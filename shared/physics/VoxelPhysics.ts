import { Vec3 } from '../math/Vector3.ts';
import { AABB } from '../math/AABB.ts';
import { VoxelWorld } from '../world/VoxelWorld.ts';
import { MAX_STEP_HEIGHT } from '../constants.ts';

export interface CollisionResult {
  position: Vec3;
  velocity: Vec3;
  isGrounded: boolean;
  hitCeiling: boolean;
  collidedX: boolean;
  collidedZ: boolean;
}

const EPSILON = 0.0001;

/**
 * Deterministic Swept-AABB vs Voxel Grid Collision Resolver.
 * Shared between client (prediction) and server (authoritative physics).
 */
export class VoxelPhysics {
  private static tempAABB = new AABB();

  /**
   * Checks whether an AABB intersects any solid voxel in the world.
   */
  public static aabbCollidesWithWorld(aabb: AABB, world: VoxelWorld): boolean {
    const minX = Math.floor(aabb.min.x + EPSILON);
    const maxX = Math.floor(aabb.max.x - EPSILON);
    const minY = Math.floor(aabb.min.y + EPSILON);
    const maxY = Math.floor(aabb.max.y - EPSILON);
    const minZ = Math.floor(aabb.min.z + EPSILON);
    const maxZ = Math.floor(aabb.max.z - EPSILON);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (world.isSolid(x, y, z)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Resolves continuous movement for an AABB through the voxel grid.
   * Handles axis separation, wall sliding, step-up/stairs, and slope traversal.
   */
  public static moveAABB(
    pos: Vec3,
    velocity: Vec3,
    width: number,
    height: number,
    world: VoxelWorld,
    dt: number,
    wasGrounded: boolean
  ): CollisionResult {
    const halfWidth = width * 0.5;
    let isGrounded = false;
    let hitCeiling = false;
    let collidedX = false;
    let collidedZ = false;

    let posX = pos.x;
    let posY = pos.y;
    let posZ = pos.z;

    let velX = velocity.x;
    let velY = velocity.y;
    let velZ = velocity.z;

    const dx = velX * dt;
    const dy = velY * dt;
    const dz = velZ * dt;

    // -------------------------------------------------------------
    // 1. VERTICAL (Y-AXIS) RESOLUTION
    // -------------------------------------------------------------
    if (dy !== 0) {
      const targetY = posY + dy;
      const minX = Math.floor(posX - halfWidth + EPSILON);
      const maxX = Math.floor(posX + halfWidth - EPSILON);
      const minZ = Math.floor(posZ - halfWidth + EPSILON);
      const maxZ = Math.floor(posZ + halfWidth - EPSILON);

      if (dy < 0) {
        // Falling down
        const checkMinY = Math.floor(targetY + EPSILON);
        const checkMaxY = Math.floor(posY + EPSILON);

        let highestSolidY = -Infinity;
        for (let y = checkMaxY; y >= checkMinY; y--) {
          for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
              if (world.isSolid(x, y, z)) {
                highestSolidY = Math.max(highestSolidY, y + 1);
              }
            }
          }
          if (highestSolidY !== -Infinity) break;
        }

        if (highestSolidY !== -Infinity && targetY <= highestSolidY) {
          posY = highestSolidY;
          velY = 0;
          isGrounded = true;
        } else {
          posY = targetY;
        }
      } else {
        // Jumping up
        const checkMinY = Math.floor(posY + height - EPSILON);
        const checkMaxY = Math.floor(targetY + height - EPSILON);

        let lowestCeilingY = Infinity;
        for (let y = checkMinY; y <= checkMaxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
              if (world.isSolid(x, y, z)) {
                lowestCeilingY = Math.min(lowestCeilingY, y);
              }
            }
          }
          if (lowestCeilingY !== Infinity) break;
        }

        if (lowestCeilingY !== Infinity && targetY + height >= lowestCeilingY) {
          posY = lowestCeilingY - height;
          velY = 0;
          hitCeiling = true;
        } else {
          posY = targetY;
        }
      }
    }

    // Ground probe to verify grounded state if dy was near zero
    if (!isGrounded && wasGrounded && Math.abs(dy) <= 0.001) {
      this.tempAABB.set(
        posX - halfWidth,
        posY - 0.05,
        posZ - halfWidth,
        posX + halfWidth,
        posY,
        posZ + halfWidth
      );
      if (this.aabbCollidesWithWorld(this.tempAABB, world)) {
        isGrounded = true;
      }
    }

    // -------------------------------------------------------------
    // 2. HORIZONTAL (X-AXIS) RESOLUTION with STEP-UP
    // -------------------------------------------------------------
    if (dx !== 0) {
      const stepSuccess = this.tryMoveWithStep(
        posX,
        posY,
        posZ,
        dx,
        0,
        halfWidth,
        height,
        world,
        isGrounded
      );

      if (stepSuccess.moved) {
        posX = stepSuccess.newX;
        posY = stepSuccess.newY;
      } else {
        // Collided with wall
        collidedX = true;
        velX = 0;
        if (dx > 0) {
          posX = Math.floor(posX + halfWidth + dx) - halfWidth - EPSILON;
        } else {
          posX = Math.floor(posX - halfWidth + dx) + 1 + halfWidth + EPSILON;
        }
      }
    }

    // -------------------------------------------------------------
    // 3. HORIZONTAL (Z-AXIS) RESOLUTION with STEP-UP
    // -------------------------------------------------------------
    if (dz !== 0) {
      const stepSuccess = this.tryMoveWithStep(
        posX,
        posY,
        posZ,
        0,
        dz,
        halfWidth,
        height,
        world,
        isGrounded
      );

      if (stepSuccess.moved) {
        posZ = stepSuccess.newZ;
        posY = stepSuccess.newY;
      } else {
        // Collided with wall
        collidedZ = true;
        velZ = 0;
        if (dz > 0) {
          posZ = Math.floor(posZ + halfWidth + dz) - halfWidth - EPSILON;
        } else {
          posZ = Math.floor(posZ - halfWidth + dz) + 1 + halfWidth + EPSILON;
        }
      }
    }

    return {
      position: new Vec3(posX, posY, posZ),
      velocity: new Vec3(velX, velY, velZ),
      isGrounded,
      hitCeiling,
      collidedX,
      collidedZ
    };
  }

  /**
   * Helper to attempt horizontal movement, trying regular slide first,
   * then auto-stepping up small obstacles (stairs, slabs) if grounded.
   */
  private static tryMoveWithStep(
    posX: number,
    posY: number,
    posZ: number,
    dx: number,
    dz: number,
    halfWidth: number,
    height: number,
    world: VoxelWorld,
    isGrounded: boolean
  ): { moved: boolean; newX: number; newY: number; newZ: number } {
    const targetX = posX + dx;
    const targetZ = posZ + dz;

    // First try: Normal horizontal move at current posY
    this.tempAABB.set(
      targetX - halfWidth,
      posY,
      targetZ - halfWidth,
      targetX + halfWidth,
      posY + height,
      targetZ + halfWidth
    );

    if (!this.aabbCollidesWithWorld(this.tempAABB, world)) {
      return { moved: true, newX: targetX, newY: posY, newZ: targetZ };
    }

    // Second try: If grounded, attempt to step up up to MAX_STEP_HEIGHT
    if (isGrounded) {
      const stepY = posY + MAX_STEP_HEIGHT;
      // Check headroom above first
      this.tempAABB.set(
        posX - halfWidth,
        posY + height,
        posZ - halfWidth,
        posX + halfWidth,
        stepY + height,
        posZ + halfWidth
      );
      if (!this.aabbCollidesWithWorld(this.tempAABB, world)) {
        // Try stepping forward at elevated height
        this.tempAABB.set(
          targetX - halfWidth,
          stepY,
          targetZ - halfWidth,
          targetX + halfWidth,
          stepY + height,
          targetZ + halfWidth
        );
        if (!this.aabbCollidesWithWorld(this.tempAABB, world)) {
          // Find the exact ground level at the stepped position
          let groundY = posY;
          for (let y = Math.floor(stepY); y >= Math.floor(posY); y--) {
            this.tempAABB.set(
              targetX - halfWidth,
              y,
              targetZ - halfWidth,
              targetX + halfWidth,
              y + 1,
              targetZ + halfWidth
            );
            if (this.aabbCollidesWithWorld(this.tempAABB, world)) {
              groundY = y + 1;
              break;
            }
          }
          return { moved: true, newX: targetX, newY: groundY, newZ: targetZ };
        }
      }
    }

    return { moved: false, newX: posX, newY: posY, newZ: posZ };
  }
}
