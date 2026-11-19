import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { TICK_RATE } from '../../shared/constants.ts';
import { createInitialPlayerState, UserInput } from '../../shared/physics/PlayerState.ts';
import { WeaponId, getWeaponDef } from '../../shared/combat/Weapons.ts';
import { Team, GameMode } from '../../shared/match/MatchTypes.ts';
import { RoomManager } from './match/RoomManager.ts';
import { ClientSession } from './match/Room.ts';
import { Database } from './db/Database.ts';
import { HttpServer } from './api/HttpServer.ts';
import {
  MessageType,
  PongMessage,
  ShootMessage,
  RoomListMessage,
  CreateRoomMessage,
  JoinRoomMessage,
  AddBotMessage,
  RemoveBotMessage,
  ThrowGrenadeMessage,
  GrenadeExplodeMessage
} from '../../shared/protocol/Messages.ts';
import { VoxelMapData, importMapFromJSON } from '../../shared/world/MapFormat.ts';

export class AuthoritativeServer {
  private httpServer: http.Server;
  private apiServer: HttpServer;
  private wss: WebSocketServer;
  public roomManager: RoomManager;
  public db: Database;

  private clients: Map<string, ClientSession> = new Map();
  private nextPlayerNumber = 1;
  private tickTimer: NodeJS.Timeout | null = null;
  private serverStartTime = Date.now();

  constructor(port = 8080) {
    this.db = new Database();
    this.apiServer = new HttpServer(this.db);
    this.roomManager = new RoomManager();

    // 1. Unified HTTP Server (serves REST API, Static Web Client, and WebSockets)
    this.httpServer = http.createServer((req, res) => {
      this.apiServer.handleRequest(req, res);
    });

    // 2. Attach WebSocket server to the same HTTP server
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.httpServer.listen(port, () => {
      console.log(`[Authoritative Server] Full-Stack Server active on http://localhost:${port} (WebSocket + REST + Static)`);
    });

    this.setupWebSocket();
    this.startFixedTick();
  }

