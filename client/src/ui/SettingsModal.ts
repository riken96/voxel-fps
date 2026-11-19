export type GraphicsPreset = 'low' | 'medium' | 'high' | 'ultra';

export interface GameSettings {
  volume: number;            // 0.0 to 1.0
  sensitivity: number;       // 0.5 to 3.0
  fov: number;               // 70 to 105
  bloom: boolean;            // true or false
  quality: GraphicsPreset;   // 'low' | 'medium' | 'high' | 'ultra'
  shadows: boolean;          // true or false
  renderScale: number;       // 0.75, 1.0, 1.25
  showStats: boolean;        // true or false
}

export class SettingsModal {
  private container: HTMLElement;
  public visible = false;
  public settings: GameSettings;

  public onSettingsChange?: (settings: GameSettings) => void;

  constructor(parent: HTMLElement, onSettingsChange?: (settings: GameSettings) => void) {
    this.onSettingsChange = onSettingsChange;

    // Load saved settings from localStorage
    const saved = localStorage.getItem('voxel_strike_settings');
    if (saved) {
      try {
        this.settings = { ...this.defaultSettings(), ...JSON.parse(saved) };
      } catch {
        this.settings = this.defaultSettings();
      }
    } else {
      this.settings = this.defaultSettings();
    }

    this.container = document.createElement('div');
    this.container.id = 'settings-modal-overlay';
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.background = 'rgba(6, 10, 16, 0.88)';
    this.container.style.display = 'none';
    this.container.style.justifyContent = 'center';
    this.container.style.alignItems = 'center';
    this.container.style.zIndex = '520';
    this.container.style.backdropFilter = 'blur(10px)';
    this.container.style.fontFamily = "'JetBrains Mono', 'Segoe UI', monospace";
    this.container.style.color = '#fff';

    this.buildUI();
    parent.appendChild(this.container);
  }

  private defaultSettings(): GameSettings {
    return {
      volume: 0.7,
      sensitivity: 1.0,
      fov: 82,
      bloom: true,
      quality: 'high',
      shadows: true,
      renderScale: 1.0,
      showStats: true
    };
  }

  private save(): void {
    localStorage.setItem('voxel_strike_settings', JSON.stringify(this.settings));
    if (this.onSettingsChange) {
      this.onSettingsChange(this.settings);
    }
  }

