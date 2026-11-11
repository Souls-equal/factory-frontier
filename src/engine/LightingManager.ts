import { AmbientLight, DirectionalLight, Group, HemisphereLight } from 'three';

export interface LightingOptions {
  readonly shadows: boolean;
}

/**
 * Scene lighting.
 *
 * A cool hemisphere fill plus a warm directional key light establishes the
 * "dawn on an industrial frontier" identity while keeping shadow configuration
 * in one place for later scalability work.
 */
export class LightingManager {
  readonly group: Group;
  private readonly keyLight: DirectionalLight;

  constructor(options: LightingOptions) {
    this.group = new Group();
    this.group.name = 'lighting';

    const hemisphere = new HemisphereLight(0x9dc9e8, 0x1b2a33, 0.6);
    hemisphere.name = 'lighting:hemisphere';

    const ambient = new AmbientLight(0x415666, 0.35);
    ambient.name = 'lighting:ambient';

    this.keyLight = new DirectionalLight(0xffe3b8, 2.4);
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

  dispose(): void {
    this.keyLight.shadow.dispose();
    this.group.clear();
  }
}
