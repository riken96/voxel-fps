import * as THREE from 'three';
import { RemotePlayerSnapshot } from '@shared/protocol/Messages.ts';
import { PLAYER_WIDTH, PLAYER_HEIGHT } from '@shared/constants.ts';
import { Team } from '@shared/match/MatchTypes.ts';

interface StampedSnapshot {
  time: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  crouched: boolean;
  isSliding?: boolean;
}

/**
 * 3D Low-poly Voxel Player Avatar with limb animations
 * and hermite/lerp snapshot interpolation.
 */
export class RemotePlayer {
  public id: string;
  public username: string;
  public team: Team = Team.NONE;
  public group: THREE.Group;

  // Body Parts
  private head: THREE.Mesh;
  private torso: THREE.Mesh;
  private leftArm: THREE.Mesh;
  private rightArm: THREE.Mesh;
  private leftLeg: THREE.Mesh;
  private rightLeg: THREE.Mesh;
  private gun: THREE.Mesh;
  private nameplate: THREE.Sprite;

  // Snapshot buffer for interpolation
  private snapshots: StampedSnapshot[] = [];
  private walkTimer = 0;

  constructor(id: string, username: string, scene: THREE.Scene) {
    this.id = id;
    this.username = username;
    this.group = new THREE.Group();

    const skinMaterial = new THREE.MeshLambertMaterial({ color: 0x4fc3f7 });
    const darkMaterial = new THREE.MeshLambertMaterial({ color: 0x263238 });
    const visorMaterial = new THREE.MeshLambertMaterial({ color: 0x00ffcc, emissive: 0x00aa88 });
    const gunMaterial = new THREE.MeshLambertMaterial({ color: 0x212121 });

    // 1. Torso
    const torsoGeo = new THREE.BoxGeometry(0.5, 0.65, 0.28);
    this.torso = new THREE.Mesh(torsoGeo, skinMaterial);
    this.torso.position.y = 0.95;
    this.torso.castShadow = true;
    this.torso.receiveShadow = true;
    this.group.add(this.torso);

    // 2. Head
    const headGeo = new THREE.BoxGeometry(0.36, 0.36, 0.36);
    this.head = new THREE.Mesh(headGeo, darkMaterial);
    this.head.position.y = 1.45;
    this.head.castShadow = true;
    this.group.add(this.head);

    // Head Visor (Glow)
    const visorGeo = new THREE.BoxGeometry(0.28, 0.1, 0.05);
    const visor = new THREE.Mesh(visorGeo, visorMaterial);
    visor.position.set(0, 0.02, -0.19);
    this.head.add(visor);

    // 3. Arms
    const armGeo = new THREE.BoxGeometry(0.14, 0.6, 0.14);
    this.leftArm = new THREE.Mesh(armGeo, skinMaterial);
    this.leftArm.position.set(-0.35, 0.95, 0);
    this.leftArm.castShadow = true;
    this.group.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, skinMaterial);
    this.rightArm.position.set(0.35, 0.95, 0);
    this.rightArm.castShadow = true;
    this.group.add(this.rightArm);

    // 4. Weapon attached to right arm
    const gunGeo = new THREE.BoxGeometry(0.08, 0.12, 0.5);
    this.gun = new THREE.Mesh(gunGeo, gunMaterial);
    this.gun.position.set(0.05, -0.2, -0.25);
    this.rightArm.add(this.gun);

