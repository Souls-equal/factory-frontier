import { BoxGeometry, BufferAttribute, BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Irregular low-poly rock variants, bounded by a unit cylinder and one unit high. */
export function createRockGeometry(variant: number): BufferGeometry {
  const positions: number[] = [], uvs: number[] = [];
  const levels = [0, .27, .67, .92];
  const radii = [.74, .89, .68, .35];
  const points: [number, number, number][][] = levels.map((height, layer) =>
    Array.from({ length: 7 }, (_, i) => {
      const angle = i * Math.PI * 2 / 7 + (layer % 2) * .08;
      const variation = .67 + ((i * 13 + layer * 7 + variant * 11) % 9) * .04;
      const lean = layer * .035 * (variant === 1 ? -1 : 1);
      const elevation = layer === 0 ? 0 : Math.min(.97, height + (((i * 5 + layer * 3 + variant * 5) % 7) - 3) * .028);
      return [Math.cos(angle) * radii[layer]! * variation + lean, elevation,
        Math.sin(angle) * radii[layer]! * variation - lean * .5];
    }));
  const triangle = (a: readonly number[], b: readonly number[], c: readonly number[],
    uv: readonly number[]): void => { positions.push(...a, ...b, ...c); uvs.push(...uv); };
  for (let layer = 0; layer < levels.length - 1; layer++) for (let i = 0; i < 7; i++) {
    const next = (i + 1) % 7, lower = points[layer]!, upper = points[layer + 1]!;
    triangle(lower[i]!, upper[i]!, upper[next]!, [0, 0, 0, 1, 1, 1]);
    triangle(lower[i]!, upper[next]!, lower[next]!, [0, 0, 1, 1, 1, 0]);
  }
  const summit = points[points.length - 1]!;
  for (let i = 0; i < 7; i++) {
    const a = summit[(i + 1) % 7]!, b = summit[i]!;
    triangle([.08, 1, -.03], a, b, [.5, .5, .5 + a[0] * .5, .5 + a[2] * .5, .5 + b[0] * .5, .5 + b[2] * .5]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.computeVertexNormals();
  return geometry;
}

/** Assemble reusable block details into one draw call per material. */
export function createNaturalBlockGeometry(parts: readonly {
  readonly position: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
  readonly yaw?: number;
}[]): BufferGeometry {
  const geometries = parts.map(part => {
    const cube = new BoxGeometry(...part.scale);
    cube.rotateY(part.yaw ?? 0); cube.translate(...part.position);
    return cube;
  });
  const geometry = mergeGeometries(geometries);
  geometries.forEach(piece => piece.dispose());
  return geometry;
}
