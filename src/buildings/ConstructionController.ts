import type { CameraView } from '../engine/types';
import { forwardVector } from '../interaction/raycast';
import type { TerrainQuery } from '../world/terrain/TerrainHeightfield';
import type { BuildingSystem, PlacementResult, PlayerFootprint } from './BuildingSystem';

/** Aiming and mode state; logical placement remains owned by BuildingSystem. */
export class ConstructionController {
  private typeId: string | null = null;
  private rotation = 0;
  constructor(readonly system: BuildingSystem, private readonly terrain: TerrainQuery, readonly reach = 6) {}
  get selected(): string | null { return this.typeId; }
  get active(): boolean { return this.typeId !== null; }
  select(id: string): void { this.system.registry.get(id); this.typeId = id; this.rotation = 0; }
  cancel(): void { this.typeId = null; }
  rotate(): void { if (this.active) this.rotation = (this.rotation + 1) % 4; }
  aim(view: CameraView): { x: number; z: number } | null {
    const direction = forwardVector(view.yaw, view.pitch), origin = view.position;
    let prev = 0, prevHeight = origin.y - this.terrain.heightAt(origin.x, origin.z);
    for (let t = 0.1; t <= this.reach + 1e-8; t += 0.1) {
      const x = origin.x + direction.x * t, z = origin.z + direction.z * t;
      if (!this.terrain.contains(x, z)) return null;
      const delta = origin.y + direction.y * t - this.terrain.heightAt(x, z);
      if (delta <= 0 && prevHeight > 0) {
        let lo = prev, hi = t;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2, mx = origin.x + direction.x * mid, mz = origin.z + direction.z * mid;
          if (origin.y + direction.y * mid > this.terrain.heightAt(mx, mz)) lo = mid; else hi = mid;
        }
        return { x: origin.x + direction.x * hi, z: origin.z + direction.z * hi };
      }
      prev = t; prevHeight = delta;
    }
    return null;
  }
  preview(view: CameraView, player: PlayerFootprint): PlacementResult | null {
    if (!this.typeId) return null;
    const point = this.aim(view);
    return point ? this.system.validate(this.typeId, point.x, point.z, this.rotation, player) : null;
  }
  confirm(view: CameraView, player: PlayerFootprint) {
    if (!this.typeId) return null;
    const point = this.aim(view);
    if (!point) return null;
    const result = this.system.place(this.typeId, point.x, point.z, this.rotation, player);
    if (result.reason === 'valid' && !this.typeId.startsWith('conveyor-')) this.cancel();
    return result;
  }
  /** Nearest intersection with a registered building's actual box, never terrain/props. */
  target(view: CameraView): string | null {
    const dir = forwardVector(view.yaw, view.pitch), origin = view.position;
    let nearest = this.reach, result: string | null = null;
    for (const building of this.system.all()) {
      const f = building.transform.footprint, height = this.system.registry.get(building.typeId).height;
      let min = 0, max = this.reach;
      const axes = [
        [origin.x, dir.x, f.minX, f.maxX], [origin.y, dir.y, building.transform.y, building.transform.y + height],
        [origin.z, dir.z, f.minZ, f.maxZ],
      ] as const;
      for (const [p, d, lo, hi] of axes) {
        if (Math.abs(d) < 1e-10) { if (p < lo || p > hi) { min = Infinity; break; } continue; }
        const a = (lo - p) / d, b = (hi - p) / d;
        min = Math.max(min, Math.min(a, b)); max = Math.min(max, Math.max(a, b));
      }
      if (min <= max && min < nearest) { nearest = min; result = building.id; }
    }
    return result;
  }
}
