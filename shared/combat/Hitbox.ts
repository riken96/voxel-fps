import { Vec3 } from '../math/Vector3.ts';
import { AABB } from '../math/AABB.ts';
import { Ray } from '../math/Ray.ts';

export enum HitboxPart {
  NONE = 0,
  BODY = 1,
  HEAD = 2
}

export interface HitboxRaycastResult {
  hit: boolean;
  part: HitboxPart;
  distance: number;
  hitPoint: Vec3;
}

/**
 * Player Hitbox component (Head and Body AABBs)
 * used for exact hitscan combat calculation on both client and server.
 */
export class PlayerHitbox {
  public headAABB = new AABB();
  public bodyAABB = new AABB();

  public update(pos: Vec3, isCrouched: boolean): void {
    const halfWidth = 0.3;

    if (isCrouched) {
      // Crouched Body: [0 .. 0.85]
      this.bodyAABB.set(
        pos.x - halfWidth,
        pos.y,
        pos.z - halfWidth,
        pos.x + halfWidth,
        pos.y + 0.85,
        pos.z + halfWidth
      );
      // Crouched Head: [0.85 .. 1.25]
      this.headAABB.set(
        pos.x - 0.22,
        pos.y + 0.85,
        pos.z - 0.22,
        pos.x + 0.22,
        pos.y + 1.25,
        pos.z + 0.22
      );
    } else {
      // Standing Body: [0 .. 1.3]
      this.bodyAABB.set(
        pos.x - halfWidth,
        pos.y,
        pos.z - halfWidth,
        pos.x + halfWidth,
        pos.y + 1.3,
        pos.z + halfWidth
      );
      // Standing Head: [1.3 .. 1.8]
      this.headAABB.set(
        pos.x - 0.22,
        pos.y + 1.3,
        pos.z - 0.22,
        pos.x + 0.22,
        pos.y + 1.8,
        pos.z + 0.22
      );
    }
  }

  /**
   * Fast Ray vs AABB intersection using the Slab Method.
   */
  public static intersectRayAABB(ray: Ray, aabb: AABB): { hit: boolean; distance: number } {
    let tmin = -Infinity;
    let tmax = Infinity;

    const ox = ray.origin.x;
    const oy = ray.origin.y;
    const oz = ray.origin.z;

    const dx = ray.direction.x;
    const dy = ray.direction.y;
    const dz = ray.direction.z;

    // X slab
    if (Math.abs(dx) > 0.000001) {
      const invD = 1 / dx;
      let t1 = (aabb.min.x - ox) * invD;
      let t2 = (aabb.max.x - ox) * invD;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return { hit: false, distance: 0 };
    } else if (ox < aabb.min.x || ox > aabb.max.x) {
      return { hit: false, distance: 0 };
    }

    // Y slab
    if (Math.abs(dy) > 0.000001) {
      const invD = 1 / dy;
      let t1 = (aabb.min.y - oy) * invD;
      let t2 = (aabb.max.y - oy) * invD;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return { hit: false, distance: 0 };
    } else if (oy < aabb.min.y || oy > aabb.max.y) {
      return { hit: false, distance: 0 };
    }

    // Z slab
    if (Math.abs(dz) > 0.000001) {
      const invD = 1 / dz;
      let t1 = (aabb.min.z - oz) * invD;
      let t2 = (aabb.max.z - oz) * invD;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return { hit: false, distance: 0 };
    } else if (oz < aabb.min.z || oz > aabb.max.z) {
      return { hit: false, distance: 0 };
    }

    if (tmax < 0) return { hit: false, distance: 0 };

    const dist = tmin >= 0 ? tmin : tmax;
    return { hit: true, distance: dist };
  }

  /**
   * Tests a ray against both head and body hitboxes, prioritizing
   * the closest intersection.
   */
  public testRay(ray: Ray): HitboxRaycastResult {
    const headHit = PlayerHitbox.intersectRayAABB(ray, this.headAABB);
    const bodyHit = PlayerHitbox.intersectRayAABB(ray, this.bodyAABB);

    if (!headHit.hit && !bodyHit.hit) {
      return { hit: false, part: HitboxPart.NONE, distance: 0, hitPoint: new Vec3() };
    }

    if (headHit.hit && bodyHit.hit) {
      if (headHit.distance <= bodyHit.distance) {
        return {
          hit: true,
          part: HitboxPart.HEAD,
          distance: headHit.distance,
          hitPoint: ray.getPointAt(headHit.distance)
        };
      } else {
        return {
          hit: true,
          part: HitboxPart.BODY,
          distance: bodyHit.distance,
          hitPoint: ray.getPointAt(bodyHit.distance)
        };
      }
    }

    if (headHit.hit) {
      return {
        hit: true,
        part: HitboxPart.HEAD,
        distance: headHit.distance,
        hitPoint: ray.getPointAt(headHit.distance)
      };
    }

    return {
      hit: true,
      part: HitboxPart.BODY,
      distance: bodyHit.distance,
      hitPoint: ray.getPointAt(bodyHit.distance)
    };
  }
}
