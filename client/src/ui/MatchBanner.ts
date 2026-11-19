import { MatchStatusData, MatchOverData, GameMode, Team } from '@shared/match/MatchTypes.ts';

export class MatchBanner {
  private topBar: HTMLElement;
  private timerEl: HTMLElement;
  private scoreEl: HTMLElement;
  private podiumModal: HTMLElement;

  constructor(parent: HTMLElement) {
    // 1. Top HUD Strip
    this.topBar = document.createElement('div');
    this.topBar.id = 'match-top-banner';
    this.topBar.style.position = 'absolute';
    this.topBar.style.top = '14px';
    this.topBar.style.left = '50%';
    this.topBar.style.transform = 'translateX(-50%)';
    this.topBar.style.display = 'flex';
    this.topBar.style.alignItems = 'center';
    this.topBar.style.gap = '16px';
    this.topBar.style.background = 'rgba(10, 16, 26, 0.85)';
    this.topBar.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    this.topBar.style.padding = '6px 18px';
    this.topBar.style.borderRadius = '6px';
    this.topBar.style.backdropFilter = 'blur(8px)';
    this.topBar.style.fontFamily = "'JetBrains Mono', monospace";
    this.topBar.style.zIndex = '140';
    this.topBar.style.pointerEvents = 'none';

    this.timerEl = document.createElement('div');
    this.timerEl.style.fontSize = '16px';
    this.timerEl.style.fontWeight = 'bold';
    this.timerEl.style.color = '#fff';

    this.scoreEl = document.createElement('div');
    this.scoreEl.style.fontSize = '14px';
    this.scoreEl.style.fontWeight = 'bold';

    this.topBar.appendChild(this.timerEl);
    this.topBar.appendChild(this.scoreEl);
    parent.appendChild(this.topBar);

    // 2. Post-Match Winner Podium Modal
    this.podiumModal = document.createElement('div');
    this.podiumModal.id = 'match-podium-modal';
    this.podiumModal.style.position = 'absolute';
    this.podiumModal.style.top = '0';
    this.podiumModal.style.left = '0';
    this.podiumModal.style.width = '100%';
    this.podiumModal.style.height = '100%';
    this.podiumModal.style.background = 'rgba(6, 10, 16, 0.9)';
    this.podiumModal.style.display = 'none';
    this.podiumModal.style.flexDirection = 'column';
    this.podiumModal.style.justifyContent = 'center';
    this.podiumModal.style.alignItems = 'center';
    this.podiumModal.style.zIndex = '600';
    this.podiumModal.style.backdropFilter = 'blur(10px)';
    this.podiumModal.style.fontFamily = "'JetBrains Mono', monospace";
    this.podiumModal.style.color = '#fff';

    parent.appendChild(this.podiumModal);
  }

  public update(matchData: MatchStatusData | null): void {
    if (!matchData) return;

    const min = Math.floor(matchData.timeRemaining / 60);
    const sec = matchData.timeRemaining % 60;
    this.timerEl.innerText = `⏱️ ${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;

    if (matchData.mode === GameMode.TDM) {
      this.scoreEl.innerHTML = `
        <span style="color:#ff5252; background:rgba(255,82,82,0.2); padding:2px 8px; border-radius:4px;">RED ${matchData.teamScores.red}</span>
        <span style="color:#78909c; margin:0 4px;">VS</span>
        <span style="color:#40c4ff; background:rgba(64,196,255,0.2); padding:2px 8px; border-radius:4px;">BLUE ${matchData.teamScores.blue}</span>
      `;
    } else {
      const leader = matchData.scores.length > 0 ? matchData.scores[0] : null;
      if (leader) {
        this.scoreEl.innerHTML = `Leader: <span style="color:#00ffcc;">${leader.username}</span> (${leader.kills} Kills)`;
      } else {
        this.scoreEl.innerHTML = `<span style="color:#78909c;">Free For All</span>`;
      }
    }
  }

  public showMatchOver(overData: MatchOverData): void {
    this.podiumModal.style.display = 'flex';

    const winnerTitle = overData.winningTeam === Team.RED
      ? '<span style="color:#ff5252;">RED TEAM VICTORY</span>'
      : overData.winningTeam === Team.BLUE
      ? '<span style="color:#40c4ff;">BLUE TEAM VICTORY</span>'
      : `<span style="color:#ffd54f;">${overData.winnerName} WINS!</span>`;

    const mvpSection = overData.mvp
      ? `
        <div style="background:rgba(255, 215, 0, 0.1); border:1px solid rgba(255, 215, 0, 0.4); border-radius:8px; padding:12px 24px; margin:16px 0; text-align:center;">
          <div style="color:#ffd54f; font-size:12px; font-weight:bold; letter-spacing:1px;">MATCH MVP</div>
          <div style="font-size:22px; font-weight:900; color:#fff;">${overData.mvp.username}</div>
          <div style="font-size:13px; color:#b0bec5;">${overData.mvp.kills} Kills | ${overData.mvp.score} Points</div>
        </div>
      `
      : '';

    let podiumRows = '';
    const top3 = overData.scores.slice(0, 3);
    let r = 1;
    for (const p of top3) {
      const medal = r === 1 ? '🥇' : r === 2 ? '🥈' : '🥉';
      podiumRows += `
        <div style="display:flex; justify-content:space-between; width:340px; padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.1); font-size:14px;">
          <span>${medal} ${p.username}</span>
          <span style="color:#ffd54f; font-weight:bold;">${p.score} PTS</span>
        </div>
      `;
      r++;
    }

    this.podiumModal.innerHTML = `
      <div style="font-size:2.8rem; font-weight:900; letter-spacing:2px; margin-bottom:8px; text-transform:uppercase;">
        ${winnerTitle}
      </div>
      <div style="color:#90a4ae; font-size:14px; margin-bottom:12px;">ROUND COMPLETED</div>
      ${mvpSection}
      <div style="margin-top:12px; display:flex; flex-direction:column; align-items:center;">
        ${podiumRows}
      </div>
      <div style="margin-top:28px; color:#00ffcc; font-size:14px; font-weight:bold;">
        Next round starts shortly...
      </div>
    `;

    setTimeout(() => {
      this.podiumModal.style.display = 'none';
    }, 9500);
  }
}
