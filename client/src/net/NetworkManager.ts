import { UserInput } from '@shared/physics/PlayerState.ts';
import { WeaponId } from '@shared/combat/Weapons.ts';
import {
  GameMode,
  MatchStatusData,
  MatchOverData,
  RoomSummary,
  Team
} from '@shared/match/MatchTypes.ts';
import {
  MessageType,
  WelcomeMessage,
  ServerSnapshotMessage,
  BlockUpdateMessage,
  PongMessage,
  HitConfirmMessage,
  DamageTakenMessage,
  BulletTracerMessage,
  KillFeedMessage,
  RespawnMessage,
  ShootMessage,
  RoomListMessage,
  MatchUpdateMessage,
  MatchOverMessage,
  ThrowGrenadeMessage,
  GrenadeSpawnMessage,
  GrenadeExplodeMessage
} from '@shared/protocol/Messages.ts';
import { VoxelWorld } from '@shared/world/VoxelWorld.ts';
import { importMapFromJSON, VoxelMapData } from '@shared/world/MapFormat.ts';
import { ChunkRenderer } from '../rendering/ChunkRenderer.ts';
import { LocalPlayer } from '../entities/LocalPlayer.ts';
import { RemotePlayerManager } from '../entities/RemotePlayerManager.ts';
import { TracerManager } from '../rendering/TracerManager.ts';
import { Hitmarker } from '../ui/Hitmarker.ts';
import { KillFeed } from '../ui/KillFeed.ts';
import { DamageIndicator } from '../ui/DamageIndicator.ts';
import { Scoreboard } from '../ui/Scoreboard.ts';
import { MatchBanner } from '../ui/MatchBanner.ts';
import { RoomBrowser } from '../ui/RoomBrowser.ts';
import { SoundFx } from '../audio/SoundFx.ts';
import * as THREE from 'three';

export enum ConnectionStatus {
  DISCONNECTED = 'Disconnected',
  CONNECTING = 'Connecting...',
  CONNECTED = 'Connected'
}

export class NetworkManager {
  private ws: WebSocket | null = null;
  public status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  public localPlayerId: string | null = null;
  public ping = 0; // ms

  private world: VoxelWorld;
  private chunkRenderer: ChunkRenderer;
  private localPlayer: LocalPlayer;
  public remotePlayers: RemotePlayerManager;
  private tracerManager: TracerManager;
  private hitmarker: Hitmarker;
  private killFeed: KillFeed;
  private damageIndicator: DamageIndicator;
  public scoreboard: Scoreboard;
  public matchBanner: MatchBanner;
  public roomBrowser?: RoomBrowser;
  private soundFx: SoundFx;

  private pingInterval: number | null = null;
  public currentServerTime = 0;

  // Local Combat & Match State
  public localTeam: Team = Team.NONE;
  public localHealth = 100;
  public localKills = 0;
  public localDeaths = 0;
  public currentMatchData: MatchStatusData | null = null;

  // Visual & UI Callbacks
  public onDamageTaken?: (damage: number, health: number) => void;
  public onHitConfirm?: (hit: HitConfirmMessage) => void;
  public onLocalKill?: (victim: string, isHeadshot: boolean) => void;
  public onLocalDeath?: (killer: string, weaponId: number) => void;
  public onLocalRespawn?: () => void;
  public onGrenadeSpawn?: (msg: GrenadeSpawnMessage) => void;
  public onGrenadeExplode?: (msg: GrenadeExplodeMessage) => void;
  public activeRooms: RoomSummary[] = [];

  constructor(
    world: VoxelWorld,
    chunkRenderer: ChunkRenderer,
    localPlayer: LocalPlayer,
    remotePlayers: RemotePlayerManager,
    tracerManager: TracerManager,
    hitmarker: Hitmarker,
    killFeed: KillFeed,
    damageIndicator: DamageIndicator,
    scoreboard: Scoreboard,
    matchBanner: MatchBanner,
    soundFx: SoundFx
  ) {
    this.world = world;
    this.chunkRenderer = chunkRenderer;
    this.localPlayer = localPlayer;
    this.remotePlayers = remotePlayers;
    this.tracerManager = tracerManager;
    this.hitmarker = hitmarker;
    this.killFeed = killFeed;
    this.damageIndicator = damageIndicator;
    this.scoreboard = scoreboard;
    this.matchBanner = matchBanner;
    this.soundFx = soundFx;
  }

