import { BlockId } from '@shared/constants.ts';
import { BLOCK_DEFINITIONS, getBlockDef } from '@shared/world/BlockTypes.ts';
import { VoxelWorld } from '@shared/world/VoxelWorld.ts';
import {
  exportMapToJSON,
  importMapFromJSON,
  encodeMapCode,
  decodeMapCode,
  generateCyberWarehouseTemplate,
  generateProtoxJumpArenaTemplate,
  VoxelMapData
} from '@shared/world/MapFormat.ts';
import { ChunkRenderer } from '../rendering/ChunkRenderer.ts';
import { MapEditor, BrushType } from '../editor/MapEditor.ts';

export class EditorUI {
  private container: HTMLElement;
  private topNavbar: HTMLElement;
  private bottomDock: HTMLElement;
  private inspectorCard: HTMLElement;
  private shortcutHelp: HTMLElement;
  private modalOverlay: HTMLElement;

  private editor: MapEditor;
  private world: VoxelWorld;
  private chunkRenderer: ChunkRenderer;

  public visible = false;
  public isPlaytesting = false;
  public mapName = 'Protox Jump Arena';

  public onMapLoaded?: (mapData: VoxelMapData) => void;
  public onAtmosphereChange?: (preset: string) => void;
  public onPlaytestToggle?: () => void;
  public onCursorLockToggle?: () => void;
  public onBlockSelected?: (blockId: BlockId) => void;
  public onOpenCreativeInventory?: () => void;

  private cursorLockBtn?: HTMLButtonElement;

  private activeCategory = 'utilities'; // 'solids' | 'neon' | 'utilities' | 'brushes'

  constructor(
    parent: HTMLElement,
    editor: MapEditor,
    world: VoxelWorld,
    chunkRenderer: ChunkRenderer,
    onMapLoaded?: (mapData: VoxelMapData) => void
  ) {
    this.editor = editor;
    this.world = world;
    this.chunkRenderer = chunkRenderer;
    this.onMapLoaded = onMapLoaded;

    this.container = document.createElement('div');
    this.container.id = 'protox-editor-ui-container';

    this.topNavbar = this.createTopNavbar();
    this.bottomDock = this.createBottomDock();
    this.inspectorCard = this.createInspectorCard();
    this.shortcutHelp = this.createShortcutHelp();
    this.modalOverlay = this.createImportModal();

    this.container.appendChild(this.topNavbar);
    this.container.appendChild(this.bottomDock);
    this.container.appendChild(this.inspectorCard);
    this.container.appendChild(this.shortcutHelp);
    this.container.appendChild(this.modalOverlay);
    parent.appendChild(this.container);

    this.setupShortcuts();
    this.setVisible(false);
  }

