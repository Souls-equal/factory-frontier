import { AmbientLight, DirectionalLight, Group, HemisphereLight } from 'three';

export interface LightingOptions {
  readonly shadows: boolean;
}

/**
 * Scene lighting.
 *
 * A bright sky fill plus a warm directional key light establishes a
 * welcoming daytime frontier while keeping shadow configuration
 * in one place for later scalability work.
 */
export class LightingManager {
  readonly group: Group;
  private readonly keyLight: DirectionalLight;
  private focusX = Number.NaN;
  private focusZ = Number.NaN;

  constructor(options: LightingOptions) {
    this.group = new Group();
    this.group.name = 'lighting';

    const hemisphere = new HemisphereLight(0xc7eaff, 0x879d76, 1.15);
    hemisphere.name = 'lighting:hemisphere';

    const ambient = new AmbientLight(0xfff1d6, 0.45);
    ambient.name = 'lighting:ambient';

    this.keyLight = new DirectionalLight(0xffedcc, 2.2);
    this.keyLight.name = 'lighting:key';
    this.keyLight.position.set(38, 52, 24);
    this.keyLight.castShadow = options.shadows;

    if (options.shadows) {
      this.keyLight.shadow.mapSize.set(2048, 2048);
      this.keyLight.shadow.camera.left = -60;
      this.keyLight.shadow.camera.right = 60;
      this.keyLight.shadow.camera.top = 60;
      this.keyLight.shadow.camera.bottom = -60;
      this.keyLight.shadow.camera.near = 1;
      this.keyLight.shadow.camera.far = 180;
      this.keyLight.shadow.bias = -0.0005;
      this.keyLight.shadow.normalBias = 0.02;
    }

    this.group.add(hemisphere, ambient, this.keyLight, this.keyLight.target);
  }

  /**
   * Move the shadow-casting key light with the player.
   *
   * The shadow camera covers 120 m around its target, so following the player
   * keeps crisp shadows everywhere in the finite world without enlarging the
   * shadow map (and without re-allocating anything).
   */
  setFocus(x: number, z: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return;
    }
    if (x === this.focusX && z === this.focusZ) {
      return;
    }
    this.focusX = x;
    this.focusZ = z;

    this.keyLight.position.set(x + 38, 52, z + 24);
    this.keyLight.target.position.set(x, 0, z);
    this.keyLight.target.updateMatrixWorld();
  }

  dispose(): void {
    this.keyLight.shadow.dispose();
    this.group.clear();
  }
}
