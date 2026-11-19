// Global Constants shared between Client and Server

export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Y = 16;
export const CHUNK_SIZE_Z = 16;
export const CHUNK_VOXEL_COUNT = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;

// Fixed Physics Tick Configuration
export const TICK_RATE = 60; // 60 ticks per second
export const FIXED_DT = 1 / TICK_RATE; // ~0.01667 seconds

// Player Physics Constants (Fast-paced arena feel inspired by Krunker / Quake)
export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE_HEIGHT = 1.6;
export const PLAYER_CROUCH_HEIGHT = 1.1;
export const PLAYER_CROUCH_EYE_HEIGHT = 0.95;

export const GRAVITY = -30.0;
export const JUMP_VELOCITY = 10.5;

export const WALK_SPEED = 9.0;
export const SPRINT_SPEED = 14.5;
export const CROUCH_SPEED = 4.5;
export const SLIDE_BOOST = 18.0;

export const GROUND_ACCELERATION = 75.0;
export const AIR_ACCELERATION = 22.0;
export const GROUND_FRICTION = 9.0;
export const AIR_DRAG = 0.4;
export const MAX_STEP_HEIGHT = 0.55; // Auto-step height for stairs / single slabs

// Advanced Movement Mechanics (Slide, Bhop, Mantle, Wall-Jump)
export const SLIDE_INITIAL_SPEED = 18.5;   // High-speed slide entry impulse
export const SLIDE_DURATION = 0.70;        // Max slide duration in seconds
export const SLIDE_COOLDOWN = 0.80;        // Cooldown between slides in seconds
export const SLIDE_FRICTION = 2.2;         // Reduced friction while sliding (vs 9.0 ground friction)
export const SLIDE_HOP_BOOST = 1.08;       // Jump velocity boost during slide-hop
export const BHOP_SPEED_BONUS = 1.05;      // Momentum bonus on landing jump
export const BHOP_MAX_SPEED = 26.0;        // Speed ceiling for consecutive bhops
export const MANTLE_REACH_DIST = 0.75;     // Forward reach to detect climbable ledge
export const MANTLE_IMPULSE_Y = 8.5;       // Upward vault velocity
export const MANTLE_IMPULSE_FORWARD = 4.5; // Forward vault velocity over obstacle lip
export const WALL_JUMP_IMPULSE_Y = 9.8;    // Upward impulse when kicking off a wall
export const WALL_JUMP_PUSH = 7.0;         // Push force away from the wall normal

// Block Type Enumeration
export enum BlockId {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  WOOD_PLANK = 4,
  BRICK = 5,
  CONCRETE = 6,
  METAL_DARK = 7,
  CRATE = 8,
  NEON_CYAN = 9,
  NEON_ORANGE = 10,
  GLASS = 11,
  SAND = 12,
  JUMP_PAD = 13,
  SPEED_PAD = 14,
  HAZARD_LAVA = 15,
  BARRIER = 16,
  SPAWN_FFA = 17,
  SPAWN_RED = 18,
  SPAWN_BLUE = 19,
  NEON_MAGENTA = 20,
  NEON_LIME = 21,

  // Expanded Building & Architecture
  CONCRETE_WHITE = 22,
  CONCRETE_DARK = 23,
  COBBLESTONE = 24,
  STONE_BRICK = 25,
  BRICK_DARK = 26,
  WOOD_DARK = 27,
  WOOD_BIRCH = 28,
  STEEL_PLATE = 29,
  METAL_GRATE = 30,
  ROOF_TILES = 31,

  // Props & Decorations
  CRATE_WOOD = 32,
  BARREL_WOOD = 33,
  BARREL_TOXIC = 34,
  POWER_CELL = 35,
  COMPUTER_CONSOLE = 36,
  SANDBAGS = 37,
  GLASS_CYAN = 38,
  GLASS_AMBER = 39,
  LANTERN_LIGHT = 40,
  NEON_YELLOW = 41,
  NEON_RED = 42,

  // Nature & Landscape
  SANDSTONE = 43,
  SNOW = 44,
  ICE = 45,
  WOOD_LOG = 46,
  LEAVES = 47,
  WATER = 48,

  // Interactive & Mechanics
  BOUNCE_PAD = 49
}

// Direction indices for voxel face neighbor checks
export const enum Direction {
  POS_X = 0, // Right (+X)
  NEG_X = 1, // Left (-X)
  POS_Y = 2, // Top (+Y)
  NEG_Y = 3, // Bottom (-Y)
  POS_Z = 4, // Front (+Z)
  NEG_Z = 5  // Back (-Z)
}

export const DIRECTION_VECTORS: ReadonlyArray<[number, number, number]> = [
  [1, 0, 0],   // +X
  [-1, 0, 0],  // -X
  [0, 1, 0],   // +Y
  [0, -1, 0],  // -Y
  [0, 0, 1],   // +Z
  [0, 0, -1]   // -Z
];