  private buildUI(): void {
    const card = document.createElement('div');
    card.style.background = '#0e1624';
    card.style.border = '1px solid rgba(0, 255, 204, 0.4)';
    card.style.borderRadius = '12px';
    card.style.padding = '24px 30px';
    card.style.width = '520px';
    card.style.maxHeight = '90vh';
    card.style.overflowY = 'auto';
    card.style.boxShadow = '0 16px 48px rgba(0,0,0,0.85)';

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <span style="font-size:1.3rem; font-weight:900; color:#00ffcc; letter-spacing:1px;">SETTINGS & PERFORMANCE</span>
        <button id="settings-close-x" style="background:none; border:none; color:#90a4ae; font-size:1.4rem; cursor:pointer;">&times;</button>
      </div>

      <!-- Graphics Quality Preset -->
      <div style="margin-bottom:16px;">
        <div style="margin-bottom:6px; font-size:11px; font-weight:bold; color:#00ffcc;">GRAPHICS QUALITY PRESET</div>
        <div style="display:flex; gap:8px;">
          ${['low', 'medium', 'high', 'ultra'].map((q) => `
            <button class="quality-btn" data-quality="${q}" style="flex:1; padding:7px; font-size:11px; font-weight:900; font-family:inherit; border-radius:5px; border:1px solid ${this.settings.quality === q ? '#00ffcc' : 'rgba(255,255,255,0.15)'}; background:${this.settings.quality === q ? 'rgba(0,255,204,0.2)' : 'rgba(255,255,255,0.05)'}; color:${this.settings.quality === q ? '#00ffcc' : '#b0bec5'}; cursor:pointer; text-transform:uppercase;">
              ${q}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Volume -->
      <div style="margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:11px; font-weight:bold;">
          <span>MASTER VOLUME</span>
          <span id="volume-val">${Math.round(this.settings.volume * 100)}%</span>
        </div>
        <input type="range" id="volume-slider" min="0" max="100" value="${Math.round(this.settings.volume * 100)}" style="width:100%; accent-color:#00ffcc; cursor:pointer;" />
      </div>

      <!-- Mouse Sensitivity -->
      <div style="margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:11px; font-weight:bold;">
          <span>MOUSE SENSITIVITY</span>
          <span id="sens-val">${this.settings.sensitivity.toFixed(1)}x</span>
        </div>
        <input type="range" id="sens-slider" min="5" max="30" value="${Math.round(this.settings.sensitivity * 10)}" style="width:100%; accent-color:#00ffcc; cursor:pointer;" />
      </div>

      <!-- Field of View -->
      <div style="margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:11px; font-weight:bold;">
          <span>FIELD OF VIEW (FOV)</span>
          <span id="fov-val">${this.settings.fov}°</span>
        </div>
        <input type="range" id="fov-slider" min="70" max="105" value="${this.settings.fov}" style="width:100%; accent-color:#00ffcc; cursor:pointer;" />
      </div>

      <!-- Toggles Grid: Shadows, Bloom, Render Scale, Stats -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:18px;">
        <!-- Dynamic Shadows -->
        <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 12px; background:rgba(255,255,255,0.04); border-radius:6px;">
          <div>
            <div style="font-size:11px; font-weight:bold;">DYNAMIC SHADOWS</div>
            <div style="font-size:9px; color:#90a4ae;">Real-time sun & block shadows</div>
          </div>
          <input type="checkbox" id="shadows-toggle" ${this.settings.shadows ? 'checked' : ''} style="width:16px; height:16px; accent-color:#00ffcc; cursor:pointer;" />
        </div>

        <!-- Post-Processing Bloom -->
        <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 12px; background:rgba(255,255,255,0.04); border-radius:6px;">
          <div>
            <div style="font-size:11px; font-weight:bold;">HDR BLOOM & GLOW</div>
            <div style="font-size:9px; color:#90a4ae;">Neon blocks & muzzle flashes</div>
          </div>
          <input type="checkbox" id="bloom-toggle" ${this.settings.bloom ? 'checked' : ''} style="width:16px; height:16px; accent-color:#00ffcc; cursor:pointer;" />
        </div>

        <!-- Render Scale (Performance Boost) -->
        <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 12px; background:rgba(255,255,255,0.04); border-radius:6px;">
          <div>
            <div style="font-size:11px; font-weight:bold;">RENDER RESOLUTION</div>
            <div style="font-size:9px; color:#90a4ae;">Downscale for +40% FPS</div>
          </div>
          <select id="scale-select" style="background:#162235; color:#00ffcc; border:1px solid rgba(0,255,204,0.3); border-radius:4px; font-size:10px; font-weight:bold; padding:3px 6px; cursor:pointer;">
            <option value="0.75" ${this.settings.renderScale === 0.75 ? 'selected' : ''}>75% Fast</option>
            <option value="1.0" ${this.settings.renderScale === 1.0 ? 'selected' : ''}>100% Native</option>
            <option value="1.25" ${this.settings.renderScale === 1.25 ? 'selected' : ''}>125% Ultra</option>
          </select>
        </div>

        <!-- Show Stats Overlay -->
        <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 12px; background:rgba(255,255,255,0.04); border-radius:6px;">
          <div>
            <div style="font-size:11px; font-weight:bold;">SHOW DEBUG STATS</div>
            <div style="font-size:9px; color:#90a4ae;">FPS, Ping, XYZ & Velocity</div>
          </div>
          <input type="checkbox" id="stats-toggle" ${this.settings.showStats ? 'checked' : ''} style="width:16px; height:16px; accent-color:#00ffcc; cursor:pointer;" />
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end;">
        <button id="settings-save-btn" style="padding:8px 22px; background:#00e676; border:none; border-radius:6px; color:#000; font-weight:900; font-size:12px; cursor:pointer; font-family:inherit;">Save & Close</button>
      </div>
    `;

    this.container.appendChild(card);

    setTimeout(() => {
      const closeX = card.querySelector('#settings-close-x') as HTMLElement;
      const saveBtn = card.querySelector('#settings-save-btn') as HTMLElement;
      const volSlider = card.querySelector('#volume-slider') as HTMLInputElement;
      const sensSlider = card.querySelector('#sens-slider') as HTMLInputElement;
      const fovSlider = card.querySelector('#fov-slider') as HTMLInputElement;
      const bloomCheck = card.querySelector('#bloom-toggle') as HTMLInputElement;
      const shadowsCheck = card.querySelector('#shadows-toggle') as HTMLInputElement;
      const scaleSelect = card.querySelector('#scale-select') as HTMLSelectElement;
      const statsCheck = card.querySelector('#stats-toggle') as HTMLInputElement;
      const qualityBtns = card.querySelectorAll<HTMLButtonElement>('.quality-btn');

      const volVal = card.querySelector('#volume-val') as HTMLElement;
      const sensVal = card.querySelector('#sens-val') as HTMLElement;
      const fovVal = card.querySelector('#fov-val') as HTMLElement;

      qualityBtns.forEach((btn) => {
        btn.onclick = () => {
          const q = btn.dataset.quality as GraphicsPreset;
          this.settings.quality = q;
          if (q === 'low') {
            this.settings.shadows = false;
            this.settings.bloom = false;
            this.settings.renderScale = 0.75;
          } else if (q === 'medium') {
            this.settings.shadows = false;
            this.settings.bloom = true;
            this.settings.renderScale = 1.0;
          } else if (q === 'high') {
            this.settings.shadows = true;
            this.settings.bloom = true;
            this.settings.renderScale = 1.0;
          } else if (q === 'ultra') {
            this.settings.shadows = true;
            this.settings.bloom = true;
            this.settings.renderScale = 1.25;
          }

          bloomCheck.checked = this.settings.bloom;
          shadowsCheck.checked = this.settings.shadows;
          scaleSelect.value = String(this.settings.renderScale);

          qualityBtns.forEach((b) => {
            const isSelected = b.dataset.quality === q;
            b.style.borderColor = isSelected ? '#00ffcc' : 'rgba(255,255,255,0.15)';
            b.style.background = isSelected ? 'rgba(0,255,204,0.2)' : 'rgba(255,255,255,0.05)';
            b.style.color = isSelected ? '#00ffcc' : '#b0bec5';
          });

          this.save();
        };
      });

      volSlider.oninput = () => {
        this.settings.volume = parseInt(volSlider.value) / 100;
        volVal.innerText = `${volSlider.value}%`;
        this.save();
      };

      sensSlider.oninput = () => {
        this.settings.sensitivity = parseInt(sensSlider.value) / 10;
        sensVal.innerText = `${this.settings.sensitivity.toFixed(1)}x`;
        this.save();
      };

      fovSlider.oninput = () => {
        this.settings.fov = parseInt(fovSlider.value);
        fovVal.innerText = `${fovSlider.value}°`;
        this.save();
      };

      bloomCheck.onchange = () => {
        this.settings.bloom = bloomCheck.checked;
        this.save();
      };

      shadowsCheck.onchange = () => {
        this.settings.shadows = shadowsCheck.checked;
        this.save();
      };

      scaleSelect.onchange = () => {
        this.settings.renderScale = parseFloat(scaleSelect.value);
        this.save();
      };

      statsCheck.onchange = () => {
        this.settings.showStats = statsCheck.checked;
        this.save();
      };

      const closeFunc = () => {
        this.setVisible(false);
      };

      closeX.onclick = closeFunc;
      saveBtn.onclick = closeFunc;
    }, 50);
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.container.style.display = visible ? 'flex' : 'none';
  }
}
