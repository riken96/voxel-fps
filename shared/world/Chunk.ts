import {
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  CHUNK_VOXEL_COUNT,
  BlockId
} from '../constants.ts';

export class Chunk {
  public readonly cx: number;
  public readonly cy: number;
  public readonly cz: number;
  public readonly key: string;

  public voxels: Uint8Array;
  public isDirty = true;
  public nonAirCount = 0;

  constructor(cx: number, cy: number, cz: number) {
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.key = Chunk.getKey(cx, cy, cz);
    this.voxels = new Uint8Array(CHUNK_VOXEL_COUNT);
  }

  public static getKey(cx: number, cy: number, cz: number): string {
    return `${cx},${cy},${cz}`;
  }

  public static getIndex(lx: number, ly: number, lz: number): number {
    return lx + CHUNK_SIZE_X * (lz + CHUNK_SIZE_Z * ly);
  }

  public getBlock(lx: number, ly: number, lz: number): number {
    if (
      lx < 0 || lx >= CHUNK_SIZE_X ||
      ly < 0 || ly >= CHUNK_SIZE_Y ||
      lz < 0 || lz >= CHUNK_SIZE_Z
    ) {
      return BlockId.AIR;
    }
    return this.voxels[Chunk.getIndex(lx, ly, lz)];
  }

  public setBlock(lx: number, ly: number, lz: number, blockId: number): boolean {
    if (
      lx < 0 || lx >= CHUNK_SIZE_X ||
      ly < 0 || ly >= CHUNK_SIZE_Y ||
      lz < 0 || lz >= CHUNK_SIZE_Z
    ) {
      return false;
    }
    const idx = Chunk.getIndex(lx, ly, lz);
    const prev = this.voxels[idx];
    if (prev === blockId) return false;

    this.voxels[idx] = blockId;
    if (prev === BlockId.AIR && blockId !== BlockId.AIR) {
      this.nonAirCount++;
    } else if (prev !== BlockId.AIR && blockId === BlockId.AIR) {
      this.nonAirCount--;
    }

    this.isDirty = true;
    return true;
  }

  public isEmpty(): boolean {
    return this.nonAirCount === 0;
  }
}
