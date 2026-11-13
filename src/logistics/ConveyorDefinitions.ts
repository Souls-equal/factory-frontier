import type { BuildingInstance } from '../buildings/BuildingSystem';
import { ConveyorPath, type ConveyorShape } from './ConveyorPath';
import type { PortPose } from './Ports';
import { isLiftBuilding, liftRise } from './LiftDefinitions';
export { isLiftBuilding, liftRise } from './LiftDefinitions';

export const CONVEYOR_SHAPES: Readonly<Record<string, ConveyorShape>> = Object.freeze({
  'conveyor-cell': 'straight', 'conveyor-straight': 'straight', 'conveyor-curve': 'curve-right', 'conveyor-incline': 'incline',
});
export const isProcessorBuilding = (typeId: string): boolean => typeId === 'smelter' || typeId === 'constructor';
export const liftInputOffset = (typeId: string, cellSize: number): number => Math.max(0, -(liftRise(typeId) ?? 0)) * cellSize;
export const liftOutputOffset = (typeId: string, cellSize: number): number => Math.max(0, liftRise(typeId) ?? 0) * cellSize;
export const isDirectionalMachine = (typeId: string): boolean => isProcessorBuilding(typeId) || typeId === 'storage-container' || typeId === 'splitter' || typeId === 'merger' || isLiftBuilding(typeId);
export const RECEIVER_TYPE = 'receiving-terminal';
export const BELT_HEIGHT = .5;
export const DEFAULT_INCLINE_RISE = 1;

export function pathForBuilding(building: BuildingInstance, cellSize: number): ConveyorPath | undefined {
  const rise = liftRise(building.typeId);
  if (rise !== null) return new ConveyorPath({ shape: 'lift', x: building.transform.x,
    y: building.transform.y + BELT_HEIGHT + liftInputOffset(building.typeId, cellSize), z: building.transform.z,
    rotation: building.transform.rotation, size: 2 * cellSize, rise: rise * cellSize });
  const shape = building.typeId === 'conveyor-auto' ? (building.autoConveyor?.shape ?? 'straight') : building.typeId === 'conveyor-cell' && building.cellConveyor?.rise ? 'incline' : Object.hasOwn(CONVEYOR_SHAPES, building.typeId) ? CONVEYOR_SHAPES[building.typeId] : undefined;
  if (!shape) return undefined;
  return new ConveyorPath({ shape, x: building.transform.x, y: building.transform.y + BELT_HEIGHT + (building.typeId === 'conveyor-cell' ? building.cellConveyor?.offset ?? 0 : building.autoConveyor?.offset ?? 0),
    z: building.transform.z, rotation: building.autoConveyor?.rotation ?? building.transform.rotation, size: (building.typeId === 'conveyor-cell' ? 1 : 2) * cellSize,
    ...(building.typeId === 'conveyor-cell' ? { rise: building.cellConveyor?.rise ?? 0 } : building.autoConveyor ? { rise: building.autoConveyor.rise } : shape === 'incline' ? { rise: DEFAULT_INCLINE_RISE * cellSize } : {}) });
}
/** Both port types face the direction of item travel, aligned to the centre of a 2-cell edge. */
export function machinePort(building: BuildingInstance, cellSize: number, type: 'source' | 'receiver'): PortPose {
  const { x, y, z, rotation } = building.transform;
  const direction = new ConveyorPath({ shape: 'straight', x, y: y + BELT_HEIGHT, z, rotation, size: 2 * cellSize });
  const point = direction.point(type === 'source' ? direction.length : 0);
  return { position: { ...point, y: point.y + (type === 'source' ? liftOutputOffset(building.typeId, cellSize) : liftInputOffset(building.typeId, cellSize)) }, direction: direction.direction('input') };
}

/** Splitter outputs are front, left and right relative to its cyan rear input. */
export function splitterPort(building: BuildingInstance, cellSize: number, index: number): PortPose {
  const rotation = building.transform.rotation + [0, 1, 3][index]!;
  return machinePort({ ...building, transform: { ...building.transform, rotation } }, cellSize, 'source');
}

/** Merger inputs are rear and the two side faces, pointing inward. */
export function mergerPort(building: BuildingInstance, cellSize: number, index: number): PortPose {
  const rotation = building.transform.rotation + [0, 1, 3][index]!;
  return machinePort({ ...building, transform: { ...building.transform, rotation } }, cellSize, 'receiver');
}
