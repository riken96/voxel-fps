import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class PostProcessingManager {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  public composer: EffectComposer;
  public bloomPass: UnrealBloomPass;
  public outputPass: OutputPass;
  public isEnabled = true;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // 1. Effect Composer
    this.composer = new EffectComposer(this.renderer);

    // 2. Main Render Pass
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // 3. Unreal Luminous Bloom Pass (Glow for Neon, Jump Pads, Lava, Muzzle Flash)
    const bloomParams = {
      threshold: 0.82,  // Only emissive / HDR surfaces bloom
      strength: 0.48,   // Juicy, stylized soft neon glow
      radius: 0.45      // Diffusion radius
    };

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      bloomParams.strength,
      bloomParams.radius,
      bloomParams.threshold
    );
    this.composer.addPass(this.bloomPass);

    // 4. Output Pass with ACES Filmic Tone Mapping
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  public render(): void {
    if (this.isEnabled) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  public setBloomEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public setBloomStrength(strength: number): void {
    this.bloomPass.strength = strength;
  }
}
