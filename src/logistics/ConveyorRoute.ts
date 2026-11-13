import { snapFootprint } from '../buildings/Transform';
import type { BuildingDefinition } from '../buildings/BuildingRegistry';

export interface RoutePoint { readonly x: number; readonly z: number }
export interface RouteCell extends RoutePoint { readonly rotation: number }
export const MAX_ROUTE_CELLS = 24;
/** Expand snapped waypoints into a non-self-intersecting orthogonal cell path. */
export function expandRoute(points: readonly RoutePoint[], definition: BuildingDefinition, cellSize: number, xFirst: boolean, defaultRotation: number): RouteCell[] | null {
  if (!points.length || points.length > MAX_ROUTE_CELLS || !Number.isFinite(cellSize) || cellSize <= 0 ||
      !Number.isInteger(defaultRotation) || points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.z)) ||
      definition.widthCells !== 1 || definition.depthCells !== 1) return null;
  const snapped = points.map((p) => snapFootprint(definition, p.x, p.z, 0, cellSize));
  const locations: RoutePoint[] = [{ x: snapped[0]!.x, z: snapped[0]!.z }];
  const seen = new Set([`${snapped[0]!.x},${snapped[0]!.z}`]);
  for (let i = 1; i < snapped.length; i++) {
    const target = snapped[i]!;
    for (const axis of (xFirst ? ['x', 'z'] : ['z', 'x']) as ('x' | 'z')[]) {
      let current = locations.at(-1)!;
      const steps = Math.round(Math.abs(target[axis] - current[axis]) / cellSize);
      if (steps + locations.length > MAX_ROUTE_CELLS) return null;
      const sign = Math.sign(target[axis] - current[axis]);
      for (let step = 0; step < steps; step++) {
        current = { ...current, [axis]: current[axis] + sign * cellSize };
        const key = `${current.x},${current.z}`;
        if (seen.has(key)) return null;
        seen.add(key); locations.push(current);
      }
    }
  }
  const direction = (a: RoutePoint, b: RoutePoint) => b.z < a.z ? 0 : b.x < a.x ? 1 : b.z > a.z ? 2 : 3;
  return locations.map((point, i) => ({ ...point, rotation: i + 1 < locations.length ? direction(point, locations[i + 1]!) :
    i ? direction(locations[i - 1]!, point) : ((defaultRotation % 4) + 4) % 4 }));
}
