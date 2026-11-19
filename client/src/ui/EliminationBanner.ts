export class EliminationBanner {
  private container: HTMLElement;
  private timer = 0;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'elimination-banner-container';
    this.container.style.position = 'absolute';
    this.container.style.bottom = '18%';
    this.container.style.left = '50%';
    this.container.style.transform = 'translateX(-50%)';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.alignItems = 'center';
    this.container.style.gap = '6px';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '320';
    this.container.style.opacity = '0';
    this.container.style.transition = 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
    this.container.style.fontFamily = "'JetBrains Mono', 'Segoe UI', monospace";

    parent.appendChild(this.container);
  }

  public showElimination(victimName: string, isHeadshot: boolean): void {
    this.container.innerHTML = `
      <div style="font-size:1.4rem; font-weight:900; letter-spacing:2px; color:${isHeadshot ? '#ff1744' : '#00e676'}; text-shadow:0 0 16px ${isHeadshot ? 'rgba(255,23,68,0.8)' : 'rgba(0,230,118,0.8)'};">
        ${isHeadshot ? '💥 HEADSHOT ELIMINATION' : '🎯 ENEMY ELIMINATED'}
      </div>
      <div style="font-size:1.0rem; font-weight:bold; color:#fff; background:rgba(8, 14, 22, 0.85); padding:4px 16px; border-radius:20px; border:1px solid rgba(255,255,255,0.2);">
        ${victimName} <span style="color:#ffd600; font-weight:900; margin-left:6px;">+${isHeadshot ? '150' : '100'}</span>
      </div>
    `;

    this.container.style.opacity = '1';
    this.container.style.transform = 'translateX(-50%) scale(1.08)';
    this.timer = 2.4; // Show for 2.4s

    setTimeout(() => {
      this.container.style.transform = 'translateX(-50%) scale(1.0)';
    }, 150);
  }

  public update(dt: number): void {
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.container.style.opacity = '0';
      }
    }
  }
}
