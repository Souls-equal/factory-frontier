import type { BuildingInstance } from '../buildings/BuildingSystem';
import { isLiftBuilding, isProcessorBuilding, machinePort, pathForBuilding, RECEIVER_TYPE } from './ConveyorDefinitions';
import { matchesPort } from './Ports';

/** Exact, directional port matches; no implicit height adjustment or lane merging. */
export function directLiftInput(lift: BuildingInstance, source: BuildingInstance, cellSize: number): boolean {
  if (!isLiftBuilding(lift.typeId) || !(source.typeId === 'miner-mk1' || source.typeId === 'storage-container' || isProcessorBuilding(source.typeId))) return false;
  const path = pathForBuilding(lift, cellSize)!;
  return matchesPort(machinePort(source, cellSize, 'source'), path.point(0), path.direction('input'));
}

export function directLiftOutput(lift: BuildingInstance, receiver: BuildingInstance, cellSize: number): boolean {
  if (!isLiftBuilding(lift.typeId) || !(receiver.typeId === RECEIVER_TYPE || receiver.typeId === 'storage-container' || isProcessorBuilding(receiver.typeId))) return false;
  const path = pathForBuilding(lift, cellSize)!;
  // Receiving terminals accept any face; use the lift's direction for their port.
  const target = receiver.typeId === RECEIVER_TYPE ? { ...receiver, transform: { ...receiver.transform, rotation: lift.transform.rotation } } : receiver;
  return matchesPort(machinePort(target, cellSize, 'receiver'), path.point(path.length), path.direction('output'));
}
