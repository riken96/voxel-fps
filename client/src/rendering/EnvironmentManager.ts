import * as THREE from 'three';

export interface EnvironmentPreset {
  id: string;
  name: string;
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPosition: [number, number, number];
  skyHemiColor: number;
  groundHemiColor: number;
  hemiIntensity: number;
}

export const ENVIRONMENT_PRESETS: Record<string, EnvironmentPreset> = {
  day: {
    id: 'day',
    name: 'Day (Vibrant Arena)',
    skyColor: 0x4fa8f6,       // Vibrant Mediterranean azure blue
    fogColor: 0x76bbf5,       // Soft atmospheric horizon glow
    fogDensity: 0.0035,       // Crystal clear visibility
    sunColor: 0xfffaed,       // Warm golden-white sunlight
    sunIntensity: 1.75,       // Crisp, dynamic directional illumination
    sunPosition: [55, 75, 40],
    skyHemiColor: 0xe0f2fe,   // Bright sky ambient fill
    groundHemiColor: 0x475569,// Slate-grey ground bounce
    hemiIntensity: 0.92       // No dark murky crevices
  },
  golden_hour: {
    id: 'golden_hour',
    name: 'Golden Hour',
    skyColor: 0xe08443,
    fogColor: 0xe08443,
    fogDensity: 0.005,
    sunColor: 0xffa339,
    sunIntensity: 1.6,
    sunPosition: [60, 25, 25],
    skyHemiColor: 0xffd199,
    groundHemiColor: 0x543216,
    hemiIntensity: 0.85
  },
  dusk: {
    id: 'dusk',
    name: 'Dusk',
    skyColor: 0x482d56,
    fogColor: 0x482d56,
    fogDensity: 0.007,
    sunColor: 0xff7055,
    sunIntensity: 1.4,
    sunPosition: [70, 25, 40],
    skyHemiColor: 0x8e4d7e,
    groundHemiColor: 0x22132e,
    hemiIntensity: 0.75
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber / Synthwave',
    skyColor: 0x181236,
    fogColor: 0x1f1642,
    fogDensity: 0.007,
    sunColor: 0x00f0ff,
    sunIntensity: 1.35,
    sunPosition: [40, 50, 30],
    skyHemiColor: 0xa832b8,
    groundHemiColor: 0x120d24,
    hemiIntensity: 0.8
  },
  night: {
    id: 'night',
    name: 'Moonlit Night',
    skyColor: 0x121a2b,
    fogColor: 0x121a2b,
    fogDensity: 0.009,
    sunColor: 0x82b1ff,
    sunIntensity: 0.85,
    sunPosition: [30, 55, -40],
    skyHemiColor: 0x334e68,
    groundHemiColor: 0x0f172a,
    hemiIntensity: 0.65
  },
  toxic: {
    id: 'toxic',
    name: 'Toxic Lab',
    skyColor: 0x1c3a1c,
    fogColor: 0x1c3a1c,
    fogDensity: 0.010,
    sunColor: 0x99ff44,
    sunIntensity: 1.25,
    sunPosition: [35, 45, 20],
    skyHemiColor: 0x4d7c0f,
    groundHemiColor: 0x142e14,
    hemiIntensity: 0.7
  },
  hell: {
    id: 'hell',
    name: 'Inferno Hell',
    skyColor: 0x3a0c0c,
    fogColor: 0x3a0c0c,
    fogDensity: 0.009,
    sunColor: 0xff4422,
    sunIntensity: 1.5,
    sunPosition: [50, 35, 10],
    skyHemiColor: 0xb91c1c,
    groundHemiColor: 0x280707,
    hemiIntensity: 0.8
  }
};

export class EnvironmentManager {
  private scene: THREE.Scene;
  public hemiLight: THREE.HemisphereLight;
  public sunLight: THREE.DirectionalLight;
  public currentPreset: string = 'day';

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Hemisphere ambient fill light
    this.hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x475569, 0.92);
    this.scene.add(this.hemiLight);

    // 2. Main directional sun light with crisp contact shadows
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.75);
    this.sunLight.position.set(55, 75, 40);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 180;
    const shadowDist = 55;
    this.sunLight.shadow.camera.left = -shadowDist;
    this.sunLight.shadow.camera.right = shadowDist;
    this.sunLight.shadow.camera.top = shadowDist;
    this.sunLight.shadow.camera.bottom = -shadowDist;
    this.sunLight.shadow.bias = -0.0004;
    this.scene.add(this.sunLight);

    // Apply default vibrant 'day' environment
    this.applyPreset('day');
  }

  public applyPreset(presetId: string): void {
    const preset = ENVIRONMENT_PRESETS[presetId] || ENVIRONMENT_PRESETS.day;
    this.currentPreset = preset.id;

    // 1. Sky & Fog
    this.scene.background = new THREE.Color(preset.skyColor);
    this.scene.fog = new THREE.FogExp2(preset.fogColor, preset.fogDensity);

    // 2. Hemisphere Ambient Fill
    this.hemiLight.color.setHex(preset.skyHemiColor);
    this.hemiLight.groundColor.setHex(preset.groundHemiColor);
    this.hemiLight.intensity = preset.hemiIntensity;

    // 3. Directional Sun
    this.sunLight.color.setHex(preset.sunColor);
    this.sunLight.intensity = preset.sunIntensity;
    this.sunLight.position.set(...preset.sunPosition);
  }
}
