import { VoxelWorld } from '@shared/world/VoxelWorld.ts';
import { exportMapToJSON, VoxelMapData } from '@shared/world/MapFormat.ts';

interface MapSummaryItem {
  id: string;
  name: string;
  author: string;
  createdAt: string;
  blockCount: number;
  downloads: number;
  likes: number;
}

export class CommunityMapsModal {
  private overlay: HTMLElement;
  private mapsContainer: HTMLElement;
  private world: VoxelWorld;
  private onLoadMap: (mapData: VoxelMapData) => void;
  public visible = false;

  constructor(
    parent: HTMLElement,
    world: VoxelWorld,
    onLoadMap: (mapData: VoxelMapData) => void
  ) {
    this.world = world;
    this.onLoadMap = onLoadMap;

    this.overlay = document.createElement('div');
    this.overlay.id = 'community-maps-modal';
    this.overlay.style.position = 'absolute';
    this.overlay.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.width = '100%';
    this.overlay.style.height = '100%';
    this.overlay.style.background = 'rgba(6, 10, 16, 0.9)';
    this.overlay.style.display = 'none';
    this.overlay.style.justifyContent = 'center';
    this.overlay.style.alignItems = 'center';
    this.overlay.style.zIndex = '560';
    this.overlay.style.backdropFilter = 'blur(10px)';
    this.overlay.style.fontFamily = "'JetBrains Mono', monospace";
    this.overlay.style.color = '#fff';

    const card = document.createElement('div');
    card.style.background = '#141d2b';
    card.style.border = '1px solid rgba(0, 255, 204, 0.4)';
    card.style.borderRadius = '10px';
    card.style.padding = '24px';
    card.style.width = '700px';
    card.style.maxHeight = '82vh';
    card.style.overflowY = 'auto';
    card.style.boxShadow = '0 16px 48px rgba(0, 0, 0, 0.8)';

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.15); padding-bottom:12px; margin-bottom:16px;">
        <div style="font-size:1.35rem; font-weight:900; color:#00ffcc;">COMMUNITY VOXEL MAPS</div>
        <button id="close-maps-modal-btn" style="background:#263238; border:1px solid #37474f; color:#fff; padding:4px 10px; border-radius:4px; cursor:pointer;">✕ ESC</button>
      </div>

      <!-- Publish Current Map Section -->
      <div style="background:rgba(0, 255, 204, 0.05); border:1px solid rgba(0, 255, 204, 0.25); border-radius:6px; padding:12px 16px; margin-bottom:18px;">
        <div style="font-size:12px; font-weight:bold; color:#00ffcc; margin-bottom:6px;">PUBLISH CURRENT MAP TO COMMUNITY</div>
        <div style="display:flex; gap:8px;">
          <input id="publish-map-name" type="text" placeholder="Map Name" value="My Voxel Arena" style="flex:2; background:#0b0f19; border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:6px 10px; color:#fff; font-family:monospace; font-size:12px;" />
          <input id="publish-map-author" type="text" placeholder="Author Name" value="Community Builder" style="flex:1.5; background:#0b0f19; border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:6px 10px; color:#fff; font-family:monospace; font-size:12px;" />
          <button id="btn-publish-submit" style="padding:6px 16px; background:#00e676; border:none; border-radius:4px; color:#000; font-weight:bold; cursor:pointer; font-size:12px;">Publish</button>
        </div>
      </div>

      <!-- Search & Browse -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <input id="search-maps-input" type="text" placeholder="Search community maps..." style="width:260px; background:#0b0f19; border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:6px 10px; color:#fff; font-family:monospace; font-size:12px;" />
        <div style="display:flex; gap:8px;">
          <button id="btn-sort-latest" style="background:#263238; border:1px solid #37474f; color:#00ffcc; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:bold;">Latest</button>
          <button id="btn-sort-popular" style="background:#263238; border:1px solid #37474f; color:#fff; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:bold;">Popular</button>
        </div>
      </div>

