import type { SimulationSystem } from '../core/Game';
import type { CameraView } from '../engine/types';
import type { Interactable, InteractionOutcome, InteractionPoint } from './Interactable';
import { forwardVector, raySphereIntersection } from './raycast';

/**
 * Central interaction system.
 *
 * Responsibilities:
 * - keep the registry of interactables,
 * - cast the camera ray once per fixed simulation step and select the closest
 *   valid target within range,
 * - execute exactly one interaction per input press.
 *
 * It owns no DOM and no Three.js: the UI polls `target`/`lastOutcome`, and the
 * renderer polls `targetId` for the highlight. Registered visuals that are not
 * interactables are never considered, so decorative meshes cannot steal aim.
 */

export interface InteractionTarget {
  readonly id: string;
  readonly displayName: string;
  readonly hint: string;
  /** Distance from the camera to the interaction volume, in metres. */
  readonly distance: number;
  readonly position: InteractionPoint;
}

export interface InteractionSystemOptions {
  /** Global reach in metres. Per-object ranges may only shorten this. */
  readonly range: number;
  /** Supplies the authoritative camera pose (player view). */
  readonly viewProvider: () => CameraView;
}

export class InteractionSystem implements SimulationSystem {
  readonly id = 'interaction';

  private readonly range: number;
  private readonly viewProvider: () => CameraView;
  private readonly interactables = new Map<string, Interactable>();

  private currentTarget: InteractionTarget | null = null;
  private pendingRequest = false;
  private lastOutcomeValue: InteractionOutcome | null = null;
  private outcomeCount = 0;
  private interactionCount = 0;

  constructor(options: InteractionSystemOptions) {
    if (!Number.isFinite(options.range) || options.range <= 0) {
      throw new RangeError(`Interaction range must be positive (received ${options.range}).`);
    }
    this.range = options.range;
    this.viewProvider = options.viewProvider;
  }

  /** Register an interactable. Returns an idempotent unregister function. */
  register(interactable: Interactable): () => void {
    const id = interactable.descriptor.id;
    if (id.trim() === '') {
      throw new Error('Interactable id must not be empty.');
    }
    if (this.interactables.has(id)) {
      throw new Error(`Interactable "${id}" is already registered.`);
    }
    this.interactables.set(id, interactable);
    return () => {
      this.interactables.delete(id);
    };
  }

  get size(): number {
    return this.interactables.size;
  }

  get target(): InteractionTarget | null {
    return this.currentTarget;
  }

  get targetId(): string | null {
    return this.currentTarget?.id ?? null;
  }

  get lastOutcome(): InteractionOutcome | null {
    return this.lastOutcomeValue;
  }

  /** Increments on every executed interaction; lets the UI detect new feedback. */
  get outcomeSequence(): number {
    return this.outcomeCount;
  }

  get executions(): number {
    return this.interactionCount;
  }

  /**
   * Queue an interaction for the next fixed step.
   *
   * The request is edge-triggered by the input layer and consumed exactly once
   * here, so holding the key cannot repeat the interaction.
   */
  requestInteraction(): void {
    this.pendingRequest = true;
  }

  get hasPendingRequest(): boolean {
    return this.pendingRequest;
  }

  fixedUpdate(_fixedDeltaMs: number): void {
    this.refreshTarget();

    if (!this.pendingRequest) {
      return;
    }
    this.pendingRequest = false;

    const target = this.currentTarget;
    if (target === null) {
      return;
    }

    const interactable = this.interactables.get(target.id);
    if (interactable === undefined || !interactable.isAvailable()) {
      return;
    }

    this.lastOutcomeValue = interactable.interact();
    this.outcomeCount += 1;
    this.interactionCount += 1;

    // Availability or position may have changed as a side effect.
    this.refreshTarget();
  }

  /** Recompute the closest valid target from the current camera pose. */
  refreshTarget(): InteractionTarget | null {
    const view = this.viewProvider();
    const direction = forwardVector(view.yaw, view.pitch);
    const ray = { origin: view.position, direction };

    let best: InteractionTarget | null = null;
    let bestDistance = Infinity;

    for (const interactable of this.interactables.values()) {
      if (!interactable.isAvailable()) {
        continue;
      }

      const descriptor = interactable.descriptor;
      const maxDistance = Math.min(this.range, descriptor.range);
      if (maxDistance <= 0) {
        continue;
      }

      const hit = raySphereIntersection(ray, descriptor.position, descriptor.targetRadius);
      if (hit === null || hit > maxDistance) {
        continue;
      }
      if (hit < bestDistance) {
        bestDistance = hit;
        best = {
          id: descriptor.id,
          displayName: descriptor.displayName,
          hint: descriptor.hint,
          distance: hit,
          position: descriptor.position,
        };
      }
    }

    this.currentTarget = best;
    return best;
  }

  /** Test/dev helper: clear the highlighted target without stopping the system. */
  clearTarget(): void {
    this.currentTarget = null;
  }
}
