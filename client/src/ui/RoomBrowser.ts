import { RoomSummary, GameMode } from '@shared/match/MatchTypes.ts';

export class RoomBrowser {
  private overlay: HTMLElement;
  private roomListContainer: HTMLElement;
  private onJoinRoom: (roomId: string) => void;
  private onCreateRoom: (name: string, mode: GameMode, mapTemplate: 'arena' | 'warehouse') => void;
  public onAddBot?: (difficulty: 'easy' | 'medium' | 'hard', count: number) => void;
  public onRemoveBot?: () => void;
  public visible = false;

  constructor(
    parent: HTMLElement,
    onJoinRoom: (roomId: string) => void,
    onCreateRoom: (name: string, mode: GameMode, mapTemplate: 'arena' | 'warehouse') => void
  ) {
    this.onJoinRoom = onJoinRoom;
    this.onCreateRoom = onCreateRoom;

    this.overlay = document.createElement('div');
    this.overlay.id = 'room-browser-modal';
    this.overlay.style.position = 'absolute';
    this.overlay.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.width = '100%';
    this.overlay.style.height = '100%';
    this.overlay.style.background = 'rgba(6, 10, 16, 0.9)';
    this.overlay.style.display = 'none';
    this.overlay.style.justifyContent = 'center';
    this.overlay.style.alignItems = 'center';
    this.overlay.style.zIndex = '550';
    this.overlay.style.backdropFilter = 'blur(10px)';
    this.overlay.style.fontFamily = "'JetBrains Mono', monospace";
    this.overlay.style.color = '#fff';

    const card = document.createElement('div');
    card.style.background = '#141d2b';
    card.style.border = '1px solid rgba(0, 255, 204, 0.4)';
    card.style.borderRadius = '10px';
    card.style.padding = '24px';
    card.style.width = '680px';
    card.style.maxHeight = '80vh';
    card.style.overflowY = 'auto';
    card.style.boxShadow = '0 16px 48px rgba(0, 0, 0, 0.8)';

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.15); padding-bottom:12px; margin-bottom:16px;">
        <div style="font-size:1.4rem; font-weight:900; color:#00ffcc; letter-spacing:1px;">GAME LOBBIES & MATCHMAKING</div>
        <button id="close-browser-btn" style="background:#263238; border:1px solid #37474f; color:#fff; padding:4px 10px; border-radius:4px; cursor:pointer;">✕ ESC</button>
      </div>

      <!-- Create Room Section -->
      <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:14px; margin-bottom:16px;">
        <div style="font-size:13px; font-weight:bold; color:#ffd54f; margin-bottom:8px;">CREATE CUSTOM ROOM</div>
        <div style="display:flex; gap:10px;">
          <input id="create-room-name" type="text" placeholder="Room Name" value="Custom Match" style="flex:2; background:#0b0f19; border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:6px 10px; color:#fff; font-family:monospace; font-size:12px;" />
          <select id="create-room-mode" style="flex:1.5; background:#0b0f19; border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:6px 10px; color:#fff; font-family:monospace; font-size:12px;">
            <option value="Free For All">Free For All (FFA)</option>
            <option value="Team Deathmatch">Team Deathmatch (TDM)</option>
          </select>
          <select id="create-room-map" style="flex:1.5; background:#0b0f19; border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:6px 10px; color:#fff; font-family:monospace; font-size:12px;">
            <option value="arena">Default Arena</option>
            <option value="warehouse">Cyber Warehouse</option>
          </select>
          <button id="btn-create-submit" style="padding:6px 14px; background:#00e676; border:none; border-radius:4px; color:#000; font-weight:bold; cursor:pointer; font-size:12px;">Create</button>
        </div>
      </div>

      <!-- Practice AI Bots Section -->
      <div style="background:rgba(0, 255, 204, 0.06); border:1px solid rgba(0, 255, 204, 0.25); border-radius:6px; padding:12px 14px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:13px; font-weight:bold; color:#00ffcc;">🤖 PRACTICE AI BOTS</div>
          <div style="font-size:11px; color:#90a4ae;">Spawn intelligent AI opponents in the current match</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <select id="bot-difficulty-select" style="background:#0b0f19; border:1px solid rgba(0,255,204,0.3); border-radius:4px; padding:5px 8px; color:#00ffcc; font-family:monospace; font-size:11px;">
            <option value="easy">Easy (Recruit)</option>
            <option value="medium" selected>Medium (Soldier)</option>
            <option value="hard">Hard (Veteran)</option>
          </select>
          <button id="btn-add-bot" style="padding:6px 12px; background:#00e676; border:none; border-radius:4px; color:#000; font-weight:bold; cursor:pointer; font-size:11px;">+ Add Bot</button>
          <button id="btn-add-3-bots" style="padding:6px 12px; background:#00b0ff; border:none; border-radius:4px; color:#000; font-weight:bold; cursor:pointer; font-size:11px;">+ 3 Bots</button>
          <button id="btn-remove-bot" style="padding:6px 12px; background:#e91e63; border:none; border-radius:4px; color:#fff; font-weight:bold; cursor:pointer; font-size:11px;">- Remove</button>
        </div>
      </div>

