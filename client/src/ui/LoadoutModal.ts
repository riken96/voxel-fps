import { WeaponId } from '@shared/combat/Weapons.ts';
import { WeaponSkinId } from '../rendering/WeaponRenderer.ts';

export interface PlayerLoadout {
  primaryWeapon: WeaponId;
  skinId: WeaponSkinId;
  crosshairStyle: 'cross' | 'dot' | 'circle' | 'wide';
  crosshairColor: string;
}

export class LoadoutModal {
  private container: HTMLElement;
  public visible = false;
  public loadout: PlayerLoadout;

  public onLoadoutChange?: (loadout: PlayerLoadout) => void;

  constructor(parent: HTMLElement, onLoadoutChange?: (loadout: PlayerLoadout) => void) {
    this.onLoadoutChange = onLoadoutChange;

    const saved = localStorage.getItem('voxel_strike_loadout');
    if (saved) {
      try {
        this.loadout = JSON.parse(saved);
      } catch {
        this.loadout = this.defaultLoadout();
      }
    } else {
      this.loadout = this.defaultLoadout();
    }

    this.container = document.createElement('div');
    this.container.id = 'loadout-modal-overlay';
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.background = 'rgba(6, 10, 16, 0.90)';
    this.container.style.display = 'none';
    this.container.style.justifyContent = 'center';
    this.container.style.alignItems = 'center';
    this.container.style.zIndex = '530';
    this.container.style.backdropFilter = 'blur(12px)';
    this.container.style.fontFamily = "'JetBrains Mono', 'Segoe UI', monospace";
    this.container.style.color = '#fff';

    this.buildUI();
    parent.appendChild(this.container);
  }

  private defaultLoadout(): PlayerLoadout {
    return {
      primaryWeapon: WeaponId.ASSAULT_RIFLE,
      skinId: 'tactical',
      crosshairStyle: 'cross',
      crosshairColor: '#00ffcc'
    };
  }

  public setVisible(val: boolean): void {
    this.visible = val;
    this.container.style.display = val ? 'flex' : 'none';
    if (val) {
      this.updateSelectionHighlights();
    }
  }

  private save(): void {
    localStorage.setItem('voxel_strike_loadout', JSON.stringify(this.loadout));
    if (this.onLoadoutChange) {
      this.onLoadoutChange(this.loadout);
    }
  }