  // -------------------------------------------------------------
  // 1. Top Protox Studio Navbar
  // -------------------------------------------------------------
  private createTopNavbar(): HTMLElement {
    const nav = document.createElement('div');
    nav.id = 'editor-top-navbar';
    nav.style.position = 'absolute';
    nav.style.top = '12px';
    nav.style.left = '50%';
    nav.style.transform = 'translateX(-50%)';
    nav.style.width = 'calc(100% - 32px)';
    nav.style.maxWidth = '1240px';
    nav.style.background = 'rgba(8, 14, 22, 0.94)';
    nav.style.border = '1px solid rgba(0, 255, 204, 0.35)';
    nav.style.borderRadius = '10px';
    nav.style.padding = '8px 18px';
    nav.style.display = 'flex';
    nav.style.alignItems = 'center';
    nav.style.justifyContent = 'space-between';
    nav.style.backdropFilter = 'blur(12px)';
    nav.style.boxShadow = '0 8px 36px rgba(0, 0, 0, 0.75)';
    nav.style.zIndex = '350';
    nav.style.fontFamily = "'JetBrains Mono', 'Segoe UI', monospace";

    // Left: Brand & Map Name Input
    const leftGroup = document.createElement('div');
    leftGroup.style.display = 'flex';
    leftGroup.style.alignItems = 'center';
    leftGroup.style.gap = '14px';

    const brand = document.createElement('div');
    brand.innerHTML = `<span style="color:#00ffcc; font-weight:900; font-size:13px; letter-spacing:1.5px; text-shadow:0 0 10px rgba(0,255,204,0.4);">PROTOX MAPMAKER</span>`;
    leftGroup.appendChild(brand);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = this.mapName;
    nameInput.style.background = 'rgba(255, 255, 255, 0.08)';
    nameInput.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    nameInput.style.borderRadius = '4px';
    nameInput.style.color = '#fff';
    nameInput.style.fontSize = '12px';
    nameInput.style.padding = '4px 8px';
    nameInput.style.width = '170px';
    nameInput.style.outline = 'none';
    nameInput.oninput = (e) => {
      this.mapName = (e.target as HTMLInputElement).value || 'Custom Map';
    };
    leftGroup.appendChild(nameInput);

    nav.appendChild(leftGroup);

    // Center: Atmosphere & Playtest Mode
    const centerGroup = document.createElement('div');
    centerGroup.style.display = 'flex';
    centerGroup.style.alignItems = 'center';
    centerGroup.style.gap = '10px';

    // Sky Preset Dropdown
    const skyLabel = document.createElement('span');
    skyLabel.innerText = 'SKY:';
    skyLabel.style.color = '#90a4ae';
    skyLabel.style.fontSize = '11px';
    skyLabel.style.fontWeight = 'bold';
    centerGroup.appendChild(skyLabel);

    const skySelect = document.createElement('select');
    skySelect.id = 'editor-sky-select';
    skySelect.style.background = 'rgba(15, 23, 36, 0.9)';
    skySelect.style.border = '1px solid rgba(0, 255, 204, 0.4)';
    skySelect.style.color = '#00ffcc';
    skySelect.style.borderRadius = '4px';
    skySelect.style.padding = '4px 8px';
    skySelect.style.fontSize = '11px';
    skySelect.style.fontWeight = 'bold';
    skySelect.style.cursor = 'pointer';

    const presets = [
      { id: 'day', label: 'Day (Vibrant Arena)' },
      { id: 'golden_hour', label: 'Golden Hour' },
      { id: 'cyber', label: 'Cyber / Synthwave' },
      { id: 'dusk', label: 'Dusk' },
      { id: 'night', label: 'Moonlit Night' },
      { id: 'toxic', label: 'Toxic Lab' },
      { id: 'hell', label: 'Inferno Hell' }
    ];
    for (const p of presets) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.innerText = p.label;
      if (p.id === 'day') opt.selected = true;
      skySelect.appendChild(opt);
    }
    skySelect.onchange = () => {
      if (this.onAtmosphereChange) {
        this.onAtmosphereChange(skySelect.value);
      }
    };
    centerGroup.appendChild(skySelect);

    // Cursor Lock / Freedom Toggle Button
    const cursorBtn = document.createElement('button');
    cursorBtn.id = 'editor-cursor-lock-btn';
    cursorBtn.innerHTML = `🔓 FREE CURSOR <span style="font-size:9px; opacity:0.8;">[Alt]</span>`;
    cursorBtn.style.background = 'rgba(255, 179, 0, 0.15)';
    cursorBtn.style.border = '1px solid rgba(255, 179, 0, 0.4)';
    cursorBtn.style.color = '#ffb300';
    cursorBtn.style.fontWeight = 'bold';
    cursorBtn.style.fontSize = '11px';
    cursorBtn.style.padding = '6px 12px';
    cursorBtn.style.borderRadius = '6px';
    cursorBtn.style.cursor = 'pointer';
    cursorBtn.style.transition = 'all 0.15s ease';
    cursorBtn.title = 'Toggle pointer lock [Alt key]';
    cursorBtn.onclick = () => {
      if (this.onCursorLockToggle) {
        this.onCursorLockToggle();
      }
    };
    this.cursorLockBtn = cursorBtn;
    centerGroup.appendChild(cursorBtn);

