import { DataTexture, NearestFilter, RGBAFormat, SRGBColorSpace } from 'three';

/** Small, deterministic pixel-art texture tiles. No DOM, network or runtime randomness. */
const SIZE = 32;
type RGB = readonly [number, number, number];
type Pattern = 'grass' | 'grass-side' | 'dirt' | 'stone' | 'bark' | 'leaves';

function hash(x: number, y: number, salt: number): number {
  let value = Math.imul(x + salt * 19, 374761393) + Math.imul(y + salt * 7, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function pixel(pattern: Pattern, x: number, y: number): RGB {
  const fine = hash(x, y, 2), patch = hash(Math.floor(x / 3), Math.floor(y / 3), 5);
  if (pattern === 'grass' || (pattern === 'grass-side' && y >= 25 - Math.floor(hash(Math.floor(x / 2), 0, 7) * 4))) {
    const blade = (x + (y % 5)) % 11 === 0 && fine > .35;
    return blade ? [83, 144, 59] : patch > .64 ? [122, 176, 79] : fine > .72 ? [111, 165, 69] : [100, 153, 66];
  }
  if (pattern === 'grass-side' || pattern === 'dirt') {
    return patch > .73 ? [141, 102, 65] : fine > .81 ? [157, 119, 76] : fine < .18 ? [105, 72, 48] : [124, 86, 55];
  }
  if (pattern === 'stone') {
    const crack = ((x + Math.floor(y / 4) * 2) % 17 === 0 && y % 12 < 8);
    return crack ? [101, 111, 107] : patch > .72 ? [169, 178, 164] : fine > .82 ? [183, 190, 176] : [142, 154, 145];
  }
  if (pattern === 'bark') {
    const stripe = hash(Math.floor(x / 3), Math.floor(y / 9), 11);
    return stripe < .25 ? [91, 59, 38] : stripe > .72 ? [153, 110, 67] : fine > .85 ? [164, 120, 73] : [122, 82, 49];
  }
  // Irregular leafy clusters rather than a flat green box.
  return patch > .73 ? [108, 163, 71] : patch < .24 ? [48, 100, 49] : fine > .84 ? [127, 178, 83] : [72, 131, 57];
}

export function createNaturalTexture(patterns: readonly Pattern[]): DataTexture {
  const width = SIZE * patterns.length, data = new Uint8Array(width * SIZE * 4);
  for (let tile = 0; tile < patterns.length; tile++) for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const [r, g, b] = pixel(patterns[tile]!, x, y), i = (y * width + tile * SIZE + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  }
  const texture = new DataTexture(data, width, SIZE, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter; texture.minFilter = NearestFilter;
  texture.generateMipmaps = false; texture.needsUpdate = true;
  return texture;
}

/** Atlas inset avoids sampling neighbouring tiles at quad edges. */
export function terrainTileUv(tile: number): readonly [number, number, number, number] {
  return [(tile * SIZE + .5) / (SIZE * 3), .5 / SIZE, ((tile + 1) * SIZE - .5) / (SIZE * 3), (SIZE - .5) / SIZE];
}
