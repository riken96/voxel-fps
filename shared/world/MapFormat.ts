import { VoxelWorld } from './VoxelWorld.ts';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, BlockId } from '../constants.ts';

export interface VoxelBlockEntry {
  x: number;
  y: number;
  z: number;
  id: number;
}

export interface VoxelMapData {
  formatVersion: number;
  name: string;
  author: string;
  createdAt: string;
  environmentPreset?: string;
  spawnPoints: [number, number, number][];
  redSpawns?: [number, number, number][];
  blueSpawns?: [number, number, number][];
  blocks: [number, number, number, number][]; // [x, y, z, blockId]
}

/**
 * Serializes the VoxelWorld into a clean, compact JSON map schema.
 */
export function exportMapToJSON(
  world: VoxelWorld,
  name = 'Custom Voxel Arena',
  author = 'Community Builder',
  environmentPreset = 'cyber',
  spawnPoints?: [number, number, number][]
): VoxelMapData {
  const blocks: [number, number, number, number][] = [];
  const detectedFFASpawns: [number, number, number][] = [];
  const detectedRedSpawns: [number, number, number][] = [];
  const detectedBlueSpawns: [number, number, number][] = [];

  for (const [, chunk] of world.chunks) {
    if (chunk.isEmpty()) continue;

    for (let ly = 0; ly < CHUNK_SIZE_Y; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
          const blockId = chunk.getBlock(lx, ly, lz);
          if (blockId !== BlockId.AIR) {
            const wx = chunk.cx * CHUNK_SIZE_X + lx;
            const wy = chunk.cy * CHUNK_SIZE_Y + ly;
            const wz = chunk.cz * CHUNK_SIZE_Z + lz;
            blocks.push([wx, wy, wz, blockId]);

            if (blockId === BlockId.SPAWN_FFA) {
              detectedFFASpawns.push([wx, wy + 1, wz]);
            } else if (blockId === BlockId.SPAWN_RED) {
              detectedRedSpawns.push([wx, wy + 1, wz]);
            } else if (blockId === BlockId.SPAWN_BLUE) {
              detectedBlueSpawns.push([wx, wy + 1, wz]);
            }
          }
        }
      }
    }
  }

  const defaultSpawns: [number, number, number][] = detectedFFASpawns.length > 0
    ? detectedFFASpawns
    : (spawnPoints && spawnPoints.length > 0
      ? spawnPoints
      : [
          [0, 6, 0],
          [-14, 3, -14],
          [14, 3, 14],
          [-16, 3, 16],
          [16, 3, -16]
        ]);

  return {
    formatVersion: 1,
    name,
    author,
    createdAt: new Date().toISOString(),
    environmentPreset,
    spawnPoints: defaultSpawns,
    redSpawns: detectedRedSpawns.length > 0 ? detectedRedSpawns : undefined,
    blueSpawns: detectedBlueSpawns.length > 0 ? detectedBlueSpawns : undefined,
    blocks
  };
}

/**
 * Compact Single-Line Protox Map Code (Base64 encoded JSON)
 */
export function encodeMapCode(mapData: VoxelMapData): string {
  const jsonStr = JSON.stringify(mapData);
  if (typeof btoa !== 'undefined') {
    return btoa(encodeURIComponent(jsonStr));
  }
  return Buffer.from(jsonStr, 'utf-8').toString('base64');
}

export function decodeMapCode(code: string): VoxelMapData {
  let jsonStr = '';
  if (typeof atob !== 'undefined') {
    try {
      jsonStr = decodeURIComponent(atob(code.trim()));
    } catch {
      jsonStr = atob(code.trim());
    }
  } else {
    jsonStr = Buffer.from(code.trim(), 'base64').toString('utf-8');
  }
  return JSON.parse(jsonStr) as VoxelMapData;
}

/**
 * Deserializes and loads a VoxelMapData schema into the VoxelWorld.
 * Clears previous chunks and populates new blocks.
 */
export function importMapFromJSON(world: VoxelWorld, mapData: VoxelMapData): void {
  // Clear all existing world chunks
  world.chunks.clear();

  for (const entry of mapData.blocks) {
    const [x, y, z, blockId] = entry;
    world.setBlock(x, y, z, blockId);
  }
}

/**
 * Predefined Template: Cyber Warehouse
 * Fast-paced indoor arena with vertical shipping containers, catwalks, and jump pillars.
 */