  private getServerTime(): number {
    return Date.now() - this.serverStartTime;
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const playerId = `p_${this.nextPlayerNumber++}`;
      const username = `Player ${this.nextPlayerNumber - 1}`;
      const initialState = createInitialPlayerState(playerId, 0, 6, 0);

      const session: ClientSession = {
        id: playerId,
        username,
        ws,
        state: initialState,
        inputQueue: [],
        lastPingTime: Date.now(),
        health: 100,
        maxHealth: 100,
        activeWeapon: WeaponId.ASSAULT_RIFLE,
        ammoInMag: getWeaponDef(WeaponId.ASSAULT_RIFLE).magazineSize,
        reserveAmmo: getWeaponDef(WeaponId.ASSAULT_RIFLE).reserveAmmo,
        lastShotTime: 0,
        isReloading: false,
        team: Team.NONE,
        kills: 0,
        deaths: 0,
        score: 0,
        ping: 0,
        packetCount: 0,
        lastRateReset: Date.now()
      };

      this.clients.set(playerId, session);

      // Join best available public room by default
      const room = this.roomManager.joinRoom(session);

      ws.on('message', (raw) => {
        const now = Date.now();
        if (!session.lastRateReset || now - session.lastRateReset >= 1000) {
          session.packetCount = 0;
          session.lastRateReset = now;
        }
        session.packetCount = (session.packetCount || 0) + 1;

        // Drop packets over 160 pkts/s; disconnect over 300 pkts/s
        if (session.packetCount > 160) {
          if (session.packetCount > 300) {
            console.warn(`[Anti-Flood] Disconnecting abusive client ${session.id} (${session.packetCount} pkts/s)`);
            ws.close(1008, 'Rate limit exceeded');
          }
          return;
        }

        try {
          const msg = JSON.parse(raw.toString());
          this.handleMessage(session, msg);
        } catch (e) {
          console.warn(`Malformed packet from ${session.id}:`, e);
        }
      });

      ws.on('close', () => {
        // Record stats to DB if player had activity
        if (session.kills > 0 || session.deaths > 0) {
          this.db.recordMatchStats(
            session.username,
            session.kills,
            session.deaths,
            session.score,
            false
          );
        }

        this.roomManager.leaveCurrentRoom(playerId);
        this.clients.delete(playerId);
      });
    });
  }

  private handleMessage(session: ClientSession, msg: { type: number; [key: string]: unknown }): void {
    const room = this.roomManager.getRoomForClient(session.id);

    switch (msg.type) {
      case MessageType.C2S_JOIN: {
        const reqUsername = (msg as { username?: string }).username;
        if (reqUsername && typeof reqUsername === 'string' && reqUsername.trim().length > 0) {
          session.username = reqUsername.trim().substring(0, 16);
          if (room) room.broadcastMatchUpdate();
        }
        break;
      }

      case MessageType.C2S_INPUT: {
        const input = (msg as unknown as { input: UserInput }).input;
        if (room && input) {
          room.handleInput(session, input);
        }
        break;
      }

      case MessageType.C2S_SHOOT: {
        const shoot = msg as unknown as ShootMessage;
        if (room && shoot) {
          room.handleShoot(session, shoot);
        }
        break;
      }

      case MessageType.C2S_BLOCK_EDIT: {
        const edit = msg as unknown as { x: number; y: number; z: number; blockId: number };
        if (room && edit) {
          room.handleBlockEdit(session, edit.x, edit.y, edit.z, edit.blockId);
        }
        break;
      }

      case MessageType.C2S_MAP_LOAD: {
        const mapMsg = msg as unknown as { mapData: VoxelMapData };
        if (room && mapMsg && mapMsg.mapData && Array.isArray(mapMsg.mapData.blocks)) {
          console.log(`[Room ${room.id}] Map update "${mapMsg.mapData.name}" from ${session.username}`);
          importMapFromJSON(room.world, mapMsg.mapData);
          room.broadcast({
            type: MessageType.S2C_MAP_LOAD,
            mapData: mapMsg.mapData
          });
        }
        break;
      }

      case MessageType.C2S_SWITCH_WEAPON: {
        const sw = msg as unknown as { weaponId: WeaponId };
        const def = getWeaponDef(sw.weaponId);
        if (def) {
          session.activeWeapon = def.id;
          session.ammoInMag = def.magazineSize;
          session.reserveAmmo = def.reserveAmmo;
          session.isReloading = false;
        }
        break;
      }

      case MessageType.C2S_PING: {
        const pingMsg = msg as unknown as { clientSendTime: number };
        const pong: PongMessage = {
          type: MessageType.S2C_PONG,
          clientSendTime: pingMsg.clientSendTime || 0,
          serverTime: this.getServerTime()
        };
        session.ws.send(JSON.stringify(pong));
        break;
      }

      case MessageType.C2S_THROW_GRENADE: {
        const tg = msg as unknown as ThrowGrenadeMessage;
        if (room && tg) {
          room.handleThrowGrenade(session, tg);
        }
        break;
      }

      case MessageType.S2C_GRENADE_EXPLODE: {
        const ge = msg as unknown as GrenadeExplodeMessage;
        if (room && ge) {
          room.handleGrenadeExplode(session, ge);
        }
        break;
      }

      // -------------------------------------------------------------
      // ROOM MANAGEMENT & MATCHMAKING
      // -------------------------------------------------------------
      case MessageType.C2S_LIST_ROOMS: {
        const summaries = this.roomManager.getSummaries();
        const res: RoomListMessage = {
          type: MessageType.S2C_ROOM_LIST,
          rooms: summaries
        };
        session.ws.send(JSON.stringify(res));
        break;
      }

      case MessageType.C2S_CREATE_ROOM: {
        const create = msg as unknown as CreateRoomMessage;
        const newRoom = this.roomManager.createRoom(
          create.name || 'Custom Arena',
          create.mode || GameMode.FFA,
          create.mapTemplate || 'arena'
        );
        this.roomManager.joinRoom(session, newRoom.id);
        break;
      }

      case MessageType.C2S_JOIN_ROOM: {
        const join = msg as unknown as JoinRoomMessage;
        this.roomManager.joinRoom(session, join.roomId);
        break;
      }

      // -------------------------------------------------------------
      // AI BOT MANAGEMENT
      // -------------------------------------------------------------
      case MessageType.C2S_ADD_BOT: {
        const botMsg = msg as unknown as AddBotMessage;
        if (room) {
          const count = botMsg.count || 1;
          for (let i = 0; i < count; i++) {
            room.addBot(botMsg.difficulty || 'medium');
          }
        }
        break;
      }

      case MessageType.C2S_REMOVE_BOT: {
        if (room) {
          room.removeBot();
        }
        break;
      }
    }
  }

  private startFixedTick(): void {
    const tickIntervalMs = 1000 / TICK_RATE;

    this.tickTimer = setInterval(() => {
      this.roomManager.tickAll();
    }, tickIntervalMs);
  }

  public stop(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.wss.close();
    this.httpServer.close();
  }
}

// Start server on PORT env or default 8080
const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;
new AuthoritativeServer(port);
