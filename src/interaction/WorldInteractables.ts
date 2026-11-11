import type { InteractableDefinition } from '../world/World';
import type { Interactable, InteractionOutcome } from './Interactable';

/**
 * Interactables for the Phase 1 exploration area.
 *
 * These are environment props, not gameplay systems: a survey beacon that logs
 * pings and a relay mast that cycles a channel. They exist to exercise the
 * interaction contract end to end (raycast → target → prompt → execution) until
 * Phase 2+ registers real objects such as deposits and machines.
 */

export interface SurveyBeaconState {
  readonly pings: number;
  readonly lastMessage: string;
}

export class SurveyBeacon implements Interactable {
  readonly descriptor;

  private pings = 0;
  private lastMessage = '';

  constructor(definition: InteractableDefinition) {
    this.descriptor = Object.freeze({
      id: definition.id,
      displayName: definition.displayName,
      hint: definition.hint,
      position: Object.freeze({ x: definition.x, y: definition.y, z: definition.z }),
      targetRadius: definition.targetRadius,
      range: definition.range,
    });
  }

  isAvailable(): boolean {
    return true;
  }

  interact(): InteractionOutcome {
    this.pings += 1;
    this.lastMessage = `Survey ping #${this.pings} logged.`;
    return { ok: true, message: this.lastMessage };
  }

  get state(): SurveyBeaconState {
    return { pings: this.pings, lastMessage: this.lastMessage };
  }
}

export class RelayMast implements Interactable {
  readonly descriptor;

  private channel = 1;
  private lastMessage = '';

  constructor(definition: InteractableDefinition) {
    this.descriptor = Object.freeze({
      id: definition.id,
      displayName: definition.displayName,
      hint: definition.hint,
      position: Object.freeze({ x: definition.x, y: definition.y, z: definition.z }),
      targetRadius: definition.targetRadius,
      range: definition.range,
    });
  }

  isAvailable(): boolean {
    return true;
  }

  interact(): InteractionOutcome {
    this.channel = (this.channel % 4) + 1;
    this.lastMessage = `Relay channel ${this.channel} engaged.`;
    return { ok: true, message: this.lastMessage };
  }

  get activeChannel(): number {
    return this.channel;
  }
}

/** Build the interactable instances for a world's interactable definitions. */
export function createWorldInteractables(
  definitions: readonly InteractableDefinition[],
): readonly Interactable[] {
  return definitions.map((definition) =>
    definition.kind === 'relay-mast' ? new RelayMast(definition) : new SurveyBeacon(definition),
  );
}
