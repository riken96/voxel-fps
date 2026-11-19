import * as THREE from 'three';
import { BlockId } from '@shared/constants.ts';
import { BLOCK_DEFINITIONS } from '@shared/world/BlockTypes.ts';

const MAX_PARTICLES = 300;

interface VoxelParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  rotSpeedX: number;
  rotSpeedY: number;
  rotSpeedZ: number;
  scale: number;
  initialScale: number;
  life: number;
  maxLife: number;
  gravity: number;
  r: number;
  g: number;
  b: number;
}

export class ParticleManager {
  private scene: THREE.Scene;
  private instancedMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private colorHelper = new THREE.Color();

  private particles: VoxelParticle[] = [];
  private nextIndex = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95
    });

    this.instancedMesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.instancedMesh.frustumCulled = false;

    // Initialize particle pool
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        rotSpeedX: 0,
        rotSpeedY: 0,
        rotSpeedZ: 0,
        scale: 0,
        initialScale: 0.1,
        life: 0,
        maxLife: 0.5,
        gravity: 24,
        r: 1,
        g: 1,
        b: 1
      });

      // Hide offscreen initially
      this.dummy.position.set(0, -999, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.instancedMesh);
  }

  private allocate(): number {
    const idx = this.nextIndex;
    this.nextIndex = (this.nextIndex + 1) % MAX_PARTICLES;
    return idx;
  }

  /**
   * Spawns bursting mini-cubes when a block is mined or broken.
   */
  public spawnBlockBreak(x: number, y: number, z: number, blockId: BlockId): void {
    const def = BLOCK_DEFINITIONS[blockId];
    const baseColor = def ? def.color : [0.8, 0.8, 0.8];
    const isEmissive = Boolean(def?.emissive);

    const count = 14;
    for (let i = 0; i < count; i++) {
      const idx = this.allocate();
      const p = this.particles[idx];
      p.active = true;

      // Center with slight random jitter
      p.x = x + 0.5 + (Math.random() - 0.5) * 0.4;
      p.y = y + 0.5 + (Math.random() - 0.5) * 0.4;
      p.z = z + 0.5 + (Math.random() - 0.5) * 0.4;

      // Burst velocity
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 4.5;
      p.vx = Math.cos(angle) * speed;
      p.vy = 2.0 + Math.random() * 5.0;
      p.vz = Math.sin(angle) * speed;

      p.rotX = Math.random() * Math.PI;
      p.rotY = Math.random() * Math.PI;
      p.rotZ = Math.random() * Math.PI;
      p.rotSpeedX = (Math.random() - 0.5) * 12;
      p.rotSpeedY = (Math.random() - 0.5) * 12;
      p.rotSpeedZ = (Math.random() - 0.5) * 12;

      p.initialScale = 0.08 + Math.random() * 0.08;
      p.scale = p.initialScale;
      p.life = 0.45 + Math.random() * 0.25;
      p.maxLife = p.life;
      p.gravity = 25;

      // Color variation
      const tint = 0.85 + Math.random() * 0.3;
      p.r = Math.min(1, baseColor[0] * tint);
      p.g = Math.min(1, baseColor[1] * tint);
      p.b = Math.min(1, baseColor[2] * tint);

      if (isEmissive && def?.emissive) {
        p.r = Math.min(1, p.r + def.emissive[0]);
        p.g = Math.min(1, p.g + def.emissive[1]);
        p.b = Math.min(1, p.b + def.emissive[2]);
      }

      this.colorHelper.setRGB(p.r, p.g, p.b);
      this.instancedMesh.setColorAt(idx, this.colorHelper);
    }

    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Spawns subtle dust placement puffs when placing a block.
   */
  public spawnBlockPlace(x: number, y: number, z: number, blockId: BlockId): void {
    const def = BLOCK_DEFINITIONS[blockId];
    const baseColor = def ? def.color : [0.7, 0.7, 0.7];

    const count = 8;
    for (let i = 0; i < count; i++) {
      const idx = this.allocate();
      const p = this.particles[idx];
      p.active = true;

      const angle = (i / count) * Math.PI * 2;
      p.x = x + 0.5 + Math.cos(angle) * 0.45;
      p.y = y + 0.1;
      p.z = z + 0.5 + Math.sin(angle) * 0.45;

      p.vx = Math.cos(angle) * 1.8;
      p.vy = 0.8 + Math.random() * 1.5;
      p.vz = Math.sin(angle) * 1.8;

      p.rotX = 0;
      p.rotY = 0;
      p.rotZ = 0;
      p.rotSpeedX = 2;
      p.rotSpeedY = 2;
      p.rotSpeedZ = 2;

      p.initialScale = 0.05 + Math.random() * 0.04;
      p.scale = p.initialScale;
      p.life = 0.28;
      p.maxLife = 0.28;
      p.gravity = 6;

      p.r = baseColor[0] * 0.9;
      p.g = baseColor[1] * 0.9;
      p.b = baseColor[2] * 0.9;

      this.colorHelper.setRGB(p.r, p.g, p.b);
      this.instancedMesh.setColorAt(idx, this.colorHelper);
    }

    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Spawns tailored bullet impact effects (dust, sparks, chips) against voxels.
   */
  public spawnBulletImpact(hitPoint: THREE.Vector3, normal: THREE.Vector3, blockId: BlockId): void {
    const def = BLOCK_DEFINITIONS[blockId];
    const baseColor = def ? def.color : [0.8, 0.8, 0.8];

    const isMetal = (blockId === BlockId.METAL_DARK || blockId === BlockId.STEEL_PLATE || blockId === BlockId.METAL_GRATE);
    const isGlass = (blockId === BlockId.GLASS || blockId === BlockId.GLASS_CYAN || blockId === BlockId.GLASS_AMBER);
    const count = isMetal ? 10 : 7;

    for (let i = 0; i < count; i++) {
      const idx = this.allocate();
      const p = this.particles[idx];
      p.active = true;

      p.x = hitPoint.x + normal.x * 0.05;
      p.y = hitPoint.y + normal.y * 0.05;
      p.z = hitPoint.z + normal.z * 0.05;

      // Reflect outwards around normal
      const spread = 2.5;
      p.vx = normal.x * 3.5 + (Math.random() - 0.5) * spread;
      p.vy = normal.y * 3.5 + (Math.random() - 0.5) * spread;
      p.vz = normal.z * 3.5 + (Math.random() - 0.5) * spread;

      p.rotX = Math.random() * Math.PI;
      p.rotY = Math.random() * Math.PI;
      p.rotZ = Math.random() * Math.PI;
      p.rotSpeedX = (Math.random() - 0.5) * 16;
      p.rotSpeedY = (Math.random() - 0.5) * 16;
      p.rotSpeedZ = (Math.random() - 0.5) * 16;

      p.initialScale = isMetal ? 0.04 : 0.06;
      p.scale = p.initialScale;
      p.life = isMetal ? 0.22 : 0.35;
      p.maxLife = p.life;
      p.gravity = 18;

      if (isMetal) {
        // Glowing orange/yellow sparks
        p.r = 1.0;
        p.g = 0.75 + Math.random() * 0.25;
        p.b = 0.2;
      } else if (isGlass) {
        // Specular cyan glints
        p.r = 0.7;
        p.g = 0.95;
        p.b = 1.0;
      } else {
        p.r = baseColor[0] * 0.9;
        p.g = baseColor[1] * 0.9;
        p.b = baseColor[2] * 0.9;
      }

      this.colorHelper.setRGB(p.r, p.g, p.b);
      this.instancedMesh.setColorAt(idx, this.colorHelper);
    }

    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Spawns impact splatter when striking an enemy player or bot.
   */
  public spawnHitSplatter(hitPoint: THREE.Vector3, isHeadshot: boolean): void {
    const count = isHeadshot ? 16 : 8;

    for (let i = 0; i < count; i++) {
      const idx = this.allocate();
      const p = this.particles[idx];
      p.active = true;

      p.x = hitPoint.x;
      p.y = hitPoint.y;
      p.z = hitPoint.z;

      p.vx = (Math.random() - 0.5) * (isHeadshot ? 5.5 : 3.5);
      p.vy = 1.5 + Math.random() * (isHeadshot ? 4.5 : 2.5);
      p.vz = (Math.random() - 0.5) * (isHeadshot ? 5.5 : 3.5);

      p.rotX = 0;
      p.rotY = 0;
      p.rotZ = 0;
      p.rotSpeedX = 4;
      p.rotSpeedY = 4;
      p.rotSpeedZ = 4;

      p.initialScale = isHeadshot ? 0.08 : 0.055;
      p.scale = p.initialScale;
      p.life = 0.35;
      p.maxLife = 0.35;
      p.gravity = 20;

      if (isHeadshot) {
        // Golden critical hit shards
        p.r = 1.0;
        p.g = 0.85;
        p.b = 0.15;
      } else {
        // Cyber red combat hit particles
        p.r = 1.0;
        p.g = 0.1;
        p.b = 0.25;
      }

      this.colorHelper.setRGB(p.r, p.g, p.b);
      this.instancedMesh.setColorAt(idx, this.colorHelper);
    }

    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Spawns high-impact explosion shockwave particles and debris shards.
   */
  public spawnExplosion(center: THREE.Vector3, radius: number): void {
    const count = 36;
    for (let i = 0; i < count; i++) {
      const idx = this.allocate();
      const p = this.particles[idx];
      p.active = true;

      p.x = center.x + (Math.random() - 0.5) * 0.4;
      p.y = center.y + (Math.random() - 0.5) * 0.4;
      p.z = center.z + (Math.random() - 0.5) * 0.4;

      // Spherical 3D blast trajectory
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 6.0 + Math.random() * (radius * 4.5);

      p.vx = Math.sin(phi) * Math.cos(theta) * speed;
      p.vy = Math.abs(Math.cos(phi)) * (speed * 0.8) + 3.0;
      p.vz = Math.sin(phi) * Math.sin(theta) * speed;

      p.rotX = Math.random() * Math.PI;
      p.rotY = Math.random() * Math.PI;
      p.rotZ = Math.random() * Math.PI;
      p.rotSpeedX = (Math.random() - 0.5) * 20;
      p.rotSpeedY = (Math.random() - 0.5) * 20;
      p.rotSpeedZ = (Math.random() - 0.5) * 20;

      p.initialScale = 0.12 + Math.random() * 0.14;
      p.scale = p.initialScale;
      p.life = 0.55 + Math.random() * 0.35;
      p.maxLife = p.life;
      p.gravity = 22;

      // Fiery blast colors (Orange, yellow, bright ember red)
      const isFire = Math.random() > 0.35;
      if (isFire) {
        p.r = 1.0;
        p.g = 0.45 + Math.random() * 0.5;
        p.b = 0.05;
      } else {
        // Concrete & rock shrapnel
        p.r = 0.35 + Math.random() * 0.2;
        p.g = 0.35 + Math.random() * 0.2;
        p.b = 0.35 + Math.random() * 0.2;
      }

      this.colorHelper.setRGB(p.r, p.g, p.b);
      this.instancedMesh.setColorAt(idx, this.colorHelper);
    }

    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Fixed frame update for particle physics and instance transforms.
   */
  public update(dt: number): void {
    let hasActive = false;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      hasActive = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }

      // Physics integration
      p.vy -= p.gravity * dt;
      p.vx *= Math.max(0, 1 - 1.2 * dt);
      p.vz *= Math.max(0, 1 - 1.2 * dt);

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      p.rotX += p.rotSpeedX * dt;
      p.rotY += p.rotSpeedY * dt;
      p.rotZ += p.rotSpeedZ * dt;

      // Shrink over lifespan
      const progress = p.life / p.maxLife;
      const curScale = p.initialScale * progress;

      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
      this.dummy.scale.set(curScale, curScale, curScale);
      this.dummy.updateMatrix();

      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }

    if (hasActive) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.scene.remove(this.instancedMesh);
    this.instancedMesh.geometry.dispose();
    if (Array.isArray(this.instancedMesh.material)) {
      this.instancedMesh.material.forEach((m) => m.dispose());
    } else {
      this.instancedMesh.material.dispose();
    }
  }
}
