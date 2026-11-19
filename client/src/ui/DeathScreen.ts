export class DeathScreen {
  private container: HTMLElement;
  public isVisible = false;
  private respawnTimer = 0;
  private onRespawnRequest?: () => void;

  constructor(parent: HTMLElement, onRespawnRequest?: () => void) {
    this.onRespawnRequest = onRespawnRequest;

    this.container = document.createElement('div');
    this.container.id = 'death-screen-overlay';
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.background = 'radial-gradient(circle, rgba(180, 0, 0, 0.45) 0%, rgba(10, 6, 8, 0.92) 80%)';
    this.container.style.display = 'none';
    this.container.style.flexDirection = 'column';
    this.container.style.justifyContent = 'center';
    this.container.style.alignItems = 'center';
    this.container.style.zIndex = '450';
    this.container.style.backdropFilter = 'blur(6px)';
    this.container.style.fontFamily = "'JetBrains Mono', 'Segoe UI', monospace";
    this.container.style.color = '#fff';

    parent.appendChild(this.container);
  }

  public show(killerName: string, weaponName: string): void {
    this.isVisible = true;
    this.respawnTimer = 3.0;

    this.container.innerHTML = `
      <div style="font-size:3.2rem; font-weight:900; letter-spacing:4px; color:#ff1744; text-shadow:0 0 30px rgba(255,23,68,0.8); margin-bottom:12px;">
        YOU WERE ELIMINATED
      </div>
      <div style="font-size:1.15rem; color:#cfd8dc; margin-bottom:28px;">
        Killed by <span style="color:#00ffcc; font-weight:bold;">${killerName}</span> with <span style="color:#ffb74d; font-weight:bold;">${weaponName}</span>
      </div>
      <div id="respawn-countdown-text" style="font-size:1.6rem; font-weight:900; color:#ffd600; letter-spacing:2px; background:rgba(255,255,255,0.08); padding:10px 28px; border-radius:8px; border:1px solid rgba(255,214,0,0.4);">
        RESPAWNING IN 3...
      </div>
    `;

    this.container.style.display = 'flex';
  }

  public hide(): void {
    this.isVisible = false;
    this.container.style.display = 'none';
  }

  public update(dt: number): void {
    if (!this.isVisible) return;

    this.respawnTimer -= dt;
    const countEl = document.getElementById('respawn-countdown-text');
    if (countEl) {
      const sec = Math.max(1, Math.ceil(this.respawnTimer));
      countEl.innerText = `RESPAWNING IN ${sec}...`;
    }

    if (this.respawnTimer <= 0) {
      this.hide();
      if (this.onRespawnRequest) {
        this.onRespawnRequest();
      }
    }
  }
}
