import { Vec3 } from './Vector3.ts';

export interface VoxelRaycastHit {
  hit: boolean;
  blockX: number;
  blockY: number;
  blockZ: number;
  blockId: number;
  faceNormal: Vec3;
  distance: number;
  hitPoint: Vec3;
}

/**
 * 3D Ray with Fast Voxel Traversal (Amanatides & Woo DDA algorithm).
 */
export class Ray {
  public origin: Vec3;
  public direction: Vec3;

  constructor(origin = new Vec3(), direction = new Vec3(0, 0, -1)) {
    this.origin = origin;
    this.direction = direction.clone().normalize();
  }

  public set(origin: Vec3, direction: Vec3): this {
    this.origin.copy(origin);
    this.direction.copy(direction).normalize();
    return this;
  }

  public getPointAt(t: number, out = new Vec3()): Vec3 {
    return out.set(
      this.origin.x + this.direction.x * t,
      this.origin.y + this.direction.y * t,
      this.origin.z + this.direction.z * t
    );
  }

  /**
   * Fast Voxel Traversal Algorithm (3D DDA).
   * Visits voxels intersected by the ray in exact sequential order.
   */
  public castVoxel(
    isSolidBlock: (x: number, y: number, z: number) => number,
    maxDistance = 100
  ): VoxelRaycastHit {
    const origin = this.origin;
    const dir = this.direction;

    let currentX = Math.floor(origin.x);
    let currentY = Math.floor(origin.y);
    let currentZ = Math.floor(origin.z);

    const stepX = dir.x > 0 ? 1 : dir.x < 0 ? -1 : 0;
    const stepY = dir.y > 0 ? 1 : dir.y < 0 ? -1 : 0;
    const stepZ = dir.z > 0 ? 1 : dir.z < 0 ? -1 : 0;

    const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;

    let tMaxX = stepX > 0 ? (currentX + 1 - origin.x) * tDeltaX : (origin.x - currentX) * tDeltaX;
    let tMaxY = stepY > 0 ? (currentY + 1 - origin.y) * tDeltaY : (origin.y - currentY) * tDeltaY;
    let tMaxZ = stepZ > 0 ? (currentZ + 1 - origin.z) * tDeltaZ : (origin.z - currentZ) * tDeltaZ;

    const normal = new Vec3();
    let distanceTraveled = 0;

    // Check if the starting voxel is solid
    const startId = isSolidBlock(currentX, currentY, currentZ);
    if (startId > 0) {
      return {
        hit: true,
        blockX: currentX,
        blockY: currentY,
        blockZ: currentZ,
        blockId: startId,
        faceNormal: normal.set(0, 0, 0),
        distance: 0,
        hitPoint: origin.clone()
      };
    }

    while (distanceTraveled <= maxDistance) {
      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          distanceTraveled = tMaxX;
          currentX += stepX;
          tMaxX += tDeltaX;
          normal.set(-stepX, 0, 0);
        } else {
          distanceTraveled = tMaxZ;
          currentZ += stepZ;
          tMaxZ += tDeltaZ;
          normal.set(0, 0, -stepZ);
        }
      } else {
        if (tMaxY < tMaxZ) {
          distanceTraveled = tMaxY;
          currentY += stepY;
          tMaxY += tDeltaY;
          normal.set(0, -stepY, 0);
        } else {
          distanceTraveled = tMaxZ;
          currentZ += stepZ;
          tMaxZ += tDeltaZ;
          normal.set(0, 0, -stepZ);
        }
      }

      if (distanceTraveled > maxDistance) break;

      const blockId = isSolidBlock(currentX, currentY, currentZ);
      if (blockId > 0) {
        const hitPoint = this.getPointAt(distanceTraveled);
        return {
          hit: true,
          blockX: currentX,
          blockY: currentY,
          blockZ: currentZ,
          blockId,
          faceNormal: normal,
          distance: distanceTraveled,
          hitPoint
        };
      }
    }

    return {
      hit: false,
      blockX: 0,
      blockY: 0,
      blockZ: 0,
      blockId: 0,
      faceNormal: new Vec3(),
      distance: maxDistance,
      hitPoint: this.getPointAt(maxDistance)
    };
  }
}
