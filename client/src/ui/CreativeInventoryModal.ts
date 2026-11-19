import { BlockId } from '@shared/constants.ts';
import { BLOCK_DEFINITIONS, BlockDefinition, BlockCategory } from '@shared/world/BlockTypes.ts';
import { TextureAtlas } from '../rendering/TextureAtlas.ts';

export const DEFAULT_HOTBAR: BlockId[] = [
  BlockId.GRASS,
  BlockId.CONCRETE,
  BlockId.COBBLESTONE,
  BlockId.WOOD_PLANK,
  BlockId.STEEL_PLATE,
  BlockId.CRATE,
  BlockId.NEON_CYAN,
  BlockId.JUMP_PAD,
  BlockId.GLASS
];

export class CreativeInventoryModal {
  private container: HTMLElement;
  private overlay: HTMLElement;
  private cardGrid: HTMLElement;
  private searchInput!: HTMLInputElement;
  private hotbarSlotsContainer!: HTMLElement;
  private tooltipEl: HTMLElement;

  public visible = false;
  public hotbar: BlockId[] = [...DEFAULT_HOTBAR];
  public activeSlotIndex = 0; // 0..8 (corresponds to keys 1..9)

  private activeCategoryTab: string = 'all';
  private searchQuery = '';
  private draggedBlockId: BlockId | null = null;
  private draggedSlotIndex: number | null = null;

  public onHotbarChange?: (hotbar: BlockId[], activeIndex: number) => void;
  public onBlockSelected?: (blockId: BlockId) => void;
  public onClose?: () => void;

  constructor(parent: HTMLElement) {
    this.loadPersistedHotbar();

    this.overlay = document.createElement('div');
    this.overlay.id = 'creative-inventory-overlay';
    this.overlay.style.position = 'fixed';
    this.overlay.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.width = '100vw';
    this.overlay.style.height = '100vh';
    this.overlay.style.backgroundColor = 'rgba(4, 8, 14, 0.78)';
    this.overlay.style.backdropFilter = 'blur(8px)';
    this.overlay.style.display = 'none';
    this.overlay.style.justifyContent = 'center';
    this.overlay.style.alignItems = 'center';
    this.overlay.style.zIndex = '500';
    this.overlay.style.fontFamily = "'JetBrains Mono', 'Segoe UI', monospace";

    this.container = document.createElement('div');
    this.container.id = 'creative-inventory-modal';
    this.container.style.width = '880px';
    this.container.style.maxWidth = '94vw';
    this.container.style.height = '620px';
    this.container.style.maxHeight = '92vh';
    this.container.style.background = 'linear-gradient(180deg, rgba(14, 22, 34, 0.98), rgba(9, 14, 22, 0.98))';
    this.container.style.border = '1px solid rgba(0, 255, 204, 0.4)';
    this.container.style.borderRadius = '14px';
    this.container.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.85), 0 0 30px rgba(0, 255, 204, 0.15)';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.overflow = 'hidden';
    this.container.style.color = '#e0f7fa';

    // 1. Modal Header
    const header = this.createHeader();
    this.container.appendChild(header);

    // 2. Tabs & Search Bar Container
    const filterBar = this.createFilterBar();
    this.container.appendChild(filterBar);

