import type { BuildingInstance } from '../buildings/BuildingSystem';
import { isLiftBuilding, isProcessorBuilding, machinePort, pathForBuilding, splitterPort, mergerPort, RECEIVER_TYPE } from './ConveyorDefinitions';
import { matchesPort } from './Ports';

/** Exact, directional port matches; no implicit height adjustment or lane merging. */
export function directLiftLink(from: BuildingInstance, to: BuildingInstance, cellSize: number): boolean {
  if (from.id === to.id || !isLiftBuilding(from.typeId) || !isLiftBuilding(to.typeId)) return false;
  return pathForBuilding(from, cellSize)!.compatible(pathForBuilding(to, cellSize)!);
}

export function directLiftSplitterOutput(lift: BuildingInstance, splitter: BuildingInstance, cellSize: number, index: number): boolean {
  if (!isLiftBuilding(lift.typeId) || splitter.typeId !== 'splitter' || !Number.isInteger(index) || index < 0 || index > 2) return false;
  const path = pathForBuilding(lift, cellSize)!;
  return matchesPort(splitterPort(splitter, cellSize, index), path.point(0), path.direction('input'));
}

export function directLiftMergerInput(lift: BuildingInstance, merger: BuildingInstance, cellSize: number, index: number): boolean {
  if (!isLiftBuilding(lift.typeId) || merger.typeId !== 'merger' || !Number.isInteger(index) || index < 0 || index > 2) return false;
  const path = pathForBuilding(lift, cellSize)!;
  return matchesPort(mergerPort(merger, cellSize, index), path.point(path.length), path.direction('output'));
}

export function directLiftInput(lift: BuildingInstance, source: BuildingInstance, cellSize: number): boolean {
  if (source.typeId === 'splitter') return [0, 1, 2].some((index) => directLiftSplitterOutput(lift, source, cellSize, index));
  if (!isLiftBuilding(lift.typeId) || !(source.typeId === 'miner-mk1' || source.typeId === 'storage-container' || source.typeId === 'merger' || isProcessorBuilding(source.typeId))) return false;
  const path = pathForBuilding(lift, cellSize)!;
  return matchesPort(machinePort(source, cellSize, 'source'), path.point(0), path.direction('input'));
}

export function directLiftOutput(lift: BuildingInstance, receiver: BuildingInstance, cellSize: number): boolean {
  if (receiver.typeId === 'merger') return [0, 1, 2].some((index) => directLiftMergerInput(lift, receiver, cellSize, index));
  if (!isLiftBuilding(lift.typeId) || !(receiver.typeId === RECEIVER_TYPE || receiver.typeId === 'storage-container' || receiver.typeId === 'splitter' || receiver.typeId === 'biomass-generator' || isProcessorBuilding(receiver.typeId))) return false;
  const path = pathForBuilding(lift, cellSize)!;
  // Receiving terminals accept any face; use the lift's direction for their port.
  const target = receiver.typeId === RECEIVER_TYPE ? { ...receiver, transform: { ...receiver.transform, rotation: lift.transform.rotation } } : receiver;
  return matchesPort(machinePort(target, cellSize, 'receiver'), path.point(path.length), path.direction('output'));
}