      <div id="community-maps-list" style="display:flex; flex-direction:column; gap:8px;"></div>
    `;

    this.mapsContainer = card.querySelector('#community-maps-list') as HTMLElement;
    this.overlay.appendChild(card);
    parent.appendChild(this.overlay);

    this.setupListeners(card);
  }

  private setupListeners(card: HTMLElement): void {
    const closeBtn = card.querySelector('#close-maps-modal-btn') as HTMLButtonElement;
    const publishBtn = card.querySelector('#btn-publish-submit') as HTMLButtonElement;
    const nameInput = card.querySelector('#publish-map-name') as HTMLInputElement;
    const authorInput = card.querySelector('#publish-map-author') as HTMLInputElement;
    const searchInput = card.querySelector('#search-maps-input') as HTMLInputElement;
    const sortLatestBtn = card.querySelector('#btn-sort-latest') as HTMLButtonElement;
    const sortPopularBtn = card.querySelector('#btn-sort-popular') as HTMLButtonElement;

    closeBtn.onclick = () => this.setVisible(false);

    let currentSort: 'latest' | 'popular' = 'latest';

    sortLatestBtn.onclick = () => {
      currentSort = 'latest';
      sortLatestBtn.style.color = '#00ffcc';
      sortPopularBtn.style.color = '#fff';
      this.fetchMaps(searchInput.value, currentSort);
    };

    sortPopularBtn.onclick = () => {
      currentSort = 'popular';
      sortPopularBtn.style.color = '#00ffcc';
      sortLatestBtn.style.color = '#fff';
      this.fetchMaps(searchInput.value, currentSort);
    };

    searchInput.oninput = () => {
      this.fetchMaps(searchInput.value, currentSort);
    };

    publishBtn.onclick = async () => {
      const name = nameInput.value.trim() || 'Custom Arena';
      const author = authorInput.value.trim() || 'Anonymous';
      const mapData = exportMapToJSON(this.world, name, author);

      publishBtn.innerText = 'Publishing...';
      try {
        const res = await fetch('/api/maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, author, mapData })
        });
        const data = await res.json();
        if (res.ok && data.id) {
          alert(`Map "${name}" successfully published to the community repository!`);
          publishBtn.innerText = 'Publish';
          this.fetchMaps('', currentSort);
        }
      } catch (e) {
        alert('Failed to publish map to backend server');
        publishBtn.innerText = 'Publish';
      }
    };
  }

  public async fetchMaps(search = '', sort: 'latest' | 'popular' = 'latest'): Promise<void> {
    this.mapsContainer.innerHTML = '<div style="color:#78909c; font-size:12px; padding:12px; text-align:center;">Loading community maps...</div>';

    try {
      const query = new URLSearchParams({ search, sort }).toString();
      const res = await fetch(`/api/maps?${query}`);
      const data = await res.json();

      if (res.ok && Array.isArray(data.maps)) {
        this.renderMapList(data.maps);
      } else {
        this.mapsContainer.innerHTML = '<div style="color:#ff5252; font-size:12px; padding:12px;">Failed to load maps.</div>';
      }
    } catch (e) {
      this.mapsContainer.innerHTML = '<div style="color:#ff5252; font-size:12px; padding:12px;">Could not connect to community repository.</div>';
    }
  }

  private renderMapList(maps: MapSummaryItem[]): void {
    this.mapsContainer.innerHTML = '';

    if (maps.length === 0) {
      this.mapsContainer.innerHTML = '<div style="color:#78909c; font-size:12px; padding:12px; text-align:center;">No community maps found. Be the first to publish one above!</div>';
      return;
    }

    for (const m of maps) {
      const item = document.createElement('div');
      item.style.background = 'rgba(255, 255, 255, 0.04)';
      item.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      item.style.borderRadius = '6px';
      item.style.padding = '10px 14px';
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';

      item.innerHTML = `
        <div>
          <div style="font-weight:bold; font-size:14px; color:#fff;">${m.name}</div>
          <div style="font-size:11px; color:#90a4ae;">By: <span style="color:#00ffcc;">${m.author}</span> | Voxels: ${m.blockCount} | ❤️ ${m.likes} Likes</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-like-map" style="padding:6px 10px; background:#263238; border:1px solid #37474f; border-radius:4px; color:#fff; cursor:pointer; font-size:11px;">❤️ Like</button>
          <button class="btn-play-map" style="padding:6px 14px; background:#00e676; border:none; border-radius:4px; color:#000; font-weight:bold; cursor:pointer; font-size:12px;">Play Map</button>
        </div>
      `;

      const likeBtn = item.querySelector('.btn-like-map') as HTMLButtonElement;
      const playBtn = item.querySelector('.btn-play-map') as HTMLButtonElement;

      likeBtn.onclick = async () => {
        likeBtn.disabled = true;
        await fetch(`/api/maps/${m.id}/like`, { method: 'POST' });
        m.likes++;
        likeBtn.innerText = `❤️ ${m.likes}`;
      };

      playBtn.onclick = async () => {
        playBtn.innerText = 'Loading...';
        try {
          const res = await fetch(`/api/maps/${m.id}`);
          const data = await res.json();
          if (res.ok && data.data) {
            this.onLoadMap(data.data);
            this.setVisible(false);
          }
        } catch (e) {
          alert('Failed to load map data');
        }
      };

      this.mapsContainer.appendChild(item);
    }
  }

  public setVisible(v: boolean): void {
    this.visible = v;
    this.overlay.style.display = v ? 'flex' : 'none';
    if (v) {
      document.exitPointerLock();
      this.fetchMaps();
    }
  }
}
