import { Vec3 } from '../../../shared/math/Vector3.ts';
import { Ray } from '../../../shared/math/Ray.ts';
import { VoxelWorld } from '../../../shared/world/VoxelWorld.ts';
import { PlayerHitbox, HitboxPart } from '../../../shared/combat/Hitbox.ts';
import { WeaponDefinition } from '../../../shared/combat/Weapons.ts';

interface PlayerHistoricalRecord {
  pos: Vec3;
  crouched: boolean;
}

interface HistoricalTick {
  tick: number;
  time: number;
  players: Map<string, PlayerHistoricalRecord>;
}

export interface ShotResult {
  hitTargetId: string | null;
  hitPart: HitboxPart;
  hitPoint: Vec3;
  distance: number;
  isHeadshot: boolean;
  damage: number;
}

export class LagCompensator {
  private history: HistoricalTick[] = [];
  private maxHistoryTicks = 60; // ~1000ms at 60Hz
  private tempHitbox = new PlayerHitbox();

  public recordTick(
    tick: number,
    serverTime: number,
    activePlayers: Array<{ id: string; pos: Vec3; crouched: boolean }>
  ): void {
    const records = new Map<string, PlayerHistoricalRecord>();
    for (const p of activePlayers) {
      records.set(p.id, {
        pos: p.pos.clone(),
        crouched: p.crouched
      });
    }

    this.history.push({
      tick,
      time: serverTime,
      players: records
    });

    if (this.history.length > this.maxHistoryTicks) {
      this.history.shift();
    }
  }

  /**
   * Rewinds the world state to client's firing timestamp, checks voxel occlusion,
   * and tests ray against historical head/body hitboxes.
   */
  public evaluateShot(
    shooterId: string,
    origin: Vec3,
    direction: Vec3,
    rewindTime: number,
    currentServerTime: number,
    world: VoxelWorld,
    weapon: WeaponDefinition
  ): ShotResult {
    // 1. Clamp rewind window (max 450ms lag compensation)
    const minTime = Math.max(0, currentServerTime - 450);
    const clampedTime = Math.max(minTime, Math.min(currentServerTime, rewindTime));

    const ray = new Ray(origin, direction);

    // 2. Voxel world collision: Check if a solid wall blocks the bullet
    const wallHit = world.raycast(ray, weapon.range);
    const maxRayDistance = wallHit.hit ? wallHit.distance : weapon.range;

    // 3. Find historical snapshots bounding the rewind time
    let s0: HistoricalTick | null = null;
    let s1: HistoricalTick | null = null;

    if (this.history.length > 0) {
      const latest = this.history[this.history.length - 1];
      const oldest = this.history[0];

      if (clampedTime >= latest.time) {
        s0 = latest;
        s1 = latest;
      } else if (clampedTime <= oldest.time) {
        s0 = oldest;
        s1 = oldest;
      } else {
        s0 = oldest;
        s1 = latest;
        for (let i = 0; i < this.history.length - 1; i++) {
          if (this.history[i].time <= clampedTime && this.history[i + 1].time >= clampedTime) {
            s0 = this.history[i];
            s1 = this.history[i + 1];
            break;
          }
        }
      }
    }

    let closestHitId: string | null = null;
    let closestDist = maxRayDistance;
    let hitPart = HitboxPart.NONE;
    let hitPoint = wallHit.hit ? wallHit.hitPoint : ray.getPointAt(maxRayDistance);

    // 4. Test against all potential targets at their rewound positions
    if (s0 && s1) {
      const timeSpan = s1.time - s0.time;
      const alpha = timeSpan > 0 ? (clampedTime - s0.time) / timeSpan : 1;
      const clampedAlpha = Math.max(0, Math.min(1, alpha));

      for (const [targetId, record0] of s0.players) {
        if (targetId === shooterId) continue; // Cannot shoot oneself

        const record1 = s1.players.get(targetId);
        if (!record1) continue;

        // Interpolate target position to exact past millisecond
        const rewoundPos = new Vec3(
          record0.pos.x + (record1.pos.x - record0.pos.x) * clampedAlpha,
          record0.pos.y + (record1.pos.y - record0.pos.y) * clampedAlpha,
          record0.pos.z + (record1.pos.z - record0.pos.z) * clampedAlpha
        );

        this.tempHitbox.update(rewoundPos, record1.crouched);
        const hitResult = this.tempHitbox.testRay(ray);

        if (hitResult.hit && hitResult.distance < closestDist) {
          closestDist = hitResult.distance;
          closestHitId = targetId;
          hitPart = hitResult.part;
          hitPoint = hitResult.hitPoint;
        }
      }
    }

    const isHeadshot = hitPart === HitboxPart.HEAD;
    const baseDamage = isHeadshot ? weapon.damageHead : weapon.damageBody;

    return {
      hitTargetId: closestHitId,
      hitPart,
      hitPoint,
      distance: closestDist,
      isHeadshot,
      damage: closestHitId ? baseDamage : 0
    };
  }
}
