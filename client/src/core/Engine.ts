import * as THREE from 'three';
import { FIXED_DT, BlockId, PLAYER_WIDTH, PLAYER_HEIGHT } from '@shared/constants.ts';
import { VoxelWorld } from '@shared/world/VoxelWorld.ts';
import { Ray, VoxelRaycastHit } from '@shared/math/Ray.ts';
import { Vec3 } from '@shared/math/Vector3.ts';
import { AABB } from '@shared/math/AABB.ts';
import { WeaponId, WeaponDefinition, getWeaponDef } from '@shared/combat/Weapons.ts';
import { ChunkRenderer } from '../rendering/ChunkRenderer.ts';
import { VoxelHighlight } from '../rendering/VoxelHighlight.ts';
import { WeaponRenderer } from '../rendering/WeaponRenderer.ts';
import { TracerManager } from '../rendering/TracerManager.ts';
import { EnvironmentManager } from '../rendering/EnvironmentManager.ts';
import { MapEditor, BrushType } from '../editor/MapEditor.ts';
import { EditorUI } from '../ui/EditorUI.ts';
import { Scoreboard } from '../ui/Scoreboard.ts';
import { MatchBanner } from '../ui/MatchBanner.ts';
import { RoomBrowser } from '../ui/RoomBrowser.ts';
import { AuthModal } from '../ui/AuthModal.ts';
import { CommunityMapsModal } from '../ui/CommunityMapsModal.ts';
import { InputManager } from './InputManager.ts';
import { LocalPlayer } from '../entities/LocalPlayer.ts';
import { RemotePlayerManager } from '../entities/RemotePlayerManager.ts';
import { NetworkManager } from '../net/NetworkManager.ts';
import { SoundFx } from '../audio/SoundFx.ts';
import { Crosshair } from '../ui/Crosshair.ts';
import { DebugOverlay } from '../ui/DebugOverlay.ts';
import { Hitmarker } from '../ui/Hitmarker.ts';
import { KillFeed } from '../ui/KillFeed.ts';
import { DamageIndicator } from '../ui/DamageIndicator.ts';
import { DamageVignette } from '../ui/DamageVignette.ts';
import { EliminationBanner } from '../ui/EliminationBanner.ts';
import { DeathScreen } from '../ui/DeathScreen.ts';
import { SettingsModal, GameSettings } from '../ui/SettingsModal.ts';
import { LoadoutModal, PlayerLoadout } from '../ui/LoadoutModal.ts';
import { CreativeInventoryModal } from '../ui/CreativeInventoryModal.ts';
import { BLOCK_DEFINITIONS } from '@shared/world/BlockTypes.ts';
import { PostProcessingManager } from '../rendering/PostProcessingManager.ts';
import { ParticleManager } from '../rendering/ParticleManager.ts';
import { Minimap } from '../ui/Minimap.ts';
import { KillstreakAnnouncer } from '../ui/KillstreakAnnouncer.ts';
import { GrenadeManager } from '../entities/GrenadeManager.ts';

export enum PlayMode {
  COMBAT = 1,
  BUILD = 2
}

