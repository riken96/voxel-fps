import { MatchStatusData, GameMode, Team } from '@shared/match/MatchTypes.ts';

export class Scoreboard {
  private element: HTMLElement;
  private headerEl: HTMLElement;
  private tableBodyEl: HTMLElement;
  public visible = false;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.id = 'tab-scoreboard';
    this.element.style.position = 'absolute';
    this.element.style.top = '50%';
    this.element.style.left = '50%';
    this.element.style.transform = 'translate(-50%, -50%)';
    this.element.style.width = '640px';
    this.element.style.background = 'rgba(10, 16, 26, 0.94)';
    this.element.style.border = '1px solid rgba(0, 255, 204, 0.4)';
    this.element.style.borderRadius = '8px';
    this.element.style.padding = '20px';
    this.element.style.backdropFilter = 'blur(12px)';
    this.element.style.boxShadow = '0 16px 48px rgba(0, 0, 0, 0.8)';
    this.element.style.display = 'none';
    this.element.style.zIndex = '400';
    this.element.style.fontFamily = "'JetBrains Mono', monospace";
    this.element.style.color = '#fff';

    this.headerEl = document.createElement('div');
    this.element.appendChild(this.headerEl);

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.marginTop = '12px';
    table.style.fontSize = '12px';

    table.innerHTML = `
      <thead>
        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.15); color: #90a4ae; text-align: left;">
          <th style="padding: 6px 8px;">#</th>
          <th style="padding: 6px 8px;">PLAYER</th>
          <th style="padding: 6px 8px;">TEAM</th>
          <th style="padding: 6px 8px; text-align: center;">K</th>
          <th style="padding: 6px 8px; text-align: center;">D</th>
          <th style="padding: 6px 8px; text-align: center;">K/D</th>
          <th style="padding: 6px 8px; text-align: right;">SCORE</th>
          <th style="padding: 6px 8px; text-align: right;">PING</th>
        </tr>
      </thead>
      <tbody id="scoreboard-rows"></tbody>
    `;

    this.tableBodyEl = table.querySelector('#scoreboard-rows') as HTMLElement;
    this.element.appendChild(table);
    parent.appendChild(this.element);

    this.setupListeners();
  }

  private setupListeners(): void {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        this.visible = true;
        this.element.style.display = 'block';
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Tab') {
        this.visible = false;
        this.element.style.display = 'none';
      }
    });
  }

  public update(matchData: MatchStatusData | null, localPlayerId: string | null): void {
    if (!matchData) return;

    // Header Info
    const min = Math.floor(matchData.timeRemaining / 60);
    const sec = matchData.timeRemaining % 60;
    const timeFormatted = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;

    let scoreStatus = '';
    if (matchData.mode === GameMode.TDM) {
      scoreStatus = ` | <span style="color:#ff5252; font-weight:bold;">RED ${matchData.teamScores.red}</span> - <span style="color:#40c4ff; font-weight:bold;">BLUE ${matchData.teamScores.blue}</span>`;
    }

    this.headerEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(0,255,204,0.3); padding-bottom:10px;">
        <div>
          <span style="color:#00ffcc; font-weight:900; font-size:16px;">${matchData.roomName.toUpperCase()}</span>
          <span style="color:#ffd54f; font-size:12px; margin-left:8px;">[${matchData.mode}]</span>
          ${scoreStatus}
        </div>
        <div style="font-size:18px; font-weight:900; color:#fff; background:rgba(0,0,0,0.5); padding:2px 10px; border-radius:4px;">
          ⏱️ ${timeFormatted}
        </div>
      </div>
    `;

    // Populate rows
    this.tableBodyEl.innerHTML = '';
    let rank = 1;

    for (const player of matchData.scores) {
      const isLocal = player.id === localPlayerId;
      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
      if (isLocal) {
        row.style.background = 'rgba(0, 255, 204, 0.12)';
        row.style.fontWeight = 'bold';
      }

      const kd = player.deaths > 0 ? (player.kills / player.deaths).toFixed(1) : player.kills.toFixed(1);
      const teamBadge = player.team === Team.RED
        ? `<span style="color:#ff5252; font-weight:bold;">RED</span>`
        : player.team === Team.BLUE
        ? `<span style="color:#40c4ff; font-weight:bold;">BLUE</span>`
        : `<span style="color:#90a4ae;">FFA</span>`;

      const nameDisplay = isLocal
        ? `<span style="color:#00ffcc;">${player.username} (YOU)</span>`
        : player.username;

      row.innerHTML = `
        <td style="padding: 7px 8px; color:#ffd54f;">#${rank++}</td>
        <td style="padding: 7px 8px;">${nameDisplay}</td>
        <td style="padding: 7px 8px;">${teamBadge}</td>
        <td style="padding: 7px 8px; text-align: center; color:#00e676;">${player.kills}</td>
        <td style="padding: 7px 8px; text-align: center; color:#ff5252;">${player.deaths}</td>
        <td style="padding: 7px 8px; text-align: center; color:#cfd8dc;">${kd}</td>
        <td style="padding: 7px 8px; text-align: right; color:#ffd54f; font-weight:bold;">${player.score}</td>
        <td style="padding: 7px 8px; text-align: right; color:#81c784;">${player.ping}ms</td>
      `;

      this.tableBodyEl.appendChild(row);
    }
  }
}
