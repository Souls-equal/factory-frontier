import type { GameConfig } from '../core/Configuration';
import { generateDeposits, type ResourceDeposit } from '../resources/ResourceDeposit';
import { ObstacleField, type ObstacleDefinition } from './ObstacleField';
import { createRandom } from './rng';
import { TerrainHeightfield } from './terrain/TerrainHeightfield';

/**
 * Phase 1 world assembly.
 *
 * `createWorld()` is the single place where gameplay world data is produced:
 * terrain, solid obstacles and interaction anchors. It is deterministic for a
 * given configuration, contains no rendering code, and is the extension point
 * for resource deposits (Phase 2), building placement (Phase 3) and chunk
 * streaming (Phase 10).
 */

export type InteractableKind = 'survey-beacon' | 'relay-mast';

export interface InteractableDefinition {
  readonly id: string;
  readonly kind: InteractableKind;
  readonly displayName: string;
  /** Contextual verb shown in the prompt, e.g. "Log survey ping". */
  readonly hint: string;
  /** Interaction anchor in world space (eye-level centre of the volume). */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Ground height under the prop, so the renderer can place it exactly. */
  readonly baseY: number;
  /** Maximum distance from the camera at which this target is usable. */
  readonly range: number;
  /** Radius of the interaction volume used by the ray test. */
  readonly targetRadius: number;
}

export interface WorldSpawn {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
}

export interface World {
  readonly terrain: TerrainHeightfield;
  readonly obstacles: ObstacleField;
  readonly obstacleDefinitions: readonly ObstacleDefinition[];
  readonly interactables: readonly InteractableDefinition[];
  readonly deposits: readonly ResourceDeposit[];
  readonly spawn: WorldSpawn;
}

const SPAWN_X = 0;
const SPAWN_Z = 9;
const SPAWN_YAW = 0;

/** Keep the clearing around the outpost free of boulders. */
const CLEARING_RADIUS = 15;

export function createWorld(config: GameConfig): World {
  const { world: worldConfig, interaction } = config;

  const terrain = new TerrainHeightfield({
    seed: worldConfig.seed,
    sizeMeters: worldConfig.sizeMeters,
    resolution: worldConfig.resolution,
    heightScale: worldConfig.heightScale,
    spawnFlatRadius: worldConfig.spawnFlatRadius,
    rimHeight: worldConfig.rimHeight,
  });

  const interactables = createInteractables(terrain, interaction.targetRadius);
  const original = createObstacles(terrain, worldConfig, interactables);
  const deposits = generateDeposits(terrain, original.definitions, worldConfig.seed,
    { x: SPAWN_X, z: SPAWN_Z }, config.resources, config.controls.playAreaRadius);
  const obstacles = new ObstacleField([...original.definitions, ...deposits.map((deposit) => ({
    id: `${deposit.id}-collider`, kind: 'prop' as const, x: deposit.x, y: deposit.y,
    z: deposit.z, radius: deposit.radius, height: 1.5, yaw: 0, variant: 0,
  }))]);

  return {
    terrain,
    obstacles,
    obstacleDefinitions: obstacles.definitions,
    interactables,
    deposits,
    spawn: {
      x: SPAWN_X,
      y: terrain.heightAt(SPAWN_X, SPAWN_Z),
      z: SPAWN_Z,
      yaw: SPAWN_YAW,
    },
  };
}

function createInteractables(
  terrain: TerrainHeightfield,
  targetRadius: number,
): readonly InteractableDefinition[] {
  const beaconX = 0;
  const beaconZ = -3;

  return Object.freeze([
    {
      id: 'survey-beacon',
      kind: 'survey-beacon' as const,
      displayName: 'Survey Beacon',
      hint: 'Log survey ping',
      x: beaconX,
      y: terrain.heightAt(beaconX, beaconZ) + 1.5,
      z: beaconZ,
      baseY: terrain.heightAt(beaconX, beaconZ),
      range: 4.2,
      targetRadius,
    },
    {
      id: 'relay-mast',
      kind: 'relay-mast' as const,
      displayName: 'Relay Mast',
      hint: 'Cycle relay channel',
      x: 11,
      y: terrain.heightAt(11, -9) + 1.6,
      z: -9,
      baseY: terrain.heightAt(11, -9),
      range: 3.8,
      targetRadius: targetRadius * 0.85,
    },
  ]);
}

function createObstacles(
  terrain: TerrainHeightfield,
  worldConfig: GameConfig['world'],
  interactables: readonly InteractableDefinition[],
): ObstacleField {
  const random = createRandom(worldConfig.seed ^ 0x9e3779b9);
  const definitions: ObstacleDefinition[] = [];

  const half = worldConfig.sizeMeters / 2;
  const minDistance = Math.max(CLEARING_RADIUS, worldConfig.spawnFlatRadius * 1.2);
  // Stay inside the boundary ridge so boulders never hang off the terrain edge.
  const maxDistance = half * 0.62;

  const isBlocked = (x: number, z: number, radius: number): boolean => {
    if (Math.hypot(x - SPAWN_X, z - SPAWN_Z) < minDistance + radius) {
      return true;
    }
    for (const interactable of interactables) {
      if (Math.hypot(x - interactable.x, z - interactable.z) < radius + 3) {
        return true;
      }
    }
    for (const existing of definitions) {
      if (Math.hypot(x - existing.x, z - existing.z) < radius + existing.radius + 1.6) {
        return true;
      }
    }
    return false;
  };

  let attempts = 0;
  const maxAttempts = worldConfig.obstacleCount * 24;

  while (definitions.length < worldConfig.obstacleCount && attempts < maxAttempts) {
    attempts += 1;

    const angle = random.next() * Math.PI * 2;
    const distance = Math.sqrt(random.next()) * (maxDistance - minDistance) + minDistance;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;

    // A few large formations stand out; the rest are boulders.
    const isFormation = definitions.length > 0 && definitions.length % 11 === 0;
    const radius = isFormation ? random.range(3.4, 5.2) : random.range(0.7, 2.4);
    const height = isFormation ? random.range(5, 8.5) : random.range(0.8, 3.4);

    if (isBlocked(x, z, radius)) {
      continue;
    }

    definitions.push({
      id: `rock-${definitions.length.toString().padStart(2, '0')}`,
      kind: isFormation ? 'formation' : 'boulder',
      x,
      y: terrain.heightAt(x, z),
      z,
      radius,
      height,
      yaw: random.range(0, Math.PI * 2),
      variant: random.int(0, 2),
    });
  }

  // The interactable masts are solid too, otherwise the player could walk
  // through the object they are aiming at.
  for (const interactable of interactables) {
    definitions.push({
      id: `${interactable.id}-collider`,
      kind: 'prop',
      x: interactable.x,
      y: terrain.heightAt(interactable.x, interactable.z),
      z: interactable.z,
      radius: 0.55,
      height: 3.4,
      yaw: 0,
      variant: 0,
    });
  }

  return new ObstacleField(definitions);
}
