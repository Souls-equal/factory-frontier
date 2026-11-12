import type { BuildingInstance } from '../buildings/BuildingSystem';
import type { BuildingTransform } from '../buildings/Transform';
import { BELT_HEIGHT, machinePort, pathForBuilding, RECEIVER_TYPE } from './ConveyorDefinitions';
import type { PortPose } from './Ports';

/** Derive the base height from horizontally aligned, direction-compatible adjacent ports. */
export function connectedHeight(typeId: string, transform: BuildingTransform, existing: readonly BuildingInstance[], cellSize: number): number | null | 'conflict' {
  const candidate: BuildingInstance = { id: '__preview__', typeId, transform: { ...transform, y: 0 } };
  const path = pathForBuilding(candidate, cellSize);
  const input = path ? { position: path.point(0), direction: path.direction('input') } : typeId === RECEIVER_TYPE ? machinePort(candidate, cellSize, 'receiver') : undefined;
  const output = path ? { position: path.point(path.length), direction: path.direction('output') } : undefined;
  const matches: number[] = [];
  function match(candidatePort: PortPose | undefined, other: PortPose): void {
    if (!candidatePort || Math.hypot(candidatePort.position.x - other.position.x, candidatePort.position.z - other.position.z) > 1e-7 ||
      candidatePort.direction.x !== other.direction.x || candidatePort.direction.z !== other.direction.z) return;
    matches.push(other.position.y - candidatePort.position.y);
  }
  for (const building of existing) {
    const other = pathForBuilding(building, cellSize);
    if (other) {
      match(input, { position: other.point(other.length), direction: other.direction('output') });
      match(output, { position: other.point(0), direction: other.direction('input') });
    } else if (building.typeId === 'miner-mk1') match(input, machinePort(building, cellSize, 'source'));
    else if (building.typeId === RECEIVER_TYPE) match(output, machinePort(building, cellSize, 'receiver'));
  }
  if (!matches.length) return null;
  return matches.some((height) => Math.abs(height - matches[0]!) > 1e-7) ? 'conflict' : matches[0]!;
}

export { BELT_HEIGHT };

/** Validate touching ports and reject cycles the linear transport model cannot route. */
export function connectionStatus(typeId: string, transform: BuildingTransform, existing: readonly BuildingInstance[], cellSize: number): 'connected' | 'disconnected' | 'incompatible' {
  const candidate: BuildingInstance = { id: '__preview__', typeId, transform };
  const path = pathForBuilding(candidate, cellSize);
  const input = path ? { position: path.point(0), direction: path.direction('input') } : typeId === RECEIVER_TYPE ? machinePort(candidate, cellSize, 'receiver') : undefined;
  const output = path ? { position: path.point(path.length), direction: path.direction('output') } : undefined;
  let connected = false, incompatible = false;
  function touch(a: PortPose | undefined, b: PortPose | undefined, allowed: boolean): void {
    if (!a || !b || Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) > 1e-7) return;
    if (allowed && Math.abs(a.position.y - b.position.y) <= 1e-7 && a.direction.x === b.direction.x && a.direction.z === b.direction.z) connected = true;
    else incompatible = true;
  }
  for (const building of existing) {
    const other = pathForBuilding(building, cellSize);
    let otherInput: PortPose | undefined, otherOutput: PortPose | undefined;
    if (other) {
      otherInput = { position: other.point(0), direction: other.direction('input') };
      otherOutput = { position: other.point(other.length), direction: other.direction('output') };
    } else if (building.typeId === 'miner-mk1') otherOutput = machinePort(building, cellSize, 'source');
    else if (building.typeId === RECEIVER_TYPE) otherInput = machinePort(building, cellSize, 'receiver');
    touch(input, otherOutput, true); touch(output, otherInput, true);
    touch(input, otherInput, false); touch(output, otherOutput, false);
  }
  if (path && !incompatible) {
    const paths = existing.map((building) => pathForBuilding(building, cellSize)).filter((p) => p !== undefined);
    const predecessor = paths.find((other) => other.compatible(path));
    let cursor = paths.find((other) => path.compatible(other));
    const visited = new Set<typeof path>();
    while (cursor && !visited.has(cursor)) {
      if (cursor === predecessor) return 'incompatible';
      visited.add(cursor);
      const current = cursor;
      cursor = paths.find((other) => other !== current && current.compatible(other));
    }
  }
  return incompatible ? 'incompatible' : connected ? 'connected' : 'disconnected';
}
