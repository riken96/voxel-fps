import {
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  BlockId
} from '../constants.ts';
import { Chunk } from './Chunk.ts';
import { isBlockSolid } from './BlockTypes.ts';
import { Ray, VoxelRaycastHit } from '../math/Ray.ts';
import { Vec3 } from '../math/Vector3.ts';

export class VoxelWorld {
  public chunks: Map<string, Chunk> = new Map();

  public static toChunkCoord(val: number, size: number): number {
    return Math.floor(val / size);
  }

  public static toLocalCoord(val: number, size: number): number {
    const mod = val % size;
    return mod < 0 ? mod + size : mod;
  }

  public getOrCreateChunk(cx: number, cy: number, cz: number): Chunk {
    const key = Chunk.getKey(cx, cy, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cy, cz);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  public getChunk(cx: number, cy: number, cz: number): Chunk | undefined {
    return this.chunks.get(Chunk.getKey(cx, cy, cz));
  }

  public getBlock(x: number, y: number, z: number): number {
    const cx = VoxelWorld.toChunkCoord(x, CHUNK_SIZE_X);
    const cy = VoxelWorld.toChunkCoord(y, CHUNK_SIZE_Y);
    const cz = VoxelWorld.toChunkCoord(z, CHUNK_SIZE_Z);

    const chunk = this.getChunk(cx, cy, cz);
    if (!chunk) return BlockId.AIR;

    const lx = VoxelWorld.toLocalCoord(x, CHUNK_SIZE_X);
    const ly = VoxelWorld.toLocalCoord(y, CHUNK_SIZE_Y);
    const lz = VoxelWorld.toLocalCoord(z, CHUNK_SIZE_Z);

    return chunk.getBlock(lx, ly, lz);
  }

  public isSolid(x: number, y: number, z: number): boolean {
    const id = this.getBlock(x, y, z);
    return isBlockSolid(id);
  }

  public setBlock(x: number, y: number, z: number, blockId: number): boolean {
    const cx = VoxelWorld.toChunkCoord(x, CHUNK_SIZE_X);
    const cy = VoxelWorld.toChunkCoord(y, CHUNK_SIZE_Y);
    const cz = VoxelWorld.toChunkCoord(z, CHUNK_SIZE_Z);

    const chunk = this.getOrCreateChunk(cx, cy, cz);

    const lx = VoxelWorld.toLocalCoord(x, CHUNK_SIZE_X);
    const ly = VoxelWorld.toLocalCoord(y, CHUNK_SIZE_Y);
    const lz = VoxelWorld.toLocalCoord(z, CHUNK_SIZE_Z);

    const changed = chunk.setBlock(lx, ly, lz, blockId);
    if (!changed) return false;

    // Boundary voxel update: trigger dirty flag on adjacent chunk for boundary face culling
    if (lx === 0) this.markChunkDirty(cx - 1, cy, cz);
    if (lx === CHUNK_SIZE_X - 1) this.markChunkDirty(cx + 1, cy, cz);
    if (ly === 0) this.markChunkDirty(cx, cy - 1, cz);
    if (ly === CHUNK_SIZE_Y - 1) this.markChunkDirty(cx, cy + 1, cz);
    if (lz === 0) this.markChunkDirty(cx, cy, cz - 1);
    if (lz === CHUNK_SIZE_Z - 1) this.markChunkDirty(cx, cy, cz + 1);

    return true;
  }

  private markChunkDirty(cx: number, cy: number, cz: number): void {
    const chunk = this.getChunk(cx, cy, cz);
    if (chunk) chunk.isDirty = true;
  }

  public fillBox(
    minX: number,
    minY: number,
    minZ: number,
    maxX: number,
    maxY: number,
    maxZ: number,
    blockId: number
  ): void {
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          this.setBlock(x, y, z, blockId);
        }
      }
    }
  }

  public raycast(ray: Ray, maxDistance = 64): VoxelRaycastHit {
    return ray.castVoxel((x, y, z) => {
      return this.isSolid(x, y, z) ? this.getBlock(x, y, z) : BlockId.AIR;
    }, maxDistance);
  }

  /**
   * Generates a stylized competitive FPS arena designed for movement testing,
   * bunny-hopping, vertical gameplay, stairs, and cover.
   */
  public generateDefaultArena(): void {
    const halfWidth = 32;
    const halfDepth = 32;

    // 1. Foundation / Floor
    this.fillBox(-halfWidth, -2, -halfDepth, halfWidth, -1, halfDepth, BlockId.STONE);
    this.fillBox(-halfWidth, 0, -halfDepth, halfWidth, 0, halfDepth, BlockId.CONCRETE);

    // Grid accent lines
    for (let x = -halfWidth; x <= halfWidth; x += 8) {
      for (let z = -halfDepth; z <= halfDepth; z++) {
        this.setBlock(x, 0, z, BlockId.METAL_DARK);
      }
    }
    for (let z = -halfDepth; z <= halfDepth; z += 8) {
      for (let x = -halfWidth; x <= halfWidth; x++) {
        this.setBlock(x, 0, z, BlockId.METAL_DARK);
      }
    }

    // 2. Perimeter Outer Walls with glowing neon rim
    const wallHeight = 8;
    // North and South walls
    this.fillBox(-halfWidth, 1, -halfDepth, halfWidth, wallHeight, -halfDepth, BlockId.CONCRETE);
    this.fillBox(-halfWidth, 1, halfDepth, halfWidth, wallHeight, halfDepth, BlockId.CONCRETE);
    // East and West walls
    this.fillBox(-halfWidth, 1, -halfDepth, -halfWidth, wallHeight, halfDepth, BlockId.CONCRETE);
    this.fillBox(halfWidth, 1, -halfDepth, halfWidth, wallHeight, halfDepth, BlockId.CONCRETE);

    // Top Neon Trims
    for (let x = -halfWidth; x <= halfWidth; x++) {
      this.setBlock(x, wallHeight + 1, -halfDepth, BlockId.NEON_CYAN);
      this.setBlock(x, wallHeight + 1, halfDepth, BlockId.NEON_CYAN);
    }
    for (let z = -halfDepth; z <= halfDepth; z++) {
      this.setBlock(-halfWidth, wallHeight + 1, z, BlockId.NEON_CYAN);
      this.setBlock(halfWidth, wallHeight + 1, z, BlockId.NEON_CYAN);
    }

    // 3. Central Monument / Raised Fighting Platform (height: 3)
    this.fillBox(-6, 1, -6, 6, 2, 6, BlockId.BRICK);
    this.fillBox(-5, 3, -5, 5, 3, 5, BlockId.STONE);
    this.fillBox(-2, 4, -2, 2, 4, 2, BlockId.METAL_DARK);
    this.setBlock(0, 5, 0, BlockId.NEON_ORANGE);

    // Stairs to Central Platform
    // North stairs
    for (let i = 0; i < 3; i++) {
      this.fillBox(-2, 1 + i, 7 + (2 - i), 2, 1 + i, 7 + (2 - i), BlockId.CONCRETE);
    }
    // South stairs
    for (let i = 0; i < 3; i++) {
      this.fillBox(-2, 1 + i, -7 - (2 - i), 2, 1 + i, -7 - (2 - i), BlockId.CONCRETE);
    }

    // 4. Tactical Cover & Crate Clusters
    const cratePlacements: [number, number, number, number][] = [
      // x, y, z, height
      [-12, 1, -10, 2],
      [-10, 1, -10, 1],
      [-12, 1, -8, 1],
      [14, 1, 12, 2],
      [12, 1, 12, 1],
      [14, 1, 14, 1],
      [-18, 1, 16, 2],
      [-16, 1, 16, 1],
      [18, 1, -18, 2],
      [16, 1, -18, 1]
    ];
    for (const [cx, cy, cz, h] of cratePlacements) {
      for (let y = cy; y < cy + h; y++) {
        this.setBlock(cx, y, cz, BlockId.CRATE);
      }
    }

    // 5. Two Sniper Towers (North-West and South-East)
    const buildTower = (startX: number, startZ: number) => {
      const towerHeight = 10;
      // Pillars
      this.fillBox(startX, 1, startZ, startX + 5, towerHeight, startZ + 5, BlockId.AIR);
      this.fillBox(startX, 1, startZ, startX, towerHeight, startZ, BlockId.METAL_DARK);
      this.fillBox(startX + 5, 1, startZ, startX + 5, towerHeight, startZ, BlockId.METAL_DARK);
      this.fillBox(startX, 1, startZ + 5, startX, towerHeight, startZ + 5, BlockId.METAL_DARK);
      this.fillBox(startX + 5, 1, startZ + 5, startX + 5, towerHeight, startZ + 5, BlockId.METAL_DARK);

      // Platform Floor
      this.fillBox(startX - 1, towerHeight, startZ - 1, startX + 6, towerHeight, startZ + 6, BlockId.WOOD_PLANK);
      // Half-wall railings
      for (let x = startX - 1; x <= startX + 6; x++) {
        this.setBlock(x, towerHeight + 1, startZ - 1, BlockId.METAL_DARK);
        this.setBlock(x, towerHeight + 1, startZ + 6, BlockId.METAL_DARK);
      }
      for (let z = startZ - 1; z <= startZ + 6; z++) {
        this.setBlock(startX - 1, towerHeight + 1, z, BlockId.METAL_DARK);
        this.setBlock(startX + 6, towerHeight + 1, z, BlockId.METAL_DARK);
      }
      // Spiral/stepped ramp up to tower
      for (let step = 0; step < towerHeight; step++) {
        this.setBlock(startX - 2 - Math.floor(step / 2), 1 + step, startZ + (step % 5), BlockId.CONCRETE);
      }
    };

    buildTower(-24, -24);
    buildTower(18, 18);

    // 6. Parkour / Bunny-hop Pillars (Test precise jumps and momentum)
    const parkourSpots: [number, number, number][] = [
      [-20, 2, 0],
      [-16, 3, 2],
      [-12, 4, 0],
      [-8, 5, 2],
      [-4, 6, 0]
    ];
    for (const [px, py, pz] of parkourSpots) {
      this.fillBox(px - 1, 1, pz - 1, px + 1, py, pz + 1, BlockId.CONCRETE);
      this.setBlock(px, py + 1, pz, BlockId.NEON_ORANGE);
    }

    // 7. Tunnel / Underpass (Testing ceiling collisions and lighting)
    this.fillBox(6, 1, -22, 12, 4, -8, BlockId.BRICK);
    // Hollow out inside of tunnel (height 3, width 4)
    this.fillBox(8, 1, -22, 10, 3, -8, BlockId.AIR);
  }

  public findSpawns(): [number, number, number][] {
    const list: [number, number, number][] = [];
    for (const [, chunk] of this.chunks) {
      if (chunk.isEmpty()) continue;
      for (let ly = 0; ly < CHUNK_SIZE_Y; ly++) {
        for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
          for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
            const b = chunk.getBlock(lx, ly, lz);
            if (b === BlockId.SPAWN_FFA || b === BlockId.SPAWN_RED || b === BlockId.SPAWN_BLUE) {
              const wx = chunk.cx * CHUNK_SIZE_X + lx;
              const wy = chunk.cy * CHUNK_SIZE_Y + ly;
              const wz = chunk.cz * CHUNK_SIZE_Z + lz;
              list.push([wx + 0.5, wy + 1.0, wz + 0.5]);
            }
          }
        }
      }
    }
    return list.length > 0 ? list : [[0, 6, 0], [-12, 3, -12], [12, 3, 12]];
  }
}
