import type { ControlsConfig, PlayerConfig } from '../core/Configuration';
import type { CameraView } from '../engine/types';
import type { CollisionQuery } from '../world/ObstacleField';
import type { TerrainQuery } from '../world/terrain/TerrainHeightfield';

/**
 * First-person player simulation.
 *
 * The controller is deliberately independent from Three.js: it owns plain
 * position/orientation numbers and produces a `CameraView` that the rendering
 * engine applies. Physics reads the terrain and obstacle contracts (also
 * Three-free), so the whole simulation runs and is tested in Node.
 *
 * Stage split (see Technical Architecture Appendix B.1/C.2):
 * - `step()` is the authoritative physics step and is driven by the fixed
 *   simulation clock (50 ms). Gravity, jumping, terrain following and collision
 *   never depend on the render frame rate.
 * - `applyLook()` consumes mouse deltas at display rate so looking stays smooth.
 * - `viewAt(alpha)` interpolates between the last two fixed steps for rendering;
 *   it never mutates simulation state.
 */

export interface PlayerInput {
  /** Strafe axis: -1 left, +1 right. */
  readonly moveX: number;
  /** Forward axis: -1 backward, +1 forward. */
  readonly moveZ: number;
  readonly sprint: boolean;
  /** Horizontal mouse movement in pixels since the previous update. */
  readonly lookDeltaX: number;
  /** Vertical mouse movement in pixels since the previous update. */
  readonly lookDeltaY: number;
  /** Edge-triggered jump request (held input must not repeat jumps). */
  readonly jump?: boolean;
}

export interface PlayerSpawn {
  readonly x: number;
  readonly z: number;
  readonly y?: number;
  readonly yaw?: number;
  readonly pitch?: number;
}

export const DEFAULT_PLAYER_SPAWN: Readonly<Required<PlayerSpawn>> = Object.freeze({
  x: 0,
  y: 0,
  z: 18,
  yaw: 0,
  pitch: 0,
});

/** Largest delta the controller integrates in one call (seconds). */
const MAX_UPDATE_SECONDS = 0.25;
/** Iterative contact projections before conservatively stopping in a tight corner. */
const MAX_CONTACT_PROJECTION_PASSES = 12;
const CONTACT_VELOCITY_EPSILON = 1e-9;

/** A flat, unbounded ground used when no terrain is supplied (tests/tools). */
export const FLAT_TERRAIN: TerrainQuery = Object.freeze({
  bounds: Object.freeze({ minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity }),
  size: Infinity,
  resolution: 0,
  cellSize: 1,
  heightAt: (): number => 0,
  normalAt: () => ({ x: 0, y: 1, z: 0 }),
  slopeAt: (): number => 0,
  contains: (): boolean => true,
  clampXZ: (x: number, z: number) => ({ x, z }),
});

/** No collisions, used when no obstacle field is supplied. */
export const NO_OBSTACLES: CollisionQuery = Object.freeze({
  moveCircle: (x: number, z: number, dx: number, dz: number) =>
    ({ x: x + dx, z: z + dz, collided: false, normals: [], blocked: false }),
});

export interface PlayerControllerOptions {
  readonly controls: ControlsConfig;
  readonly player?: PlayerConfig;
  readonly terrain?: TerrainQuery;
  readonly obstacles?: CollisionQuery;
  readonly spawn?: PlayerSpawn;
}

const DEFAULT_PLAYER_PHYSICS: PlayerConfig = Object.freeze({
  gravity: 24,
  jumpSpeed: 7.2,
  radius: 0.4,
  height: 1.8,
  maxWalkableSlope: 0.73,
  groundSnapDistance: 0.45,
  maxStepHeight: 0.6,
  airControl: 0.35,
  slideAcceleration: 11,
});

export class PlayerController {
  private readonly controls: ControlsConfig;
  private readonly physics: PlayerConfig;
  private readonly terrain: TerrainQuery;
  private readonly obstacles: CollisionQuery;
  private readonly spawn: Required<PlayerSpawn>;

  // Authoritative simulation state (feet position).
  private x: number;
  private y: number;
  private z: number;
  private yaw: number;
  private pitch: number;
  private velocityX = 0;
  private velocityY = 0;
  private velocityZ = 0;
  private grounded: boolean;
  private jumpHeld = false;

  // Previous fixed-step pose, used only for render interpolation.
  private previousX: number;
  private previousY: number;
  private previousZ: number;

