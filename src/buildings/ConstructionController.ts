import type { CameraView } from '../engine/types';
import { forwardVector } from '../interaction/raycast';
import type { TerrainQuery } from '../world/terrain/TerrainHeightfield';
import type { BuildingSystem, PlacementResult, PlayerFootprint } from './BuildingSystem';
import { snapFootprint } from './Transform';
import { liftRise, MAX_LIFT_HEIGHT } from '../logistics/LiftDefinitions';

/** Aiming and mode state; logical placement remains owned by BuildingSystem. */
export class ConstructionController {
  private typeId: string | null = null;
  private rotation = 0;
  private foundationSteps = 0;
  constructor(readonly system: BuildingSystem, private readonly terrain: TerrainQuery, readonly reach = 6) {}
  get selected(): string | null { return this.typeId; }
  get active(): boolean { return this.typeId !== null; }
  select(id: string): void { this.system.registry.get(id); this.typeId = id; this.rotation = 0; this.foundationSteps = 0; }
  cancel(): void { this.typeId = null; }
  rotate(): void { if (this.active) this.rotation = (this.rotation + 1) % 4; }
  adjustFoundationHeight(direction: 1 | -1): void { if (this.typeId === 'foundation') this.foundationSteps += direction; }
  /** Change the selected lift variant without mutating already placed lifts. */
  adjustLiftHeight(direction: 1 | -1, fine = false): void {
    if (!this.typeId) return;
    const rise = liftRise(this.typeId);
    if (rise === null) return;
    const steps = Math.round(Math.abs(rise) * 10) + direction * (fine ? 1 : 10);
    const height = Math.max(10, Math.min(MAX_LIFT_HEIGHT * 10, steps)) / 10;
    const next = `lift-${rise > 0 ? 'up' : 'down'}-${height}`;
    // Custom registries may expose only some lift sizes.
    if (this.system.registry.all().some((definition) => definition.id === next)) this.typeId = next;
  }
  get foundationHeightOffset(): number { return this.foundationSteps / 10; }
  aim(view: CameraView): { x: number; z: number } | null {
    const direction = forwardVector(view.yaw, view.pitch), origin = view.position;
    // Project onto nearby foundation surfaces before the ground ray so elevated
    // platforms can be extended and supported belts aimed at beyond ground reach.
    let best = Infinity, target: { x: number; z: number } | null = null;
    const onFoundation = this.typeId !== null && this.system.registry.get(this.typeId).placement === 'logistics';
    if ((this.typeId === 'foundation' || onFoundation) && direction.y < -1e-8 &&
        this.system.registry.all().some((definition) => definition.id === 'foundation')) {
      const definition = this.system.registry.get('foundation');
      for (const foundation of this.system.all().filter((b) => b.typeId === 'foundation')) {
        const t = (foundation.transform.y + definition.height - origin.y) / direction.y;
        if (t <= 0 || t > this.reach || t >= best) continue;
        const x = origin.x + direction.x * t, z = origin.z + direction.z * t;
        if (!this.terrain.contains(x, z) || (this.typeId === 'foundation' && foundation.transform.y <= this.terrain.heightAt(x, z) + .5)) continue;
        const n = foundation.transform.footprint, epsilon = 1e-7;
        const f = snapFootprint(definition, x, z, this.rotation, this.system.cellSize).footprint;
        const touches = f.minX <= n.maxX + epsilon && f.maxX >= n.minX - epsilon &&
          f.minZ <= n.maxZ + epsilon && f.maxZ >= n.minZ - epsilon;
        // A belt needs a real surface under the aimed point, not an infinite plane.
        const onSurface = x >= n.minX && x <= n.maxX && z >= n.minZ && z <= n.maxZ;
        if (this.typeId === 'foundation' ? touches : onSurface) {
          best = t; target = { x, z };
        }
      }
    }
    let prev = 0, prevHeight = origin.y - this.terrain.heightAt(origin.x, origin.z);
    for (let t = 0.1; t <= this.reach + 1e-8; t += 0.1) {
      const x = origin.x + direction.x * t, z = origin.z + direction.z * t;
      if (t >= best) return target;
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
    return target;
  }
  facing(view: CameraView): number {
    return this.typeId === 'conveyor-cell' ? ((Math.round(view.yaw / (Math.PI / 2)) + this.rotation) % 4 + 4) % 4 : this.rotation;
  }
  preview(view: CameraView, player: PlayerFootprint): PlacementResult | null {
    if (!this.typeId) return null;
    const point = this.aim(view);
    return point ? this.system.validate(this.typeId, point.x, point.z, this.facing(view), player, this.typeId === 'foundation' ? this.foundationHeightOffset : undefined, { alignFoundationToLogistics: this.typeId === 'foundation' }) : null;
  }
  confirm(view: CameraView, player: PlayerFootprint) {
    if (!this.typeId) return null;
    const point = this.aim(view);
    if (!point) return null;
    const result = this.system.place(this.typeId, point.x, point.z, this.facing(view), player, this.typeId === 'foundation' ? this.foundationHeightOffset : undefined, { alignFoundationToLogistics: this.typeId === 'foundation' });
    if (result.reason === 'valid' && this.typeId === 'foundation') this.foundationSteps = 0;
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
