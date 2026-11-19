export interface UserProfile {
  id: string;
  username: string;
  kills?: number;
  deaths?: number;
  wins?: number;
  score?: number;
}

export class AuthModal {
  private overlay: HTMLElement;
  public currentUser: UserProfile | null = null;
  private onUserLoggedIn?: (user: UserProfile) => void;
  public visible = false;

  constructor(parent: HTMLElement, onUserLoggedIn?: (user: UserProfile) => void) {
    this.onUserLoggedIn = onUserLoggedIn;

    this.overlay = document.createElement('div');
    this.overlay.id = 'auth-modal';
    this.overlay.style.position = 'absolute';
    this.overlay.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.width = '100%';
    this.overlay.style.height = '100%';
    this.overlay.style.background = 'rgba(6, 10, 16, 0.9)';
    this.overlay.style.display = 'none';
    this.overlay.style.justifyContent = 'center';
    this.overlay.style.alignItems = 'center';
    this.overlay.style.zIndex = '580';
    this.overlay.style.backdropFilter = 'blur(10px)';
    this.overlay.style.fontFamily = "'JetBrains Mono', monospace";
    this.overlay.style.color = '#fff';

    const card = document.createElement('div');
    card.style.background = '#141d2b';
    card.style.border = '1px solid rgba(0, 255, 204, 0.4)';
    card.style.borderRadius = '10px';
    card.style.padding = '26px';
    card.style.width = '420px';
    card.style.boxShadow = '0 16px 48px rgba(0, 0, 0, 0.8)';

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.15); padding-bottom:12px; margin-bottom:16px;">
        <div style="font-size:1.3rem; font-weight:900; color:#00ffcc;">PILOT PROFILE & LOGIN</div>
        <button id="auth-close-btn" style="background:#263238; border:1px solid #37474f; color:#fff; padding:3px 8px; border-radius:4px; cursor:pointer;">✕</button>
      </div>

      <div id="auth-user-info" style="display:none; margin-bottom:16px; background:rgba(0,255,204,0.08); border:1px solid rgba(0,255,204,0.3); border-radius:6px; padding:12px;">
        <div style="color:#00ffcc; font-weight:bold; font-size:16px;" id="profile-name">Pilot</div>
        <div style="font-size:12px; color:#cfd8dc; margin-top:6px;" id="profile-stats">Kills: 0 | Deaths: 0 | Wins: 0</div>
        <button id="auth-logout-btn" style="margin-top:10px; padding:4px 10px; background:#d32f2f; border:none; border-radius:4px; color:#fff; cursor:pointer; font-size:11px; font-weight:bold;">Log Out</button>
      </div>

      <div id="auth-form-container">
        <div style="display:flex; gap:10px; margin-bottom:14px;">
          <button id="tab-login" style="flex:1; padding:7px; background:#00e676; border:none; border-radius:4px; color:#000; font-weight:bold; cursor:pointer; font-size:12px;">Sign In</button>
          <button id="tab-register" style="flex:1; padding:7px; background:#263238; border:1px solid #37474f; border-radius:4px; color:#fff; font-weight:bold; cursor:pointer; font-size:12px;">Register</button>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">
          <input id="auth-username" type="text" placeholder="Pilot Username" style="background:#0b0f19; border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:8px 12px; color:#fff; font-family:monospace;" />
          <input id="auth-password" type="password" placeholder="Password" style="background:#0b0f19; border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:8px 12px; color:#fff; font-family:monospace;" />
        </div>

        <button id="auth-submit-btn" style="width:100%; padding:10px; background:#00e676; border:none; border-radius:4px; color:#000; font-weight:bold; cursor:pointer; font-size:13px;">CONFIRM</button>
        <div id="auth-error-msg" style="color:#ff5252; font-size:11px; margin-top:8px; min-height:16px;"></div>
      </div>
    `;

    this.overlay.appendChild(card);
    parent.appendChild(this.overlay);

    this.setupListeners(card);
    this.loadSavedSession();
  }

  private loadSavedSession(): void {
    const saved = localStorage.getItem('voxel_user');
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
        if (this.currentUser && this.onUserLoggedIn) {
          this.onUserLoggedIn(this.currentUser);
        }
      } catch (e) {}
    }
  }

  private setupListeners(card: HTMLElement): void {
    let mode: 'login' | 'register' = 'login';
    const closeBtn = card.querySelector('#auth-close-btn') as HTMLButtonElement;
    const tabLogin = card.querySelector('#tab-login') as HTMLButtonElement;
    const tabRegister = card.querySelector('#tab-register') as HTMLButtonElement;
    const submitBtn = card.querySelector('#auth-submit-btn') as HTMLButtonElement;
    const userInput = card.querySelector('#auth-username') as HTMLInputElement;
    const passInput = card.querySelector('#auth-password') as HTMLInputElement;
    const errEl = card.querySelector('#auth-error-msg') as HTMLElement;
    const logoutBtn = card.querySelector('#auth-logout-btn') as HTMLButtonElement;
    const infoBox = card.querySelector('#auth-user-info') as HTMLElement;
    const formBox = card.querySelector('#auth-form-container') as HTMLElement;
    const profileName = card.querySelector('#profile-name') as HTMLElement;
    const profileStats = card.querySelector('#profile-stats') as HTMLElement;

    closeBtn.onclick = () => this.setVisible(false);

    tabLogin.onclick = () => {
      mode = 'login';
      tabLogin.style.background = '#00e676';
      tabLogin.style.color = '#000';
      tabRegister.style.background = '#263238';
      tabRegister.style.color = '#fff';
      errEl.innerText = '';
    };

    tabRegister.onclick = () => {
      mode = 'register';
      tabRegister.style.background = '#00e676';
      tabRegister.style.color = '#000';
      tabLogin.style.background = '#263238';
      tabLogin.style.color = '#fff';
      errEl.innerText = '';
    };

    logoutBtn.onclick = () => {
      localStorage.removeItem('voxel_user');
      this.currentUser = null;
      infoBox.style.display = 'none';
      formBox.style.display = 'block';
    };

    submitBtn.onclick = async () => {
      const username = userInput.value.trim();
      const password = passInput.value.trim();

      if (!username || !password) {
        errEl.innerText = 'Please enter both username and password';
        return;
      }

      errEl.innerText = 'Authenticating...';
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok && data.user) {
          this.currentUser = data.user;
          localStorage.setItem('voxel_user', JSON.stringify(data.user));
          errEl.innerText = '';

          infoBox.style.display = 'block';
          formBox.style.display = 'none';
          profileName.innerText = `Pilot: ${data.user.username}`;
          profileStats.innerText = `Kills: ${data.user.kills || 0} | Deaths: ${data.user.deaths || 0} | Wins: ${data.user.wins || 0}`;

          if (this.onUserLoggedIn) {
            this.onUserLoggedIn(data.user);
          }

          setTimeout(() => this.setVisible(false), 600);
        } else {
          errEl.innerText = data.error || 'Authentication failed';
        }
      } catch (err) {
        errEl.innerText = 'Failed to reach backend server';
      }
    };
  }

  public setVisible(v: boolean): void {
    this.visible = v;
    this.overlay.style.display = v ? 'flex' : 'none';
    if (v) {
      document.exitPointerLock();
    }
  }
}
