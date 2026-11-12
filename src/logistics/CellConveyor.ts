import type { BuildingInstance } from '../buildings/BuildingSystem';
import { machinePort, pathForBuilding } from './ConveyorDefinitions';

const epsilon = 1e-7;
/** Whether a machine's 2-cell-wide port touches a particular one-cell lane. */
export function cellTouchesMachine(cell: BuildingInstance, machine: BuildingInstance, cellSize: number, kind: 'source' | 'receiver', ignoreHeight = false): boolean {
  const path = pathForBuilding(cell, cellSize)!;
  const port = machinePort(machine, cellSize, kind);
  const d = port.direction;
  if (kind === 'receiver') {
    const out = path.direction('output');
    if (out.x !== d.x || out.z !== d.z) return false;
    const p = path.point(path.length), dx = p.x - port.position.x, dz = p.z - port.position.z;
    return Math.abs(dx * d.x + dz * d.z) < epsilon && Math.abs(dx * d.z - dz * d.x) <= cellSize / 2 + epsilon &&
      (ignoreHeight || Math.abs(p.y - port.position.y) < epsilon);
  }
  const dx = cell.transform.x - port.position.x, dz = cell.transform.z - port.position.z;
  return Math.abs(dx * d.x + dz * d.z - cellSize / 2) < epsilon &&
    Math.abs(dx * d.z - dz * d.x) <= cellSize / 2 + epsilon &&
    (ignoreHeight || Math.abs(path.point(0).y - port.position.y) < epsilon);
}

export function cellAhead(from: BuildingInstance, to: BuildingInstance, cellSize: number): boolean {
  const d = pathForBuilding(from, cellSize)!.direction('output');
  return Math.abs(to.transform.x - from.transform.x - d.x * cellSize) < epsilon &&
    Math.abs(to.transform.z - from.transform.z - d.z * cellSize) < epsilon;
}
