import { Vec3 } from './Vector3.ts';

/**
 * Axis-Aligned Bounding Box (AABB) for deterministic collision checks.
 */
export class AABB {
  public min: Vec3;
  public max: Vec3;

  constructor(min = new Vec3(), max = new Vec3()) {
    this.min = min;
    this.max = max;
  }

  public set(
    minX: number,
    minY: number,
    minZ: number,
    maxX: number,
    maxY: number,
    maxZ: number
  ): this {
    this.min.set(minX, minY, minZ);
    this.max.set(maxX, maxY, maxZ);
    return this;
  }

  public copy(other: AABB): this {
    this.min.copy(other.min);
    this.max.copy(other.max);
    return this;
  }

  public clone(): AABB {
    return new AABB(this.min.clone(), this.max.clone());
  }

  public setFromCenterAndSize(center: Vec3, size: Vec3): this {
    const halfX = size.x * 0.5;
    const halfY = size.y * 0.5;
    const halfZ = size.z * 0.5;
    this.min.set(center.x - halfX, center.y - halfY, center.z - halfZ);
    this.max.set(center.x + halfX, center.y + halfY, center.z + halfZ);
    return this;
  }

  public setFromBottomCenter(bottomCenter: Vec3, width: number, height: number): this {
    const halfWidth = width * 0.5;
    this.min.set(bottomCenter.x - halfWidth, bottomCenter.y, bottomCenter.z - halfWidth);
    this.max.set(bottomCenter.x + halfWidth, bottomCenter.y + height, bottomCenter.z + halfWidth);
    return this;
  }

  public offset(dx: number, dy: number, dz: number): this {
    this.min.x += dx;
    this.min.y += dy;
    this.min.z += dz;
    this.max.x += dx;
    this.max.y += dy;
    this.max.z += dz;
    return this;
  }

  public intersects(other: AABB): boolean {
    return (
      this.min.x < other.max.x &&
      this.max.x > other.min.x &&
      this.min.y < other.max.y &&
      this.max.y > other.min.y &&
      this.min.z < other.max.z &&
      this.max.z > other.min.z
    );
  }

  public containsPoint(p: Vec3): boolean {
    return (
      p.x >= this.min.x &&
      p.x <= this.max.x &&
      p.y >= this.min.y &&
      p.y <= this.max.y &&
      p.z >= this.min.z &&
      p.z <= this.max.z
    );
  }

  public expand(margin: number): this {
    this.min.x -= margin;
    this.min.y -= margin;
    this.min.z -= margin;
    this.max.x += margin;
    this.max.y += margin;
    this.max.z += margin;
    return this;
  }
}
