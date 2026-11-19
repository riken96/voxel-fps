import { BlockId } from '../constants.ts';

export type BlockCategory = 'building' | 'decor' | 'nature' | 'interactive';

export interface BlockDefinition {
  id: BlockId;
  name: string;
  category: BlockCategory;
  isSolid: boolean;
  isTransparent: boolean;
  color: [number, number, number]; // Normalized RGB [0..1]
  emissive?: [number, number, number];
  opacity?: number;
  description?: string;
}

export const BLOCK_DEFINITIONS: Record<number, BlockDefinition> = {
  [BlockId.AIR]: {
    id: BlockId.AIR,
    name: 'Air',
    category: 'building',
    isSolid: false,
    isTransparent: true,
    color: [0, 0, 0],
    opacity: 0,
    description: 'Empty space'
  },

  // -------------------------------------------------------------
  // Nature & Landscape
  // -------------------------------------------------------------
  [BlockId.GRASS]: {
    id: BlockId.GRASS,
    name: 'Lush Grass',
    category: 'nature',
    isSolid: true,
    isTransparent: false,
    color: [0.35, 0.72, 0.28],
    description: 'Vibrant green surface grass with rich soil beneath'
  },
  [BlockId.DIRT]: {
    id: BlockId.DIRT,
    name: 'Forest Soil',
    category: 'nature',
    isSolid: true,
    isTransparent: false,
    color: [0.52, 0.36, 0.22],
    description: 'Compact earthy soil and loam'
  },
  [BlockId.SAND]: {
    id: BlockId.SAND,
    name: 'Golden Sand',
    category: 'nature',
    isSolid: true,
    isTransparent: false,
    color: [0.88, 0.82, 0.58],
    description: 'Fine desert and shoreline sand grains'
  },
  [BlockId.SANDSTONE]: {
    id: BlockId.SANDSTONE,
    name: 'Carved Sandstone',
    category: 'nature',
    isSolid: true,
    isTransparent: false,
    color: [0.82, 0.74, 0.48],
    description: 'Layered arid sandstone sedimentary rock'
  },
  [BlockId.SNOW]: {
    id: BlockId.SNOW,
    name: 'Alpine Snow',
    category: 'nature',
    isSolid: true,
    isTransparent: false,
    color: [0.94, 0.96, 0.98],
    description: 'Clean crisp mountain powder snow'
  },
  [BlockId.ICE]: {
    id: BlockId.ICE,
    name: 'Glacial Ice',
    category: 'nature',
    isSolid: true,
    isTransparent: true,
    color: [0.72, 0.88, 0.98],
    opacity: 0.7,
    description: 'Slick translucent polar ice'
  },
  [BlockId.WOOD_LOG]: {
    id: BlockId.WOOD_LOG,
    name: 'Timber Log',
    category: 'nature',
    isSolid: true,
    isTransparent: false,
    color: [0.42, 0.28, 0.16],
    description: 'Raw trunk log with bark and growth rings'
  },
  [BlockId.LEAVES]: {
    id: BlockId.LEAVES,
    name: 'Tree Foliage',
    category: 'nature',
    isSolid: true,
    isTransparent: false,
    color: [0.22, 0.58, 0.24],
    description: 'Dense deciduous leafy tree crown'
  },
  [BlockId.WATER]: {
    id: BlockId.WATER,
    name: 'Still Water',
    category: 'nature',
    isSolid: false,
    isTransparent: true,
    color: [0.15, 0.55, 0.85],
    opacity: 0.55,
    description: 'Clear azure water with surface caustics'
  },

  // -------------------------------------------------------------
  // Building & Architecture
  // -------------------------------------------------------------
  [BlockId.CONCRETE]: {
    id: BlockId.CONCRETE,
    name: 'Concrete Grey',
    category: 'building',
    isSolid: true,
    isTransparent: false,
    color: [0.72, 0.74, 0.76],
    description: 'Standard smooth architectural concrete'
  },
  [BlockId.CONCRETE_WHITE]: {
    id: BlockId.CONCRETE_WHITE,
    name: 'Concrete White',
    category: 'building',
    isSolid: true,
    isTransparent: false,
    color: [0.92, 0.93, 0.95],
    description: 'Bright modern minimalist white concrete'
  },
  [BlockId.CONCRETE_DARK]: {
    id: BlockId.CONCRETE_DARK,
    name: 'Concrete Dark',
    category: 'building',
    isSolid: true,
    isTransparent: false,
    color: [0.32, 0.35, 0.38],
    description: 'Heavy brutalist charcoal concrete'
  },
  [BlockId.STONE]: {
    id: BlockId.STONE,
    name: 'Mountain Stone',
    category: 'building',
    isSolid: true,
    isTransparent: false,
    color: [0.55, 0.58, 0.62],
    description: 'Solid natural quarry rock'
  },
  [BlockId.COBBLESTONE]: {
    id: BlockId.COBBLESTONE,
    name: 'Cobblestone',
    category: 'building',
    isSolid: true,
    isTransparent: false,
    color: [0.48, 0.50, 0.53],
    description: 'Rough chiseled masonry paving stones'
  },
  [BlockId.STONE_BRICK]: {
    id: BlockId.STONE_BRICK,
    name: 'Stone Bricks',
    category: 'building',
    isSolid: true,
    isTransparent: false,
    color: [0.60, 0.62, 0.66],
    description: 'Smooth dressed castle stone blocks with mortar'
  },
  [BlockId.BRICK]: {
    id: BlockId.BRICK,
    name: 'Red Bricks',
    category: 'building',
    isSolid: true,
    isTransparent: false,
    color: [0.75, 0.32, 0.24],
    description: 'Traditional fired terracotta clay masonry'
  },
  [BlockId.BRICK_DARK]: {
    id: BlockId.BRICK_DARK,
    name: 'Industrial Bricks',
    category: 'building',
    isSolid: true,
    isTransparent: false,
    color: [0.42, 0.26, 0.22],
    description: 'Weathered factory brickwork'
  },
  [BlockId.WOOD_PLANK]: {
    id: BlockId.WOOD_PLANK,
    name: 'Oak Planks',
    category: 'building',
    isSolid: true,
    isTransparent: false,
    color: [0.72, 0.53, 0.35],
    description: 'Polished golden oak floor & wall planks'
  },
  [BlockId.WOOD_DARK]: {
    id: BlockId.WOOD_DARK,
    name: 'Dark Wood Planks',
    category: 'building',
    isSolid: true,
    isTransparent: false,
    color: [0.38, 0.25, 0.18],
    description: 'Rich dark walnut timber boards'
  },
  [BlockId.WOOD_BIRCH]: {
    id: BlockId.WOOD_BIRCH,
    name: 'Birch Planks',
    category: 'building',
    isSolid: true,
    isTransparent: false,
    color: [0.86, 0.78, 0.62],
    description: 'Light Scandinavian blonde birch wood'
  },
  [BlockId.METAL_DARK]: {
    id: BlockId.METAL_DARK,
    name: 'Dark Metal Plating',
    category: 'building',
    isSolid: true,
    isTransparent: false,
    color: [0.22, 0.24, 0.27],
    description: 'Heavy gunmetal industrial cladding'
  },
  [BlockId.STEEL_PLATE]: {
    id: BlockId.STEEL_PLATE,
    name: 'Riveted Steel',
    category: 'building',
    isSolid: true,
    isTransparent: false,
    color: [0.55, 0.58, 0.62],
    description: 'Reinforced alloy plating with corner bolts'
  },
  [BlockId.METAL_GRATE]: {
    id: BlockId.METAL_GRATE,
    name: 'Vent Grate',
    category: 'building',
    isSolid: true,
    isTransparent: false,
    color: [0.28, 0.32, 0.36],
    description: 'Cross-hatch ventilation flooring'
  },
  [BlockId.ROOF_TILES]: {
    id: BlockId.ROOF_TILES,
    name: 'Roof Tiles',
    category: 'building',
    isSolid: true,
    isTransparent: false,
    color: [0.68, 0.28, 0.20],
    description: 'Mediterranean clay shingle roof tiles'
  },

  // -------------------------------------------------------------
  // Props & Decorations
  // -------------------------------------------------------------
  [BlockId.CRATE]: {
    id: BlockId.CRATE,
    name: 'Tactical Crate',
    category: 'decor',
    isSolid: true,
    isTransparent: false,
    color: [0.78, 0.62, 0.24],
    description: 'Military supply container with cross-bracing'
  },
  [BlockId.CRATE_WOOD]: {
    id: BlockId.CRATE_WOOD,
    name: 'Wooden Cargo Crate',
    category: 'decor',
    isSolid: true,
    isTransparent: false,
    color: [0.65, 0.48, 0.28],
    description: 'Standard wooden storage container'
  },
  [BlockId.BARREL_WOOD]: {
    id: BlockId.BARREL_WOOD,
    name: 'Wooden Barrel',
    category: 'decor',
    isSolid: true,
    isTransparent: false,
    color: [0.55, 0.36, 0.22],
    description: 'Oak keg bound with forged iron bands'
  },
  [BlockId.BARREL_TOXIC]: {
    id: BlockId.BARREL_TOXIC,
    name: 'Toxic Waste Drum',
    category: 'decor',
    isSolid: true,
    isTransparent: false,
    color: [0.92, 0.82, 0.12],
    emissive: [0.45, 0.40, 0.05],
    description: 'Hazardous chemical barrel with hazard stripes'
  },
  [BlockId.POWER_CELL]: {
    id: BlockId.POWER_CELL,
    name: 'Power Core Cell',
    category: 'decor',
    isSolid: true,
    isTransparent: false,
    color: [0.12, 0.85, 0.92],
    emissive: [0.10, 0.75, 0.85],
    description: 'Pulsing sci-fi energy generator'
  },
  [BlockId.COMPUTER_CONSOLE]: {
    id: BlockId.COMPUTER_CONSOLE,
    name: 'Server Console',
    category: 'decor',
    isSolid: true,
    isTransparent: false,
    color: [0.18, 0.20, 0.26],
    emissive: [0.08, 0.25, 0.35],
    description: 'Command computer terminal with LED readouts'
  },
  [BlockId.SANDBAGS]: {
    id: BlockId.SANDBAGS,
    name: 'Sandbag Bunker',
    category: 'decor',
    isSolid: true,
    isTransparent: false,
    color: [0.72, 0.66, 0.48],
    description: 'Ballistic fabric sandbag bunker cover'
  },
  [BlockId.GLASS]: {
    id: BlockId.GLASS,
    name: 'Reinforced Glass',
    category: 'decor',
    isSolid: true,
    isTransparent: true,
    color: [0.75, 0.88, 0.96],
    opacity: 0.45,
    description: 'High-strength laminated observation glass'
  },
  [BlockId.GLASS_CYAN]: {
    id: BlockId.GLASS_CYAN,
    name: 'Cyan Tinted Glass',
    category: 'decor',
    isSolid: true,
    isTransparent: true,
    color: [0.25, 0.85, 0.95],
    opacity: 0.50,
    description: 'Futuristic holographic tinted pane'
  },
  [BlockId.GLASS_AMBER]: {
    id: BlockId.GLASS_AMBER,
    name: 'Amber Tinted Glass',
    category: 'decor',
    isSolid: true,
    isTransparent: true,
    color: [0.95, 0.65, 0.22],
    opacity: 0.50,
    description: 'Warm protective radiation shield glass'
  },
  [BlockId.LANTERN_LIGHT]: {
    id: BlockId.LANTERN_LIGHT,
    name: 'Glow Lantern',
    category: 'decor',
    isSolid: true,
    isTransparent: false,
    color: [1.0, 0.92, 0.65],
    emissive: [0.95, 0.85, 0.55],
    description: 'Warm architectural light emitter cube'
  },
  [BlockId.NEON_CYAN]: {
    id: BlockId.NEON_CYAN,
    name: 'Neon Cyan Strip',
    category: 'decor',
    isSolid: true,
    isTransparent: false,
    color: [0.10, 0.90, 0.95],
    emissive: [0.20, 0.85, 0.95],
    description: 'Luminous cyan LED architectural accent'
  },
  [BlockId.NEON_ORANGE]: {
    id: BlockId.NEON_ORANGE,
    name: 'Neon Orange Strip',
    category: 'decor',
    isSolid: true,
    isTransparent: false,
    color: [1.0, 0.45, 0.10],
    emissive: [0.95, 0.40, 0.08],
    description: 'High-visibility amber neon lighting'
  },
  [BlockId.NEON_MAGENTA]: {
    id: BlockId.NEON_MAGENTA,
    name: 'Neon Magenta Strip',
    category: 'decor',
    isSolid: true,
    isTransparent: false,
    color: [0.95, 0.15, 0.85],
    emissive: [0.90, 0.12, 0.75],
    description: 'Synthwave hot magenta neon beam'
  },
  [BlockId.NEON_LIME]: {
    id: BlockId.NEON_LIME,
    name: 'Neon Lime Strip',
    category: 'decor',
    isSolid: true,
    isTransparent: false,
    color: [0.65, 0.95, 0.15],
    emissive: [0.55, 0.88, 0.10],
    description: 'Electric lime radioactive glow strip'
  },
  [BlockId.NEON_YELLOW]: {
    id: BlockId.NEON_YELLOW,
    name: 'Neon Sunburst Yellow',
    category: 'decor',
    isSolid: true,
    isTransparent: false,
    color: [1.0, 0.88, 0.12],
    emissive: [0.95, 0.82, 0.08],
    description: 'Electric bright yellow illumination strip'
  },
  [BlockId.NEON_RED]: {
    id: BlockId.NEON_RED,
    name: 'Emergency Neon Red',
    category: 'decor',
    isSolid: true,
    isTransparent: false,
    color: [1.0, 0.18, 0.18],
    emissive: [0.95, 0.12, 0.12],
    description: 'Tactical warning alert red light'
  },

  // -------------------------------------------------------------
  // Interactive & Utilities
  // -------------------------------------------------------------
  [BlockId.JUMP_PAD]: {
    id: BlockId.JUMP_PAD,
    name: 'Jump Pad',
    category: 'interactive',
    isSolid: true,
    isTransparent: false,
    color: [1.0, 0.85, 0.15],
    emissive: [0.90, 0.75, 0.10],
    description: 'Propels players +19.5 m/s upward on contact'
  },
  [BlockId.SPEED_PAD]: {
    id: BlockId.SPEED_PAD,
    name: 'Speed Boost Pad',
    category: 'interactive',
    isSolid: true,
    isTransparent: false,
    color: [0.10, 0.85, 1.0],
    emissive: [0.08, 0.70, 0.95],
    description: 'Surges player forward with supersonic velocity'
  },
  [BlockId.BOUNCE_PAD]: {
    id: BlockId.BOUNCE_PAD,
    name: 'Elastic Bounce Pad',
    category: 'interactive',
    isSolid: true,
    isTransparent: false,
    color: [0.85, 0.20, 0.85],
    emissive: [0.75, 0.15, 0.75],
    description: 'Super-elastic rubber bounce pad'
  },
  [BlockId.HAZARD_LAVA]: {
    id: BlockId.HAZARD_LAVA,
    name: 'Hazard Lava',
    category: 'interactive',
    isSolid: true,
    isTransparent: false,
    color: [1.0, 0.22, 0.05],
    emissive: [1.0, 0.28, 0.0],
    description: 'Molten magma dealing lethal contact damage'
  },
  [BlockId.BARRIER]: {
    id: BlockId.BARRIER,
    name: 'Invisible Barrier',
    category: 'interactive',
    isSolid: true,
    isTransparent: true,
    color: [0.5, 0.7, 1.0],
    opacity: 0.25,
    description: 'Solid collision boundary for map limits'
  },
  [BlockId.SPAWN_FFA]: {
    id: BlockId.SPAWN_FFA,
    name: 'FFA Spawn Marker',
    category: 'interactive',
    isSolid: true,
    isTransparent: false,
    color: [0.15, 0.95, 0.35],
    emissive: [0.10, 0.85, 0.25],
    description: 'Designates Free-For-All player spawn point'
  },
  [BlockId.SPAWN_RED]: {
    id: BlockId.SPAWN_RED,
    name: 'Red Spawn Marker',
    category: 'interactive',
    isSolid: true,
    isTransparent: false,
    color: [0.95, 0.20, 0.20],
    emissive: [0.85, 0.10, 0.10],
    description: 'Designates Team Red spawn zone'
  },
  [BlockId.SPAWN_BLUE]: {
    id: BlockId.SPAWN_BLUE,
    name: 'Blue Spawn Marker',
    category: 'interactive',
    isSolid: true,
    isTransparent: false,
    color: [0.20, 0.45, 0.95],
    emissive: [0.10, 0.35, 0.85],
    description: 'Designates Team Blue spawn zone'
  }
};

export function getBlockDef(id: number): BlockDefinition {
  return BLOCK_DEFINITIONS[id] || BLOCK_DEFINITIONS[BlockId.AIR];
}

export function isBlockSolid(id: number): boolean {
  const def = BLOCK_DEFINITIONS[id];
  return def ? def.isSolid : false;
}

export function getBlocksByCategory(cat: BlockCategory | 'all'): BlockDefinition[] {
  return Object.values(BLOCK_DEFINITIONS).filter((b) => {
    if (b.id === BlockId.AIR) return false;
    return cat === 'all' || b.category === cat;
  });
}