      <!-- Public Rooms List -->
      <div style="font-size:13px; font-weight:bold; color:#90a4ae; margin-bottom:8px;">AVAILABLE ROOMS</div>
      <div id="room-list-items" style="display:flex; flex-direction:column; gap:8px;"></div>
    `;

    this.roomListContainer = card.querySelector('#room-list-items') as HTMLElement;
    this.overlay.appendChild(card);
    parent.appendChild(this.overlay);

    // Event hooks
    setTimeout(() => {
      const closeBtn = card.querySelector('#close-browser-btn') as HTMLButtonElement;
      const createBtn = card.querySelector('#btn-create-submit') as HTMLButtonElement;
      const nameInput = card.querySelector('#create-room-name') as HTMLInputElement;
      const modeSelect = card.querySelector('#create-room-mode') as HTMLSelectElement;
      const mapSelect = card.querySelector('#create-room-map') as HTMLSelectElement;

      closeBtn.onclick = () => this.setVisible(false);

      createBtn.onclick = () => {
        const name = nameInput.value.trim() || 'Custom Arena';
        const mode = modeSelect.value as GameMode;
        const map = mapSelect.value as 'arena' | 'warehouse';
        this.onCreateRoom(name, mode, map);
        this.setVisible(false);
      };

      const addBotBtn = card.querySelector('#btn-add-bot') as HTMLButtonElement;
      const add3BotsBtn = card.querySelector('#btn-add-3-bots') as HTMLButtonElement;
      const removeBotBtn = card.querySelector('#btn-remove-bot') as HTMLButtonElement;
      const diffSelect = card.querySelector('#bot-difficulty-select') as HTMLSelectElement;

      if (addBotBtn) {
        addBotBtn.onclick = () => {
          const diff = (diffSelect?.value || 'medium') as 'easy' | 'medium' | 'hard';
          if (this.onAddBot) this.onAddBot(diff, 1);
        };
      }
      if (add3BotsBtn) {
        add3BotsBtn.onclick = () => {
          const diff = (diffSelect?.value || 'medium') as 'easy' | 'medium' | 'hard';
          if (this.onAddBot) this.onAddBot(diff, 3);
        };
      }
      if (removeBotBtn) {
        removeBotBtn.onclick = () => {
          if (this.onRemoveBot) this.onRemoveBot();
        };
      }
    }, 50);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') {
        this.setVisible(!this.visible);
      }
    });
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.overlay.style.display = visible ? 'flex' : 'none';
    if (visible) {
      document.exitPointerLock();
    }
  }

  public updateRooms(rooms: RoomSummary[], currentRoomId?: string): void {
    this.roomListContainer.innerHTML = '';

    if (rooms.length === 0) {
      this.roomListContainer.innerHTML = `<div style="color:#78909c; font-size:12px; padding:12px; text-align:center;">No active rooms found. Create one above!</div>`;
      return;
    }

    for (const r of rooms) {
      const isCurrent = r.id === currentRoomId;
      const item = document.createElement('div');
      item.style.background = isCurrent ? 'rgba(0, 255, 204, 0.12)' : 'rgba(255, 255, 255, 0.04)';
      item.style.border = isCurrent ? '1px solid #00ffcc' : '1px solid rgba(255, 255, 255, 0.1)';
      item.style.borderRadius = '6px';
      item.style.padding = '10px 14px';
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';

      const modeBadge = r.mode === GameMode.TDM
        ? `<span style="color:#40c4ff; font-weight:bold;">[TDM]</span>`
        : `<span style="color:#ffd54f; font-weight:bold;">[FFA]</span>`;

      const playerStatus = `${r.playerCount} / ${r.maxPlayers}`;

      item.innerHTML = `
        <div>
          <div style="font-weight:bold; font-size:14px; color:#fff;">${r.name} ${modeBadge}</div>
          <div style="font-size:11px; color:#90a4ae;">Map: ${r.mapName} | Players: <span style="color:#00ffcc;">${playerStatus}</span></div>
        </div>
      `;

      const joinBtn = document.createElement('button');
      joinBtn.innerText = isCurrent ? 'Current' : 'Join';
      joinBtn.style.padding = '6px 14px';
      joinBtn.style.background = isCurrent ? '#263238' : '#00e676';
      joinBtn.style.border = 'none';
      joinBtn.style.borderRadius = '4px';
      joinBtn.style.color = isCurrent ? '#90a4ae' : '#000';
      joinBtn.style.fontWeight = 'bold';
      joinBtn.style.cursor = isCurrent ? 'default' : 'pointer';
      joinBtn.style.fontSize = '12px';

      if (!isCurrent) {
        joinBtn.onclick = () => {
          this.onJoinRoom(r.id);
          this.setVisible(false);
        };
      }

      item.appendChild(joinBtn);
      this.roomListContainer.appendChild(item);
    }
  }
}