  public connect(url = 'ws://localhost:8080'): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.status = ConnectionStatus.CONNECTING;
    console.log(`[Network] Connecting to ${url}...`);

    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      console.warn('[Network] Connection failed:', e);
      this.status = ConnectionStatus.DISCONNECTED;
      return;
    }

    this.ws.onopen = () => {
      this.status = ConnectionStatus.CONNECTED;
      console.log('[Network] Connected to authoritative game server.');
      this.startPingLoop();

      // Immediately register with saved or default callsign if available
      try {
        const savedName = localStorage.getItem('voxel_pilot_callsign');
        if (savedName && savedName.trim()) {
          this.sendJoin(savedName.trim());
        }
      } catch {}
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (err) {
        console.warn('[Network] Failed to parse server message:', err);
      }
    };

    this.ws.onclose = () => {
      this.status = ConnectionStatus.DISCONNECTED;
      this.localPlayerId = null;
      console.log('[Network] Disconnected from server. Will retry in 3s...');
      this.stopPingLoop();

      setTimeout(() => {
        this.connect(url);
      }, 3000);
    };

    this.ws.onerror = (err) => {
      console.warn('[Network] WebSocket error:', err);
    };
  }

  private handleMessage(msg: { type: number; [key: string]: unknown }): void {
    switch (msg.type) {
      case MessageType.S2C_WELCOME: {
        const welcome = msg as unknown as WelcomeMessage;
        this.localPlayerId = welcome.playerId;
        this.localPlayer.state.id = welcome.playerId;
        this.localPlayer.state.position.copy(welcome.initialState.position);
        console.log(`[Network] Registered as ${welcome.playerId}. Initial spawn:`, welcome.initialState.position);
        break;
      }

      case MessageType.S2C_SNAPSHOT: {
        const snapshot = msg as unknown as ServerSnapshotMessage;
        this.processSnapshot(snapshot);
        break;
      }

      case MessageType.S2C_BLOCK_UPDATE: {
        const update = msg as unknown as BlockUpdateMessage;
        this.world.setBlock(update.x, update.y, update.z, update.blockId);
        this.chunkRenderer.update(this.world);
        break;
      }

      case MessageType.S2C_PLAYER_LEFT: {
        const left = msg as unknown as { playerId: string };
        this.remotePlayers.removePlayer(left.playerId);
        break;
      }

      case MessageType.S2C_PONG: {
        const pong = msg as unknown as PongMessage;
        const now = performance.now();
        const rtt = now - pong.clientSendTime;
        this.ping = Math.round(this.ping * 0.7 + rtt * 0.3);
        this.currentServerTime = pong.serverTime;
        break;
      }

      // -------------------------------------------------------------
      // COMBAT PACKET HANDLERS
      // -------------------------------------------------------------
      case MessageType.S2C_HIT_CONFIRM: {
        const hit = msg as unknown as HitConfirmMessage;
        this.hitmarker.show(hit.isHeadshot);
        this.soundFx.playHitmarker(hit.isHeadshot);
        if (this.onHitConfirm) {
          this.onHitConfirm(hit);
        }
        break;
      }

      case MessageType.S2C_DAMAGE_TAKEN: {
        const dmg = msg as unknown as DamageTakenMessage;
        this.localHealth = dmg.currentHealth;
        this.damageIndicator.flash();
        if (this.onDamageTaken) {
          this.onDamageTaken(dmg.damage, dmg.currentHealth);
        }
        break;
      }

      case MessageType.S2C_BULLET_TRACER: {
        const tr = msg as unknown as BulletTracerMessage;
        const originVec = new THREE.Vector3(tr.origin[0], tr.origin[1], tr.origin[2]);
        const targetVec = new THREE.Vector3(tr.target[0], tr.target[1], tr.target[2]);
        this.tracerManager.addTracer(originVec, targetVec, tr.isHit);

        // If another player/bot fired, play 3D spatial gunshot!
        if (tr.shooterId !== this.localPlayerId) {
          this.soundFx.play3DShoot(tr.origin[0], tr.origin[1], tr.origin[2]);

          // Check for supersonic bullet whizz close to local player camera
          if (this.localPlayer?.camera) {
            const camPos = this.localPlayer.camera.position;
            const line = new THREE.Line3(originVec, targetVec);
            const closestPt = new THREE.Vector3();
            line.closestPointToPoint(camPos, true, closestPt);
            const dist = closestPt.distanceTo(camPos);
            if (dist < 3.2) {
              const proximity = Math.max(0.3, 1.0 - dist / 3.2);
              this.soundFx.playBulletWhiz(proximity);
            }
          }
        }
        break;
      }

      case MessageType.S2C_KILL_FEED: {
        const kf = msg as unknown as KillFeedMessage;
        const isLocalKiller = kf.killerId === this.localPlayerId;
        const isLocalVictim = kf.victimId === this.localPlayerId;

        if (isLocalKiller) {
          this.localKills++;
          this.soundFx.playKill(kf.isHeadshot);
          if (this.onLocalKill) {
            this.onLocalKill(kf.victimName, kf.isHeadshot);
          }
        }
        if (isLocalVictim) {
          this.localDeaths++;
          if (this.onLocalDeath) {
            this.onLocalDeath(kf.killerName, kf.weaponId);
          }
        }

        this.killFeed.addEntry(
          kf.killerName,
          kf.victimName,
          kf.weaponId,
          kf.isHeadshot,
          isLocalKiller,
          isLocalVictim
        );
        break;
      }

      case MessageType.S2C_RESPAWN: {
        const respawn = msg as unknown as RespawnMessage;
        if (respawn.playerId === this.localPlayerId) {
          this.localPlayer.state.position.set(respawn.x, respawn.y, respawn.z);
          this.localPlayer.state.velocity.set(0, 0, 0);
          this.localHealth = respawn.health;
          if (this.onLocalRespawn) {
            this.onLocalRespawn();
          }
        }
        break;
      }

      case MessageType.S2C_MAP_LOAD: {
        const mapMsg = msg as unknown as { mapData: VoxelMapData };
        if (mapMsg && mapMsg.mapData) {
          console.log(`[Map Sync] Received new map from server: "${mapMsg.mapData.name}"`);
          importMapFromJSON(this.world, mapMsg.mapData);
          this.chunkRenderer.update(this.world);
        }
        break;
      }

      // -------------------------------------------------------------
      // MATCH & ROOM PACKET HANDLERS
      // -------------------------------------------------------------
      case MessageType.S2C_MATCH_UPDATE: {
        const mu = msg as unknown as MatchUpdateMessage;
        this.currentMatchData = mu.matchData;
        const myPlayerData = this.currentMatchData.scores.find((p) => p.id === this.localPlayerId);
        if (myPlayerData) {
          this.localTeam = myPlayerData.team;
        }
        for (const p of this.currentMatchData.scores) {
          const rp = this.remotePlayers.players.get(p.id);
          if (rp) {
            rp.team = p.team;
          }
        }
        this.scoreboard.update(this.currentMatchData, this.localPlayerId);
        this.matchBanner.update(this.currentMatchData);
        break;
      }

      case MessageType.S2C_MATCH_OVER: {
        const mo = msg as unknown as MatchOverMessage;
        this.matchBanner.showMatchOver(mo.overData);
        break;
      }

      case MessageType.S2C_GRENADE_SPAWN: {
        const gs = msg as unknown as GrenadeSpawnMessage;
        if (this.onGrenadeSpawn) {
          this.onGrenadeSpawn(gs);
        }
        break;
      }

      case MessageType.S2C_GRENADE_EXPLODE: {
        const ge = msg as unknown as GrenadeExplodeMessage;
        if (this.onGrenadeExplode) {
          this.onGrenadeExplode(ge);
        }
        break;
      }

      case MessageType.S2C_ROOM_LIST: {
        const rl = msg as unknown as RoomListMessage;
        this.activeRooms = rl.rooms;
        if (this.roomBrowser) {
          this.roomBrowser.updateRooms(rl.rooms, this.currentMatchData?.roomId);
        }
        break;
      }
    }
  }

  private processSnapshot(snapshot: ServerSnapshotMessage): void {
    for (const playerSnap of snapshot.players) {
      if (playerSnap.id === this.localPlayerId) {
        // Authoritative reconciliation for the local player
        this.localPlayer.reconcile(playerSnap, this.world);
      } else {
        // Remote player interpolation buffer update
        this.remotePlayers.addSnapshot(playerSnap, snapshot.serverTime);
      }
    }
  }

  public sendJoin(username: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: MessageType.C2S_JOIN,
        username
      })
    );
  }

  public sendInput(input: UserInput): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        type: MessageType.C2S_INPUT,
        input,
        clientTime: performance.now()
      })
    );
  }

  public sendShoot(weaponId: WeaponId, origin: THREE.Vector3, direction: THREE.Vector3): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const msg: ShootMessage = {
      type: MessageType.C2S_SHOOT,
      weaponId,
      origin: [origin.x, origin.y, origin.z],
      direction: [direction.x, direction.y, direction.z],
      clientTime: this.currentServerTime - (this.ping / 2) // Estimated server time when fired
    };
    this.ws.send(JSON.stringify(msg));
  }

  public sendSwitchWeapon(weaponId: WeaponId): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        type: MessageType.C2S_SWITCH_WEAPON,
        weaponId
      })
    );
  }

  public sendReload(weaponId: WeaponId): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        type: MessageType.C2S_RELOAD,
        weaponId
      })
    );
  }

  public requestRoomList(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: MessageType.C2S_LIST_ROOMS }));
  }

  public createRoom(name: string, mode: GameMode, mapTemplate: 'arena' | 'warehouse'): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: MessageType.C2S_CREATE_ROOM,
        name,
        mode,
        mapTemplate
      })
    );
  }

  public joinRoom(roomId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: MessageType.C2S_JOIN_ROOM,
        roomId
      })
    );
  }

  public sendAddBot(difficulty: 'easy' | 'medium' | 'hard' = 'medium', count = 1): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: MessageType.C2S_ADD_BOT,
        difficulty,
        count
      })
    );
  }

  public sendRemoveBot(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: MessageType.C2S_REMOVE_BOT }));
  }

  public sendMapLoad(mapData: VoxelMapData): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        type: MessageType.C2S_MAP_LOAD,
        mapData
      })
    );
  }

  public sendBlockEdit(x: number, y: number, z: number, blockId: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        type: MessageType.C2S_BLOCK_EDIT,
        x,
        y,
        z,
        blockId
      })
    );
  }

  public sendThrowGrenade(origin: THREE.Vector3, velocity: THREE.Vector3): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: MessageType.C2S_THROW_GRENADE,
        origin: [origin.x, origin.y, origin.z],
        velocity: [velocity.x, velocity.y, velocity.z]
      } as ThrowGrenadeMessage)
    );
  }

  public sendGrenadeExplode(x: number, y: number, z: number, id: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: MessageType.S2C_GRENADE_EXPLODE,
        id,
        x,
        y,
        z,
        radius: 2.4
      } as GrenadeExplodeMessage)
    );
  }

  private startPingLoop(): void {
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: MessageType.C2S_PING,
            clientSendTime: performance.now()
          })
        );
      }
    }, 1000);
  }

  private stopPingLoop(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
