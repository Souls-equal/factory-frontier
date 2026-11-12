import { Mesh, MeshStandardMaterial } from 'three';
import { createNaturalBlockGeometry } from './NaturalModels';

type Block = { readonly position: readonly [number, number, number]; readonly scale: readonly [number, number, number] };

/** Static, batched decorative blocks. Coordinates are relative to the building base. */
function addBlocks(parent: Mesh, name: string, color: number, height: number, preview: boolean, blocks: readonly Block[]): void {
  const geometry = createNaturalBlockGeometry(blocks.map(({ position: [x, y, z], scale }) =>
    ({ position: [x, y - height / 2, z], scale })));
  const material = new MeshStandardMaterial({ color, roughness: .78, transparent: preview, opacity: preview ? .5 : 1, depthWrite: !preview });
  const part = new Mesh(geometry, material); part.name = name;
  part.castShadow = !preview; part.receiveShadow = !preview; parent.add(part);
}

/** Exposed bolt heads and edge plates make a tiled structural slab read as reinforced. */
export function addFoundationDetails(parent: Mesh, size: number, height: number, preview: boolean): void {
  const top = height + .018;
  const corners: Block[] = [];
  for (const x of [-.84, .84]) for (const z of [-.84, .84]) {
    corners.push({ position: [x * size, top, z * size], scale: [.20 * size, .032, .20 * size] });
  }
  addBlocks(parent, 'foundation-corner-plates', 0x536b73, height, preview, corners);
  const bolts: Block[] = [];
  for (const x of [-.84, .84]) for (const z of [-.84, .84]) {
    bolts.push({ position: [x * size, top + .020, z * size], scale: [.06 * size, .012, .06 * size] });
  }
  addBlocks(parent, 'foundation-bolts', 0xd1c498, height, preview, bolts);
  addBlocks(parent, 'foundation-side-banding', 0x526a71, height, preview, [
    { position: [0, .12, -1.002 * size], scale: [1.85 * size, .08, .008 * size] },
    { position: [0, .12, 1.002 * size], scale: [1.85 * size, .08, .008 * size] },
    { position: [-1.002 * size, .12, 0], scale: [.008 * size, .08, 1.85 * size] },
    { position: [1.002 * size, .12, 0], scale: [.008 * size, .08, 1.85 * size] },
  ]);
}

/** Supporting gantry and access panels distinguish the extractor from a plain box. */
export function addMinerDetails(parent: Mesh, size: number, height: number, preview: boolean): void {
  const frame: Block[] = [];
  for (const x of [-.76, .76]) for (const z of [-.69, .69]) {
    frame.push({ position: [x * size, .92, z * size], scale: [.18 * size, 1.45, .18 * size] });
    frame.push({ position: [x * size, .19, z * size], scale: [.29 * size, .25, .29 * size] });
  }
  frame.push(
    { position: [0, 1.65, -.69 * size], scale: [1.65 * size, .13, .16 * size] },
    { position: [0, 1.65, .69 * size], scale: [1.65 * size, .13, .16 * size] },
    { position: [-.76 * size, 1.65, 0], scale: [.16 * size, .13, 1.30 * size] },
    { position: [.76 * size, 1.65, 0], scale: [.16 * size, .13, 1.30 * size] },
  );
  addBlocks(parent, 'miner-gantry', 0x394d55, height, preview, frame);
  addBlocks(parent, 'miner-access-panels', 0x405b62, height, preview, [
    { position: [0, 1.16, -.636 * size], scale: [.66 * size, .72, .035 * size] },
    { position: [.656 * size, 1.1, 0], scale: [.035 * size, .74, .70 * size] },
    { position: [-.656 * size, 1.1, 0], scale: [.035 * size, .74, .70 * size] },
  ]);
  const vents: Block[] = [];
  for (const y of [.94, 1.09, 1.24, 1.39]) {
    vents.push({ position: [0, y, -.659 * size], scale: [.44 * size, .045, .015 * size] });
    vents.push({ position: [.678 * size, y, 0], scale: [.015 * size, .045, .46 * size] });
    vents.push({ position: [-.678 * size, y, 0], scale: [.015 * size, .045, .46 * size] });
  }
  addBlocks(parent, 'miner-vents', 0x9bb0a6, height, preview, vents);
  addBlocks(parent, 'miner-drill-collar', 0xd5a552, height, preview, [
    { position: [0, .38, -.53 * size], scale: [.82 * size, .12, .30 * size] },
    { position: [0, .26, -.65 * size], scale: [.58 * size, .16, .20 * size] },
  ]);
}

/** Low feet and chassis braces stay below the live transport surface. */
export function addConveyorDetails(parent: Mesh, size: number, height: number, preview: boolean): void {
  const feet: Block[] = [];
  for (const x of [-.30, .30]) for (const z of [-.31, .31]) {
    feet.push({ position: [x * size, .055, z * size], scale: [.22 * size, .11, .25 * size] });
  }
  addBlocks(parent, 'conveyor-feet', 0x465b60, height, preview, feet);
  addBlocks(parent, 'conveyor-chassis', 0x596f73, height, preview, [
    { position: [-.31 * size, .20, 0], scale: [.09 * size, .10, .74 * size] },
    { position: [.31 * size, .20, 0], scale: [.09 * size, .10, .74 * size] },
  ]);
}

/** Storage bands, control panel and lid locks remain clear of all input ports. */
export function addTerminalDetails(parent: Mesh, size: number, height: number, preview: boolean): void {
  const frame: Block[] = [];
  for (const x of [-.88, .88]) for (const z of [-.88, .88]) {
    frame.push({ position: [x * size, .58, z * size], scale: [.17 * size, 1.08, .17 * size] });
  }
  frame.push({ position: [0, .14, -.98 * size], scale: [1.65 * size, .13, .035 * size] },
    { position: [0, .14, .98 * size], scale: [1.65 * size, .13, .035 * size] },
    { position: [-.98 * size, .14, 0], scale: [.035 * size, .13, 1.65 * size] },
    { position: [.98 * size, .14, 0], scale: [.035 * size, .13, 1.65 * size] });
  addBlocks(parent, 'terminal-frame', 0x405b62, height, preview, frame);
  addBlocks(parent, 'terminal-controls', 0x1b3945, height, preview, [
    { position: [0, .83, -.999 * size], scale: [.70 * size, .35, .045 * size] },
    { position: [0, height + .018, 0], scale: [.88 * size, .036, .73 * size] },
  ]);
  addBlocks(parent, 'terminal-screen', 0x78cacc, height, preview, [
    { position: [-.08 * size, .86, -1.027 * size], scale: [.38 * size, .19, .012 * size] },
    { position: [.24 * size, .86, -1.027 * size], scale: [.08 * size, .08, .012 * size] },
    { position: [0, height + .042, 0], scale: [.63 * size, .012, .48 * size] },
  ]);
  addBlocks(parent, 'terminal-latches', 0xd7b564, height, preview, [
    { position: [-.61 * size, height + .028, 0], scale: [.12 * size, .056, .42 * size] },
    { position: [.61 * size, height + .028, 0], scale: [.12 * size, .056, .42 * size] },
  ]);
}
