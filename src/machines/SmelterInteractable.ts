import type { BuildingInstance } from '../buildings/BuildingSystem';
import type { Interactable, InteractionOutcome } from '../interaction/Interactable';
import type { Smelter } from './Smelter';

export class SmelterInteractable implements Interactable {
  readonly descriptor;
  constructor(readonly smelter: Smelter, building: BuildingInstance, range: number, private readonly onInspect: (machine: Smelter) => void) {
    this.descriptor = Object.freeze({ id: building.id, displayName: 'Smelter', hint: 'Inspect machine',
      position: Object.freeze({ x: building.transform.x, y: building.transform.y + 1.1, z: building.transform.z }), targetRadius: 1.35, range });
  }
  isAvailable(): boolean { return true; }
  interact(): InteractionOutcome { this.onInspect(this.smelter); return { ok: true, message: 'Inspecting Smelter.' }; }
}
