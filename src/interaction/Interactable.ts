/**
 * Reusable interaction contract (Phase 1).
 *
 * The interaction system knows nothing about beacons, machines or deposits; it
 * only sees `Interactable` implementations. Later phases register additional
 * implementations (resource deposits, storage, terminals) without touching the
 * raycast, the prompt or the input path.
 */

export interface InteractionPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface InteractableDescriptor {
  /** Stable logical id (used by saves and tests; never a display string). */
  readonly id: string;
  /** Human-readable name shown in the prompt. */
  readonly displayName: string;
  /** Contextual verb shown next to the interact key, e.g. "Log survey ping". */
  readonly hint: string;
  /** Anchor of the interaction volume in world space. */
  readonly position: InteractionPoint;
  /** Radius of the interaction volume (the ray tests this sphere). */
  readonly targetRadius: number;
  /** Maximum interaction distance for this object, in metres. */
  readonly range: number;
}

export interface InteractionOutcome {
  readonly ok: boolean;
  /** Player-facing feedback text. */
  readonly message: string;
}

export interface Interactable {
  readonly descriptor: InteractableDescriptor;
  /** Temporary availability (disabled, busy, out of order…). */
  isAvailable(): boolean;
  /** Execute the interaction. Called at most once per input press. */
  interact(): InteractionOutcome;
}
