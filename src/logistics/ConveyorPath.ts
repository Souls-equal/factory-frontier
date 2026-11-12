/** Renderer-independent grid geometry; all distances are metres. */
export type ConveyorShape = 'straight' | 'curve-right' | 'curve-left' | 'incline';
export interface Point3 { readonly x: number; readonly y: number; readonly z: number }
export interface ConveyorPathSpec {
  readonly shape: ConveyorShape;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Quarter turns clockwise about the vertical axis. */
  readonly rotation: number;
  readonly size: number;
  /** Vertical rise from inlet to outlet, including sloped turns. */
  readonly rise?: number;
}

/** One grid footprint. In local coordinates flow starts at +Z and heads toward -Z. */
export class ConveyorPath {
  readonly length: number;
  readonly rise: number;
  constructor(readonly spec: ConveyorPathSpec) {
    if (![spec.x, spec.y, spec.z, spec.size, spec.rotation, spec.rise ?? 0].every(Number.isFinite) ||
        spec.size <= 0 || !Number.isInteger(spec.rotation) || !['straight', 'curve-right', 'curve-left', 'incline'].includes(spec.shape) ||
        (spec.shape === 'straight' && (spec.rise ?? 0) !== 0)) throw new RangeError('Invalid conveyor path.');
    this.rise = spec.rise ?? 0;
    const horizontal = spec.shape.startsWith('curve-') ? Math.PI * spec.size / 4 : spec.size;
    this.length = Math.hypot(horizontal, this.rise);
  }
  /** Position at distance along the centreline; endpoints are exactly on grid edges. */
  point(distance: number): Point3 {
    if (!Number.isFinite(distance)) throw new RangeError('Invalid path distance.');
    const t = Math.max(0, Math.min(1, distance / this.length)), half = this.spec.size / 2;
    let x = 0, z = half - t * this.spec.size;
    if (this.spec.shape === 'curve-right' || this.spec.shape === 'curve-left') {
      const angle = Math.PI + Math.PI * t / 2;
      x = (half + half * Math.cos(angle)) * (this.spec.shape === 'curve-left' ? -1 : 1); z = half + half * Math.sin(angle);
    }
    const rotation = ((this.spec.rotation % 4) + 4) % 4;
    const cos = [1, 0, -1, 0][rotation]!, sin = [0, 1, 0, -1][rotation]!;
    return { x: this.spec.x + x * cos + z * sin, y: this.spec.y + this.rise * t,
      z: this.spec.z - x * sin + z * cos };
  }
  /** Horizontal travel tangent at a path endpoint. */
  direction(end: 'input' | 'output'): Point3 {
    let x = end === 'output' && this.spec.shape === 'curve-right' ? 1 : end === 'output' && this.spec.shape === 'curve-left' ? -1 : 0;
    let z = end === 'output' && this.spec.shape.startsWith('curve-') ? 0 : -1;
    const rotation = ((this.spec.rotation % 4) + 4) % 4;
    const cos = [1, 0, -1, 0][rotation]!, sin = [0, 1, 0, -1][rotation]!;
    [x, z] = [x * cos + z * sin, -x * sin + z * cos];
    return { x, y: 0, z };
  }
  compatible(next: ConveyorPath, epsilon = 1e-7): boolean {
    const a = this.point(this.length), b = next.point(0), da = this.direction('output'), db = next.direction('input');
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= epsilon && da.x === db.x && da.z === db.z;
  }
}
