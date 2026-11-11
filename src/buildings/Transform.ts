import type { BuildingDefinition } from './BuildingRegistry';

export interface Footprint { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number }
export interface BuildingTransform { readonly x: number; readonly y: number; readonly z: number; readonly rotation: number; readonly footprint: Footprint }

/** Snap lower corner to the world grid: odd and even footprints share grid lines. */
export function snapFootprint(definition: BuildingDefinition, x: number, z: number, rotation: number, cellSize: number): BuildingTransform {
  if (![x, z, cellSize].every(Number.isFinite) || cellSize <= 0 || !Number.isInteger(rotation)) {
    throw new RangeError('Invalid grid transform.');
  }
  const turns = ((rotation % 4) + 4) % 4;
  const width = (turns % 2 ? definition.depthCells : definition.widthCells) * cellSize;
  const depth = (turns % 2 ? definition.widthCells : definition.depthCells) * cellSize;
  const minX = Math.round((x - width / 2) / cellSize) * cellSize;
  const minZ = Math.round((z - depth / 2) / cellSize) * cellSize;
  return { x: minX + width / 2, y: 0, z: minZ + depth / 2, rotation: turns,
    footprint: { minX, maxX: minX + width, minZ, maxZ: minZ + depth } };
}
