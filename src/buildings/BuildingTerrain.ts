import type { TerrainQuery, TerrainNormal } from '../world/terrain/TerrainHeightfield';
import type { BuildingSystem } from './BuildingSystem';

/** Player ground query: foundations support the player on their top surface. */
export class BuildingTerrain implements TerrainQuery {
  constructor(private readonly terrain: TerrainQuery, private readonly buildings: BuildingSystem) {}
  get bounds() { return this.terrain.bounds; }
  get size() { return this.terrain.size; }
  get resolution() { return this.terrain.resolution; }
  get cellSize() { return this.terrain.cellSize; }
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
  normalAt(x: number, z: number): TerrainNormal {
    return this.topAt(x, z) > this.terrain.heightAt(x, z) ? { x: 0, y: 1, z: 0 } : this.terrain.normalAt(x, z);
  }
  slopeAt(x: number, z: number): number {
    return this.topAt(x, z) > this.terrain.heightAt(x, z) ? 0 : this.terrain.slopeAt(x, z);
  }
}