    // Playtest Toggle Button
    const playtestBtn = document.createElement('button');
    playtestBtn.id = 'editor-playtest-toggle-btn';
    playtestBtn.innerHTML = `⚡ PLAYTEST (H)`;
    playtestBtn.style.background = 'linear-gradient(135deg, #00e676, #00b0ff)';
    playtestBtn.style.border = 'none';
    playtestBtn.style.color = '#000';
    playtestBtn.style.fontWeight = '900';
    playtestBtn.style.fontSize = '11px';
    playtestBtn.style.padding = '6px 14px';
    playtestBtn.style.borderRadius = '6px';
    playtestBtn.style.cursor = 'pointer';
    playtestBtn.style.boxShadow = '0 0 16px rgba(0, 230, 118, 0.5)';
    playtestBtn.style.transition = 'all 0.15s ease';
    playtestBtn.onclick = () => {
      if (this.onPlaytestToggle) {
        this.onPlaytestToggle();
      }
    };
    centerGroup.appendChild(playtestBtn);

    nav.appendChild(centerGroup);

    // Right: Actions (Undo, Redo, Copy Map Code, Import, Templates, Community)
    const rightGroup = document.createElement('div');
    rightGroup.style.display = 'flex';
    rightGroup.style.alignItems = 'center';
    rightGroup.style.gap = '6px';

    const undoBtn = document.createElement('button');
    undoBtn.innerText = '↶ Undo';
    undoBtn.title = 'Ctrl + Z';
    this.styleButton(undoBtn);
    undoBtn.onclick = () => this.editor.history.undo(this.world, this.chunkRenderer);
    rightGroup.appendChild(undoBtn);

    const redoBtn = document.createElement('button');
    redoBtn.innerText = '↷ Redo';
    redoBtn.title = 'Ctrl + Y';
    this.styleButton(redoBtn);
    redoBtn.onclick = () => this.editor.history.redo(this.world, this.chunkRenderer);
    rightGroup.appendChild(redoBtn);

    const copyCodeBtn = document.createElement('button');
    copyCodeBtn.innerText = '📋 Copy Code';
    copyCodeBtn.title = 'Copy single-line Protox Map Code to clipboard';
    this.styleButton(copyCodeBtn, '#00e676');
    copyCodeBtn.onclick = () => this.handleCopyMapCode();
    rightGroup.appendChild(copyCodeBtn);

    const importBtn = document.createElement('button');
    importBtn.innerText = '📥 Import';
    importBtn.title = 'Paste Map Code or JSON';
    this.styleButton(importBtn, '#29b6f6');
    importBtn.onclick = () => {
      this.modalOverlay.style.display = 'flex';
      document.exitPointerLock();
    };
    rightGroup.appendChild(importBtn);

    const clearBtn = document.createElement('button');
    clearBtn.innerText = '🗑️ Clear';
    this.styleButton(clearBtn, '#ff5252');
    clearBtn.onclick = () => {
      if (confirm('Clear the entire map?')) {
        this.world.chunks.clear();
        this.chunkRenderer.update(this.world);
        this.editor.history.clear();
      }
    };
    rightGroup.appendChild(clearBtn);

    const communityBtn = document.createElement('button');
    communityBtn.id = 'editor-community-maps-btn';
    communityBtn.innerText = '🌐 Maps';
    this.styleButton(communityBtn, '#ab47bc');
    rightGroup.appendChild(communityBtn);

    nav.appendChild(rightGroup);