  private buildUI(): void {
    const card = document.createElement('div');
    card.style.background = '#0d1522';
    card.style.border = '1px solid rgba(0, 255, 204, 0.45)';
    card.style.borderRadius = '14px';
    card.style.padding = '26px 32px';
    card.style.width = '640px';
    card.style.maxHeight = '90vh';
    card.style.overflowY = 'auto';
    card.style.boxShadow = '0 20px 60px rgba(0,0,0,0.9), 0 0 30px rgba(0,255,204,0.1)';

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px;">
        <div>
          <span style="font-size:1.35rem; font-weight:900; color:#00ffcc; letter-spacing:1.5px;">🔫 ARMORY & LOADOUT</span>
          <div style="font-size:10px; color:#90a4ae; margin-top:2px;">CUSTOMIZE WEAPONS, SKINS & COMBAT OPTICS</div>
        </div>
        <button id="loadout-close-btn" style="background:none; border:none; color:#90a4ae; font-size:1.5rem; cursor:pointer; line-height:1;">&times;</button>
      </div>

      <!-- 1. Primary Weapon Selection -->
      <div style="margin-bottom:20px;">
        <div style="font-size:11px; font-weight:900; color:#ffb74d; letter-spacing:1px; margin-bottom:10px;">PRIMARY WEAPON</div>
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px;">
          <!-- Assault Rifle -->
          <div class="loadout-weapon-card" data-weapon="${WeaponId.ASSAULT_RIFLE}" style="background:#131d2e; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:12px; cursor:pointer; transition:all 0.15s ease;">
            <div style="font-size:13px; font-weight:bold; color:#fff;">ASSAULT RIFLE</div>
            <div style="font-size:10px; color:#00ffcc; margin:4px 0;">FULL-AUTO (545 RPM)</div>
            <div style="font-size:9px; color:#90a4ae;">Dmg: 24/38 &bull; Mag: 30</div>
          </div>

          <!-- Sniper Rifle -->
          <div class="loadout-weapon-card" data-weapon="${WeaponId.SNIPER_RIFLE}" style="background:#131d2e; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:12px; cursor:pointer; transition:all 0.15s ease;">
            <div style="font-size:13px; font-weight:bold; color:#fff;">SNIPER RIFLE</div>
            <div style="font-size:10px; color:#00ffcc; margin:4px 0;">BOLT-ACTION (High-Cal)</div>
            <div style="font-size:9px; color:#90a4ae;">Dmg: 85/170 &bull; Mag: 5</div>
          </div>

          <!-- Shotgun -->
          <div class="loadout-weapon-card" data-weapon="${WeaponId.SHOTGUN}" style="background:#131d2e; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:12px; cursor:pointer; transition:all 0.15s ease;">
            <div style="font-size:13px; font-weight:bold; color:#fff;">VOXEL SHOTGUN</div>
            <div style="font-size:10px; color:#00ffcc; margin:4px 0;">PUMP-ACTION (8 Pellets)</div>
            <div style="font-size:9px; color:#90a4ae;">Dmg: 14x8 &bull; Mag: 8</div>
          </div>
        </div>
      </div>

      <!-- 2. Weapon Skin Theme Selection -->
      <div style="margin-bottom:20px;">
        <div style="font-size:11px; font-weight:900; color:#ffb74d; letter-spacing:1px; margin-bottom:10px;">WEAPON SKIN THEME</div>
        <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:8px;">
          <button class="loadout-skin-btn" data-skin="tactical" style="background:#1a2332; border:1px solid rgba(255,255,255,0.12); border-radius:6px; padding:8px 4px; color:#fff; cursor:pointer; font-size:10px; font-weight:bold; font-family:inherit;">
            🛡️ TACTICAL
          </button>
          <button class="loadout-skin-btn" data-skin="cyberpunk" style="background:#1a2332; border:1px solid rgba(255,255,255,0.12); border-radius:6px; padding:8px 4px; color:#fff; cursor:pointer; font-size:10px; font-weight:bold; font-family:inherit;">
            ⚡ CYBER NEON
          </button>
          <button class="loadout-skin-btn" data-skin="gold_royale" style="background:#1a2332; border:1px solid rgba(255,255,255,0.12); border-radius:6px; padding:8px 4px; color:#fff; cursor:pointer; font-size:10px; font-weight:bold; font-family:inherit;">
            👑 GOLD ROYALE
          </button>
          <button class="loadout-skin-btn" data-skin="magma_core" style="background:#1a2332; border:1px solid rgba(255,255,255,0.12); border-radius:6px; padding:8px 4px; color:#fff; cursor:pointer; font-size:10px; font-weight:bold; font-family:inherit;">
            🔥 MAGMA CORE
          </button>
          <button class="loadout-skin-btn" data-skin="arctic_camo" style="background:#1a2332; border:1px solid rgba(255,255,255,0.12); border-radius:6px; padding:8px 4px; color:#fff; cursor:pointer; font-size:10px; font-weight:bold; font-family:inherit;">
            ❄️ ARCTIC CAMO
          </button>
        </div>
      </div>

      <!-- 3. Reticle & Crosshair Customization -->
      <div style="margin-bottom:24px;">
        <div style="font-size:11px; font-weight:900; color:#ffb74d; letter-spacing:1px; margin-bottom:10px;">RETICLE & CROSSHAIR</div>
        <div style="display:flex; gap:20px; align-items:center;">
          <!-- Style -->
          <div style="flex:1;">
            <div style="font-size:10px; color:#90a4ae; margin-bottom:6px;">STYLE</div>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px;">
              <button class="loadout-reticle-btn" data-style="cross" style="background:#131d2e; border:1px solid rgba(255,255,255,0.12); border-radius:6px; padding:6px; color:#fff; cursor:pointer; font-size:10px; font-family:inherit;">CROSS</button>
              <button class="loadout-reticle-btn" data-style="dot" style="background:#131d2e; border:1px solid rgba(255,255,255,0.12); border-radius:6px; padding:6px; color:#fff; cursor:pointer; font-size:10px; font-family:inherit;">DOT</button>
              <button class="loadout-reticle-btn" data-style="circle" style="background:#131d2e; border:1px solid rgba(255,255,255,0.12); border-radius:6px; padding:6px; color:#fff; cursor:pointer; font-size:10px; font-family:inherit;">CIRCLE</button>
              <button class="loadout-reticle-btn" data-style="wide" style="background:#131d2e; border:1px solid rgba(255,255,255,0.12); border-radius:6px; padding:6px; color:#fff; cursor:pointer; font-size:10px; font-family:inherit;">WIDE</button>
            </div>
          </div>

          <!-- Color Swatches -->
          <div>
            <div style="font-size:10px; color:#90a4ae; margin-bottom:6px;">COLOR</div>
            <div style="display:flex; gap:8px;">
              <div class="loadout-color-swatch" data-color="#00ffcc" style="width:24px; height:24px; border-radius:50%; background:#00ffcc; cursor:pointer; border:2px solid transparent;"></div>
              <div class="loadout-color-swatch" data-color="#39ff14" style="width:24px; height:24px; border-radius:50%; background:#39ff14; cursor:pointer; border:2px solid transparent;"></div>
              <div class="loadout-color-swatch" data-color="#ff007f" style="width:24px; height:24px; border-radius:50%; background:#ff007f; cursor:pointer; border:2px solid transparent;"></div>
              <div class="loadout-color-swatch" data-color="#ff1744" style="width:24px; height:24px; border-radius:50%; background:#ff1744; cursor:pointer; border:2px solid transparent;"></div>
              <div class="loadout-color-swatch" data-color="#ffffff" style="width:24px; height:24px; border-radius:50%; background:#ffffff; cursor:pointer; border:2px solid transparent;"></div>
              <div class="loadout-color-swatch" data-color="#ffd700" style="width:24px; height:24px; border-radius:50%; background:#ffd700; cursor:pointer; border:2px solid transparent;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Button -->
      <button id="loadout-save-deploy-btn" style="width:100%; padding:13px; background:#00ffcc; color:#06101a; border:none; border-radius:8px; font-weight:900; font-size:13px; cursor:pointer; letter-spacing:1px; transition:background 0.15s ease;">
        SAVE LOADOUT & EQUIP
      </button>
    `;

    this.container.appendChild(card);

    // Close button
    card.querySelector('#loadout-close-btn')!.addEventListener('click', () => {
      this.setVisible(false);
    });

    // Save & Deploy
    card.querySelector('#loadout-save-deploy-btn')!.addEventListener('click', () => {
      this.save();
      this.setVisible(false);
    });

    // Weapon card selection
    card.querySelectorAll<HTMLElement>('.loadout-weapon-card').forEach((el) => {
      el.addEventListener('click', () => {
        const weaponId = parseInt(el.getAttribute('data-weapon') || '1', 10);
        this.loadout.primaryWeapon = weaponId;
        this.save();
        this.updateSelectionHighlights();
      });
    });

    // Skin selection
    card.querySelectorAll<HTMLElement>('.loadout-skin-btn').forEach((el) => {
      el.addEventListener('click', () => {
        const skin = el.getAttribute('data-skin') as WeaponSkinId;
        this.loadout.skinId = skin;
        this.save();
        this.updateSelectionHighlights();
      });
    });

    // Reticle style selection
    card.querySelectorAll<HTMLElement>('.loadout-reticle-btn').forEach((el) => {
      el.addEventListener('click', () => {
        const style = el.getAttribute('data-style') as 'cross' | 'dot' | 'circle' | 'wide';
        this.loadout.crosshairStyle = style;
        this.save();
        this.updateSelectionHighlights();
      });
    });

    // Color swatch selection
    card.querySelectorAll<HTMLElement>('.loadout-color-swatch').forEach((el) => {
      el.addEventListener('click', () => {
        const color = el.getAttribute('data-color') || '#00ffcc';
        this.loadout.crosshairColor = color;
        this.save();
        this.updateSelectionHighlights();
      });
    });
  }

  private updateSelectionHighlights(): void {
    // Weapon highlight
    this.container.querySelectorAll<HTMLElement>('.loadout-weapon-card').forEach((el) => {
      const weaponId = parseInt(el.getAttribute('data-weapon') || '1', 10);
      if (weaponId === this.loadout.primaryWeapon) {
        el.style.borderColor = '#00ffcc';
        el.style.background = '#182b42';
        el.style.boxShadow = '0 0 12px rgba(0, 255, 204, 0.3)';
      } else {
        el.style.borderColor = 'rgba(255,255,255,0.1)';
        el.style.background = '#131d2e';
        el.style.boxShadow = 'none';
      }
    });

    // Skin highlight
    this.container.querySelectorAll<HTMLElement>('.loadout-skin-btn').forEach((el) => {
      const skin = el.getAttribute('data-skin');
      if (skin === this.loadout.skinId) {
        el.style.borderColor = '#ffb74d';
        el.style.background = '#2a3b50';
        el.style.boxShadow = '0 0 10px rgba(255, 183, 77, 0.4)';
      } else {
        el.style.borderColor = 'rgba(255,255,255,0.12)';
        el.style.background = '#1a2332';
        el.style.boxShadow = 'none';
      }
    });

    // Reticle style highlight
    this.container.querySelectorAll<HTMLElement>('.loadout-reticle-btn').forEach((el) => {
      const style = el.getAttribute('data-style');
      if (style === this.loadout.crosshairStyle) {
        el.style.borderColor = '#00ffcc';
        el.style.background = '#1a3344';
      } else {
        el.style.borderColor = 'rgba(255,255,255,0.12)';
        el.style.background = '#131d2e';
      }
    });

    // Swatch highlight
    this.container.querySelectorAll<HTMLElement>('.loadout-color-swatch').forEach((el) => {
      const color = el.getAttribute('data-color');
      if (color === this.loadout.crosshairColor) {
        el.style.borderColor = '#ffffff';
        el.style.transform = 'scale(1.2)';
      } else {
        el.style.borderColor = 'transparent';
        el.style.transform = 'scale(1.0)';
      }
    });
  }
}