    // 3. Scrollable Block Catalog Grid
    this.cardGrid = document.createElement('div');
    this.cardGrid.id = 'creative-inventory-grid';
    this.cardGrid.style.flex = '1';
    this.cardGrid.style.overflowY = 'auto';
    this.cardGrid.style.padding = '14px 20px';
    this.cardGrid.style.display = 'grid';
    this.cardGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(135px, 1fr))';
    this.cardGrid.style.gap = '10px';
    this.cardGrid.style.alignContent = 'start';
    this.container.appendChild(this.cardGrid);

    // 4. Hotbar Dock Section
    const hotbarSection = this.createHotbarSection();
    this.container.appendChild(hotbarSection);

    // 5. Tooltip element
    this.tooltipEl = this.createTooltip();
    document.body.appendChild(this.tooltipEl);

    this.overlay.appendChild(this.container);
    parent.appendChild(this.overlay);

    // Close on background click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.setVisible(false);
      }
    });

    this.renderCatalog();
    this.renderHotbar();
  }

  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.style.padding = '14px 22px';
    header.style.background = 'rgba(5, 10, 18, 0.6)';
    header.style.borderBottom = '1px solid rgba(0, 255, 204, 0.2)';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '10px';

    const icon = document.createElement('div');
    icon.innerHTML = '&#9638;';
    icon.style.fontSize = '20px';
    icon.style.color = '#00ffcc';
    icon.style.textShadow = '0 0 10px #00ffcc';

    const titleGroup = document.createElement('div');
    const title = document.createElement('div');
    title.innerText = 'CREATIVE INVENTORY';
    title.style.fontWeight = '900';
    title.style.fontSize = '15px';
    title.style.letterSpacing = '1px';
    title.style.color = '#fff';

    const sub = document.createElement('div');
    sub.innerText = 'Click to place in selected Hotbar slot • Drag & drop to arrange';
    sub.style.fontSize = '11px';
    sub.style.color = 'rgba(255, 255, 255, 0.5)';

    titleGroup.appendChild(title);
    titleGroup.appendChild(sub);
    left.appendChild(icon);
    left.appendChild(titleGroup);

    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕';
    closeBtn.title = 'Close [E / ESC]';
    closeBtn.style.background = 'rgba(255, 255, 255, 0.08)';
    closeBtn.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    closeBtn.style.color = '#fff';
    closeBtn.style.width = '30px';
    closeBtn.style.height = '30px';
    closeBtn.style.borderRadius = '6px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.transition = 'all 0.15s ease';
    closeBtn.onmouseenter = () => {
      closeBtn.style.background = 'rgba(255, 50, 50, 0.4)';
      closeBtn.style.borderColor = '#ff5252';
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.08)';
      closeBtn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
    };
    closeBtn.onclick = () => this.setVisible(false);

    header.appendChild(left);
    header.appendChild(closeBtn);
    return header;
  }

  private createFilterBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.style.padding = '10px 20px';
    bar.style.display = 'flex';
    bar.style.justifyContent = 'space-between';
    bar.style.alignItems = 'center';
    bar.style.gap = '12px';
    bar.style.borderBottom = '1px solid rgba(255, 255, 255, 0.08)';
    bar.style.background = 'rgba(0, 0, 0, 0.2)';

    // Category Tabs
    const tabsContainer = document.createElement('div');
    tabsContainer.style.display = 'flex';
    tabsContainer.style.gap = '6px';

    const categories: { id: string; label: string; icon: string }[] = [
      { id: 'all', label: 'All', icon: '★' },
      { id: 'building', label: 'Building', icon: '🏛️' },
      { id: 'decor', label: 'Decor & Props', icon: '📦' },
      { id: 'nature', label: 'Nature', icon: '🌿' },
      { id: 'interactive', label: 'Interactive', icon: '⚡' }
    ];

    for (const cat of categories) {
      const tab = document.createElement('button');
      tab.innerText = `${cat.icon} ${cat.label}`;
      tab.style.padding = '6px 12px';
      tab.style.borderRadius = '6px';
      tab.style.fontSize = '11px';
      tab.style.fontWeight = '700';
      tab.style.cursor = 'pointer';
      tab.style.transition = 'all 0.15s ease';

      const updateTabStyle = () => {
        const isActive = this.activeCategoryTab === cat.id;
        tab.style.background = isActive ? 'rgba(0, 255, 204, 0.22)' : 'rgba(255, 255, 255, 0.06)';
        tab.style.border = isActive ? '1px solid #00ffcc' : '1px solid rgba(255, 255, 255, 0.1)';
        tab.style.color = isActive ? '#00ffcc' : 'rgba(255, 255, 255, 0.75)';
        tab.style.boxShadow = isActive ? '0 0 10px rgba(0, 255, 204, 0.3)' : 'none';
      };

      tab.onclick = () => {
        this.activeCategoryTab = cat.id;
        Array.from(tabsContainer.children).forEach((child: any) => {
          if (child.updateStyle) child.updateStyle();
        });
        this.renderCatalog();
      };
      (tab as any).updateStyle = updateTabStyle;
      updateTabStyle();

      tabsContainer.appendChild(tab);
    }

    // Search Input
    const searchContainer = document.createElement('div');
    searchContainer.style.position = 'relative';
    searchContainer.style.width = '240px';

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = 'Search blocks...';
    this.searchInput.style.width = '100%';
    this.searchInput.style.padding = '6px 12px 6px 28px';
    this.searchInput.style.background = 'rgba(0, 0, 0, 0.4)';
    this.searchInput.style.border = '1px solid rgba(0, 255, 204, 0.3)';
    this.searchInput.style.borderRadius = '6px';
    this.searchInput.style.color = '#fff';
    this.searchInput.style.fontSize = '12px';
    this.searchInput.style.outline = 'none';
    this.searchInput.style.fontFamily = 'inherit';

    const searchIcon = document.createElement('span');
    searchIcon.innerText = '🔍';
    searchIcon.style.position = 'absolute';
    searchIcon.style.left = '8px';
    searchIcon.style.top = '50%';
    searchIcon.style.transform = 'translateY(-50%)';
    searchIcon.style.fontSize = '11px';
    searchIcon.style.opacity = '0.6';
    searchIcon.style.pointerEvents = 'none';

    this.searchInput.oninput = () => {
      this.searchQuery = this.searchInput.value.trim().toLowerCase();
      this.renderCatalog();
    };

    searchContainer.appendChild(searchIcon);
    searchContainer.appendChild(this.searchInput);

    bar.appendChild(tabsContainer);
    bar.appendChild(searchContainer);
    return bar;
  }

  private createHotbarSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.padding = '12px 20px 16px 20px';
    section.style.background = 'rgba(6, 11, 18, 0.95)';
    section.style.borderTop = '1px solid rgba(0, 255, 204, 0.25)';
    section.style.display = 'flex';
    section.style.flexDirection = 'column';
    section.style.gap = '8px';

    const infoRow = document.createElement('div');
    infoRow.style.display = 'flex';
    infoRow.style.justifyContent = 'space-between';
    infoRow.style.alignItems = 'center';

    const label = document.createElement('div');
    label.innerText = 'BUILDING HOTBAR [KEYS 1 - 9]';
    label.style.fontSize = '11px';
    label.style.fontWeight = 'bold';
    label.style.color = '#00ffcc';
    label.style.letterSpacing = '1px';

    const actionBtns = document.createElement('div');
    actionBtns.style.display = 'flex';
    actionBtns.style.gap = '8px';

    const resetBtn = document.createElement('button');
    resetBtn.innerText = 'Reset Defaults';
    resetBtn.style.padding = '3px 10px';
    resetBtn.style.background = 'rgba(255, 255, 255, 0.06)';
    resetBtn.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    resetBtn.style.borderRadius = '4px';
    resetBtn.style.color = 'rgba(255, 255, 255, 0.7)';
    resetBtn.style.fontSize = '10px';
    resetBtn.style.cursor = 'pointer';
    resetBtn.onclick = () => {
      this.hotbar = [...DEFAULT_HOTBAR];
      this.persistHotbar();
      this.renderHotbar();
      this.notifyHotbarChange();
    };

    const clearBtn = document.createElement('button');
    clearBtn.innerText = 'Clear All';
    clearBtn.style.padding = '3px 10px';
    clearBtn.style.background = 'rgba(255, 50, 50, 0.15)';
    clearBtn.style.border = '1px solid rgba(255, 80, 80, 0.3)';
    clearBtn.style.borderRadius = '4px';
    clearBtn.style.color = '#ff8080';
    clearBtn.style.fontSize = '10px';
    clearBtn.style.cursor = 'pointer';
    clearBtn.onclick = () => {
      this.hotbar = new Array(9).fill(BlockId.AIR);
      this.persistHotbar();
      this.renderHotbar();
      this.notifyHotbarChange();
    };

    actionBtns.appendChild(resetBtn);
    actionBtns.appendChild(clearBtn);

    infoRow.appendChild(label);
    infoRow.appendChild(actionBtns);
    section.appendChild(infoRow);

    // 9-slot grid
    this.hotbarSlotsContainer = document.createElement('div');
    this.hotbarSlotsContainer.style.display = 'grid';
    this.hotbarSlotsContainer.style.gridTemplateColumns = 'repeat(9, 1fr)';
    this.hotbarSlotsContainer.style.gap = '8px';
    section.appendChild(this.hotbarSlotsContainer);

    return section;
  }

  private createTooltip(): HTMLElement {
    const tt = document.createElement('div');
    tt.id = 'creative-inv-tooltip';
    tt.style.position = 'fixed';
    tt.style.display = 'none';
    tt.style.pointerEvents = 'none';
    tt.style.background = 'rgba(10, 16, 26, 0.95)';
    tt.style.border = '1px solid #00ffcc';
    tt.style.borderRadius = '6px';
    tt.style.padding = '8px 12px';
    tt.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.8)';
    tt.style.zIndex = '600';
    tt.style.fontFamily = "'JetBrains Mono', monospace";
    tt.style.fontSize = '11px';
    tt.style.color = '#fff';
    tt.style.maxWidth = '240px';
    return tt;
  }

  private showTooltip(e: MouseEvent, def: BlockDefinition): void {
    let html = `<div style="font-weight: bold; color: #00ffcc; font-size: 12px; margin-bottom: 4px;">${def.name}</div>`;
    html += `<div style="color: rgba(255,255,255,0.6); font-size: 10px; margin-bottom: 6px; text-transform: uppercase;">Category: ${def.category}</div>`;
    if (def.description) {
      html += `<div style="color: #cfd8dc; font-size: 10px; line-height: 1.3; margin-bottom: 6px;">${def.description}</div>`;
    }
    const tags: string[] = [];
    if (def.isSolid) tags.push('<span style="background: rgba(0,255,204,0.15); color: #00ffcc; padding: 1px 4px; border-radius: 3px;">Solid</span>');
    if (def.isTransparent) tags.push('<span style="background: rgba(41,182,246,0.15); color: #29b6f6; padding: 1px 4px; border-radius: 3px;">Glass</span>');
    if (def.emissive) tags.push('<span style="background: rgba(255,167,38,0.15); color: #ffa726; padding: 1px 4px; border-radius: 3px;">Glow</span>');
    if (tags.length > 0) {
      html += `<div style="display: flex; gap: 4px; font-size: 9px;">${tags.join('')}</div>`;
    }

    this.tooltipEl.innerHTML = html;
    this.tooltipEl.style.display = 'block';
    this.tooltipEl.style.left = `${e.clientX + 14}px`;
    this.tooltipEl.style.top = `${e.clientY + 14}px`;
  }

  private hideTooltip(): void {
    this.tooltipEl.style.display = 'none';
  }

  /**
   * Renders the catalog grid filtered by active category tab and search query.
   */
  public renderCatalog(): void {
    this.cardGrid.innerHTML = '';
    const atlas = TextureAtlas.get();

    const blockList: BlockDefinition[] = [];
    for (let id = 1; id <= BlockId.BOUNCE_PAD; id++) {
      const def = BLOCK_DEFINITIONS[id];
      if (!def) continue;

      // Filter by category
      if (this.activeCategoryTab !== 'all' && def.category !== this.activeCategoryTab) {
        continue;
      }

      // Filter by search query
      if (this.searchQuery) {
        const matchesName = def.name.toLowerCase().includes(this.searchQuery);
        const matchesCat = def.category.toLowerCase().includes(this.searchQuery);
        const matchesDesc = (def.description || '').toLowerCase().includes(this.searchQuery);
        if (!matchesName && !matchesCat && !matchesDesc) {
          continue;
        }
      }

      blockList.push(def);
    }

    for (const def of blockList) {
      const card = document.createElement('div');
      card.className = 'creative-block-card';
      card.draggable = true;
      card.style.background = 'rgba(255, 255, 255, 0.04)';
      card.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      card.style.borderRadius = '8px';
      card.style.padding = '8px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'center';
      card.style.gap = '6px';
      card.style.cursor = 'grab';
      card.style.transition = 'all 0.15s ease';
      card.style.userSelect = 'none';

      // Visual Tile Swatch from TextureAtlas
      const canvas = atlas.createTileCanvas(def.id, 44);
      canvas.style.borderRadius = '5px';
      canvas.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.5)';
      canvas.style.pointerEvents = 'none';

      // Block Name
      const name = document.createElement('div');
      name.innerText = def.name;
      name.style.fontSize = '10.5px';
      name.style.fontWeight = 'bold';
      name.style.textAlign = 'center';
      name.style.whiteSpace = 'nowrap';
      name.style.overflow = 'hidden';
      name.style.textOverflow = 'ellipsis';
      name.style.maxWidth = '110px';
      name.style.color = '#e0e0e0';
      name.style.pointerEvents = 'none';

      // Category Tag
      const catBadge = document.createElement('div');
      catBadge.innerText = def.category.toUpperCase();
      catBadge.style.fontSize = '8px';
      catBadge.style.color = this.getCategoryColor(def.category);
      catBadge.style.opacity = '0.85';
      catBadge.style.letterSpacing = '0.5px';
      catBadge.style.pointerEvents = 'none';

      card.appendChild(canvas);
      card.appendChild(name);
      card.appendChild(catBadge);

      // Hover interactions
      card.onmouseenter = (e) => {
        card.style.background = 'rgba(0, 255, 204, 0.15)';
        card.style.borderColor = '#00ffcc';
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 6px 16px rgba(0, 255, 204, 0.2)';
        this.showTooltip(e, def);
      };
      card.onmousemove = (e) => {
        this.tooltipEl.style.left = `${e.clientX + 14}px`;
        this.tooltipEl.style.top = `${e.clientY + 14}px`;
      };
      card.onmouseleave = () => {
        card.style.background = 'rgba(255, 255, 255, 0.04)';
        card.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = 'none';
        this.hideTooltip();
      };

      // Click: assign to currently selected hotbar slot!
      card.onclick = () => {
        this.hotbar[this.activeSlotIndex] = def.id;
        this.persistHotbar();
        this.renderHotbar();
        this.notifyHotbarChange();
        if (this.onBlockSelected) {
          this.onBlockSelected(def.id);
        }
      };

      // Drag start from catalog
      card.ondragstart = (e) => {
        this.draggedBlockId = def.id;
        this.draggedSlotIndex = null;
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', String(def.id));
          e.dataTransfer.effectAllowed = 'copyMove';
        }
        card.style.opacity = '0.6';
      };
      card.ondragend = () => {
        card.style.opacity = '1.0';
        this.draggedBlockId = null;
      };

      this.cardGrid.appendChild(card);
    }
  }

  /**
   * Renders the 9-slot Hotbar dock at the bottom of the modal.
   */
  public renderHotbar(): void {
    this.hotbarSlotsContainer.innerHTML = '';
    const atlas = TextureAtlas.get();

    for (let i = 0; i < 9; i++) {
      const slotIndex = i;
      const blockId = this.hotbar[i];
      const def = BLOCK_DEFINITIONS[blockId];
      const isSelected = (this.activeSlotIndex === i);

      const slot = document.createElement('div');
      slot.className = 'creative-hotbar-slot';
      slot.draggable = true;
      slot.style.height = '62px';
      slot.style.background = isSelected ? 'rgba(0, 255, 204, 0.18)' : 'rgba(255, 255, 255, 0.05)';
      slot.style.border = isSelected ? '2px solid #00ffcc' : '1px solid rgba(255, 255, 255, 0.15)';
      slot.style.borderRadius = '8px';
      slot.style.padding = '4px';
      slot.style.display = 'flex';
      slot.style.flexDirection = 'column';
      slot.style.alignItems = 'center';
      slot.style.justifyContent = 'center';
      slot.style.position = 'relative';
      slot.style.cursor = 'pointer';
      slot.style.transition = 'all 0.15s ease';
      slot.style.userSelect = 'none';
      if (isSelected) {
        slot.style.boxShadow = '0 0 14px rgba(0, 255, 204, 0.45)';
      }

      // Slot hotkey number badge (1..9)
      const numBadge = document.createElement('div');
      numBadge.innerText = String(i + 1);
      numBadge.style.position = 'absolute';
      numBadge.style.top = '3px';
      numBadge.style.left = '4px';
      numBadge.style.fontSize = '9px';
      numBadge.style.fontWeight = '900';
      numBadge.style.color = isSelected ? '#00ffcc' : 'rgba(255, 255, 255, 0.6)';
      slot.appendChild(numBadge);

      if (def && blockId !== BlockId.AIR) {
        // Thumbnail
        const canvas = atlas.createTileCanvas(blockId, 32);
        canvas.style.borderRadius = '3px';
        canvas.style.pointerEvents = 'none';

        // Short label
        const name = document.createElement('div');
        name.innerText = def.name;
        name.style.fontSize = '8.5px';
        name.style.fontWeight = 'bold';
        name.style.textAlign = 'center';
        name.style.whiteSpace = 'nowrap';
        name.style.overflow = 'hidden';
        name.style.textOverflow = 'ellipsis';
        name.style.maxWidth = '75px';
        name.style.color = isSelected ? '#00ffcc' : '#e0e0e0';
        name.style.pointerEvents = 'none';
        name.style.marginTop = '2px';

        slot.appendChild(canvas);
        slot.appendChild(name);

        slot.onmouseenter = (e) => {
          this.showTooltip(e, def);
        };
        slot.onmouseleave = () => {
          this.hideTooltip();
        };
      } else {
        const emptyLabel = document.createElement('div');
        emptyLabel.innerText = 'Empty';
        emptyLabel.style.fontSize = '9px';
        emptyLabel.style.color = 'rgba(255, 255, 255, 0.25)';
        slot.appendChild(emptyLabel);
      }

      // Click to select slot as active
      slot.onclick = () => {
        this.activeSlotIndex = slotIndex;
        this.renderHotbar();
        this.notifyHotbarChange();
        if (def && blockId !== BlockId.AIR && this.onBlockSelected) {
          this.onBlockSelected(blockId);
        }
      };

      // Right-click to clear slot
      slot.oncontextmenu = (e) => {
        e.preventDefault();
        this.hotbar[slotIndex] = BlockId.AIR;
        this.persistHotbar();
        this.renderHotbar();
        this.notifyHotbarChange();
      };

      // Drag and drop events
      slot.ondragstart = (e) => {
        this.draggedSlotIndex = slotIndex;
        this.draggedBlockId = this.hotbar[slotIndex];
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', String(this.hotbar[slotIndex]));
        }
        slot.style.opacity = '0.5';
      };

      slot.ondragend = () => {
        slot.style.opacity = '1.0';
        this.draggedSlotIndex = null;
        this.draggedBlockId = null;
      };

      slot.ondragover = (e) => {
        e.preventDefault();
        slot.style.background = 'rgba(0, 255, 204, 0.3)';
      };

      slot.ondragleave = () => {
        slot.style.background = isSelected ? 'rgba(0, 255, 204, 0.18)' : 'rgba(255, 255, 255, 0.05)';
      };

      slot.ondrop = (e) => {
        e.preventDefault();
        if (this.draggedSlotIndex !== null) {
          // Reorder / Swap slots
          const temp = this.hotbar[slotIndex];
          this.hotbar[slotIndex] = this.hotbar[this.draggedSlotIndex];
          this.hotbar[this.draggedSlotIndex] = temp;
        } else if (this.draggedBlockId !== null) {
          // Assign from catalog
          this.hotbar[slotIndex] = this.draggedBlockId;
        }
        this.persistHotbar();
        this.renderHotbar();
        this.notifyHotbarChange();
      };

      this.hotbarSlotsContainer.appendChild(slot);
    }
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.overlay.style.display = visible ? 'flex' : 'none';
    if (visible) {
      this.hideTooltip();
      this.renderCatalog();
      this.renderHotbar();
      document.exitPointerLock();
    } else {
      this.hideTooltip();
      if (this.onClose) {
        this.onClose();
      }
    }
  }

  public setActiveSlot(index: number): void {
    if (index >= 0 && index < 9) {
      this.activeSlotIndex = index;
      this.renderHotbar();
    }
  }

  public getActiveBlock(): BlockId {
    return this.hotbar[this.activeSlotIndex] || BlockId.CONCRETE;
  }

  private notifyHotbarChange(): void {
    if (this.onHotbarChange) {
      this.onHotbarChange(this.hotbar, this.activeSlotIndex);
    }
  }

  private persistHotbar(): void {
    try {
      localStorage.setItem('voxel_creative_hotbar', JSON.stringify(this.hotbar));
    } catch {
      // Ignored in non-browser env
    }
  }

  private loadPersistedHotbar(): void {
    try {
      const saved = localStorage.getItem('voxel_creative_hotbar');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 9) {
          this.hotbar = parsed;
          return;
        }
      }
    } catch {
      // Fallback to default
    }
    this.hotbar = [...DEFAULT_HOTBAR];
  }

  private getCategoryColor(cat: BlockCategory): string {
    switch (cat) {
      case 'building': return '#29b6f6';
      case 'decor': return '#ab47bc';
      case 'nature': return '#66bb6a';
      case 'interactive': return '#ffa726';
      default: return '#00ffcc';
    }
  }
}
