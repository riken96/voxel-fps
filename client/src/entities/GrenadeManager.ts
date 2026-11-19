import * as THREE from 'three';
import { VoxelWorld } from '@shared/world/VoxelWorld.ts';
import { BlockId } from '@shared/constants.ts';
import { ParticleManager } from '../rendering/ParticleManager.ts';
import { SoundFx } from '../audio/SoundFx.ts';

export interface ActiveGrenade {
  id: string;
  mesh: THREE.Group;
  fuseLight: THREE.PointLight;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  fuse: number;
  totalFuse: number;
  isLocal: boolean;
}

export class GrenadeManager {
  private scene: THREE.Scene;
  private particleManager: ParticleManager;
  private soundFx: SoundFx;
  private grenades: Map<string, ActiveGrenade> = new Map();
  private nextId = 1;

  public onExplodeBroadcast?: (x: number, y: number, z: number, id: string) => void;

  constructor(scene: THREE.Scene, particleManager: ParticleManager, soundFx: SoundFx) {
    this.scene = scene;
    this.particleManager = particleManager;
    this.soundFx = soundFx;
  }

  public spawnGrenade(
    origin: THREE.Vector3,
    velocity: THREE.Vector3,
    isLocal: boolean,
    customId?: string
  ): ActiveGrenade {
    const id = customId || `grenade_${this.nextId++}_${Date.now()}`;

    // Create 3D Grenade model (tactical cylindrical canister with red/orange fuse LED)
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.22, 10);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2e3d30, // Olive drab
      roughness: 0.6,
      metalness: 0.4
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Pin & Lever Cap
    const capGeo = new THREE.BoxGeometry(0.06, 0.04, 0.06);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 0.13;
    group.add(cap);

    // Blinking Fuse LED
    const ledGeo = new THREE.SphereGeometry(0.025, 6, 6);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(0, 0.14, 0.05);
    group.add(led);

    const fuseLight = new THREE.PointLight(0xff1744, 1.2, 2.5);
    fuseLight.position.set(0, 0.14, 0.05);
    group.add(fuseLight);

    group.position.copy(origin);
    this.scene.add(group);

    const grenade: ActiveGrenade = {
      id,
      mesh: group,
      fuseLight,
      x: origin.x,
      y: origin.y,
      z: origin.z,
      vx: velocity.x,
      vy: velocity.y,
      vz: velocity.z,
      rotX: Math.random() * Math.PI,
      rotY: Math.random() * Math.PI,
      rotZ: Math.random() * Math.PI,
      fuse: 2.2,
      totalFuse: 2.2,
      isLocal
    };

    this.grenades.set(id, grenade);
    return grenade;
  }

  public update(
    dt: number,
    world: VoxelWorld,
    localPlayerPos: { x: number; y: number; z: number },
    onCameraTrauma?: (amount: number) => void
  ): void {
    const toRemove: string[] = [];

    for (const [id, g] of this.grenades) {
      g.fuse -= dt;

      // LED Blinking speed accelerates as fuse expires
      const blinkRate = Math.max(0.08, (g.fuse / g.totalFuse) * 0.4);
      const isBlink = Math.floor(g.fuse / blinkRate) % 2 === 0;
      g.fuseLight.intensity = isBlink ? 2.0 : 0.2;

      // Fuse expired: Detonate!
      if (g.fuse <= 0) {
        this.detonate(g.x, g.y, g.z, world, localPlayerPos, onCameraTrauma);
        toRemove.push(id);
        if (g.isLocal && this.onExplodeBroadcast) {
          this.onExplodeBroadcast(g.x, g.y, g.z, id);
        }
        continue;
      }

      // Physics: Gravity & Trajectory Integration
      g.vy -= 24.0 * dt;

      const nextX = g.x + g.vx * dt;
      const nextY = g.y + g.vy * dt;
      const nextZ = g.z + g.vz * dt;

      // Voxel collision & bouncing
      const bx = Math.floor(nextX);
      const by = Math.floor(nextY);
      const bz = Math.floor(nextZ);

      if (world.isSolid(bx, by, bz)) {
        // Simple normal reflection
        if (world.isSolid(bx, Math.floor(g.y), Math.floor(g.z))) {
          g.vx = -g.vx * 0.5;
        } else if (world.isSolid(Math.floor(g.x), by, Math.floor(g.z))) {
          g.vy = -g.vy * 0.45;
          g.vx *= 0.85; // friction on floor
          g.vz *= 0.85;
        } else {
          g.vz = -g.vz * 0.5;
        }
      } else {
        g.x = nextX;
        g.y = nextY;
        g.z = nextZ;
      }

      // Tumbling rotation
      g.rotX += 6.0 * dt;
      g.rotZ += 4.0 * dt;

      g.mesh.position.set(g.x, g.y, g.z);
      g.mesh.rotation.set(g.rotX, g.rotY, g.rotZ);
    }

    for (const id of toRemove) {
      const g = this.grenades.get(id);
      if (g) {
        this.scene.remove(g.mesh);
        this.grenades.delete(id);
      }
    }
  }

  public detonate(
    x: number,
    y: number,
    z: number,
    world: VoxelWorld,
    localPlayerPos: { x: number; y: number; z: number },
    onCameraTrauma?: (amount: number) => void
  ): void {
    const center = new THREE.Vector3(x, y, z);
    const radius = 2.4;

    // 1. Carve physical voxel blast crater
    const rx = Math.ceil(radius);
    const ry = Math.ceil(radius);
    const rz = Math.ceil(radius);
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);
    const rSq = radius * radius;

    for (let dx = -rx; dx <= rx; dx++) {
      for (let dy = -ry; dy <= ry; dy++) {
        for (let dz = -rz; dz <= rz; dz++) {
          if (dx * dx + dy * dy + dz * dz <= rSq) {
            const cur = world.getBlock(bx + dx, by + dy, bz + dz);
            if (cur !== BlockId.AIR && cur !== BlockId.BARRIER) {
              world.setBlock(bx + dx, by + dy, bz + dz, BlockId.AIR);
            }
          }
        }
      }
    }

    // 2. Spawn 3D InstancedMesh explosive particle blast
    this.particleManager.spawnExplosion(center, radius);

    // 3. Play 3D spatial explosion sound
    this.soundFx.playExplosion(x, y, z);

    // 4. Camera trauma shake based on distance
    const dx = x - localPlayerPos.x;
    const dy = y - localPlayerPos.y;
    const dz = z - localPlayerPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 22.0 && onCameraTrauma) {
      const traumaFactor = Math.max(0.04, (1.0 - dist / 22.0) * 0.16);
      onCameraTrauma(traumaFactor);
    }
  }

  public dispose(): void {
    for (const [, g] of this.grenades) {
      this.scene.remove(g.mesh);
    }
    this.grenades.clear();
  }
}