export function generateCyberWarehouseTemplate(): VoxelMapData {
  const world = new VoxelWorld();
  const half = 24;

  // Floor & Ceiling
  world.fillBox(-half, 0, -half, half, 0, half, BlockId.CONCRETE);
  world.fillBox(-half, 12, -half, half, 12, half, BlockId.METAL_DARK);

  // Outer Walls
  world.fillBox(-half, 1, -half, half, 11, -half, BlockId.METAL_DARK);
  world.fillBox(-half, 1, half, half, 11, half, BlockId.METAL_DARK);
  world.fillBox(-half, 1, -half, -half, 11, half, BlockId.METAL_DARK);
  world.fillBox(half, 1, -half, half, 11, half, BlockId.METAL_DARK);

  // Ceiling Skylight
  world.fillBox(-6, 12, -6, 6, 12, 6, BlockId.GLASS);

  // Neon Trim
  for (let x = -half; x <= half; x += 4) {
    world.setBlock(x, 1, -half + 1, BlockId.NEON_CYAN);
    world.setBlock(x, 1, half - 1, BlockId.NEON_CYAN);
  }

  // Stacked Shipping Containers / Crates
  world.fillBox(-10, 1, -8, -4, 4, -4, BlockId.CRATE);
  world.fillBox(4, 1, 4, 10, 4, 8, BlockId.CRATE);
  world.fillBox(-8, 1, 8, -2, 5, 12, BlockId.BRICK);
  world.fillBox(6, 1, -12, 12, 5, -6, BlockId.BRICK);

  // Center High Platform with stairs
  world.fillBox(-4, 1, -4, 4, 3, 4, BlockId.CONCRETE);
  world.fillBox(-3, 4, -3, 3, 4, 3, BlockId.WOOD_PLANK);
  world.setBlock(0, 5, 0, BlockId.NEON_ORANGE);

  // Access stairs
  for (let i = 0; i < 4; i++) {
    world.fillBox(-2, 1 + i, 5 + (3 - i), 2, 1 + i, 5 + (3 - i), BlockId.CONCRETE);
    world.fillBox(-2, 1 + i, -5 - (3 - i), 2, 1 + i, -5 - (3 - i), BlockId.CONCRETE);
  }

  return exportMapToJSON(world, 'Cyber Warehouse', 'Voxel Engine Core', 'cyber');
}

/**
 * Predefined Protox Template: Neon Jump Arena
 * Showcases Protox.io movement features: Jump Pads, Speed Boosts, Lava Hazards, and Floating Catwalks.
 */
export function generateProtoxJumpArenaTemplate(): VoxelMapData {
  const world = new VoxelWorld();
  const half = 26;

  // Outer floor (Concrete)
  world.fillBox(-half, 0, -half, half, 0, half, BlockId.CONCRETE);

  // Lava Moat in the middle
  world.fillBox(-16, 0, -16, 16, 0, 16, BlockId.HAZARD_LAVA);

  // Central Elevated Island
  world.fillBox(-8, 1, -8, 8, 4, 8, BlockId.METAL_DARK);
  world.fillBox(-7, 5, -7, 7, 5, 7, BlockId.CONCRETE);

  // High Tower in Center
  world.fillBox(-2, 5, -2, 2, 10, 2, BlockId.BRICK);
  world.fillBox(-3, 11, -3, 3, 11, 3, BlockId.GLASS);

  // Jump Pads launching onto the Central Island!
  world.setBlock(-14, 1, 0, BlockId.JUMP_PAD);
  world.setBlock(14, 1, 0, BlockId.JUMP_PAD);
  world.setBlock(0, 1, -14, BlockId.JUMP_PAD);
  world.setBlock(0, 1, 14, BlockId.JUMP_PAD);

  // High Jump Pads on Central Island launching to Top Tower
  world.setBlock(-5, 6, 0, BlockId.JUMP_PAD);
  world.setBlock(5, 6, 0, BlockId.JUMP_PAD);

  // Speed Boost Runways on sides
  for (let z = -10; z <= 10; z += 2) {
    world.setBlock(-20, 1, z, BlockId.SPEED_PAD);
    world.setBlock(20, 1, z, BlockId.SPEED_PAD);
  }

  // Outer boundary walls with Neon Trim
  world.fillBox(-half, 1, -half, half, 6, -half, BlockId.METAL_DARK);
  world.fillBox(-half, 1, half, half, 6, half, BlockId.METAL_DARK);
  world.fillBox(-half, 1, -half, -half, 6, half, BlockId.METAL_DARK);
  world.fillBox(half, 1, -half, half, 6, half, BlockId.METAL_DARK);

  for (let x = -half; x <= half; x += 3) {
    world.setBlock(x, 4, -half + 1, BlockId.NEON_CYAN);
    world.setBlock(x, 4, half - 1, BlockId.NEON_CYAN);
  }

  // Spawns
  world.setBlock(-22, 1, -22, BlockId.SPAWN_RED);
  world.setBlock(-22, 1, 22, BlockId.SPAWN_RED);
  world.setBlock(22, 1, -22, BlockId.SPAWN_BLUE);
  world.setBlock(22, 1, 22, BlockId.SPAWN_BLUE);
  world.setBlock(0, 12, 0, BlockId.SPAWN_FFA);

  return exportMapToJSON(world, 'Protox Neon Jump Arena', 'Protox Engine Team', 'dusk');
}
