import type { BuildingInstance } from '../buildings/BuildingSystem';
import type { Interactable, InteractionOutcome } from '../interaction/Interactable';
import type { Miner } from './Miner';

/** Adapter into the shared interaction registry; no independent raycaster. */
export class MinerInteractable implements Interactable {
  readonly descriptor;
  constructor(readonly miner: Miner, building: BuildingInstance, range: number, private readonly onInspect: (miner: Miner) => void) {
    this.descriptor = Object.freeze({ id: building.id, displayName: 'Miner Mk.1', hint: 'Inspect machine',
      position: Object.freeze({ x: building.transform.x, y: building.transform.y + 1.2, z: building.transform.z }),
      targetRadius: 1.35, range });
  }
  isAvailable(): boolean { return true; }
  interact(): InteractionOutcome { this.onInspect(this.miner); return { ok: true, message: 'Inspecting Miner Mk.1.' }; }
}
