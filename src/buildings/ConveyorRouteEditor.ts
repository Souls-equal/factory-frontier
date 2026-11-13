import { expandRoute, type RoutePoint } from '../logistics/ConveyorRoute';
import type { TerrainQuery } from '../world/terrain/TerrainHeightfield';
import { snapFootprint } from './Transform';
import type { BuildingInstance, BuildingSystem, PlayerFootprint, RouteReason, RouteResult } from './BuildingSystem';

export interface RouteEditorPreview extends RouteResult {
  readonly starting: boolean;
  readonly startValid: boolean;
  /** Visual fallback when authoritative staging failed before producing cells. */
  readonly visualCells: readonly BuildingInstance[];
}

/** Input-independent route editing. No world or inventory change until confirm. */
export class ConveyorRouteEditor {
  private waypoints: RoutePoint[] = [];
  private startRotation = 0;
  private xFirst = false;
  private cached: { key: string; preview: RouteEditorPreview } | null = null;
  constructor(private readonly system: BuildingSystem, private readonly terrain: TerrainQuery) {}
  get pointCount(): number { return this.waypoints.length; }
  get horizontalFirst(): boolean { return this.xFirst; }
  reset(): void { this.waypoints = []; this.xFirst = false; this.cached = null; }
  toggleAxis(): void { this.xFirst = !this.xFirst; this.cached = null; }
  undo(): void { this.waypoints.pop(); this.cached = null; }
  private snap(point: RoutePoint): RoutePoint {
    const t = snapFootprint(this.system.registry.get('conveyor-cell'), point.x, point.z, 0, this.system.cellSize);
    return { x: t.x, z: t.z };
  }
  private route(point: RoutePoint): RoutePoint[] {
    const end = this.snap(point), last = this.waypoints.at(-1);
    return last && last.x === end.x && last.z === end.z ? [...this.waypoints] : [...this.waypoints, end];
  }
  private sourceOK(reason: RouteReason): boolean {
    return reason === 'valid' || reason === 'output blocked' || reason === 'insufficient materials' || reason === 'conveyor occupied';
  }
  private plan(point: RoutePoint, player: PlayerFootprint, rotation: number): RouteEditorPreview {
    const starting = !this.waypoints.length, points = this.route(point);
    let selectedRotation = starting ? rotation : this.startRotation;
    let result = this.system.previewConveyorRoute(points, player, this.xFirst, selectedRotation);
    // Prefer an unblocked starting direction when a one-cell route can face
    // several ways (e.g. sideways entry from a machine).
    const rank = (reason: RouteReason): number => reason === 'valid' ? 0 : reason === 'insufficient materials' ? 1 :
      reason === 'conveyor occupied' ? 2 : reason === 'output blocked' ? 3 : 4;
    if (starting && rank(result.reason) > 0) {
      for (let i = 1; i < 4; i++) {
        const candidateRotation = (rotation + i) % 4;
        const candidate = this.system.previewConveyorRoute(points, player, this.xFirst, candidateRotation);
        if (rank(candidate.reason) < rank(result.reason)) { result = candidate; selectedRotation = candidateRotation; }
        if (rank(result.reason) === 0) break;
      }
    }
    const expanded = expandRoute(points, this.system.registry.get('conveyor-cell'), this.system.cellSize, this.xFirst, selectedRotation);
    const visualCells = result.cells.length ? result.cells : (expanded ?? []).map((cell, i) => {
      const transform = snapFootprint(this.system.registry.get('conveyor-cell'), cell.x, cell.z, cell.rotation, this.system.cellSize);
      return { id: `route-fallback-${i}`, typeId: 'conveyor-cell', transform: { ...transform, y: this.terrain.heightAt(cell.x, cell.z) } };
    });
    return { ...result, starting, startValid: starting && this.sourceOK(result.reason), visualCells };
  }
  /** Advisory preview cached for 250ms, with immediate refresh on grid, mode or world changes.
   * Confirm and clicks always revalidate; moving logistics items can change guards. */
  preview(point: RoutePoint, player: PlayerFootprint, rotation: number, inventoryRevision: number, now: number): RouteEditorPreview {
    const snapped = this.snap(point);
    const key = JSON.stringify([snapped, this.waypoints, this.startRotation, this.xFirst, rotation,
      Math.round(player.x * 4), Math.round(player.z * 4), player.radius, this.system.revision,
      inventoryRevision, this.system.creativeMode, Math.floor(now / 250)]);
    if (this.cached?.key !== key) this.cached = { key, preview: this.plan(point, player, rotation) };
    return this.cached.preview;
  }
  /** Adds a start or intermediate point; the current final point is not built yet. */
  addPoint(point: RoutePoint, player: PlayerFootprint, rotation: number): RouteReason | 'point added' {
    const result = this.plan(point, player, rotation);
    if (result.starting ? !result.startValid : !this.sourceOK(result.reason)) return result.reason;
    const snapped = this.snap(point), last = this.waypoints.at(-1);
    if (last && last.x === snapped.x && last.z === snapped.z) return 'point added';
    if (result.starting) this.startRotation = result.visualCells[0]?.transform.rotation ?? rotation;
    this.waypoints.push(snapped); this.cached = null;
    return 'point added';
  }
  confirm(point: RoutePoint, player: PlayerFootprint): RouteResult | null {
    if (!this.waypoints.length) return null;
    const result = this.system.placeConveyorRoute(this.route(point), player, this.xFirst, this.startRotation);
    this.cached = null;
    if (result.reason === 'valid') this.reset();
    return result;
  }
}
