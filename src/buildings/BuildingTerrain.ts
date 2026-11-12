import type { TerrainQuery, TerrainNormal } from '../world/terrain/TerrainHeightfield';
import type { BuildingSystem } from './BuildingSystem';

/** Player ground query: foundations support the player on their top surface. */
export class BuildingTerrain implements TerrainQuery {
  constructor(private readonly terrain: TerrainQuery, private readonly buildings: BuildingSystem) {}
  get bounds() { return this.terrain.bounds; }
  get size() { return this.terrain.size; }
  get resolution() { return this.terrain.resolution; }
  get cellSize() { return this.terrain.cellSize; }
  get verticalWalls() { return this.terrain.verticalWalls ?? false; }
  contains(x: number, z: number): boolean { return this.terrain.contains(x, z); }
  clampXZ(x: number, z: number) { return this.terrain.clampXZ(x, z); }
  private topAt(x: number, z: number): number {
    let top = -Infinity;
    for (const building of this.buildings.all()) {
      const f = building.transform.footprint;
      if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) {
        top = Math.max(top, building.transform.y + this.buildings.registry.get(building.typeId).height);
      }
    }
    return top;
  }
  heightAt(x: number, z: number): number { return Math.max(this.terrain.heightAt(x, z), this.topAt(x, z)); }
  groundBelow(x: number, z: number, feetY: number, radius: number): number {
    let top = this.terrain.groundBelow?.(x, z, feetY, radius) ?? this.terrain.heightAt(x, z);
    for (const building of this.buildings.all()) {
      const f = building.transform.footprint;
      const dx = x - Math.max(f.minX, Math.min(f.maxX, x));
      const dz = z - Math.max(f.minZ, Math.min(f.maxZ, z));
      const height = building.transform.y + this.buildings.registry.get(building.typeId).height;
      if (dx * dx + dz * dz <= radius * radius + 1e-10 && height <= feetY + 1e-7) top = Math.max(top, height);
    }
    return top;
  }
  normalAt(x: number, z: number): TerrainNormal {
    return this.topAt(x, z) > this.terrain.heightAt(x, z) ? { x: 0, y: 1, z: 0 } : this.terrain.normalAt(x, z);
  }
  slopeAt(x: number, z: number): number {
    return this.topAt(x, z) > this.terrain.heightAt(x, z) ? 0 : this.terrain.slopeAt(x, z);
  }
}