  constructor(options: PlayerControllerOptions) {
    this.controls = options.controls;
    this.physics = options.player ?? DEFAULT_PLAYER_PHYSICS;
    this.terrain = options.terrain ?? FLAT_TERRAIN;
    this.obstacles = options.obstacles ?? NO_OBSTACLES;

    const spawnX = options.spawn?.x ?? DEFAULT_PLAYER_SPAWN.x;
    const spawnZ = options.spawn?.z ?? DEFAULT_PLAYER_SPAWN.z;
    const spawn: Required<PlayerSpawn> = {
      x: spawnX,
      z: spawnZ,
      // An explicit spawn height wins; otherwise the player starts on the terrain.
      y: options.spawn?.y ?? this.terrain.heightAt(spawnX, spawnZ),
      yaw: options.spawn?.yaw ?? DEFAULT_PLAYER_SPAWN.yaw,
      pitch: options.spawn?.pitch ?? DEFAULT_PLAYER_SPAWN.pitch,
    };

    if (![spawn.x, spawn.y, spawn.z, spawn.yaw, spawn.pitch].every((value) => Number.isFinite(value))) {
      throw new RangeError('Player spawn contains non-finite values.');
    }

    this.spawn = Object.freeze(spawn);
    this.x = spawn.x;
    this.y = spawn.y;
    this.z = spawn.z;
    this.yaw = normalizeRadians(spawn.yaw);
    this.pitch = clamp(spawn.pitch, -this.controls.pitchLimit, this.controls.pitchLimit);
    this.grounded = this.y <= this.terrain.heightAt(this.x, this.z) + 1e-3;

    this.previousX = this.x;
    this.previousY = this.y;
    this.previousZ = this.z;
  }

  /**
   * Convenience entry point: apply look, then advance physics.
   * Used by tests and tools; `main.ts` drives `applyLook()` and `step()`
   * separately so look runs per frame and physics stays on the fixed clock.
   */
  update(frameDeltaSeconds: number, input: PlayerInput): void {
    this.applyLook(input);
    this.step(frameDeltaSeconds, input);
  }

  /** Apply mouse look. Safe to call at display rate; does not advance physics. */
  applyLook(input: PlayerInput): void {
    const deltaX = Number.isFinite(input.lookDeltaX) ? input.lookDeltaX : 0;
    const deltaY = Number.isFinite(input.lookDeltaY) ? input.lookDeltaY : 0;

    this.yaw = normalizeRadians(this.yaw - deltaX * this.controls.lookSensitivity);
    this.pitch = clamp(
      this.pitch - deltaY * this.controls.lookSensitivity,
      -this.controls.pitchLimit,
      this.controls.pitchLimit,
    );
  }

