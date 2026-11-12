import type { BuildingInstance } from '../buildings/BuildingSystem';
import { machinePort } from './ConveyorDefinitions';
import type { ConveyorShape } from './ConveyorPath';

/** Plain data used by simulation, preview and renderer. */
export interface AutoConveyorShape { readonly shape: ConveyorShape; readonly rotation: number; readonly rise: number; readonly offset: number }
export type AutoPlan = ReadonlyMap<string, AutoConveyorShape>;
const directions = [{ x: 0, z: -1 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 0 }] as const;
const epsilon = 1e-7;

/** Resolve linear, unambiguous neighbouring conveyor tiles. No gameplay mutation. */
export function resolveAutoConveyors(buildings: readonly BuildingInstance[], cellSize: number): AutoPlan | null {
  const belts = buildings.filter((b) => b.typeId === 'conveyor-auto');
  const nodes = [...belts, ...buildings.filter((b) => b.typeId === 'miner-mk1' || b.typeId === 'receiving-terminal')];
  const neighbors = new Map(nodes.map((b) => [b.id, [] as BuildingInstance[]]));
  const horizontalNeighbor = (a: BuildingInstance, b: BuildingInstance): boolean => {
    const dx = b.transform.x - a.transform.x, dz = b.transform.z - a.transform.z;
    return (Math.abs(Math.abs(dx) - 2 * cellSize) < epsilon && Math.abs(dz) < epsilon) ||
      (Math.abs(Math.abs(dz) - 2 * cellSize) < epsilon && Math.abs(dx) < epsilon);
  };
  for (const belt of belts) for (const other of nodes) {
    if (belt.id === other.id || (other.typeId === 'conveyor-auto' && other.id < belt.id) || !horizontalNeighbor(belt, other)) continue;
    if (other.typeId !== 'conveyor-auto') {
      const port = machinePort(other, cellSize, other.typeId === 'miner-mk1' ? 'source' : 'receiver');
      const sign = other.typeId === 'miner-mk1' ? 1 : -1;
      if (Math.hypot(belt.transform.x - (other.transform.x + sign * port.direction.x * 2 * cellSize),
        belt.transform.z - (other.transform.z + sign * port.direction.z * 2 * cellSize)) > epsilon) continue;
      if (belt.transform.y > other.transform.y + epsilon) return null;
      if (other.typeId === 'miner-mk1' && Math.abs(belt.transform.y - other.transform.y) > epsilon) return null;
    }
    if (Math.abs(belt.transform.y - other.transform.y) > cellSize + epsilon) return null;
    neighbors.get(belt.id)!.push(other); neighbors.get(other.id)!.push(belt);
  }
  if (nodes.some((n) => neighbors.get(n.id)!.length > (n.typeId === 'conveyor-auto' ? 2 : 1))) return null;
  const plan = new Map<string, AutoConveyorShape>(), visited = new Set<string>();
  for (const first of belts) {
    if (visited.has(first.id)) continue;
    const component: BuildingInstance[] = [], queue = [first]; visited.add(first.id);
    while (queue.length) {
      const node = queue.shift()!; component.push(node);
      for (const neighbor of neighbors.get(node.id)!) if (!visited.has(neighbor.id)) { visited.add(neighbor.id); queue.push(neighbor); }
    }
    if (component.filter((n) => n.typeId === 'miner-mk1').length > 1 || component.filter((n) => n.typeId === 'receiving-terminal').length > 1) return null;
    const ends = component.filter((n) => neighbors.get(n.id)!.length < 2);
    if (component.length > 1 && ends.length !== 2) return null;
    const source = component.find((n) => n.typeId === 'miner-mk1');
    const sink = component.find((n) => n.typeId === 'receiving-terminal');
    let start = source ?? (sink ? ends.find((n) => n !== sink) : undefined);
    if (!start && component.length > 1) {
      // Prefer an already resolved end whose outlet enters the line. This keeps
      // the direction stable while extending a source-less route at either end.
      start = ends.find((n) => {
        if (!n.autoConveyor) return false;
        const next = neighbors.get(n.id)![0];
        const { rotation, shape } = n.autoConveyor;
        const out = shape === 'curve-right' ? (rotation + 3) % 4 : shape === 'curve-left' ? (rotation + 1) % 4 : rotation;
        const d = directions[out]!;
        return next && (next.transform.x - n.transform.x) * d.x + (next.transform.z - n.transform.z) * d.z > epsilon;
      }) ?? ends.find((n) => n.autoConveyor) ?? ends[0];
    }
    start ??= first;
    const ordered: BuildingInstance[] = []; let prev: BuildingInstance | undefined, current: BuildingInstance | undefined = start;
    while (current) {
      ordered.push(current);
      const next: BuildingInstance | undefined = neighbors.get(current.id)!.find((n) => n !== prev);
      prev = current; current = next;
    }
    if (ordered.length !== component.length || (sink && ordered.at(-1) !== sink)) return null;
    for (let i = 0; i < ordered.length; i++) {
      const belt = ordered[i]!; if (belt.typeId !== 'conveyor-auto') continue;
      const before = ordered[i - 1], after = ordered[i + 1];
      const directionIndex = (from: BuildingInstance, to: BuildingInstance): number =>
        directions.findIndex((d) => Math.abs(to.transform.x - from.transform.x - d.x * 2 * cellSize) < epsilon &&
          Math.abs(to.transform.z - from.transform.z - d.z * 2 * cellSize) < epsilon);
      const outgoingNeighbor = after ? directionIndex(belt, after) : undefined;
      // A free inlet keeps the originally selected heading. A neighbour placed
      // to the side therefore bends this tile instead of rotating the whole line.
      let incoming = before ? directionIndex(before, belt) : (belt.autoConveyor?.rotation ?? belt.transform.rotation);
      if (!before && outgoingNeighbor !== undefined && (incoming + 2) % 4 === outgoingNeighbor) incoming = outgoingNeighbor;
      const outgoing = outgoingNeighbor ?? incoming;
      if (incoming < 0 || outgoing < 0 || (incoming + 2) % 4 === outgoing) return null;
      // The shared edge is at the higher of the two supports, keeping a ramp
      // above ground for both ascending and descending transitions.
      const inputY = before ? Math.max(belt.transform.y, before.transform.y) : belt.transform.y;
      const outputY = after ? Math.max(belt.transform.y, after.transform.y) : belt.transform.y;
      const rise = outputY - inputY, offset = inputY - belt.transform.y;
      const shape: ConveyorShape = incoming === outgoing ? (Math.abs(rise) > epsilon ? 'incline' : 'straight') :
        (incoming + 3) % 4 === outgoing ? 'curve-right' : 'curve-left';
      plan.set(belt.id, { shape, rotation: incoming, rise, offset });
    }
  }
  return plan;
}
