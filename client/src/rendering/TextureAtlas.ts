import * as THREE from 'three';
import { BlockId } from '@shared/constants.ts';

export const ATLAS_GRID_SIZE = 16; // 16 x 16 tiles
export const TILE_PIXEL_SIZE = 64;  // 64x64 pixels per tile
export const ATLAS_WIDTH = ATLAS_GRID_SIZE * TILE_PIXEL_SIZE; // 1024 px

export interface TileCoordinate {
  col: number; // 0..15
  row: number; // 0..15
}

export class TextureAtlas {
  private static instance: TextureAtlas | null = null;
  public canvas: HTMLCanvasElement;
  public texture: THREE.CanvasTexture;
  public emissiveTexture: THREE.CanvasTexture;
  private tileMap: Map<number, TileCoordinate> = new Map();

  public static get(): TextureAtlas {
    if (!TextureAtlas.instance) {
      TextureAtlas.instance = new TextureAtlas();
    }
    return TextureAtlas.instance;
  }

  private constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ATLAS_WIDTH;
    this.canvas.height = ATLAS_WIDTH;

    const emissiveCanvas = document.createElement('canvas');
    emissiveCanvas.width = ATLAS_WIDTH;
    emissiveCanvas.height = ATLAS_WIDTH;

    const ctx = this.canvas.getContext('2d')!;
    const eCtx = emissiveCanvas.getContext('2d')!;

    // Black background for emissive canvas
    eCtx.fillStyle = '#000000';
    eCtx.fillRect(0, 0, ATLAS_WIDTH, ATLAS_WIDTH);

    this.generateAllTiles(ctx, eCtx);

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.needsUpdate = true;

