import type { BuildingInstance } from '../buildings/BuildingSystem';
import { ConveyorPath, type ConveyorShape } from './ConveyorPath';
import type { PortPose } from './Ports';

export const CONVEYOR_SHAPES: Readonly<Record<string, ConveyorShape>> = Object.freeze({
  'conveyor-cell': 'straight', 'conveyor-straight': 'straight', 'conveyor-curve': 'curve-right', 'conveyor-incline': 'incline',
});
export const RECEIVER_TYPE = 'receiving-terminal';
export const BELT_HEIGHT = .5;
export const DEFAULT_INCLINE_RISE = 1;

export function pathForBuilding(building: BuildingInstance, cellSize: number): ConveyorPath | undefined {
  const shape = building.typeId === 'conveyor-auto' ? (building.autoConveyor?.shape ?? 'straight') : CONVEYOR_SHAPES[building.typeId];
  if (!shape) return undefined;
  return new ConveyorPath({ shape, x: building.transform.x, y: building.transform.y + BELT_HEIGHT + (building.autoConveyor?.offset ?? 0),
    z: building.transform.z, rotation: building.autoConveyor?.rotation ?? building.transform.rotation, size: (building.typeId === 'conveyor-cell' ? 1 : 2) * cellSize,
    ...(building.autoConveyor ? { rise: building.autoConveyor.rise } : shape === 'incline' ? { rise: DEFAULT_INCLINE_RISE * cellSize } : {}) });
}
/** Both port types face the direction of item travel, aligned to the centre of a 2-cell edge. */
export function machinePort(building: BuildingInstance, cellSize: number, type: 'source' | 'receiver'): PortPose {
  const { x, y, z, rotation } = building.transform;
  const direction = new ConveyorPath({ shape: 'straight', x, y: y + BELT_HEIGHT, z, rotation, size: 2 * cellSize });
  return { position: direction.point(type === 'source' ? direction.length : 0), direction: direction.direction('input') };
}
