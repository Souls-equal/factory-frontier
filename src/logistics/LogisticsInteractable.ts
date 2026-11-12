import type { BuildingInstance } from '../buildings/BuildingSystem';
import type { Interactable, InteractionOutcome } from '../interaction/Interactable';

export class LogisticsInteractable implements Interactable {
  readonly descriptor;
  constructor(building: BuildingInstance, name: string, range: number, private readonly inspect: (id: string) => void) {
    this.descriptor = Object.freeze({ id: building.id, displayName: name, hint: 'Inspect logistics',
      position: Object.freeze({ x: building.transform.x, y: building.transform.y + .6, z: building.transform.z }),
      targetRadius: .8, range });
  }
  isAvailable(): boolean { return true; }
  interact(): InteractionOutcome { this.inspect(this.descriptor.id); return { ok: true, message: `Inspecting ${this.descriptor.displayName}.` }; }
}