    this.emissiveTexture = new THREE.CanvasTexture(emissiveCanvas);
    this.emissiveTexture.magFilter = THREE.NearestFilter;
    this.emissiveTexture.minFilter = THREE.NearestFilter;
    this.emissiveTexture.generateMipmaps = false;
    this.emissiveTexture.needsUpdate = true;
  }

  /**
   * Generates a miniature standalone canvas thumbnail for a block
   * for UI buttons, hotbar slots, and the Creative Inventory catalog.
   */
  public createTileCanvas(blockId: BlockId, size = 48): HTMLCanvasElement {
    const coord = this.getTileCoord(blockId, 1, 1);
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = size;
    tileCanvas.height = size;
    const ctx = tileCanvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.canvas,
      coord.col * TILE_PIXEL_SIZE,
      coord.row * TILE_PIXEL_SIZE,
      TILE_PIXEL_SIZE,
      TILE_PIXEL_SIZE,
      0,
      0,
      size,
      size
    );
    return tileCanvas;
  }

  /**
   * Returns tile coordinates (col, row in 0..15) for a given block and face.
   * axis: 0=X, 1=Y, 2=Z; dir: +1 or -1
   */
  public getTileCoord(blockId: BlockId, axis: number, dir: number): TileCoordinate {
    const isTop = (axis === 1 && dir === 1);
    const isBottom = (axis === 1 && dir === -1);
    const isSide = (axis !== 1);

    // Multi-face texture mappings
    if (blockId === BlockId.GRASS) {
      if (isTop) return this.tile(0, 0);       // Grass top
      if (isBottom) return this.tile(1, 0);    // Dirt bottom
      return this.tile(2, 0);                  // Grass side with dirt
    }

    if (blockId === BlockId.WOOD_LOG) {
      if (isTop || isBottom) return this.tile(3, 1); // Log top rings
      return this.tile(2, 1);                        // Log bark sides
    }

    if (blockId === BlockId.BARREL_WOOD) {
      if (isTop || isBottom) return this.tile(4, 3); // Barrel top lid
      return this.tile(3, 3);                        // Barrel staves side
    }

    if (blockId === BlockId.JUMP_PAD) {
      if (isTop) return this.tile(0, 5);
      return this.tile(1, 5); // Side pad
    }

    if (blockId === BlockId.SPEED_PAD) {
      if (isTop) return this.tile(2, 5);
      return this.tile(1, 5);
    }

    if (blockId === BlockId.BOUNCE_PAD) {
      if (isTop) return this.tile(3, 5);
      return this.tile(1, 5);
    }

    // Default single tile per block
    const single = this.tileMap.get(blockId);
    return single || this.tile(0, 1); // Fallback to concrete
  }

  private tile(col: number, row: number): TileCoordinate {
    return { col, row };
  }

  private register(blockId: BlockId, col: number, row: number): void {
    this.tileMap.set(blockId, { col, row });
  }

  private generateAllTiles(ctx: CanvasRenderingContext2D, eCtx: CanvasRenderingContext2D): void {
    // Row 0: Nature Basics
    this.drawGrassTop(ctx, 0, 0);
    this.register(BlockId.DIRT, 1, 0);
    this.drawDirt(ctx, 1, 0);
    this.drawGrassSide(ctx, 2, 0);
    this.register(BlockId.SAND, 3, 0);
    this.drawSand(ctx, 3, 0);
    this.register(BlockId.SANDSTONE, 4, 0);
    this.drawSandstone(ctx, 4, 0);
    this.register(BlockId.SNOW, 5, 0);
    this.drawSnow(ctx, 5, 0);
    this.register(BlockId.ICE, 6, 0);
    this.drawIce(ctx, 6, 0);
    this.register(BlockId.WATER, 7, 0);
    this.drawWater(ctx, 7, 0);
    this.register(BlockId.LEAVES, 8, 0);
    this.drawLeaves(ctx, 8, 0);

    // Row 1: Building Solids - Stone & Concrete
    this.register(BlockId.CONCRETE, 0, 1);
    this.drawConcrete(ctx, 0, 1, '#b8bcc2', '#9ea4ab');
    this.register(BlockId.CONCRETE_WHITE, 1, 1);
    this.drawConcrete(ctx, 1, 1, '#eaedf2', '#d5d9e0');
    this.register(BlockId.CONCRETE_DARK, 2, 1);
    this.drawConcrete(ctx, 2, 1, '#474c54', '#34383f');
    this.register(BlockId.STONE, 3, 1);
    this.drawStone(ctx, 3, 1);
    this.register(BlockId.COBBLESTONE, 4, 1);
    this.drawCobblestone(ctx, 4, 1);
    this.register(BlockId.STONE_BRICK, 5, 1);
    this.drawStoneBrick(ctx, 5, 1);
    this.register(BlockId.BRICK, 6, 1);
    this.drawBricks(ctx, 6, 1, '#b54836', '#872a1a', '#e8ded8');
    this.register(BlockId.BRICK_DARK, 7, 1);
    this.drawBricks(ctx, 7, 1, '#5e3a32', '#3d241e', '#857874');
    this.register(BlockId.ROOF_TILES, 8, 1);
    this.drawRoofTiles(ctx, 8, 1);

    // Row 2: Woods & Metals
    this.register(BlockId.WOOD_PLANK, 0, 2);
    this.drawWoodPlanks(ctx, 0, 2, '#b88652', '#8c6035', '#57371a');
    this.register(BlockId.WOOD_DARK, 1, 2);
    this.drawWoodPlanks(ctx, 1, 2, '#5e3b24', '#422817', '#2b170c');
    this.register(BlockId.WOOD_BIRCH, 2, 2);
    this.drawWoodPlanks(ctx, 2, 2, '#ded0ab', '#baa77b', '#85734e');
    this.drawLogSide(ctx, 2, 1);
    this.drawLogTop(ctx, 3, 1);
    this.register(BlockId.METAL_DARK, 3, 2);
    this.drawMetalPlate(ctx, 3, 2, '#383e47', '#252a32', '#525a66');
    this.register(BlockId.STEEL_PLATE, 4, 2);
    this.drawSteelPlate(ctx, 4, 2);
    this.register(BlockId.METAL_GRATE, 5, 2);
    this.drawMetalGrate(ctx, 5, 2);

    // Row 3: Props & Decorations
    this.register(BlockId.CRATE, 0, 3);
    this.drawCrate(ctx, 0, 3, '#c2973c', '#8a651a', true);
    this.register(BlockId.CRATE_WOOD, 1, 3);
    this.drawCrate(ctx, 1, 3, '#a37440', '#6e4a21', false);
    this.register(BlockId.SANDBAGS, 2, 3);
    this.drawSandbags(ctx, 2, 3);
    this.drawBarrelSide(ctx, 3, 3);
    this.drawBarrelTop(ctx, 4, 3);
    this.register(BlockId.BARREL_TOXIC, 5, 3);
    this.drawToxicBarrel(ctx, eCtx, 5, 3);
    this.register(BlockId.POWER_CELL, 6, 3);
    this.drawPowerCell(ctx, eCtx, 6, 3);
    this.register(BlockId.COMPUTER_CONSOLE, 7, 3);
    this.drawComputerConsole(ctx, eCtx, 7, 3);
    this.register(BlockId.LANTERN_LIGHT, 8, 3);
    this.drawLantern(ctx, eCtx, 8, 3);

    // Row 4: Glasses & Neons
    this.register(BlockId.GLASS, 0, 4);
    this.drawGlass(ctx, 0, 4, 'rgba(195, 225, 245, 0.45)', '#d8edf8');
    this.register(BlockId.GLASS_CYAN, 1, 4);
    this.drawGlass(ctx, 1, 4, 'rgba(60, 215, 240, 0.50)', '#00ffff');
    this.register(BlockId.GLASS_AMBER, 2, 4);
    this.drawGlass(ctx, 2, 4, 'rgba(240, 160, 50, 0.50)', '#ffb74d');
    this.register(BlockId.NEON_CYAN, 3, 4);
    this.drawNeon(ctx, eCtx, 3, 4, '#00ffff', '#00cccc');
    this.register(BlockId.NEON_ORANGE, 4, 4);
    this.drawNeon(ctx, eCtx, 4, 4, '#ff7700', '#dd5500');
    this.register(BlockId.NEON_MAGENTA, 5, 4);
    this.drawNeon(ctx, eCtx, 5, 4, '#ff00aa', '#cc0088');
    this.register(BlockId.NEON_LIME, 6, 4);
    this.drawNeon(ctx, eCtx, 6, 4, '#77ff00', '#55cc00');
    this.register(BlockId.NEON_YELLOW, 7, 4);
    this.drawNeon(ctx, eCtx, 7, 4, '#ffee00', '#ccbb00');
    this.register(BlockId.NEON_RED, 8, 4);
    this.drawNeon(ctx, eCtx, 8, 4, '#ff2222', '#cc1111');

    // Row 5: Mechanics & Special
    this.register(BlockId.JUMP_PAD, 0, 5);
    this.drawJumpPadTop(ctx, eCtx, 0, 5);
    this.drawPadSide(ctx, 1, 5);
    this.register(BlockId.SPEED_PAD, 2, 5);
    this.drawSpeedPadTop(ctx, eCtx, 2, 5);
    this.register(BlockId.BOUNCE_PAD, 3, 5);
    this.drawBouncePadTop(ctx, eCtx, 3, 5);
    this.register(BlockId.HAZARD_LAVA, 4, 5);
    this.drawLava(ctx, eCtx, 4, 5);
    this.register(BlockId.BARRIER, 5, 5);
    this.drawBarrier(ctx, 5, 5);
    this.register(BlockId.SPAWN_FFA, 6, 5);
    this.drawSpawnMarker(ctx, eCtx, 6, 5, '#00ff88');
    this.register(BlockId.SPAWN_RED, 7, 5);
    this.drawSpawnMarker(ctx, eCtx, 7, 5, '#ff3333');
    this.register(BlockId.SPAWN_BLUE, 8, 5);
    this.drawSpawnMarker(ctx, eCtx, 8, 5, '#3388ff');
  }

  // --- Tile Renderers ---

  private getBounds(col: number, row: number) {
    return {
      x: col * TILE_PIXEL_SIZE,
      y: row * TILE_PIXEL_SIZE,
      w: TILE_PIXEL_SIZE,
      h: TILE_PIXEL_SIZE
    };
  }

  private drawGrassTop(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#55b83f';
    ctx.fillRect(x, y, w, h);

    // Stylized pixel micro-dots
    ctx.fillStyle = '#6ac953';
    for (let i = 0; i < 48; i++) {
      const px = x + ((i * 13) % (w - 4));
      const py = y + ((i * 19) % (h - 4));
      ctx.fillRect(px, py, 4, 4);
    }
    ctx.fillStyle = '#449631';
    for (let i = 0; i < 36; i++) {
      const px = x + ((i * 17) % (w - 4));
      const py = y + ((i * 23) % (h - 4));
      ctx.fillRect(px, py, 3, 3);
    }
    // Subtle beveled border
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  private drawDirt(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#825835';
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = '#9c6c43';
    for (let i = 0; i < 32; i++) {
      const px = x + ((i * 11) % (w - 6));
      const py = y + ((i * 29) % (h - 6));
      ctx.fillRect(px, py, 6, 5);
    }
    ctx.fillStyle = '#5c3a1e';
    for (let i = 0; i < 28; i++) {
      const px = x + ((i * 19) % (w - 4));
      const py = y + ((i * 7) % (h - 4));
      ctx.fillRect(px, py, 4, 4);
    }
  }

  private drawGrassSide(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    // Base dirt
    this.drawDirt(ctx, col, row);

    // Overhanging grass rim with toothy drips
    ctx.fillStyle = '#55b83f';
    ctx.fillRect(x, y, w, 14);

    // Irregular dripping fringe
    const drips = [16, 22, 18, 26, 17, 24, 19, 21];
    const dripW = w / drips.length;
    for (let i = 0; i < drips.length; i++) {
      ctx.fillRect(x + i * dripW, y + 14, dripW, drips[i] - 14);
    }

    // Grass highlight top line
    ctx.fillStyle = '#6ac953';
    ctx.fillRect(x, y, w, 3);
  }

  private drawSand(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#decb8a';
    ctx.fillRect(x, y, w, h);

    // Gentle sand ripples
    ctx.fillStyle = '#eddca1';
    for (let r = 8; r < h; r += 12) {
      ctx.fillRect(x, y + r, w, 3);
    }
    ctx.fillStyle = '#c7b473';
    for (let i = 0; i < 30; i++) {
      ctx.fillRect(x + ((i * 17) % w), y + ((i * 13) % h), 2, 2);
    }
  }

  private drawSandstone(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#ccb67a';
    ctx.fillRect(x, y, w, h);

    // Layered bands
    ctx.fillStyle = '#baa05f';
    ctx.fillRect(x, y + 14, w, 4);
    ctx.fillRect(x, y + 36, w, 5);
    ctx.fillRect(x, y + 52, w, 3);

    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  private drawSnow(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#f0f4f8';
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      ctx.fillRect(x + ((i * 13) % (w - 4)), y + ((i * 23) % (h - 4)), 4, 4);
    }
    ctx.fillStyle = '#dbe5ee';
    for (let i = 0; i < 20; i++) {
      ctx.fillRect(x + ((i * 29) % (w - 3)), y + ((i * 17) % (h - 3)), 3, 3);
    }
  }

  private drawIce(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#b8e2f8';
    ctx.fillRect(x, y, w, h);

    // Frost crack lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 10);
    ctx.lineTo(x + 30, y + 34);
    ctx.lineTo(x + 56, y + 26);
    ctx.moveTo(x + 30, y + 34);
    ctx.lineTo(x + 22, y + 54);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(100, 180, 240, 0.5)';
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  }

  private drawWater(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#2b8cdb';
    ctx.fillRect(x, y, w, h);

    // Soft caustic ripples
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let i = 0; i < 4; i++) {
      const cy = y + 8 + i * 14;
      ctx.beginPath();
      ctx.arc(x + 16 + (i % 2) * 28, cy, 10, 0, Math.PI);
      ctx.fill();
    }
  }

  private drawLeaves(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#317833';
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = '#449c47';
    for (let i = 0; i < 40; i++) {
      ctx.fillRect(x + ((i * 11) % (w - 6)), y + ((i * 17) % (h - 6)), 8, 6);
    }
    ctx.fillStyle = '#215423';
    for (let i = 0; i < 30; i++) {
      ctx.fillRect(x + ((i * 19) % (w - 5)), y + ((i * 13) % (h - 5)), 6, 5);
    }
  }

  private drawConcrete(ctx: CanvasRenderingContext2D, col: number, row: number, base: string, border: string): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);

    // Crisp low-poly perimeter bevel
    ctx.strokeStyle = border;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);

    // Fine texture grain
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let i = 0; i < 35; i++) {
      ctx.fillRect(x + ((i * 17) % (w - 2)), y + ((i * 23) % (h - 2)), 2, 2);
    }
  }

  private drawStone(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#8f949c';
    ctx.fillRect(x, y, w, h);

    // Chiseled facets
    ctx.fillStyle = '#a6abb4';
    ctx.fillRect(x + 8, y + 8, 22, 18);
    ctx.fillRect(x + 34, y + 32, 22, 20);

    ctx.fillStyle = '#727780';
    ctx.fillRect(x + 34, y + 8, 20, 18);
    ctx.fillRect(x + 8, y + 32, 20, 20);

    ctx.strokeStyle = '#5a5e66';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  private drawCobblestone(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    // Dark mortar background
    ctx.fillStyle = '#3a3d42';
    ctx.fillRect(x, y, w, h);

    // Irregular stones
    const stones = [
      { sx: 3, sy: 3, sw: 26, sh: 16, c: '#7e838c' },
      { sx: 33, sy: 3, sw: 28, sh: 14, c: '#6d727a' },
      { sx: 3, sy: 23, sw: 18, sh: 18, c: '#656a73' },
      { sx: 25, sy: 21, sw: 36, sh: 18, c: '#848a94' },
      { sx: 3, sy: 45, sw: 32, sh: 16, c: '#747982' },
      { sx: 39, sy: 43, sw: 22, sh: 18, c: '#696e75' }
    ];

    for (const s of stones) {
      ctx.fillStyle = s.c;
      ctx.fillRect(x + s.sx, y + s.sy, s.sw, s.sh);
      // Highlight rim
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x + s.sx, y + s.sy, s.sw, 2);
      ctx.fillRect(x + s.sx, y + s.sy, 2, s.sh);
    }
  }

  private drawStoneBrick(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#3b3e45';
    ctx.fillRect(x, y, w, h);

    // Staggered neat masonry blocks
    const brickH = 14;
    for (let r = 0; r < 4; r++) {
      const by = y + 2 + r * 15;
      const offset = (r % 2 === 0) ? 0 : 16;

      ctx.fillStyle = '#9aa0aa';
      ctx.fillRect(x + 2, by, 28 - offset, brickH);
      ctx.fillRect(x + 32 - offset, by, 29, brickH);
      if (offset > 0) {
        ctx.fillRect(x + 63 - offset, by, offset - 1, brickH);
      }

      // Bevel highlights
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(x + 2, by, w - 4, 2);
    }
  }

  private drawBricks(ctx: CanvasRenderingContext2D, col: number, row: number, brickCol: string, darkCol: string, mortarCol: string): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = mortarCol;
    ctx.fillRect(x, y, w, h);

    const bH = 13;
    for (let r = 0; r < 4; r++) {
      const by = y + 2 + r * 15;
      const isShift = (r % 2 !== 0);
      const bW = 28;

      for (let c = -1; c < 3; c++) {
        const bx = x + c * (bW + 3) + (isShift ? 15 : 0);
        if (bx + bW > x && bx < x + w) {
          ctx.fillStyle = (c + r) % 3 === 0 ? darkCol : brickCol;
          ctx.fillRect(Math.max(x + 1, bx), by, Math.min(bW, x + w - bx - 1), bH);
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(Math.max(x + 1, bx), by, Math.min(bW, x + w - bx - 1), 2);
        }
      }
    }
  }

  private drawRoofTiles(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#9e3f2c';
    ctx.fillRect(x, y, w, h);

    for (let r = 0; r < 4; r++) {
      const ry = y + r * 16;
      ctx.fillStyle = '#b54b36';
      ctx.fillRect(x, ry, w, 14);
      ctx.fillStyle = '#6e2719';
      ctx.fillRect(x, ry + 14, w, 2);

      // Scallop ribs
      for (let c = 0; c < 4; c++) {
        const cx = x + c * 16 + (r % 2) * 8;
        ctx.fillStyle = '#cf5b44';
        ctx.fillRect(cx, ry, 3, 14);
      }
    }
  }

  private drawWoodPlanks(ctx: CanvasRenderingContext2D, col: number, row: number, base: string, grain: string, seam: string): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);

    const plankH = 16;
    for (let p = 0; p < 4; p++) {
      const py = y + p * plankH;

      // Dark seam
      ctx.fillStyle = seam;
      ctx.fillRect(x, py, w, 2);

      // Wood grain lines
      ctx.fillStyle = grain;
      ctx.fillRect(x + 6, py + 5, w - 12, 1.5);
      ctx.fillRect(x + 12, py + 10, w - 24, 1.5);

      // Nail dots
      ctx.fillStyle = '#1e1610';
      ctx.fillRect(x + 5, py + 7, 2, 2);
      ctx.fillRect(x + w - 7, py + 7, 2, 2);
    }
  }

  private drawLogSide(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#614023';
    ctx.fillRect(x, y, w, h);

    // Vertical bark striations
    const barkColors = ['#4a3017', '#7a522f', '#3b2510'];
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = barkColors[i % 3];
      ctx.fillRect(x + i * 6 + 2, y, 3, h);
    }
  }

  private drawLogTop(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    // Dark outer bark ring
    ctx.fillStyle = '#4a3017';
    ctx.fillRect(x, y, w, h);

    // Concentric growth rings
    ctx.fillStyle = '#c79d67';
    ctx.fillRect(x + 5, y + 5, w - 10, h - 10);

    ctx.strokeStyle = '#9c733f';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 12, y + 12, w - 24, h - 24);
    ctx.strokeRect(x + 20, y + 20, w - 40, h - 40);

    // Heartwood center
    ctx.fillStyle = '#7a522f';
    ctx.fillRect(x + 27, y + 27, 10, 10);
  }

  private drawMetalPlate(ctx: CanvasRenderingContext2D, col: number, row: number, base: string, dark: string, light: string): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);

    // Outer and inner border
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

    ctx.strokeStyle = light;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);

    // Corner rivets
    ctx.fillStyle = '#e0e6ed';
    const rPts = [[8, 8], [w - 10, 8], [8, h - 10], [w - 10, h - 10]];
    for (const [rx, ry] of rPts) {
      ctx.fillRect(x + rx, y + ry, 3, 3);
      ctx.fillStyle = '#111';
      ctx.fillRect(x + rx + 1, y + ry + 1, 1, 1);
      ctx.fillStyle = '#e0e6ed';
    }
  }

  private drawSteelPlate(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#8a94a0';
    ctx.fillRect(x, y, w, h);

    // Brushed diagonal sheen
    ctx.fillStyle = '#9eaaba';
    ctx.fillRect(x + 6, y + 6, w - 12, h - 12);

    ctx.strokeStyle = '#545d69';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

    // Heavy bolted corners
    ctx.fillStyle = '#dbe5f0';
    const bolts = [[7, 7], [w - 11, 7], [7, h - 11], [w - 11, h - 11], [w/2 - 2, h/2 - 2]];
    for (const [bx, by] of bolts) {
      ctx.fillRect(x + bx, y + by, 4, 4);
    }
  }

  private drawMetalGrate(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    // Dark void beneath grate
    ctx.fillStyle = '#10141a';
    ctx.fillRect(x, y, w, h);

    // Metal grid ribs
    ctx.fillStyle = '#576270';
    for (let i = 0; i < w; i += 8) {
      ctx.fillRect(x + i, y, 3, h);
      ctx.fillRect(x, y + i, w, 3);
    }
    // High-contrast metal frame
    ctx.strokeStyle = '#7c8b9e';
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  }

  private drawCrate(ctx: CanvasRenderingContext2D, col: number, row: number, woodCol: string, borderCol: string, isTactical: boolean): void {
    const { x, y, w, h } = this.getBounds(col, row);
    // Wood planks center
    ctx.fillStyle = woodCol;
    ctx.fillRect(x, y, w, h);

    // Horizontal plank seams
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x, y + 16, w, 2);
    ctx.fillRect(x, y + 32, w, 2);
    ctx.fillRect(x, y + 48, w, 2);

    // Heavy perimeter frame
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 8;
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);

    // Bold diagonal X-brace
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 8);
    ctx.lineTo(x + w - 8, y + h - 8);
    ctx.moveTo(x + w - 8, y + 8);
    ctx.lineTo(x + 8, y + h - 8);
    ctx.stroke();

    if (isTactical) {
      // Corner steel brackets
      ctx.fillStyle = '#2b313a';
      ctx.fillRect(x + 4, y + 4, 8, 8);
      ctx.fillRect(x + w - 12, y + 4, 8, 8);
      ctx.fillRect(x + 4, y + h - 12, 8, 8);
      ctx.fillRect(x + w - 12, y + h - 12, 8, 8);
    }
  }

  private drawBarrelSide(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#7a4e28';
    ctx.fillRect(x, y, w, h);

    // Vertical staves
    ctx.fillStyle = '#5c3514';
    for (let i = 8; i < w; i += 12) {
      ctx.fillRect(x + i, y, 2, h);
    }

    // Heavy iron hoops
    ctx.fillStyle = '#26292e';
    ctx.fillRect(x, y + 10, w, 6);
    ctx.fillRect(x, y + h - 16, w, 6);
    ctx.fillStyle = '#8a94a0';
    ctx.fillRect(x, y + 11, w, 2);
    ctx.fillRect(x, y + h - 15, w, 2);
  }

  private drawBarrelTop(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#26292e';
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = '#7a4e28';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, w / 2 - 5, 0, Math.PI * 2);
    ctx.fill();

    // Bung hole
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawToxicBarrel(ctx: CanvasRenderingContext2D, eCtx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#e6c800';
    ctx.fillRect(x, y, w, h);

    // Diagonal hazard stripes
    ctx.fillStyle = '#1a1a1a';
    for (let i = -w; i < w * 2; i += 18) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + 20);
      ctx.lineTo(x + i + 10, y + 20);
      ctx.lineTo(x + i + 10 - 24, y + 44);
      ctx.lineTo(x + i - 24, y + 44);
      ctx.closePath();
      ctx.fill();
    }

    // Iron rims
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y + 4, w, 6);
    ctx.fillRect(x, y + h - 10, w, 6);

    // Emissive yellow glow on hazard stripes
    eCtx.fillStyle = '#b39c00';
    eCtx.fillRect(x, y + 20, w, 24);
  }

  private drawPowerCell(ctx: CanvasRenderingContext2D, eCtx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    // Dark chassis
    ctx.fillStyle = '#121820';
    ctx.fillRect(x, y, w, h);

    // Glowing energy honeycomb core
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(x + 12, y + 12, w - 24, h - 24);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 18, y + 18, w - 36, h - 36);

    ctx.strokeStyle = '#37474f';
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

    // Emissive glow
    eCtx.fillStyle = '#00ffff';
    eCtx.fillRect(x + 12, y + 12, w - 24, h - 24);
  }

  private drawComputerConsole(ctx: CanvasRenderingContext2D, eCtx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#222831';
    ctx.fillRect(x, y, w, h);

    // Screen
    ctx.fillStyle = '#0a192f';
    ctx.fillRect(x + 8, y + 8, w - 16, 26);
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 8, y + 8, w - 16, 26);

    // Screen graph lines
    ctx.fillStyle = '#00ffcc';
    ctx.fillRect(x + 12, y + 16, 18, 2);
    ctx.fillRect(x + 12, y + 22, 28, 2);
    ctx.fillRect(x + 12, y + 28, 12, 2);

    // Server louvers & LED lights
    ctx.fillStyle = '#393e46';
    ctx.fillRect(x + 8, y + 40, w - 16, 16);

    // Blinking LEDs
    const leds = ['#ff1744', '#00e676', '#ffea00', '#00e5ff'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = leds[i];
      ctx.fillRect(x + 12 + i * 11, y + 46, 4, 4);
      eCtx.fillStyle = leds[i];
      eCtx.fillRect(x + 12 + i * 11, y + 46, 4, 4);
    }
  }

  private drawSandbags(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#595037';
    ctx.fillRect(x, y, w, h);

    // Two rows of rounded burlap bags
    const rows = [4, 34];
    for (const ry of rows) {
      for (let c = 0; c < 2; c++) {
        const bx = x + 3 + c * 30;
        ctx.fillStyle = '#bda879';
        ctx.beginPath();
        ctx.roundRect(bx, y + ry, 28, 26, 6);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  private drawGlass(ctx: CanvasRenderingContext2D, col: number, row: number, fill: string, highlight: string): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);

    // Beveled frame
    ctx.strokeStyle = highlight;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

    // Diagonal specular glints
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 6);
    ctx.lineTo(x + 6, y + 12);
    ctx.moveTo(x + w - 8, y + 18);
    ctx.lineTo(x + 18, y + h - 8);
    ctx.stroke();
  }

  private drawLantern(ctx: CanvasRenderingContext2D, eCtx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#fff4bd';
    ctx.fillRect(x, y, w, h);

    // Cast iron cage frame
    ctx.strokeStyle = '#222831';
    ctx.lineWidth = 6;
    ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);

    ctx.fillStyle = '#ffea75';
    ctx.fillRect(x + 14, y + 14, w - 28, h - 28);

    // Emissive warmth
    eCtx.fillStyle = '#ffe066';
    eCtx.fillRect(x + 6, y + 6, w - 12, h - 12);
  }

  private drawNeon(ctx: CanvasRenderingContext2D, eCtx: CanvasRenderingContext2D, col: number, row: number, color: string, dark: string): void {
    const { x, y, w, h } = this.getBounds(col, row);
    // Dark cyber housing
    ctx.fillStyle = '#10141a';
    ctx.fillRect(x, y, w, h);

    // Outer neon glow stripe
    ctx.fillStyle = dark;
    ctx.fillRect(x + 10, y + 10, w - 20, h - 20);

    // Central super-bright tube
    ctx.fillStyle = color;
    ctx.fillRect(x + 18, y + 18, w - 36, h - 36);

    // Core white hot discharge
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 26, y + 26, w - 52, h - 52);

    // Emissive map
    eCtx.fillStyle = color;
    eCtx.fillRect(x + 10, y + 10, w - 20, h - 20);
    eCtx.fillStyle = '#ffffff';
    eCtx.fillRect(x + 22, y + 22, w - 44, h - 44);
  }

  private drawJumpPadTop(ctx: CanvasRenderingContext2D, eCtx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#263238';
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = '#ffb300';
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);

    // Triple chevron arrows (^^^) pointing up
    ctx.strokeStyle = '#ffea00';
    ctx.lineWidth = 4;
    const arrowYs = [18, 30, 42];
    for (const ay of arrowYs) {
      ctx.beginPath();
      ctx.moveTo(x + 16, y + ay + 6);
      ctx.lineTo(x + w / 2, y + ay - 4);
      ctx.lineTo(x + w - 16, y + ay + 6);
      ctx.stroke();
    }

    eCtx.strokeStyle = '#ffea00';
    eCtx.lineWidth = 5;
    for (const ay of arrowYs) {
      eCtx.beginPath();
      eCtx.moveTo(x + 16, y + ay + 6);
      eCtx.lineTo(x + w / 2, y + ay - 4);
      eCtx.lineTo(x + w - 16, y + ay + 6);
      eCtx.stroke();
    }
  }

  private drawSpeedPadTop(ctx: CanvasRenderingContext2D, eCtx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#1a237e';
    ctx.fillRect(x, y, w, h);

    // Forward supersonic velocity chevrons (>>>)
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 4;
    const arrowXs = [18, 30, 42];
    for (const ax of arrowXs) {
      ctx.beginPath();
      ctx.moveTo(x + ax - 4, y + 16);
      ctx.lineTo(x + ax + 6, y + h / 2);
      ctx.lineTo(x + ax - 4, y + h - 16);
      ctx.stroke();
    }

    eCtx.strokeStyle = '#00e5ff';
    eCtx.lineWidth = 5;
    for (const ax of arrowXs) {
      eCtx.beginPath();
      eCtx.moveTo(x + ax - 4, y + 16);
      eCtx.lineTo(x + ax + 6, y + h / 2);
      eCtx.lineTo(x + ax - 4, y + h - 16);
      eCtx.stroke();
    }
  }

  private drawBouncePadTop(ctx: CanvasRenderingContext2D, eCtx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#212121';
    ctx.fillRect(x, y, w, h);

    // Concentric spring rings
    ctx.strokeStyle = '#d500f9';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 24, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#ff4081';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 14, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 5, 0, Math.PI * 2);
    ctx.fill();

    eCtx.strokeStyle = '#d500f9';
    eCtx.lineWidth = 4;
    eCtx.beginPath();
    eCtx.arc(x + w / 2, y + h / 2, 24, 0, Math.PI * 2);
    eCtx.stroke();
  }

  private drawPadSide(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#37474f';
    ctx.fillRect(x, y, w, h);

    // Hazard stripes band along middle
    ctx.fillStyle = '#ffb300';
    ctx.fillRect(x, y + 22, w, 20);
    ctx.fillStyle = '#212121';
    for (let i = -w; i < w * 2; i += 14) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + 22);
      ctx.lineTo(x + i + 7, y + 22);
      ctx.lineTo(x + i - 3, y + 42);
      ctx.lineTo(x + i - 10, y + 42);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawLava(ctx: CanvasRenderingContext2D, eCtx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#ff3d00';
    ctx.fillRect(x, y, w, h);

    // Dark basalt crust patches
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(x + 6, y + 8, 20, 16);
    ctx.fillRect(x + 36, y + 28, 22, 18);
    ctx.fillRect(x + 12, y + 38, 16, 18);

    // Glowing molten fissures
    ctx.fillStyle = '#ffea00';
    ctx.fillRect(x, y + 26, w, 4);
    ctx.fillRect(x + 28, y, 4, h);

    // Emissive molten lava
    eCtx.fillStyle = '#ff5722';
    eCtx.fillRect(x, y, w, h);
    eCtx.fillStyle = '#ffff00';
    eCtx.fillRect(x, y + 26, w, 4);
    eCtx.fillRect(x + 28, y, 4, h);
  }

  private drawBarrier(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = 'rgba(70, 140, 255, 0.2)';
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = 'rgba(0, 220, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

    // Warning barrier cross
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 8);
    ctx.lineTo(x + w - 8, y + h - 8);
    ctx.moveTo(x + w - 8, y + 8);
    ctx.lineTo(x + 8, y + h - 8);
    ctx.stroke();
  }

  private drawSpawnMarker(ctx: CanvasRenderingContext2D, eCtx: CanvasRenderingContext2D, col: number, row: number, color: string): void {
    const { x, y, w, h } = this.getBounds(col, row);
    ctx.fillStyle = '#1c222b';
    ctx.fillRect(x, y, w, h);

    // Target crosshair rings
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 20, 0, Math.PI * 2);
    ctx.stroke();

    // Cross reticles
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 6);
    ctx.lineTo(x + w / 2, y + h - 6);
    ctx.moveTo(x + 6, y + h / 2);
    ctx.lineTo(x + w - 6, y + h / 2);
    ctx.stroke();

    eCtx.strokeStyle = color;
    eCtx.lineWidth = 3;
    eCtx.beginPath();
    eCtx.arc(x + w / 2, y + h / 2, 20, 0, Math.PI * 2);
    eCtx.stroke();
  }
}