  /**
   * Deterministic physics step.
   *
   * Order: horizontal acceleration → jump → gravity → horizontal move with
   * slope blocking and obstacle resolution → vertical integration and ground
   * resolution → steep-slope sliding.
   */
  step(frameDeltaSeconds: number, input: PlayerInput): void {
    if (!Number.isFinite(frameDeltaSeconds) || frameDeltaSeconds <= 0) {
      return;
    }
    const dt = Math.min(frameDeltaSeconds, MAX_UPDATE_SECONDS);

    this.previousX = this.x;
    this.previousY = this.y;
    this.previousZ = this.z;

    const moveX = clampAxis(input.moveX);
    const moveZ = clampAxis(input.moveZ);
    const sprint = input.sprint === true;

    let directionX = 0;
    let directionZ = 0;

    if (moveX !== 0 || moveZ !== 0) {
      const forwardX = -Math.sin(this.yaw);
      const forwardZ = -Math.cos(this.yaw);
      const rightX = Math.cos(this.yaw);
      const rightZ = -Math.sin(this.yaw);

      directionX = forwardX * moveZ + rightX * moveX;
      directionZ = forwardZ * moveZ + rightZ * moveX;

      const length = Math.hypot(directionX, directionZ);
      if (length > 1) {
        directionX /= length;
        directionZ /= length;
      }
    }

    const speed = this.controls.moveSpeed * (sprint ? this.controls.sprintMultiplier : 1);
    const maxVelocityChange =
      this.controls.acceleration * (this.grounded ? 1 : this.physics.airControl) * dt;

    // Ground steeper than the walkable limit has no foothold: standing still
    // must not brake the player, otherwise sliding would be cancelled out.
    const steepGround =
      this.grounded && this.terrain.slopeAt(this.x, this.z) > this.physics.maxWalkableSlope;
    const wantsToMove = moveX !== 0 || moveZ !== 0;

    if (steepGround && !wantsToMove) {
      const drag = Math.max(0, 1 - 1.5 * dt);
      this.velocityX *= drag;
      this.velocityZ *= drag;
    } else {
      this.velocityX = moveTowards(this.velocityX, directionX * speed, maxVelocityChange);
      this.velocityZ = moveTowards(this.velocityZ, directionZ * speed, maxVelocityChange);
    }

    // Jump is edge-triggered: holding the key must not re-trigger on landing.
    const jumpRequested = input.jump === true;
    if (jumpRequested && !this.jumpHeld && this.grounded) {
      this.velocityY = this.physics.jumpSpeed;
      this.grounded = false;
    }
    this.jumpHeld = jumpRequested;

    this.velocityY -= this.physics.gravity * dt;

    // --- horizontal movement -------------------------------------------------
    const startX = this.x;
    const startZ = this.z;
    let nextX = this.x + this.velocityX * dt;
    let nextZ = this.z + this.velocityZ * dt;

    const desiredX = nextX;
    const desiredZ = nextZ;

    const clamped = this.terrain.clampXZ(nextX, nextZ);
    const inset = this.insetBounds(clamped.x, clamped.z);
    nextX = inset.x;
    nextZ = inset.z;

    // Kill the outward velocity component when a boundary stopped the player,
    // so they do not keep pressing into the edge.
    if (nextX < desiredX - 1e-9) {
      this.velocityX = Math.min(this.velocityX, 0);
    } else if (nextX > desiredX + 1e-9) {
      this.velocityX = Math.max(this.velocityX, 0);
    }
    if (nextZ < desiredZ - 1e-9) {
      this.velocityZ = Math.min(this.velocityZ, 0);
    } else if (nextZ > desiredZ + 1e-9) {
      this.velocityZ = Math.max(this.velocityZ, 0);
    }

    const circularRadius = this.controls.playAreaRadius;
    if (Number.isFinite(circularRadius) && Math.hypot(nextX, nextZ) >= circularRadius - 1e-6) {
      const normalX = nextX / circularRadius;
      const normalZ = nextZ / circularRadius;
      const outward = this.velocityX * normalX + this.velocityZ * normalZ;
      if (outward > 0) {
        this.velocityX -= outward * normalX;
        this.velocityZ -= outward * normalZ;
      }
    }

    // Refuse to climb ground steeper than the walkable limit. The check uses
    // the slope of the actual travel segment, so it also blocks a single
    // unrealistically tall step.
    const travelDistance = Math.hypot(nextX - startX, nextZ - startZ);
    if (this.grounded && travelDistance > 1e-4) {
      const rise = this.terrain.heightAt(nextX, nextZ) - this.y;
      const segmentSlope = rise / travelDistance;
      const maxTangent = Math.tan(this.physics.maxWalkableSlope);
      const climbsTooSteeply = rise > 0.02 && segmentSlope > maxTangent;
      const climbsTooHigh = rise > this.physics.maxStepHeight && segmentSlope > maxTangent * 0.5;

      if (climbsTooSteeply || climbsTooHigh) {
        nextX = startX;
        nextZ = startZ;
        this.velocityX = 0;
        this.velocityZ = 0;
      }
    }

    const resolved = this.obstacles.moveCircle(
      startX, startZ, nextX - startX, nextZ - startZ,
      this.physics.radius, this.y, this.y + this.physics.height,
    );

    // Project the physical velocity onto the feasible contact directions.
    // Never derive it from position correction: depenetration is not momentum.
    if (resolved.blocked) {
      this.velocityX = 0;
      this.velocityZ = 0;
    } else {
      // Sequential projections handle corners. Recheck earlier normals because
      // projection onto a later, non-orthogonal contact may violate them.
      for (let pass = 0; pass < MAX_CONTACT_PROJECTION_PASSES; pass += 1) {
        let changed = false;
        for (const normal of resolved.normals) {
          const inward = this.velocityX * normal.x + this.velocityZ * normal.z;
          if (inward < -CONTACT_VELOCITY_EPSILON) {
            this.velocityX -= inward * normal.x;
            this.velocityZ -= inward * normal.z;
            changed = true;
          }
        }
        if (!changed) break;
      }
      if (resolved.normals.some((normal) =>
        this.velocityX * normal.x + this.velocityZ * normal.z < -CONTACT_VELOCITY_EPSILON)) {
        // Stop rather than allow an unresolved multi-contact constraint to
        // produce persistent inward motion on the next step.
        this.velocityX = 0;
        this.velocityZ = 0;
      }
    }

    this.x = resolved.x;
    this.z = resolved.z;

    // --- vertical integration ------------------------------------------------
    this.y += this.velocityY * dt;
    const ground = this.terrain.heightAt(this.x, this.z);

    if (this.y < ground) {
      // Never leave the collision surface.
      this.y = ground;
      this.velocityY = 0;
      this.grounded = true;
    } else if (this.velocityY > 0) {
      this.grounded = false;
    } else if (this.y - ground <= this.physics.groundSnapDistance) {
      // Walking downhill / standing still: keep contact with the surface.
      this.y = ground;
      this.velocityY = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    // --- steep slope sliding -------------------------------------------------
    if (this.grounded) {
      const slope = this.terrain.slopeAt(this.x, this.z);
      if (slope > this.physics.maxWalkableSlope) {
        const normal = this.terrain.normalAt(this.x, this.z);
        const length = Math.hypot(normal.x, normal.z);
        if (length > 1e-4 && this.physics.slideAcceleration > 0) {
          // The horizontal part of the surface normal points downhill.
          const slide = this.physics.slideAcceleration * dt;
          this.velocityX += (normal.x / length) * slide;
          this.velocityZ += (normal.z / length) * slide;
        }
      }
    }
  }

  /** Reset to the spawn pose and remove all momentum. */
  reset(): void {
    this.x = this.spawn.x;
    this.y = this.spawn.y;
    this.z = this.spawn.z;
    this.yaw = normalizeRadians(this.spawn.yaw);
    this.pitch = clamp(this.spawn.pitch, -this.controls.pitchLimit, this.controls.pitchLimit);
    this.velocityX = 0;
    this.velocityY = 0;
    this.velocityZ = 0;
    this.grounded = this.y <= this.terrain.heightAt(this.x, this.z) + 1e-3;
    this.jumpHeld = false;
    this.previousX = this.x;
    this.previousY = this.y;
    this.previousZ = this.z;
  }

  /** Authoritative camera pose (no interpolation). */
  get view(): CameraView {
    return this.viewAt(1);
  }

  /**
   * Camera pose interpolated between the previous and current fixed step.
   * `alpha` comes from `GameClock.alpha`; simulation state is untouched.
   */
  viewAt(alpha: number): CameraView {
    const t = Number.isFinite(alpha) ? clamp(alpha, 0, 1) : 1;
    const x = this.previousX + (this.x - this.previousX) * t;
    const y = this.previousY + (this.y - this.previousY) * t;
    const z = this.previousZ + (this.z - this.previousZ) * t;

    return {
      position: { x, y: y + this.controls.eyeHeight, z },
      yaw: this.yaw,
      pitch: this.pitch,
    };
  }

  /** Feet position (authoritative). */
  get position(): { readonly x: number; readonly y: number; readonly z: number } {
    return { x: this.x, y: this.y, z: this.z };
  }

  get isGrounded(): boolean {
    return this.grounded;
  }

  get verticalSpeed(): number {
    return this.velocityY;
  }

  /** Current horizontal speed in metres per second (for UI/diagnostics). */
  get horizontalSpeed(): number {
    return Math.hypot(this.velocityX, this.velocityZ);
  }

  private insetBounds(x: number, z: number): { readonly x: number; readonly z: number } {
    const radius = this.physics.radius;
    const bounds = this.terrain.bounds;

    let resultX = x;
    let resultZ = z;

    if (Number.isFinite(bounds.minX) && Number.isFinite(bounds.maxX)) {
      resultX = Math.min(Math.max(resultX, bounds.minX + radius), bounds.maxX - radius);
    }
    if (Number.isFinite(bounds.minZ) && Number.isFinite(bounds.maxZ)) {
      resultZ = Math.min(Math.max(resultZ, bounds.minZ + radius), bounds.maxZ - radius);
    }

    // Redundant circular safety bound from the foundation: terrain bounds and
    // collision own movement now, but this guarantees the player stays in a
    // bounded region even if a world is misconfigured.
    const distance = Math.hypot(resultX, resultZ);
    const maxRadius = this.controls.playAreaRadius;
    if (Number.isFinite(maxRadius) && distance > maxRadius && distance > 0) {
      const scale = maxRadius / distance;
      resultX *= scale;
      resultZ *= scale;
    }

    return { x: resultX, z: resultZ };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampAxis(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return clamp(value, -1, 1);
}

function normalizeRadians(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function moveTowards(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) {
    return target;
  }
  return current + Math.sign(target - current) * maxDelta;
}
