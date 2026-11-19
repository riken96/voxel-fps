import { Vec3 } from '../../../shared/math/Vector3.ts';
import { Ray } from '../../../shared/math/Ray.ts';
import { FIXED_DT } from '../../../shared/constants.ts';
import { UserInput } from '../../../shared/physics/PlayerState.ts';
import { WeaponId, getWeaponDef } from '../../../shared/combat/Weapons.ts';
import { GameMode } from '../../../shared/match/MatchTypes.ts';
import { ShootMessage, MessageType } from '../../../shared/protocol/Messages.ts';
import { ClientSession, Room } from '../match/Room.ts';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export class AIBot {
  public session: ClientSession;
  public difficulty: BotDifficulty;
  private room: Room;

  // Behavior Tuning by Difficulty
  private lookSpeed: number;        // Radians per second
  private accuracySpread: number;   // Noise spread angle (rad)
  private reactionTime: number;     // Seconds to acquire and pull trigger
  private strafeFrequency: number;  // Seconds between strafe direction switches
  private preferredRange: number;   // Preferred combat distance in meters

  // Runtime State
  private targetPlayerId: string | null = null;
  private patrolTarget: Vec3 | null = null;
  private reactionTimer = 0;
  private strafeDir = 1;
  private strafeTimer = 0;
  private jumpTimer = 0;
  private reloadTimer = 0;
  private isReloading = false;
  private sequence = 0;
  private lastShootTime = 0;

  constructor(session: ClientSession, room: Room, difficulty: BotDifficulty = 'medium') {
    this.session = session;
    this.room = room;
    this.difficulty = difficulty;

    switch (difficulty) {
      case 'easy':
        this.lookSpeed = 4.2;
        this.accuracySpread = 0.08;
        this.reactionTime = 0.40;
        this.strafeFrequency = 2.4;
        this.preferredRange = 12;
        break;
      case 'hard':
        this.lookSpeed = 12.0;
        this.accuracySpread = 0.012;
        this.reactionTime = 0.10;
        this.strafeFrequency = 0.9;
        this.preferredRange = 14;
        break;
      case 'medium':
      default:
        this.lookSpeed = 7.5;
        this.accuracySpread = 0.035;
        this.reactionTime = 0.22;
        this.strafeFrequency = 1.6;
        this.preferredRange = 13;
        break;
    }

    if (this.session.activeWeapon === WeaponId.SNIPER_RIFLE) {
      this.preferredRange = 22;
    } else if (this.session.activeWeapon === WeaponId.SHOTGUN) {
      this.preferredRange = 7;
    }
  }

  public update(dt: number): UserInput {
    this.sequence++;

    // 1. If Bot is eliminated / dead, return idle input
    if (this.session.health <= 0) {
      this.targetPlayerId = null;
      return {
        sequence: this.sequence,
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        crouch: false,
        sprint: false,
        yaw: this.session.state.yaw,
        pitch: this.session.state.pitch,
        dt
      };
    }

    // 2. Target Acquisition & Line of Sight Evaluation
    const target = this.findBestTarget();
    let currentYaw = this.session.state.yaw;
    let currentPitch = this.session.state.pitch;

    let forward = false;
    let backward = false;
    let left = false;
    let right = false;
    let jump = false;
    let sprint = false;
    let crouch = false;

    if (target) {
      this.targetPlayerId = target.id;
      const dx = target.state.position.x - this.session.state.position.x;
      const dy = (target.state.position.y + 1.35) - (this.session.state.position.y + 1.55);
      const dz = target.state.position.z - this.session.state.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Aim angles towards target head/torso
      const desiredYaw = Math.atan2(-dx, -dz);
      const desiredPitch = Math.atan2(dy, dist);

      // Smooth aim tracking
      currentYaw = this.rotateTowards(currentYaw, desiredYaw, this.lookSpeed * dt);
      currentPitch = this.rotateTowards(currentPitch, desiredPitch, this.lookSpeed * dt);

      // Movement based on preferred combat distance
      if (dist > this.preferredRange + 2.0) {
        forward = true;
        sprint = this.difficulty !== 'easy' && dist > 18;
      } else if (dist < this.preferredRange - 2.5) {
        backward = true;
      }

      // Dynamic evasive strafing
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0) {
        this.strafeDir = Math.random() < 0.5 ? -1 : 1;
        this.strafeTimer = this.strafeFrequency * (0.8 + Math.random() * 0.4);
      }

      if (this.strafeDir > 0) right = true;
      else left = true;

      // Bunny hop / Slide jumps for Medium & Hard bots
      this.jumpTimer -= dt;
      if (this.session.state.isGrounded && this.jumpTimer <= 0) {
        if (Math.random() < (this.difficulty === 'hard' ? 0.45 : 0.2)) {
          jump = true;
          this.jumpTimer = 1.2 + Math.random() * 1.5;
        }
      }

      // Check aim alignment threshold before firing
      const angleErrYaw = Math.abs(this.angularDistance(currentYaw, desiredYaw));
      const angleErrPitch = Math.abs(currentPitch - desiredPitch);

      if (angleErrYaw < 0.22 && angleErrPitch < 0.22) {
        this.reactionTimer += dt;
        if (this.reactionTimer >= this.reactionTime) {
          this.handleCombatShooting(currentYaw, currentPitch);
        }
      } else {
        this.reactionTimer = Math.max(0, this.reactionTimer - dt * 2);
      }
    } else {
      // 3. Patrol / Roam Arena Navigation (No Target in sight)
      this.targetPlayerId = null;
      this.reactionTimer = 0;

      if (!this.patrolTarget || this.session.state.position.distanceTo(this.patrolTarget) < 3.0) {
        this.pickNewPatrolTarget();
      }

      if (this.patrolTarget) {
        const dx = this.patrolTarget.x - this.session.state.position.x;
        const dz = this.patrolTarget.z - this.session.state.position.z;
        const desiredYaw = Math.atan2(-dx, -dz);

        currentYaw = this.rotateTowards(currentYaw, desiredYaw, this.lookSpeed * dt * 0.7);
        currentPitch = this.rotateTowards(currentPitch, 0, this.lookSpeed * dt);
        forward = true;
      }

      // Obstacle detection and auto-jump over 1-block steps
      const sinY = Math.sin(currentYaw);
      const cosY = Math.cos(currentYaw);
      const aheadX = Math.floor(this.session.state.position.x - sinY * 0.85);
      const aheadY = Math.floor(this.session.state.position.y + 0.3);
      const aheadZ = Math.floor(this.session.state.position.z - cosY * 0.85);

      if (this.room.world.isSolid(aheadX, aheadY, aheadZ)) {
        jump = true;
      }
    }

    this.session.state.yaw = currentYaw;
    this.session.state.pitch = currentPitch;

    return {
      sequence: this.sequence,
      forward,
      backward,
      left,
      right,
      jump,
      crouch,
      sprint,
      yaw: currentYaw,
      pitch: currentPitch,
      dt
    };
  }

  private findBestTarget(): ClientSession | null {
    let bestTarget: ClientSession | null = null;
    let closestDistSq = 55 * 55; // 55m max range

    const botEyePos = new Vec3(
      this.session.state.position.x,
      this.session.state.position.y + 1.55,
      this.session.state.position.z
    );

    for (const [, other] of this.room.clients) {
      if (other.id === this.session.id || other.health <= 0) continue;

      // In TDM mode, ignore teammates
      if (this.room.mode === GameMode.TDM && other.team === this.session.team) {
        continue;
      }

      const dx = other.state.position.x - this.session.state.position.x;
      const dy = other.state.position.y - this.session.state.position.y;
      const dz = other.state.position.z - this.session.state.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq > closestDistSq) continue;
      const dist = Math.sqrt(distSq);

      // Line of Sight check via 3D DDA voxel raycast
      const targetCenter = new Vec3(
        other.state.position.x,
        other.state.position.y + 1.35,
        other.state.position.z
      );
      const dir = targetCenter.clone().sub(botEyePos).normalize();
      const ray = new Ray(botEyePos, dir);

      const hit = this.room.world.raycast(ray, dist);
      // If ray doesn't hit any solid block before target, LOS is open!
      if (!hit.hit || hit.distance >= dist - 0.5) {
        closestDistSq = distSq;
        bestTarget = other;
      }
    }

    return bestTarget;
  }

  private handleCombatShooting(currentYaw: number, currentPitch: number): void {
    const weapon = getWeaponDef(this.session.activeWeapon);
    const now = this.room.getServerTime();

    // 1. Handle Reload
    if (this.session.ammoInMag <= 0) {
      if (!this.isReloading) {
        this.isReloading = true;
        this.reloadTimer = weapon.reloadTimeMs / 1000;
      } else {
        this.reloadTimer -= FIXED_DT;
        if (this.reloadTimer <= 0) {
          this.isReloading = false;
          this.session.ammoInMag = weapon.magazineSize;
        }
      }
      return;
    }

    // 2. Fire Rate Check
    if (now - this.lastShootTime < weapon.fireRateMs) {
      return;
    }

    this.lastShootTime = now;
    this.session.ammoInMag--;

    // 3. Compute shot direction with humanized accuracy noise
    const noiseYaw = currentYaw + (Math.random() - 0.5) * this.accuracySpread;
    const noisePitch = currentPitch + (Math.random() - 0.5) * this.accuracySpread;
    const cosPitch = Math.cos(noisePitch);

    const dirX = -Math.sin(noiseYaw) * cosPitch;
    const dirY = Math.sin(noisePitch);
    const dirZ = -Math.cos(noiseYaw) * cosPitch;

    const origin: [number, number, number] = [
      this.session.state.position.x,
      this.session.state.position.y + 1.55,
      this.session.state.position.z
    ];

    const shootMsg: ShootMessage = {
      type: MessageType.C2S_SHOOT,
      weaponId: weapon.id,
      origin,
      direction: [dirX, dirY, dirZ],
      clientTime: now
    };

    // Execute authoritative shot on the room
    this.room.handleShoot(this.session, shootMsg);
  }

  private pickNewPatrolTarget(): void {
    const spawns = this.room.world.findSpawns();
    if (spawns.length > 0 && Math.random() < 0.6) {
      const sp = spawns[Math.floor(Math.random() * spawns.length)];
      this.patrolTarget = new Vec3(sp[0], sp[1], sp[2]);
    } else {
      // Pick random accessible point in arena
      const rx = (Math.random() - 0.5) * 32;
      const rz = (Math.random() - 0.5) * 32;
      this.patrolTarget = new Vec3(rx, 2, rz);
    }
  }

  private rotateTowards(current: number, target: number, maxStep: number): number {
    let diff = this.angularDistance(current, target);
    if (Math.abs(diff) <= maxStep) return target;
    return current + Math.sign(diff) * maxStep;
  }

  private angularDistance(a: number, b: number): number {
    let diff = b - a;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
  }
}