    // 5. Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.65, 0.18);
    this.leftLeg = new THREE.Mesh(legGeo, darkMaterial);
    this.leftLeg.position.set(-0.14, 0.35, 0);
    this.leftLeg.castShadow = true;
    this.group.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, darkMaterial);
    this.rightLeg.position.set(0.14, 0.35, 0);
    this.rightLeg.castShadow = true;
    this.group.add(this.rightLeg);

    // 6. Nameplate Canvas Sprite
    this.nameplate = this.createNameplateSprite(username);
    this.nameplate.position.y = 1.95;
    this.group.add(this.nameplate);

    scene.add(this.group);
  }

  private createNameplateSprite(name: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(10, 16, 26, 0.85)';
    ctx.roundRect(10, 10, 236, 44, 8);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 255, 204, 0.5)';
    ctx.lineWidth = 2;
    ctx.roundRect(10, 10, 236, 44, 8);
    ctx.stroke();

    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.5, 0.38, 1);
    return sprite;
  }

  public addSnapshot(snap: RemotePlayerSnapshot, serverTime: number): void {
    this.snapshots.push({
      time: serverTime,
      x: snap.x,
      y: snap.y,
      z: snap.z,
      vx: snap.vx,
      vy: snap.vy,
      vz: snap.vz,
      yaw: snap.yaw,
      pitch: snap.pitch,
      crouched: snap.crouched,
      isSliding: snap.isSliding
    });

    // Keep up to 30 snapshots (~1 second buffer)
    if (this.snapshots.length > 30) {
      this.snapshots.shift();
    }
  }

  /**
   * Evaluates snapshot interpolation at render target time.
   * Interpolation delay of ~70ms eliminates network jitter across all monitor refresh rates.
   */
  public updateInterpolation(renderTime: number, dt: number): void {
    if (this.snapshots.length === 0) return;

    if (this.snapshots.length === 1) {
      const s = this.snapshots[0];
      this.group.position.set(s.x, s.y, s.z);
      this.group.rotation.y = s.yaw;
      this.head.rotation.x = s.pitch;
      return;
    }

    // Find two snapshots s0 and s1 bounding renderTime
    let s0 = this.snapshots[0];
    let s1 = this.snapshots[this.snapshots.length - 1];

    for (let i = 0; i < this.snapshots.length - 1; i++) {
      if (this.snapshots[i].time <= renderTime && this.snapshots[i + 1].time >= renderTime) {
        s0 = this.snapshots[i];
        s1 = this.snapshots[i + 1];
        break;
      }
    }

    const timeSpan = s1.time - s0.time;
    let alpha = timeSpan > 0 ? (renderTime - s0.time) / timeSpan : 0;
    alpha = Math.max(0, Math.min(1.5, alpha)); // Clamped extrapolation

    // 1. Position interpolation (Lerp)
    const px = s0.x + (s1.x - s0.x) * alpha;
    const py = s0.y + (s1.y - s0.y) * alpha;
    const pz = s0.z + (s1.z - s0.z) * alpha;
    this.group.position.set(px, py, pz);

    // 2. Yaw & Pitch shortest angle lerp
    this.group.rotation.y = this.lerpAngle(s0.yaw, s1.yaw, alpha);
    this.head.rotation.x = s0.pitch + (s1.pitch - s0.pitch) * alpha;

    // 3. Crouching & Sliding scale & avatar tilt
    const isSliding = s1.isSliding || false;
    const targetScaleY = (s1.crouched || isSliding) ? 0.62 : 1.0;
    this.group.scale.y += (targetScaleY - this.group.scale.y) * Math.min(1, dt * 15);

    const targetTilt = isSliding ? -0.12 : 0;
    this.torso.rotation.z += (targetTilt - this.torso.rotation.z) * Math.min(1, dt * 12);

    // 4. Procedural Limb Animation
    const hozSpeed = Math.sqrt(s1.vx * s1.vx + s1.vz * s1.vz);
    if (hozSpeed > 0.8) {
      this.walkTimer += dt * (hozSpeed * 1.5);
      const legAngle = Math.sin(this.walkTimer) * 0.55;
      this.leftLeg.rotation.x = legAngle;
      this.rightLeg.rotation.x = -legAngle;
      this.leftArm.rotation.x = -legAngle * 0.6;
      this.rightArm.rotation.x = legAngle * 0.6;
    } else {
      // Idle return
      this.leftLeg.rotation.x *= 0.85;
      this.rightLeg.rotation.x *= 0.85;
      this.leftArm.rotation.x *= 0.85;
      this.rightArm.rotation.x *= 0.85;
    }
  }

  private lerpAngle(a: number, b: number, t: number): number {
    let diff = (b - a) % (Math.PI * 2);
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;
    return a + diff * t;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
  }
}
