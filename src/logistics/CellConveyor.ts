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

/** Aligned level/uphill belts join at the input edge. Other entries travel
 * to the receiving centre, allowing a downhill ramp wholly within that tile. */
export function cellEntryFraction(from: BuildingInstance, to: BuildingInstance, cellSize: number): number {
  const a = pathForBuilding(from, cellSize)!.direction('output'), b = pathForBuilding(to, cellSize)!.direction('input');
  return a.x === b.x && a.z === b.z && to.transform.y >= from.transform.y - epsilon ? 0 : .5;
}

/** Slope and visible entry ramps for one directional cell, in local cell space. */
export interface CellConveyorShape {
  readonly rise: number;
  readonly entries: readonly { readonly x: number; readonly z: number; readonly startHeight: number }[];
}

/** Plan rising decks on the lower tile and short entry ramps on the receiving tile.
 * Output heights are a monotone fixed point, including directed cycles. */
export function resolveCellConveyors(buildings: readonly BuildingInstance[], cellSize: number): ReadonlyMap<string, CellConveyorShape> | null {
  const cells = buildings.filter((b) => b.typeId === 'conveyor-cell');
  const next = new Map(cells.map((b) => [b.id, cells.find((other) => cellAhead(b, other, cellSize))]));
  for (const b of cells) {
    const target = next.get(b.id);
    if (target && Math.abs(target.transform.y - b.transform.y) > cellSize + 1e-7) return null;
  }
  const rise = new Map(cells.map((b) => [b.id, 0]));
  // Each dependency halves the next tile's rise. At most N propagation steps
  // plus 80 contraction steps give sub-nanometre precision for finite heights.
  for (let iteration = 0; iteration < cells.length + 80; iteration++) {
    let change = 0;
    for (const b of cells) {
      const target = next.get(b.id);
      const value = target ? Math.max(0, target.transform.y + rise.get(target.id)! * cellEntryFraction(b, target, cellSize) - b.transform.y) : 0;
      if (value > cellSize + 1e-7) return null;
      change = Math.max(change, Math.abs(value - rise.get(b.id)!)); rise.set(b.id, value);
    }
    if (change < 1e-10) break;
    if (iteration === cells.length + 79) return null;
  }
  const entries = new Map(cells.map((b) => [b.id, [] as { x: number; z: number; startHeight: number }[]]));
  for (const from of cells) {
    const to = next.get(from.id); if (!to || cellEntryFraction(from, to, cellSize) === 0) continue;
    const r = to.transform.rotation * Math.PI / 2, dx = (from.transform.x - to.transform.x) / 2, dz = (from.transform.z - to.transform.z) / 2;
    // Inverse of the renderer's quarter-turn around Y.
    const x = dx * Math.cos(r) - dz * Math.sin(r), z = dx * Math.sin(r) + dz * Math.cos(r);
    entries.get(to.id)!.push({ x: Math.abs(x) < 1e-9 ? 0 : x, z: Math.abs(z) < 1e-9 ? 0 : z,
      startHeight: from.transform.y + rise.get(from.id)! - to.transform.y });
  }
  // A sideways Miner output also enters through a tile edge, not its rear inlet.
  for (const machine of buildings.filter((b) => b.typeId === 'miner-mk1')) {
    const cell = cells.find((b) => cellTouchesMachine(b, machine, cellSize, 'source'));
    if (!cell) continue;
    const port = machinePort(machine, cellSize, 'source'), direction = pathForBuilding(cell, cellSize)!.direction('input');
    if (direction.x === port.direction.x && direction.z === port.direction.z) continue;
    const dx = -port.direction.x * cellSize / 2, dz = -port.direction.z * cellSize / 2, r = cell.transform.rotation * Math.PI / 2;
    const x = dx * Math.cos(r) - dz * Math.sin(r), z = dx * Math.sin(r) + dz * Math.cos(r);
    entries.get(cell.id)!.push({ x: Math.abs(x) < 1e-9 ? 0 : x, z: Math.abs(z) < 1e-9 ? 0 : z,
      startHeight: machine.transform.y - cell.transform.y });
  }
  return new Map(cells.map((b) => [b.id, { rise: rise.get(b.id)!, entries: entries.get(b.id)! }]));
}
