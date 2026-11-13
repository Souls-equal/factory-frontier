import type { BuildingInstance } from '../buildings/BuildingSystem';
import type { Interactable, InteractionOutcome } from '../interaction/Interactable';
import type { ConstructorMachine } from './ConstructorMachine';

export class ConstructorInteractable implements Interactable {
  readonly descriptor;
  constructor(readonly machine: ConstructorMachine, building: BuildingInstance, range: number, private readonly onInspect: (machine: ConstructorMachine) => void) {
    this.descriptor = Object.freeze({ id: building.id, displayName: 'Constructor', hint: 'Inspect machine',
      position: Object.freeze({ x: building.transform.x, y: building.transform.y + 1.1, z: building.transform.z }), targetRadius: 1.35, range });
  }
  isAvailable(): boolean { return true; }
  interact(): InteractionOutcome { this.onInspect(this.machine); return { ok: true, message: 'Inspecting Constructor.' }; }
}