    return nav;
  }

  // -------------------------------------------------------------
  // 2. Bottom Categorized Dock (Solids, Neon, Utilities, Brushes)
  // -------------------------------------------------------------
  private createBottomDock(): HTMLElement {
    const dock = document.createElement('div');
    dock.id = 'editor-bottom-dock';
    dock.style.position = 'absolute';
    dock.style.bottom = '16px';
    dock.style.left = '50%';
    dock.style.transform = 'translateX(-50%)';
    dock.style.width = 'calc(100% - 32px)';
    dock.style.maxWidth = '920px';
    dock.style.background = 'rgba(8, 14, 22, 0.94)';
    dock.style.border = '1px solid rgba(0, 255, 204, 0.3)';
    dock.style.borderRadius = '10px';
    dock.style.padding = '8px 14px';
    dock.style.backdropFilter = 'blur(12px)';
    dock.style.boxShadow = '0 8px 36px rgba(0, 0, 0, 0.75)';
    dock.style.zIndex = '350';
    dock.style.fontFamily = "'JetBrains Mono', 'Segoe UI', monospace";

    // Category Tabs Header
    const tabsHeader = document.createElement('div');
    tabsHeader.style.display = 'flex';
    tabsHeader.style.gap = '8px';
    tabsHeader.style.borderBottom = '1px solid rgba(255, 255, 255, 0.12)';
    tabsHeader.style.paddingBottom = '6px';
    tabsHeader.style.marginBottom = '8px';

    const categories = [
      { id: 'utilities', label: '🚀 Gameplay & Utilities' },
      { id: 'neon', label: '✨ Neon / Glow' },
      { id: 'solids', label: '🧱 Solid Blocks' },
      { id: 'brushes', label: '🖌️ Brush Tools' }
    ];

    const invBtn = document.createElement('button');
    invBtn.innerText = '📦 Catalog & Hotbar [E]';
    invBtn.title = 'Open Minecraft Creative Mode-style catalog to customize 9 hotbar slots';
    invBtn.style.marginLeft = 'auto';
    invBtn.style.padding = '4px 12px';
    invBtn.style.background = 'linear-gradient(135deg, rgba(0, 255, 204, 0.25), rgba(41, 182, 246, 0.25))';
    invBtn.style.border = '1px solid #00ffcc';
    invBtn.style.borderRadius = '5px';
    invBtn.style.color = '#00ffcc';
    invBtn.style.fontWeight = 'bold';
    invBtn.style.fontSize = '11px';
    invBtn.style.cursor = 'pointer';
    invBtn.style.boxShadow = '0 0 10px rgba(0, 255, 204, 0.3)';
    invBtn.onclick = () => {
      if (this.onOpenCreativeInventory) {
        this.onOpenCreativeInventory();
      }
    };

    const contentPane = document.createElement('div');
    contentPane.id = 'editor-category-content';
    contentPane.style.display = 'flex';
    contentPane.style.gap = '6px';
    contentPane.style.flexWrap = 'wrap';

    const renderCategory = (catId: string) => {
      this.activeCategory = catId;
      contentPane.innerHTML = '';

      // Update active tab style
      tabsHeader.querySelectorAll('.dock-tab').forEach((el) => {
        (el as HTMLElement).style.borderColor = 'transparent';
        (el as HTMLElement).style.color = '#90a4ae';
      });
      const activeTab = tabsHeader.querySelector(`[data-cat="${catId}"]`) as HTMLElement;
      if (activeTab) {
        activeTab.style.borderColor = '#00ffcc';
        activeTab.style.color = '#00ffcc';
      }

      if (catId === 'brushes') {
        const brushes = [
          { type: BrushType.SINGLE, label: '1x1 Single', key: '1' },
          { type: BrushType.CUBE_2X2, label: '2x2 Cube', key: '2' },
          { type: BrushType.CUBE_3X3, label: '3x3 Cube', key: '3' },
          { type: BrushType.BOX_FILL, label: 'Box Fill', key: '4' },
          { type: BrushType.EYEDROPPER, label: 'Eyedropper', key: 'Q' }
        ];
        for (const b of brushes) {
          const item = document.createElement('button');
          item.innerHTML = `<span>${b.label}</span> <span style="font-size:9px; background:rgba(255,255,255,0.15); padding:1px 4px; border-radius:3px;">${b.key}</span>`;
          this.styleButton(item);
          if (this.editor.activeBrush === b.type) {
            item.style.borderColor = '#00ffcc';
            item.style.color = '#00ffcc';
          }
          item.onclick = () => {
            this.editor.setBrush(b.type);
            renderCategory('brushes');
          };
          contentPane.appendChild(item);
        }
      } else {
        let blockIds: number[] = [];
        if (catId === 'utilities') {
          blockIds = [
            BlockId.JUMP_PAD,
            BlockId.SPEED_PAD,
            BlockId.HAZARD_LAVA,
            BlockId.BARRIER,
            BlockId.SPAWN_FFA,
            BlockId.SPAWN_RED,
            BlockId.SPAWN_BLUE
          ];
        } else if (catId === 'neon') {
          blockIds = [
            BlockId.NEON_CYAN,
            BlockId.NEON_ORANGE,
            BlockId.NEON_MAGENTA,
            BlockId.NEON_LIME
          ];
        } else {
          blockIds = [
            BlockId.CONCRETE,
            BlockId.STONE,
            BlockId.METAL_DARK,
            BlockId.BRICK,
            BlockId.WOOD_PLANK,
            BlockId.CRATE,
            BlockId.GLASS,
            BlockId.SAND,
            BlockId.GRASS,
            BlockId.DIRT
          ];
        }

        for (const id of blockIds) {
          const def = getBlockDef(id);
          const item = document.createElement('button');
          const [r, g, b] = def.color.map((v) => Math.round(v * 255));
          const isSelected = this.editor.activeBlockId === id;

          item.style.display = 'flex';
          item.style.alignItems = 'center';
          item.style.gap = '8px';
          item.style.padding = '5px 10px';
          item.style.background = isSelected ? 'rgba(0, 255, 204, 0.15)' : 'rgba(255, 255, 255, 0.05)';
          item.style.border = isSelected ? '1px solid #00ffcc' : '1px solid rgba(255, 255, 255, 0.15)';
          item.style.borderRadius = '5px';
          item.style.cursor = 'pointer';
          item.style.color = isSelected ? '#00ffcc' : '#fff';
          item.style.fontSize = '11px';
          item.style.fontWeight = 'bold';

          item.innerHTML = `
            <span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:rgb(${r},${g},${b}); box-shadow:0 0 6px rgba(${r},${g},${b},0.6);"></span>
            <span>${def.name}</span>
          `;

          item.onclick = () => {
            this.editor.activeBlockId = id;
            renderCategory(catId);
            if (this.onBlockSelected) {
              this.onBlockSelected(id);
            }
          };

          contentPane.appendChild(item);
        }
      }
    };

    for (const cat of categories) {
      const tab = document.createElement('button');
      tab.innerText = cat.label;
      tab.className = 'dock-tab';
      tab.setAttribute('data-cat', cat.id);
      tab.style.background = 'none';
      tab.style.border = 'none';
      tab.style.borderBottom = '2px solid transparent';
      tab.style.color = '#90a4ae';
      tab.style.fontSize = '11px';
      tab.style.fontWeight = 'bold';
      tab.style.padding = '4px 8px';
      tab.style.cursor = 'pointer';
      tab.onclick = () => renderCategory(cat.id);
      tabsHeader.appendChild(tab);
    }
    tabsHeader.appendChild(invBtn);

    dock.appendChild(tabsHeader);
    dock.appendChild(contentPane);

    renderCategory(this.activeCategory);
    return dock;
  }

  // -------------------------------------------------------------
  // 3. Floating Inspector Card (Coordinates, Total Blocks)
  // -------------------------------------------------------------
  private createInspectorCard(): HTMLElement {
    const card = document.createElement('div');
    card.id = 'editor-inspector-card';
    card.style.position = 'absolute';
    card.style.top = '74px';
    card.style.left = '16px';
    card.style.background = 'rgba(8, 14, 22, 0.9)';
    card.style.border = '1px solid rgba(0, 255, 204, 0.3)';
    card.style.borderRadius = '8px';
    card.style.padding = '10px 14px';
    card.style.color = '#cfd8dc';
    card.style.fontFamily = "'JetBrains Mono', monospace";
    card.style.fontSize = '11px';
    card.style.backdropFilter = 'blur(10px)';
    card.style.zIndex = '350';
    card.style.minWidth = '180px';
    card.style.lineHeight = '1.6';

    card.innerHTML = `
      <div style="font-weight:bold; color:#00ffcc; margin-bottom:4px;">INSPECTOR</div>
      <div id="inspector-coords">XYZ: 0, 0, 0</div>
      <div id="inspector-blocks">Blocks: 0</div>
      <div id="inspector-brush">Brush: 1x1</div>
      <div id="inspector-mode" style="margin-top:4px; color:#ffb74d;">CAMERA: NOCLIP FLY</div>
    `;

    return card;
  }

  // -------------------------------------------------------------
  // 4. Protox Shortcut Helper Card (Bottom-Right)
  // -------------------------------------------------------------
  private createShortcutHelp(): HTMLElement {
    const help = document.createElement('div');
    help.id = 'editor-shortcut-help';
    help.style.position = 'absolute';
    help.style.bottom = '16px';
    help.style.right = '16px';
    help.style.background = 'rgba(8, 14, 22, 0.88)';
    help.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    help.style.borderRadius = '8px';
    help.style.padding = '10px 14px';
    help.style.color = '#90a4ae';
    help.style.fontFamily = "'JetBrains Mono', monospace";
    help.style.fontSize = '10px';
    help.style.backdropFilter = 'blur(8px)';
    help.style.zIndex = '340';
    help.style.lineHeight = '1.5';

    help.innerHTML = `
      <div style="font-weight:bold; color:#fff; margin-bottom:4px;">PROTOX KEYBINDS</div>
      <div><span style="color:#00ffcc;">Left Click:</span> Place Block</div>
      <div><span style="color:#00ffcc;">Right Click:</span> Break Block</div>
      <div><span style="color:#00ffcc;">Mid-Click / Q:</span> Eyedropper</div>
      <div><span style="color:#00ffcc;">W A S D:</span> Fly Look Dir</div>
      <div><span style="color:#00ffcc;">Space / C:</span> Fly Up / Down</div>
      <div><span style="color:#00ffcc;">Shift:</span> Fast Fly Boost</div>
      <div><span style="color:#ffb74d;">H Key:</span> Toggle Playtest</div>
      <div><span style="color:#29b6f6;">Ctrl+Z / Y:</span> Undo / Redo</div>
    `;

    return help;
  }

  // -------------------------------------------------------------
  // 5. Protox Map Import & Predefined Templates Modal
  // -------------------------------------------------------------
  private createImportModal(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(6, 10, 16, 0.88)';
    overlay.style.display = 'none';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '500';
    overlay.style.backdropFilter = 'blur(8px)';

    const card = document.createElement('div');
    card.style.background = '#101724';
    card.style.border = '1px solid rgba(0, 255, 204, 0.4)';
    card.style.borderRadius = '10px';
    card.style.padding = '24px';
    card.style.width = '540px';
    card.style.boxShadow = '0 12px 48px rgba(0,0,0,0.85)';
    card.style.color = '#fff';
    card.style.fontFamily = "'JetBrains Mono', monospace";

    card.innerHTML = `
      <div style="font-size:1.25rem; font-weight:bold; color:#00ffcc; margin-bottom:12px;">IMPORT PROTOX MAP</div>
      <div style="font-size:0.8rem; color:#90a4ae; margin-bottom:14px;">Paste a Protox Map Code or full JSON map data, or choose a template:</div>
      
      <div style="margin-bottom:12px; display:flex; gap:6px;">
        <button id="template-protox-jump" style="flex:1; padding:7px; background:#1b2a38; border:1px solid #00ffcc; color:#00ffcc; border-radius:4px; cursor:pointer; font-size:10px; font-weight:bold;">Template: Neon Jump Arena</button>
        <button id="template-warehouse" style="flex:1; padding:7px; background:#1b2a38; border:1px solid #37474f; color:#fff; border-radius:4px; cursor:pointer; font-size:10px; font-weight:bold;">Template: Cyber Warehouse</button>
        <button id="template-default" style="flex:1; padding:7px; background:#1b2a38; border:1px solid #37474f; color:#fff; border-radius:4px; cursor:pointer; font-size:10px; font-weight:bold;">Template: Default Arena</button>
      </div>

      <textarea id="import-json-text" placeholder="Paste single-line Map Code or JSON data here..." style="width:100%; height:140px; background:#080d15; border:1px solid rgba(255,255,255,0.2); border-radius:6px; color:#cfd8dc; font-family:monospace; font-size:11px; padding:10px; resize:none; margin-bottom:16px; outline:none;"></textarea>
      
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button id="modal-cancel-btn" style="padding:8px 16px; background:#263238; border:none; border-radius:4px; color:#fff; cursor:pointer; font-weight:bold; font-size:11px;">Cancel</button>
        <button id="modal-load-btn" style="padding:8px 20px; background:#00e676; border:none; border-radius:4px; color:#000; cursor:pointer; font-weight:bold; font-size:11px;">Load Map</button>
      </div>
    `;

    overlay.appendChild(card);

    setTimeout(() => {
      const cancelBtn = card.querySelector('#modal-cancel-btn') as HTMLButtonElement;
      const loadBtn = card.querySelector('#modal-load-btn') as HTMLButtonElement;
      const textarea = card.querySelector('#import-json-text') as HTMLTextAreaElement;
      const tplProtox = card.querySelector('#template-protox-jump') as HTMLButtonElement;
      const tplWarehouse = card.querySelector('#template-warehouse') as HTMLButtonElement;
      const tplDefault = card.querySelector('#template-default') as HTMLButtonElement;

      cancelBtn.onclick = () => {
        overlay.style.display = 'none';
      };

      tplProtox.onclick = () => {
        const jumpArena = generateProtoxJumpArenaTemplate();
        this.loadMapData(jumpArena);
        overlay.style.display = 'none';
      };

      tplWarehouse.onclick = () => {
        const warehouse = generateCyberWarehouseTemplate();
        this.loadMapData(warehouse);
        overlay.style.display = 'none';
      };

      tplDefault.onclick = () => {
        this.world.generateDefaultArena();
        this.chunkRenderer.update(this.world);
        this.editor.history.clear();
        overlay.style.display = 'none';
        if (this.onMapLoaded) {
          this.onMapLoaded(exportMapToJSON(this.world, 'Default Arena'));
        }
      };

      loadBtn.onclick = () => {
        const text = textarea.value.trim();
        if (!text) return;

        let parsed: VoxelMapData | null = null;
        try {
          if (text.startsWith('{')) {
            parsed = JSON.parse(text) as VoxelMapData;
          } else {
            parsed = decodeMapCode(text);
          }
        } catch (e) {
          alert('Could not decode Protox Map Code or JSON: ' + String(e));
          return;
        }

        if (parsed && Array.isArray(parsed.blocks)) {
          this.loadMapData(parsed);
          overlay.style.display = 'none';
        } else {
          alert('Invalid Voxel Map schema.');
        }
      };
    }, 50);

    return overlay;
  }

  private loadMapData(mapData: VoxelMapData): void {
    importMapFromJSON(this.world, mapData);
    this.chunkRenderer.update(this.world);
    this.editor.history.clear();
    this.mapName = mapData.name;

    const nameInput = this.topNavbar.querySelector('input') as HTMLInputElement;
    if (nameInput) nameInput.value = this.mapName;

    if (mapData.environmentPreset && this.onAtmosphereChange) {
      this.onAtmosphereChange(mapData.environmentPreset);
      const skySelect = document.getElementById('editor-sky-select') as HTMLSelectElement;
      if (skySelect) skySelect.value = mapData.environmentPreset;
    }

    if (this.onMapLoaded) {
      this.onMapLoaded(mapData);
    }
  }

  public handleCopyMapCode(): void {
    const skySelect = document.getElementById('editor-sky-select') as HTMLSelectElement;
    const preset = skySelect ? skySelect.value : 'cyber';
    const data = exportMapToJSON(this.world, this.mapName, 'Protox Builder', preset);
    const code = encodeMapCode(data);

    navigator.clipboard.writeText(code).then(() => {
      alert(`Protox Map Code copied to clipboard!\nTotal blocks: ${data.blocks.length}`);
    }).catch(() => {
      alert(`Map Code: ${code.slice(0, 40)}... (Copied)`);
    });
  }

  public updateInspector(cursorX: number, cursorY: number, cursorZ: number, totalBlocks: number): void {
    const coordsEl = document.getElementById('inspector-coords');
    const blocksEl = document.getElementById('inspector-blocks');
    const brushEl = document.getElementById('inspector-brush');
    const modeEl = document.getElementById('inspector-mode');

    if (coordsEl) coordsEl.innerText = `XYZ: ${cursorX}, ${cursorY}, ${cursorZ}`;
    if (blocksEl) blocksEl.innerText = `Blocks: ${totalBlocks}`;
    if (brushEl) brushEl.innerText = `Brush: ${this.editor.activeBrush}`;
    if (modeEl) {
      modeEl.innerText = this.isPlaytesting ? 'MODE: FPS PLAYTEST' : 'MODE: NOCLIP FLY';
      modeEl.style.color = this.isPlaytesting ? '#00e676' : '#ffb74d';
    }
  }

  public setPlaytestState(isPlaytesting: boolean): void {
    this.isPlaytesting = isPlaytesting;
    const btn = document.getElementById('editor-playtest-toggle-btn');
    if (btn) {
      if (isPlaytesting) {
        btn.innerHTML = `🔨 BUILD MODE (H)`;
        btn.style.background = 'linear-gradient(135deg, #ff9100, #ff5252)';
      } else {
        btn.innerHTML = `⚡ PLAYTEST (H)`;
        btn.style.background = 'linear-gradient(135deg, #00e676, #00b0ff)';
      }
    }
  }

  private styleButton(btn: HTMLElement, highlightColor = '#ffffff'): void {
    btn.style.background = 'rgba(255, 255, 255, 0.08)';
    btn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    btn.style.color = highlightColor;
    btn.style.fontFamily = "'JetBrains Mono', monospace";
    btn.style.fontSize = '11px';
    btn.style.fontWeight = 'bold';
    btn.style.padding = '5px 10px';
    btn.style.borderRadius = '5px';
    btn.style.cursor = 'pointer';
    btn.style.transition = 'all 0.15s ease';

    btn.onmouseenter = () => {
      btn.style.background = 'rgba(255, 255, 255, 0.18)';
    };
    btn.onmouseleave = () => {
      btn.style.background = 'rgba(255, 255, 255, 0.08)';
    };
  }

  private setupShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.code === 'KeyZ' && !e.shiftKey) {
        this.editor.history.undo(this.world, this.chunkRenderer);
      }
      if ((e.ctrlKey && e.code === 'KeyY') || (e.ctrlKey && e.shiftKey && e.code === 'KeyZ')) {
        this.editor.history.redo(this.world, this.chunkRenderer);
      }
    });
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.topNavbar.style.display = visible ? 'flex' : 'none';
    this.bottomDock.style.display = visible ? 'block' : 'none';
    this.inspectorCard.style.display = visible ? 'block' : 'none';
    this.shortcutHelp.style.display = visible ? 'block' : 'none';
    if (!visible) {
      this.modalOverlay.style.display = 'none';
    }
  }

  public setCursorLocked(locked: boolean): void {
    if (!this.cursorLockBtn) return;
    if (locked) {
      this.cursorLockBtn.innerHTML = `🔓 FREE CURSOR <span style="font-size:9px; opacity:0.8;">[Alt]</span>`;
      this.cursorLockBtn.style.background = 'rgba(255, 179, 0, 0.15)';
      this.cursorLockBtn.style.borderColor = 'rgba(255, 179, 0, 0.4)';
      this.cursorLockBtn.style.color = '#ffb300';
    } else {
      this.cursorLockBtn.innerHTML = `🔒 LOCK LOOK <span style="font-size:9px; opacity:0.8;">[Alt]</span>`;
      this.cursorLockBtn.style.background = 'rgba(0, 255, 204, 0.15)';
      this.cursorLockBtn.style.borderColor = 'rgba(0, 255, 204, 0.6)';
      this.cursorLockBtn.style.color = '#00ffcc';
    }
  }
}
