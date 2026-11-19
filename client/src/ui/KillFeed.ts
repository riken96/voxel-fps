import { WeaponId, getWeaponDef } from '@shared/combat/Weapons.ts';

export class KillFeed {
  private container: HTMLElement;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'kill-feed';
    this.container.style.position = 'absolute';
    this.container.style.top = '184px';
    this.container.style.right = '16px';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.alignItems = 'flex-end';
    this.container.style.gap = '6px';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '200';
    this.container.style.fontFamily = "'JetBrains Mono', monospace";
    this.container.style.fontSize = '12px';

    parent.appendChild(this.container);
  }

  public addEntry(
    killerName: string,
    victimName: string,
    weaponId: WeaponId,
    isHeadshot: boolean,
    isLocalKiller: boolean,
    isLocalVictim: boolean
  ): void {
    const entry = document.createElement('div');
    entry.style.background = 'rgba(10, 16, 26, 0.85)';
    entry.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    entry.style.padding = '5px 10px';
    entry.style.borderRadius = '4px';
    entry.style.backdropFilter = 'blur(4px)';
    entry.style.color = '#fff';
    entry.style.display = 'flex';
    entry.style.alignItems = 'center';
    entry.style.gap = '8px';
    entry.style.animation = 'fadeIn 0.2s ease';

    const weapon = getWeaponDef(weaponId);
    const killerColor = isLocalKiller ? '#00ffcc' : '#90caf9';
    const victimColor = isLocalVictim ? '#ff5252' : '#e0e0e0';
    const headshotBadge = isHeadshot ? `<span style="color:#ff1744; font-weight:bold;">[HEADSHOT]</span>` : '';

    entry.innerHTML = `
      <span style="color:${killerColor}; font-weight:bold;">${killerName}</span>
      <span style="color:#ffd54f; font-size:11px;">[${weapon.name}]</span>
      ${headshotBadge}
      <span style="color:${victimColor}; font-weight:bold;">${victimName}</span>
    `;

    this.container.appendChild(entry);

    // Keep max 5 entries
    if (this.container.children.length > 5) {
      this.container.removeChild(this.container.children[0]);
    }

    // Auto-remove after 4 seconds
    setTimeout(() => {
      if (entry.parentElement) {
        entry.style.opacity = '0';
        entry.style.transition = 'opacity 0.4s ease';
        setTimeout(() => {
          if (entry.parentElement) entry.parentElement.removeChild(entry);
        }, 400);
      }
    }, 3800);
  }
}
