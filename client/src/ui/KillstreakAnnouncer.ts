export interface KillstreakEvent {
  title: string;
  sub: string;
  score: number;
  color: string;
}

interface FloatingScore {
  el: HTMLElement;
  y: number;
  opacity: number;
  life: number;
}

export class KillstreakAnnouncer {
  private parent: HTMLElement;
  private bannerEl: HTMLElement;
  private bannerTitleEl: HTMLElement;
  private bannerSubEl: HTMLElement;
  private bannerScoreEl: HTMLElement;

  private floatingScores: FloatingScore[] = [];

  private lastKillTime = 0;
  private currentStreak = 0;
  private bannerTimer = 0;

  public onAnnounceSound?: (soundType: 'headshot' | 'multikill' | 'rampage') => void;

  constructor(parent: HTMLElement) {
    this.parent = parent;

    // Center Banner Container
    this.bannerEl = document.createElement('div');
    this.bannerEl.id = 'killstreak-banner';
    this.bannerEl.style.position = 'absolute';
    this.bannerEl.style.top = '18%';
    this.bannerEl.style.left = '50%';
    this.bannerEl.style.transform = 'translateX(-50%) scale(0.85)';
    this.bannerEl.style.opacity = '0';
    this.bannerEl.style.transition = 'transform 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.18s ease';
    this.bannerEl.style.pointerEvents = 'none';
    this.bannerEl.style.display = 'flex';
    this.bannerEl.style.flexDirection = 'column';
    this.bannerEl.style.alignItems = 'center';
    this.bannerEl.style.zIndex = '300';
    this.bannerEl.style.fontFamily = "'JetBrains Mono', 'Segoe UI', monospace";
    this.bannerEl.style.textShadow = '0 0 20px rgba(0,0,0,0.9)';

    this.bannerTitleEl = document.createElement('div');
    this.bannerTitleEl.style.fontSize = '24px';
    this.bannerTitleEl.style.fontWeight = '900';
    this.bannerTitleEl.style.letterSpacing = '2px';
    this.bannerTitleEl.style.textTransform = 'uppercase';

    this.bannerSubEl = document.createElement('div');
    this.bannerSubEl.style.fontSize = '12px';
    this.bannerSubEl.style.fontWeight = 'bold';
    this.bannerSubEl.style.color = 'rgba(255, 255, 255, 0.8)';
    this.bannerSubEl.style.marginTop = '2px';

    this.bannerScoreEl = document.createElement('div');
    this.bannerScoreEl.style.fontSize = '14px';
    this.bannerScoreEl.style.fontWeight = 'bold';
    this.bannerScoreEl.style.marginTop = '4px';

    this.bannerEl.appendChild(this.bannerTitleEl);
    this.bannerEl.appendChild(this.bannerSubEl);
    this.bannerEl.appendChild(this.bannerScoreEl);
    this.parent.appendChild(this.bannerEl);
  }

  public resetStreaks(): void {
    this.currentStreak = 0;
  }

  public recordElimination(victimName: string, isHeadshot: boolean): void {
    const now = performance.now();
    const timeSinceLast = (now - this.lastKillTime) / 1000;

    if (timeSinceLast <= 4.5) {
      this.currentStreak++;
    } else {
      this.currentStreak = 1;
    }
    this.lastKillTime = now;

    let title = 'ENEMY ELIMINATED';
    let sub = `Eliminated ${victimName}`;
    let score = 100;
    let color = '#00ffcc';
    let sound: 'headshot' | 'multikill' | 'rampage' = 'multikill';

    if (this.currentStreak === 2) {
      title = '🔥 DOUBLE KILL!';
      score = 200;
      color = '#ffea00';
      sound = 'multikill';
    } else if (this.currentStreak === 3) {
      title = '⚡ TRIPLE KILL!';
      score = 300;
      color = '#ff9100';
      sound = 'multikill';
    } else if (this.currentStreak === 4) {
      title = '💥 QUADRA KILL!';
      score = 450;
      color = '#ff3d00';
      sound = 'multikill';
    } else if (this.currentStreak >= 5) {
      title = '☠️ UNSTOPPABLE RAMPAGE!';
      score = 600;
      color = '#e040fb';
      sound = 'rampage';
    } else if (isHeadshot) {
      title = '🎯 HEADSHOT!';
      score = 150;
      color = '#ff1744';
      sound = 'headshot';
    }

    if (isHeadshot && this.currentStreak > 1) {
      sub += ' [CRITICAL HEADSHOT]';
      score += 50;
    }

    // Trigger visual banner
    this.showBanner(title, sub, `+${score} PTS`, color);

    // Trigger floating combat score
    this.spawnFloatingScore(`+${score}`, isHeadshot ? '#ff1744' : '#00ffcc');

    if (this.onAnnounceSound) {
      this.onAnnounceSound(sound);
    }
  }

  private showBanner(title: string, sub: string, scoreText: string, color: string): void {
    this.bannerTitleEl.innerText = title;
    this.bannerTitleEl.style.color = color;
    this.bannerTitleEl.style.textShadow = `0 0 16px ${color}`;

    this.bannerSubEl.innerText = sub;
    this.bannerScoreEl.innerText = scoreText;
    this.bannerScoreEl.style.color = color;

    this.bannerEl.style.opacity = '1';
    this.bannerEl.style.transform = 'translateX(-50%) scale(1.05)';
    this.bannerTimer = 2.4; // 2.4s display time
  }

  private spawnFloatingScore(text: string, color: string): void {
    const el = document.createElement('div');
    el.innerText = text;
    el.style.position = 'absolute';
    el.style.left = '50%';
    el.style.top = '54%';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.color = color;
    el.style.fontSize = '16px';
    el.style.fontWeight = '900';
    el.style.fontFamily = "'JetBrains Mono', monospace";
    el.style.textShadow = `0 0 10px ${color}, 0 2px 4px rgba(0,0,0,0.9)`;
    el.style.pointerEvents = 'none';
    el.style.zIndex = '310';

    this.parent.appendChild(el);
    this.floatingScores.push({
      el,
      y: 0,
      opacity: 1.0,
      life: 0.8
    });
  }

  public update(dt: number): void {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerEl.style.opacity = '0';
        this.bannerEl.style.transform = 'translateX(-50%) scale(0.85)';
      }
    }

    // Update floating score numbers
    for (let i = this.floatingScores.length - 1; i >= 0; i--) {
      const fs = this.floatingScores[i];
      fs.life -= dt;
      fs.y -= dt * 45; // float upward
      fs.opacity = Math.max(0, fs.life / 0.8);

      fs.el.style.transform = `translate(-50%, calc(-50% + ${fs.y}px))`;
      fs.el.style.opacity = String(fs.opacity);

      if (fs.life <= 0) {
        if (fs.el.parentElement) {
          fs.el.parentElement.removeChild(fs.el);
        }
        this.floatingScores.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    if (this.bannerEl.parentElement) {
      this.bannerEl.parentElement.removeChild(this.bannerEl);
    }
    for (const fs of this.floatingScores) {
      if (fs.el.parentElement) {
        fs.el.parentElement.removeChild(fs.el);
      }
    }
    this.floatingScores = [];
  }
}