export class Engine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  public world: VoxelWorld;
  public chunkRenderer: ChunkRenderer;
  public voxelHighlight: VoxelHighlight;

  public inputManager: InputManager;
  public localPlayer: LocalPlayer;
  public remotePlayers: RemotePlayerManager;
  public networkManager: NetworkManager;
  public soundFx: SoundFx;
  public crosshair: Crosshair;
  public debugOverlay: DebugOverlay;

  // Environment & Atmosphere
  public environmentManager: EnvironmentManager;

  // Post-Processing & Screen Effects
  public postProcessing: PostProcessingManager;
  public damageVignette: DamageVignette;
  public eliminationBanner: EliminationBanner;
  public deathScreen: DeathScreen;
  public settingsModal: SettingsModal;
  public loadoutModal: LoadoutModal;
  public creativeInventoryModal: CreativeInventoryModal;
  public cameraTrauma = 0;

  // Map Editor Systems
  public mapEditor: MapEditor;
  public editorUI: EditorUI;

  // Combat Systems
  public weaponRenderer: WeaponRenderer;
  public tracerManager: TracerManager;
  public particleManager: ParticleManager;
  public hitmarker: Hitmarker;
  public killFeed: KillFeed;
  public damageIndicator: DamageIndicator;
  public killstreakAnnouncer: KillstreakAnnouncer;
  public minimap: Minimap;
  public grenadeManager: GrenadeManager;

  // Match & Lobby Systems
  public scoreboard: Scoreboard;
  public matchBanner: MatchBanner;
  public roomBrowser: RoomBrowser;
  public authModal: AuthModal;
  public communityMapsModal: CommunityMapsModal;

  public playMode: PlayMode = PlayMode.COMBAT;
  public currentWeapon: WeaponDefinition;
  public ammoInMag: number;
  public reserveAmmo: number;
  private lastFireTime = 0;
  private lastGrenadeTime = 0;
  private prevMouseDown0 = false;

  private activeBlockId = BlockId.CONCRETE;
  private currentRaycastHit: VoxelRaycastHit | null = null;
  private lastActionTime = 0;

  // HUD DOM Elements
  private healthValueEl: HTMLElement | null = null;
  private healthBarFillEl: HTMLElement | null = null;
  private ammoValueEl: HTMLElement | null = null;
  private ammoLabelEl: HTMLElement | null = null;
  private paletteBarEl: HTMLElement | null = null;

  // Fixed timestep loop timing
  private lastTime = performance.now();
  private accumulator = 0;
  private isRunning = true;

  constructor(container: HTMLElement) {
    // 1. Three.js Scene & Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x141d2b);
    this.scene.fog = new THREE.FogExp2(0x141d2b, 0.012);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      82,
      window.innerWidth / window.innerHeight,
      0.05,
      500
    );
    // CRITICAL: The camera MUST be in the scene for its children (WeaponRenderer viewmodels) to render!
    this.scene.add(this.camera);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    // 4. HDR Post-Processing Pipeline (Bloom & ACES Tone Mapping)
    this.postProcessing = new PostProcessingManager(this.renderer, this.scene, this.camera);

    // 5. Stylized Lighting & Protox Atmosphere Engine
    this.environmentManager = new EnvironmentManager(this.scene);

    // 6. Shared Core Systems & Entities
    this.world = new VoxelWorld();
    this.world.generateDefaultArena();

    this.chunkRenderer = new ChunkRenderer(this.scene);
    this.chunkRenderer.update(this.world);

    this.voxelHighlight = new VoxelHighlight(this.scene);
    this.soundFx = new SoundFx();

    this.inputManager = new InputManager(this.renderer.domElement);
    this.localPlayer = new LocalPlayer(this.camera, this.soundFx);
    this.remotePlayers = new RemotePlayerManager(this.scene);

    // 7. Combat & Visual Systems
    this.crosshair = new Crosshair(container);
    this.debugOverlay = new DebugOverlay(container);
    this.tracerManager = new TracerManager(this.scene);
    this.particleManager = new ParticleManager(this.scene);
    this.weaponRenderer = new WeaponRenderer(this.camera);
    this.hitmarker = new Hitmarker(container);
    this.killFeed = new KillFeed(container);
    this.damageIndicator = new DamageIndicator(container);
    this.damageVignette = new DamageVignette(container);
    this.eliminationBanner = new EliminationBanner(container);
    this.killstreakAnnouncer = new KillstreakAnnouncer(container);
    this.killstreakAnnouncer.onAnnounceSound = (soundType) => {
      this.soundFx.playMultikillFanfare(soundType);
    };
    this.minimap = new Minimap(container);
    this.grenadeManager = new GrenadeManager(this.scene, this.particleManager, this.soundFx);
    this.grenadeManager.onExplodeBroadcast = (x, y, z, id) => {
      this.chunkRenderer.update(this.world);
      this.networkManager.sendGrenadeExplode(x, y, z, id);
    };

    this.currentWeapon = getWeaponDef(WeaponId.ASSAULT_RIFLE);
    this.ammoInMag = this.currentWeapon.magazineSize;
    this.reserveAmmo = this.currentWeapon.reserveAmmo;

    // 8. Match & Scoreboard Systems
    this.scoreboard = new Scoreboard(container);
    this.matchBanner = new MatchBanner(container);
    this.deathScreen = new DeathScreen(container, () => {
      this.respawnLocalPlayer();
    });
    this.settingsModal = new SettingsModal(container, (settings) => {
      this.applySettings(settings);
    });
    this.applySettings(this.settingsModal.settings);

    this.roomBrowser = new RoomBrowser(
      container,
      (roomId) => this.networkManager.joinRoom(roomId),
      (name, mode, map) => this.networkManager.createRoom(name, mode, map)
    );
    this.roomBrowser.onAddBot = (difficulty, count) => {
      this.networkManager.sendAddBot(difficulty, count);
      this.soundFx.playLand();
    };
    this.roomBrowser.onRemoveBot = () => {
      this.networkManager.sendRemoveBot();
      this.soundFx.playShoot();
    };

    // 9. Auth & Community Maps Systems
    this.authModal = new AuthModal(container, (user) => {
      console.log('[Auth] Signed in as:', user.username);
    });
    this.communityMapsModal = new CommunityMapsModal(
      container,
      this.world,
      (mapData) => {
        this.chunkRenderer.update(this.world);
        this.networkManager.sendMapLoad(mapData);
      }
    );

    // 10. In-Game Map Editor Systems
    this.mapEditor = new MapEditor(this.scene);
    this.editorUI = new EditorUI(
      container,
      this.mapEditor,
      this.world,
      this.chunkRenderer,
      (mapData) => this.networkManager.sendMapLoad(mapData)
    );
    this.editorUI.onAtmosphereChange = (preset) => {
      this.environmentManager.applyPreset(preset);
    };
    this.editorUI.onPlaytestToggle = () => {
      this.togglePlaytestMode();
    };
    this.editorUI.onCursorLockToggle = () => {
      this.inputManager.toggleLock();
    };
    this.editorUI.onBlockSelected = (blockId) => {
      this.weaponRenderer.setHeldBlock(blockId);
      this.soundFx.playLand();
    };
    this.editorUI.onOpenCreativeInventory = () => {
      this.creativeInventoryModal.setVisible(true);
    };
    this.inputManager.onLockChange = (locked) => {
      this.editorUI.setCursorLocked(locked);
    };

    // 10b. Creative Mode Dynamic Hotbar & Inventory Catalog Modal
    this.creativeInventoryModal = new CreativeInventoryModal(container);
    this.creativeInventoryModal.onHotbarChange = (hotbar, activeIndex) => {
      this.updateHudPaletteBar(hotbar, activeIndex);
    };
    this.creativeInventoryModal.onBlockSelected = (blockId) => {
      this.mapEditor.activeBlockId = blockId;
      this.weaponRenderer.setHeldBlock(blockId);
      this.soundFx.playLand();
    };
    this.creativeInventoryModal.onClose = () => {
      if (this.playMode === PlayMode.BUILD) {
        this.inputManager.requestLock();
      }
    };

    // 11. Authoritative Networking Setup
    this.networkManager = new NetworkManager(
      this.world,
      this.chunkRenderer,
      this.localPlayer,
      this.remotePlayers,
      this.tracerManager,
      this.hitmarker,
      this.killFeed,
      this.damageIndicator,
      this.scoreboard,
      this.matchBanner,
      this.soundFx
    );
    this.networkManager.roomBrowser = this.roomBrowser;

    // Wire Combat Feedback Handlers
    this.networkManager.onHitConfirm = (hit) => {
      const target = this.remotePlayers.players.get(hit.targetId);
      if (target) {
        this.particleManager.spawnHitSplatter(target.group.position, hit.isHeadshot);
      }
    };
    this.networkManager.onDamageTaken = (dmg, hp) => {
      this.damageVignette.triggerDamageFlash();
      this.addCameraShake(0.04);
    };
    this.networkManager.onLocalKill = (victim, isHeadshot) => {
      this.eliminationBanner.showElimination(victim, isHeadshot);
      this.killstreakAnnouncer.recordElimination(victim, isHeadshot);
      this.soundFx.playKill();
    };
    this.networkManager.onLocalDeath = (killer, weaponId) => {
      this.killstreakAnnouncer.resetStreaks();
      this.deathScreen.show(killer, getWeaponDef(weaponId).name);
    };
    this.networkManager.onLocalRespawn = () => {
      this.deathScreen.hide();
    };
    this.networkManager.onGrenadeSpawn = (msg) => {
      const orig = new THREE.Vector3(msg.origin[0], msg.origin[1], msg.origin[2]);
      const vel = new THREE.Vector3(msg.velocity[0], msg.velocity[1], msg.velocity[2]);
      this.grenadeManager.spawnGrenade(orig, vel, false, msg.id);
    };
    this.networkManager.onGrenadeExplode = (msg) => {
      this.grenadeManager.detonate(msg.x, msg.y, msg.z, this.world, this.localPlayer.state.position, (t) => this.addCameraShake(t));
      this.chunkRenderer.update(this.world);
    };

    // Dynamic protocol & host resolution (supports localhost, LAN IP, HTTPS tunnels & cloud hosting)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    let wsPort = window.location.port;

    if (!wsPort || wsPort === '80' || wsPort === '443') {
      // Standard reverse-proxied production / cloud deploy / ngrok tunnel
      wsPort = '';
    } else if (wsPort === '3000') {
      // Vite dev server -> connect to backend port 8080
      wsPort = ':8080';
    } else {
      wsPort = `:${wsPort}`;
    }

    const wsUrl = `${protocol}//${host}${wsPort}`;
    this.networkManager.connect(wsUrl);

    this.loadoutModal = new LoadoutModal(container, (loadout) => {
      this.applyLoadout(loadout);
    });
    this.applyLoadout(this.loadoutModal.loadout);

    this.healthValueEl = document.querySelector('.health-value');
    this.healthBarFillEl = document.querySelector('.health-bar-fill');
    this.ammoValueEl = document.querySelector('.ammo-value');
    this.ammoLabelEl = document.querySelector('.ammo-label');

    this.setupEventHandlers();
    this.startLoop();
  }

  public togglePlaytestMode(): void {
    if (this.playMode === PlayMode.COMBAT) {
      this.playMode = PlayMode.BUILD;
      this.editorUI.setVisible(true);
      this.editorUI.setPlaytestState(false);
      this.weaponRenderer.setMode('build');
      this.weaponRenderer.setHeldBlock(this.mapEditor.activeBlockId);
      this.mapEditor.previewMesh.visible = true;
      return;
    }

    const nextState = !this.editorUI.isPlaytesting;
    this.editorUI.setPlaytestState(nextState);

    if (nextState) {
      // In Playtest: switch viewmodel to combat weapons
      this.weaponRenderer.setMode('combat');
      this.mapEditor.previewMesh.visible = false;
      this.localPlayer.state.velocity.set(0, 0, 0);
    } else {
      // In Editor: switch viewmodel to builder arm + active block
      this.weaponRenderer.setMode('build');
      this.weaponRenderer.setHeldBlock(this.mapEditor.activeBlockId);
      this.mapEditor.previewMesh.visible = true;
    }
  }

  public applySettings(settings: GameSettings): void {
    this.soundFx.setMasterVolume(settings.volume);
    this.inputManager.sensitivity = 0.0022 * settings.sensitivity;
    this.camera.fov = settings.fov;
    this.camera.updateProjectionMatrix();

    // 1. Post-processing Bloom
    this.postProcessing.setBloomEnabled(settings.bloom);

    // 2. Real-time Shadows
    this.renderer.shadowMap.enabled = settings.shadows;

    // 3. Render Resolution Scaling (performance boost on low-spec GPUs)
    const baseRatio = Math.min(window.devicePixelRatio, 2.0);
    const effectiveRatio = Math.max(0.65, Math.min(2.0, baseRatio * (settings.renderScale || 1.0)));
    this.renderer.setPixelRatio(effectiveRatio);

    // 4. Debug stats visibility
    if (this.debugOverlay) {
      this.debugOverlay.setVisible(settings.showStats !== false);
    }
  }

  public applyLoadout(loadout: PlayerLoadout): void {
    this.weaponRenderer.setSkin(loadout.skinId);
    if (this.crosshair) {
      this.crosshair.setStyle(loadout.crosshairStyle);
      this.crosshair.setColor(loadout.crosshairColor);
    }
    if (this.playMode === PlayMode.COMBAT) {
      this.switchWeapon(loadout.primaryWeapon);
    }
  }

  public addCameraShake(amount: number): void {
    this.cameraTrauma = Math.min(0.14, this.cameraTrauma + amount);
  }

  public respawnLocalPlayer(): void {
    const spawns = this.world.findSpawns();
    const spawn = spawns.length > 0 ? spawns[Math.floor(Math.random() * spawns.length)] : [0, 8, 0];
    this.localPlayer.state.position.set(spawn[0], spawn[1] + 0.5, spawn[2]);
    this.localPlayer.state.velocity.set(0, 0, 0);
    this.networkManager.localHealth = 100;
    this.ammoInMag = this.currentWeapon.magazineSize;
    this.reserveAmmo = this.currentWeapon.reserveAmmo;
    this.deathScreen.hide();
  }

  private setupEventHandlers(): void {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.postProcessing.setSize(window.innerWidth, window.innerHeight);
    });

    // Canvas click locks cursor if no modal is open
    this.renderer.domElement.addEventListener('click', () => {
      const isAnyModalOpen = this.settingsModal.visible ||
        this.roomBrowser.visible ||
        this.communityMapsModal.visible ||
        this.authModal.visible ||
        (this.loadoutModal && this.loadoutModal.visible) ||
        (this.creativeInventoryModal && this.creativeInventoryModal.visible);

      if (!isAnyModalOpen && !this.inputManager.isLocked) {
        // In Combat mode, click captures pointer
        if (this.playMode === PlayMode.COMBAT || this.editorUI.isPlaytesting) {
          this.inputManager.requestLock();
        }
      }
    });

    // Hook Community Maps button from editor toolbar
    setTimeout(() => {
      const commBtn = document.getElementById('editor-community-maps-btn');
      if (commBtn) {
        commBtn.onclick = () => this.communityMapsModal.setVisible(true);
      }
    }, 100);

    // Initialize HUD Palette Bar
    this.paletteBarEl = document.getElementById('palette-bar');
    this.updateHudPaletteBar();

    // Weapon Switching & Palette selection
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR') {
        this.reloadWeapon();
        return;
      }

      if (e.code === 'Escape') {
        if (this.creativeInventoryModal.visible) {
          this.creativeInventoryModal.setVisible(false);
          return;
        }
      }

      if (e.code === 'KeyE') {
        // Minecraft-style Creative Inventory hotkey
        if (this.creativeInventoryModal.visible) {
          this.creativeInventoryModal.setVisible(false);
          if (this.playMode === PlayMode.BUILD) {
            this.inputManager.requestLock();
          }
        } else if (this.playMode === PlayMode.BUILD) {
          this.creativeInventoryModal.setVisible(true);
        }
        return;
      }

      if (e.code === 'KeyG') {
        if (this.playMode === PlayMode.COMBAT || (this.playMode === PlayMode.BUILD && this.editorUI.isPlaytesting)) {
          this.throwTacticalGrenade();
        }
        return;
      }

      if (e.code === 'KeyK') {
        this.settingsModal.setVisible(!this.settingsModal.visible);
        if (this.settingsModal.visible) this.inputManager.exitLock();
        return;
      }

      if (e.code === 'KeyL') {
        this.loadoutModal.setVisible(!this.loadoutModal.visible);
        if (this.loadoutModal.visible) this.inputManager.exitLock();
        return;
      }

      if (e.code === 'KeyM') {
        this.networkManager.requestRoomList();
        this.roomBrowser.setVisible(!this.roomBrowser.visible);
        if (this.roomBrowser.visible) this.inputManager.exitLock();
        return;
      }

      if (e.code === 'KeyO') {
        this.authModal.setVisible(!this.authModal.visible);
        if (this.authModal.visible) this.inputManager.exitLock();
        return;
      }

      if (e.code === 'F4') {
        this.networkManager.sendAddBot('medium', 1);
        this.soundFx.playLand();
        return;
      }

      if (e.code === 'KeyH') {
        this.togglePlaytestMode();
        return;
      }

      if (e.code === 'KeyB') {
        // Toggle Combat vs Build mode
        this.playMode = this.playMode === PlayMode.COMBAT ? PlayMode.BUILD : PlayMode.COMBAT;
        const isBuild = this.playMode === PlayMode.BUILD;
        this.editorUI.setVisible(isBuild);
        this.editorUI.setPlaytestState(false);
        if (isBuild) {
          this.weaponRenderer.setMode('build');
          const blockId = this.creativeInventoryModal.getActiveBlock();
          this.mapEditor.activeBlockId = blockId;
          this.weaponRenderer.setHeldBlock(blockId);
        } else {
          this.weaponRenderer.setMode('combat');
        }
        this.mapEditor.previewMesh.visible = isBuild;
        this.voxelHighlight.mesh.visible = false;
        this.updateHudPaletteBar();
        return;
      }

      // Eyedropper shortcut in Build mode
      if (e.code === 'KeyQ' && this.playMode === PlayMode.BUILD) {
        if (this.currentRaycastHit && this.currentRaycastHit.hit) {
          const hitBlock = this.currentRaycastHit.blockId;
          this.mapEditor.activeBlockId = hitBlock;
          this.creativeInventoryModal.hotbar[this.creativeInventoryModal.activeSlotIndex] = hitBlock;
          this.creativeInventoryModal.renderHotbar();
          this.weaponRenderer.setHeldBlock(hitBlock);
          this.updateHudPaletteBar(this.creativeInventoryModal.hotbar, this.creativeInventoryModal.activeSlotIndex);
          this.soundFx.playLand();
        }
        return;
      }

      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        if (this.playMode === PlayMode.BUILD) {
          // In Build Mode: Keys 1..9 select Hotbar slots 0..8
          const slotIndex = num - 1;
          this.creativeInventoryModal.setActiveSlot(slotIndex);
          const selectedBlock = this.creativeInventoryModal.getActiveBlock();
          this.mapEditor.activeBlockId = selectedBlock;
          this.weaponRenderer.setHeldBlock(selectedBlock);
          this.updateHudPaletteBar(this.creativeInventoryModal.hotbar, slotIndex);
          this.soundFx.playLand();
        } else {
          // In Combat Mode: Keys 1..4 switch primary weapons
          if (num >= 1 && num <= 4) {
            const weaponMap = [
              WeaponId.ASSAULT_RIFLE,
              WeaponId.SNIPER_RIFLE,
              WeaponId.SHOTGUN,
              WeaponId.PISTOL
            ];
            this.switchWeapon(weaponMap[num - 1]);
            this.updateHudPaletteBar();
          }
        }
      }
    });
  }

  /**
   * Updates the in-game bottom HUD Quickbar to dynamically reflect either
   * the 9-slot Creative Hotbar (in Build Mode) or the Combat loadout (in Combat Mode).
   */
  public updateHudPaletteBar(hotbar?: BlockId[], activeIndex?: number): void {
    if (!this.paletteBarEl) return;
    const bar = this.paletteBarEl;
    bar.innerHTML = '';

    if (this.playMode === PlayMode.BUILD) {
      const currentHotbar = hotbar || (this.creativeInventoryModal ? this.creativeInventoryModal.hotbar : []);
      const currentActive = activeIndex !== undefined ? activeIndex : (this.creativeInventoryModal ? this.creativeInventoryModal.activeSlotIndex : 0);

      for (let i = 0; i < 9; i++) {
        const slotId = currentHotbar[i] !== undefined ? currentHotbar[i] : BlockId.AIR;
        const def = BLOCK_DEFINITIONS[slotId];
        const isSlotActive = (i === currentActive);

        const slot = document.createElement('div');
        slot.className = `palette-slot${isSlotActive ? ' active' : ''}`;
        slot.setAttribute('data-slot', String(i + 1));
        slot.title = def ? `${def.name} [Key ${i + 1}] (Press E for full inventory)` : `Empty [Key ${i + 1}]`;

        if (def && slotId !== BlockId.AIR) {
          const [r, g, b] = def.color.map((v) => Math.round(v * 255));
          slot.style.backgroundColor = `rgb(${r},${g},${b})`;
          if (def.emissive) {
            slot.style.boxShadow = `inset 0 0 8px rgba(255,255,255,0.4), 0 0 10px rgb(${r},${g},${b})`;
          }
          slot.innerHTML = `<span>${i + 1}</span><span style="font-size:7px;max-width:32px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${def.name.slice(0, 5)}</span>`;
        } else {
          slot.style.backgroundColor = 'rgba(255,255,255,0.06)';
          slot.innerHTML = `<span>${i + 1}</span>`;
        }

        slot.onclick = () => {
          this.creativeInventoryModal.setActiveSlot(i);
          const block = this.creativeInventoryModal.getActiveBlock();
          this.mapEditor.activeBlockId = block;
          this.weaponRenderer.setHeldBlock(block);
          this.updateHudPaletteBar(this.creativeInventoryModal.hotbar, i);
          this.soundFx.playLand();
        };

        bar.appendChild(slot);
      }
    } else {
      // Combat Mode: 4 primary weapon slots + preview of creative hotbar
      const weapons = [
        { id: WeaponId.ASSAULT_RIFLE, label: '1-AR', col: '#37474f' },
        { id: WeaponId.SNIPER_RIFLE, label: '2-SNP', col: '#263238' },
        { id: WeaponId.SHOTGUN, label: '3-SG', col: '#455a64' },
        { id: WeaponId.PISTOL, label: '4-PST', col: '#546e7a' }
      ];

      weapons.forEach((w, idx) => {
        const isActive = this.currentWeapon && this.currentWeapon.id === w.id;
        const slot = document.createElement('div');
        slot.className = `palette-slot${isActive ? ' active' : ''}`;
        slot.style.backgroundColor = w.col;
        slot.title = `${w.label} [Key ${idx + 1}]`;
        slot.innerHTML = `<span>${w.label}</span>`;
        slot.onclick = () => {
          this.switchWeapon(w.id);
          this.updateHudPaletteBar();
        };
        bar.appendChild(slot);
      });

      // Quick-access preview for slots 5..9
      const currentHotbar = this.creativeInventoryModal ? this.creativeInventoryModal.hotbar : [];
      for (let i = 4; i < 9; i++) {
        const slotId = currentHotbar[i] !== undefined ? currentHotbar[i] : BlockId.AIR;
        const def = BLOCK_DEFINITIONS[slotId];
        const slot = document.createElement('div');
        slot.className = 'palette-slot';
        slot.setAttribute('data-slot', String(i + 1));
        slot.title = def ? `${def.name} (Click to enter Build Mode)` : 'Empty';

        if (def && slotId !== BlockId.AIR) {
          const [r, g, b] = def.color.map((v) => Math.round(v * 255));
          slot.style.backgroundColor = `rgb(${r},${g},${b})`;
          slot.innerHTML = `<span>${i + 1}</span>`;
        } else {
          slot.style.backgroundColor = 'rgba(255,255,255,0.06)';
          slot.innerHTML = `<span>${i + 1}</span>`;
        }

        slot.onclick = () => {
          this.playMode = PlayMode.BUILD;
          this.editorUI.setVisible(true);
          this.weaponRenderer.setMode('build');
          this.creativeInventoryModal.setActiveSlot(i);
          const block = this.creativeInventoryModal.getActiveBlock();
          this.mapEditor.activeBlockId = block;
          this.weaponRenderer.setHeldBlock(block);
          this.updateHudPaletteBar(this.creativeInventoryModal.hotbar, i);
          this.soundFx.playLand();
        };

        bar.appendChild(slot);
      }
    }
  }

  public throwTacticalGrenade(): void {
    const now = performance.now();
    if (now - this.lastGrenadeTime < 3200) return; // 3.2s cooldown
    this.lastGrenadeTime = now;

    const forward = this.localPlayer.getForwardVector();
    const camPos = this.camera.position;
    const origin = new THREE.Vector3(
      camPos.x + forward.x * 0.5,
      camPos.y + forward.y * 0.5,
      camPos.z + forward.z * 0.5
    );
    const vel = new THREE.Vector3(
      forward.x * 17.5,
      forward.y * 17.5 + 4.5,
      forward.z * 17.5
    );

    this.grenadeManager.spawnGrenade(origin, vel, true);
    this.networkManager.sendThrowGrenade(origin, vel);
    this.soundFx.playLand();
  }

  private switchWeapon(id: WeaponId): void {
    this.currentWeapon = getWeaponDef(id);
    if (this.weaponRenderer) {
      this.weaponRenderer.setWeapon(id);
    }
    this.ammoInMag = this.currentWeapon.magazineSize;
    this.reserveAmmo = this.currentWeapon.reserveAmmo;
    if (this.networkManager) {
      this.networkManager.sendSwitchWeapon(id);
    }

    if (this.ammoLabelEl) {
      this.ammoLabelEl.innerText = this.currentWeapon.name.toUpperCase();
    }
    this.updateHudPaletteBar();
  }

  private reloadWeapon(): void {
    if (this.weaponRenderer.isReloading || this.ammoInMag === this.currentWeapon.magazineSize || this.reserveAmmo <= 0) {
      return;
    }
    this.weaponRenderer.startReload();
    this.soundFx.playReload();
    this.networkManager.sendReload(this.currentWeapon.id);

    setTimeout(() => {
      const needed = this.currentWeapon.magazineSize - this.ammoInMag;
      const transfer = Math.min(needed, this.reserveAmmo);
      this.ammoInMag += transfer;
      this.reserveAmmo -= transfer;
    }, this.currentWeapon.reloadTimeMs);
  }

  private handleWeaponCombat(now: number, dt: number): void {
    const isAnyModalOpen =
      this.settingsModal.visible ||
      this.roomBrowser.visible ||
      this.communityMapsModal.visible ||
      this.authModal.visible ||
      (this.loadoutModal && this.loadoutModal.visible) ||
      (this.creativeInventoryModal && this.creativeInventoryModal.visible);

    if (isAnyModalOpen) return;

    const canUseCombat = this.playMode === PlayMode.COMBAT || (this.playMode === PlayMode.BUILD && this.editorUI.isPlaytesting);

    // Right-click ADS zoom
    const isRightDown = this.inputManager.isMouseButtonDown(2);
    this.weaponRenderer.isADS = isRightDown && canUseCombat;

    const targetFOV = this.weaponRenderer.isADS
      ? 82 * this.currentWeapon.adsZoom
      : 82;
    this.camera.fov += (targetFOV - this.camera.fov) * Math.min(1, dt * 14);
    this.camera.updateProjectionMatrix();

    if (!canUseCombat) return;

    const isLeftDown = this.inputManager.isMouseButtonDown(0);

    // Automatically request pointer lock when firing in combat
    if ((isLeftDown || isRightDown) && !this.inputManager.isLocked) {
      this.inputManager.requestLock();
    }

    const shouldFire = this.currentWeapon.isAutomatic
      ? isLeftDown
      : isLeftDown && !this.prevMouseDown0;

    this.prevMouseDown0 = isLeftDown;

    if (shouldFire && !this.weaponRenderer.isReloading) {
      if (now - this.lastFireTime >= this.currentWeapon.fireRateMs) {
        if (this.ammoInMag > 0) {
          this.fireWeapon(now);
        } else {
          // Auto-reload on dry fire
          this.reloadWeapon();
        }
      }
    }
  }

  private fireWeapon(now: number): void {
    this.lastFireTime = now;
    this.ammoInMag--;

    // 1. Trigger visual recoil & audio
    this.weaponRenderer.triggerFireRecoil();
    this.soundFx.playShoot(this.currentWeapon.id, this.weaponRenderer.isADS);

    // 2. Camera recoil kick & trauma shake
    this.localPlayer.state.pitch += this.currentWeapon.recoilPitch;
    this.addCameraShake(this.currentWeapon.recoilPitch * 0.4);

    // 3. Compute bullet ray direction with spread
    const camPos = this.camera.position;
    const forward = this.localPlayer.getForwardVector();
    const muzzleWorldPos = this.weaponRenderer.getMuzzleWorldPosition();

    for (let p = 0; p < this.currentWeapon.pelletCount; p++) {
      let spreadX = (Math.random() - 0.5) * this.currentWeapon.spread;
      let spreadY = (Math.random() - 0.5) * this.currentWeapon.spread;

      // In ADS, spread is tightened by 60%
      if (this.weaponRenderer.isADS) {
        spreadX *= 0.4;
        spreadY *= 0.4;
      }

      const dir = new THREE.Vector3(forward.x + spreadX, forward.y + spreadY, forward.z).normalize();

      // 4. Send authoritative shoot packet to server
      this.networkManager.sendShoot(this.currentWeapon.id, camPos, dir);

      // 5. Client prediction tracer beam & bullet impact particles
      const localRay = new Ray(new Vec3(camPos.x, camPos.y, camPos.z), new Vec3(dir.x, dir.y, dir.z));
      const voxelHit = this.world.raycast(localRay, this.currentWeapon.range);
      const hitTargetPoint = voxelHit.hit
        ? new THREE.Vector3(voxelHit.hitPoint.x, voxelHit.hitPoint.y, voxelHit.hitPoint.z)
        : new THREE.Vector3().addVectors(camPos, dir.clone().multiplyScalar(this.currentWeapon.range));

      this.tracerManager.addTracer(muzzleWorldPos, hitTargetPoint, false);

      if (voxelHit.hit) {
        const norm = new THREE.Vector3(voxelHit.faceNormal.x, voxelHit.faceNormal.y, voxelHit.faceNormal.z);
        this.particleManager.spawnBulletImpact(hitTargetPoint, norm, voxelHit.blockId);
      }
    }
  }

  private handleVoxelInteraction(): void {
    if (this.playMode !== PlayMode.BUILD || this.editorUI.isPlaytesting) return;
    if (!this.currentRaycastHit) return;

    const now = performance.now();
    // 160ms debounce between continuous placement/removal clicks
    if (now - this.lastActionTime < 160) return;

    const hit = this.currentRaycastHit;
    if (!hit.hit) return;

    // Left Click: Erase with active brush
    if (this.inputManager.isMouseButtonDown(0)) {
      this.lastActionTime = now;
      this.particleManager.spawnBlockBreak(hit.blockX, hit.blockY, hit.blockZ, hit.blockId);
      this.mapEditor.erase(hit, this.world, this.chunkRenderer, (x, y, z, id) => {
        this.networkManager.sendBlockEdit(x, y, z, id);
      });
      this.weaponRenderer.triggerSwingAnimation('break');
      this.soundFx.playShoot();
      return;
    }

    // Right Click: Place with active brush / Box Fill
    if (this.inputManager.isMouseButtonDown(2)) {
      this.lastActionTime = now;
      const targetX = hit.blockX + hit.faceNormal.x;
      const targetY = hit.blockY + hit.faceNormal.y;
      const targetZ = hit.blockZ + hit.faceNormal.z;
      this.particleManager.spawnBlockPlace(targetX, targetY, targetZ, this.mapEditor.activeBlockId);
      this.mapEditor.place(hit, this.world, this.chunkRenderer, (x, y, z, id) => {
        this.networkManager.sendBlockEdit(x, y, z, id);
      });
      this.weaponRenderer.triggerSwingAnimation('place');
      this.soundFx.playLand();
    }
  }

  private performRaycast(): void {
    const camPos = this.camera.position;
    const forward = this.localPlayer.getForwardVector();

    const origin = new Vec3(camPos.x, camPos.y, camPos.z);
    const direction = new Vec3(forward.x, forward.y, forward.z);
    const ray = new Ray(origin, direction);

    this.currentRaycastHit = this.world.raycast(ray, 16.0);
    if (this.playMode === PlayMode.BUILD && !this.editorUI.isPlaytesting) {
      this.mapEditor.updatePreview(this.currentRaycastHit, this.inputManager.isMouseButtonDown(2));
    } else {
      this.mapEditor.previewMesh.visible = false;
    }
  }

  private startLoop(): void {
    const loop = (currentTime: number) => {
      if (!this.isRunning) return;
      requestAnimationFrame(loop);

      const frameDelta = Math.min((currentTime - this.lastTime) / 1000, 0.1);
      this.lastTime = currentTime;
      this.accumulator += frameDelta;

      // 1. Fixed Timestep Physics Loop (Guaranteed 60Hz deterministic tick)
      while (this.accumulator >= FIXED_DT) {
        const inputSnapshot = this.inputManager.getSnapshot(FIXED_DT);
        const isFlyMode = this.playMode === PlayMode.BUILD && !this.editorUI.isPlaytesting;

        // Local client prediction (Noclip fly or FPS movement)
        this.localPlayer.fixedUpdate(inputSnapshot, this.world, FIXED_DT, isFlyMode);

        // Transmit sequenced input to authoritative server when in physics mode
        if (!isFlyMode) {
          this.networkManager.sendInput(inputSnapshot);
        }

        this.accumulator -= FIXED_DT;
      }

      // 2. Alpha interpolation factor for buttery visual rendering
      const alpha = this.accumulator / FIXED_DT;

      // 3. Update Camera, 3D Audio Listener & View
      this.localPlayer.updateCamera(alpha, frameDelta);
      this.soundFx.updateListener(this.camera);

      // 4. Update Remote Player Avatar Snapshot Interpolation & Animations
      this.remotePlayers.update(this.networkManager.currentServerTime, frameDelta);

      // 5. Combat Systems & Weapons
      this.handleWeaponCombat(currentTime, frameDelta);
      const hozSpeed = this.localPlayer.state.velocity.horizontalLength();
      this.weaponRenderer.update(frameDelta, hozSpeed, this.localPlayer.state.isGrounded);
      this.tracerManager.update(frameDelta);
      this.hitmarker.update(frameDelta);
      this.damageIndicator.update(frameDelta);

      // 6. Raycasting for Block Aim & Editor
      this.performRaycast();
      this.handleVoxelInteraction();

      // 7. Update UI, Reticle & HUD
      this.crosshair.update(hozSpeed, this.localPlayer.state.isGrounded, frameDelta);
      this.debugOverlay.update(
        this.localPlayer.state,
        this.chunkRenderer.totalChunks,
        this.chunkRenderer.totalTriangles,
        this.currentRaycastHit,
        this.networkManager.status,
        this.networkManager.ping,
        this.remotePlayers.getCount(),
        this.localPlayer.reconciliationCorrections
      );

      // 8. Update Protox Mapmaker Inspector
      if (this.playMode === PlayMode.BUILD) {
        const hit = this.currentRaycastHit;
        const cx = hit && hit.hit ? hit.blockX : Math.floor(this.localPlayer.state.position.x);
        const cy = hit && hit.hit ? hit.blockY : Math.floor(this.localPlayer.state.position.y);
        const cz = hit && hit.hit ? hit.blockZ : Math.floor(this.localPlayer.state.position.z);
        this.editorUI.updateInspector(cx, cy, cz, Math.round(this.chunkRenderer.totalTriangles / 2));
      }

      // Sync Health & Ammo HUD elements
      if (this.healthValueEl) {
        this.healthValueEl.innerText = String(this.networkManager.localHealth);
      }
      if (this.healthBarFillEl) {
        const hpPct = Math.max(0, Math.min(100, this.networkManager.localHealth));
        this.healthBarFillEl.style.width = `${hpPct}%`;
        if (hpPct <= 25) {
          this.healthBarFillEl.style.background = '#ff1744';
        } else if (hpPct <= 50) {
          this.healthBarFillEl.style.background = '#ff9100';
        } else {
          this.healthBarFillEl.style.background = 'linear-gradient(90deg, #00e676, #69f0ae)';
        }
      }
      if (this.ammoValueEl) {
        this.ammoValueEl.innerText = this.weaponRenderer.isReloading
          ? 'RELOADING'
          : `${this.ammoInMag} / ${this.reserveAmmo}`;
      }

      // 9. Camera Trauma Shake Decay & Application
      if (this.cameraTrauma > 0.001) {
        this.cameraTrauma = Math.max(0, this.cameraTrauma - frameDelta * 3.5);
        const shakePitch = (Math.random() - 0.5) * this.cameraTrauma;
        const shakeYaw = (Math.random() - 0.5) * this.cameraTrauma;
        this.camera.rotation.x += shakePitch;
        this.camera.rotation.y += shakeYaw;
      }

      // 10. Update Screen Effects, Particles & Feedback UI
      this.particleManager.update(frameDelta);
      this.grenadeManager.update(frameDelta, this.world, this.localPlayer.state.position, (t) => this.addCameraShake(t));
      this.minimap.update(frameDelta, this.localPlayer, this.remotePlayers, this.world, this.networkManager.localTeam);
      this.killstreakAnnouncer.update(frameDelta);
      this.damageVignette.update(this.networkManager.localHealth, frameDelta);
      this.eliminationBanner.update(frameDelta);
      this.deathScreen.update(frameDelta);

      // 11. Render Scene via HDR Post-Processing (Unreal Bloom & ACES Tonemapping)
      this.postProcessing.render();
    };

    requestAnimationFrame(loop);
  }

  public dispose(): void {
    this.isRunning = false;
    this.chunkRenderer.dispose();
    this.voxelHighlight.dispose();
    this.remotePlayers.dispose();
    this.tracerManager.dispose();
    this.particleManager.dispose();
    this.grenadeManager.dispose();
    this.minimap.dispose();
    this.killstreakAnnouncer.dispose();
    this.renderer.dispose();
  }
}
