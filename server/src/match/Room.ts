import { WebSocket } from 'ws';
import { FIXED_DT, TICK_RATE, PLAYER_EYE_HEIGHT, PLAYER_CROUCH_EYE_HEIGHT } from '../../../shared/constants.ts';
import { VoxelWorld } from '../../../shared/world/VoxelWorld.ts';
import { importMapFromJSON, generateCyberWarehouseTemplate } from '../../../shared/world/MapFormat.ts';
import { Vec3 } from '../../../shared/math/Vector3.ts';
import {
  PlayerState,
  UserInput,
  createInitialPlayerState
} from '../../../shared/physics/PlayerState.ts';
import { PlayerPhysics } from '../../../shared/physics/PlayerPhysics.ts';
import { WeaponId, getWeaponDef } from '../../../shared/combat/Weapons.ts';
import { LagCompensator } from '../combat/LagCompensator.ts';
import {
  GameMode,
  MatchState,
  Team,
  PlayerScore,
  RoomSummary,
  MatchStatusData,
  MatchOverData
} from '../../../shared/match/MatchTypes.ts';
import {
  MessageType,
  WelcomeMessage,
  ServerSnapshotMessage,
  RemotePlayerSnapshot,
  PongMessage,
  ShootMessage,
  HitConfirmMessage,
  DamageTakenMessage,
  BulletTracerMessage,
  KillFeedMessage,
  RespawnMessage,
  MatchUpdateMessage,
  MatchOverMessage,
  ThrowGrenadeMessage,
  GrenadeSpawnMessage,
  GrenadeExplodeMessage
} from '../../../shared/protocol/Messages.ts';
import { AIBot, BotDifficulty } from '../bot/AIBot.ts';

export interface ClientSession {
  id: string;
  username: string;
  ws: WebSocket;
  state: PlayerState;
  inputQueue: UserInput[];
  lastPingTime: number;

  // Combat Stats
  health: number;
  maxHealth: number;
  activeWeapon: WeaponId;
  ammoInMag: number;
  reserveAmmo: number;
  lastShotTime: number;
  isReloading: boolean;

  // Match / Score Stats
  team: Team;
  kills: number;
  deaths: number;
  score: number;
  ping: number;
  isBot?: boolean;

  // Anti-Cheat & Flood Protection
  packetCount?: number;
  lastRateReset?: number;
}

export class Room {
  public readonly id: string;
  public name: string;
  public mode: GameMode;
  public mapName: string;
  public maxPlayers: number;

  public world: VoxelWorld;
  public lagCompensator: LagCompensator;
  public clients: Map<string, ClientSession> = new Map();
  public bots: Map<string, AIBot> = new Map();
  private botCounter = 0;

  // Match State Machine
  public state: MatchState = MatchState.WAITING;
  public timeRemaining = 180; // 3 minutes per round
  public scoreLimit = 25;
  public teamScores = { red: 0, blue: 0 };
  private stateCountdown = 0;

  private tickCount = 0;
  private roomStartTime = Date.now();
  private lastSecondTimer = Date.now();

  constructor(
    id: string,
    name: string,
    mode = GameMode.FFA,
    mapTemplate: 'arena' | 'warehouse' = 'arena',
    maxPlayers = 10
  ) {
    this.id = id;
    this.name = name;
    this.mode = mode;
    this.maxPlayers = maxPlayers;
    this.mapName = mapTemplate === 'warehouse' ? 'Cyber Warehouse' : 'Default Arena';

    this.world = new VoxelWorld();
    if (mapTemplate === 'warehouse') {
      importMapFromJSON(this.world, generateCyberWarehouseTemplate());
    } else {
      this.world.generateDefaultArena();
    }

    this.lagCompensator = new LagCompensator();
    this.scoreLimit = mode === GameMode.TDM ? 35 : 25;
  }

  public getServerTime(): number {
    return Date.now() - this.roomStartTime;
  }

  public getSummary(): RoomSummary {
    return {
      id: this.id,
      name: this.name,
      mode: this.mode,
      mapName: this.mapName,
      playerCount: this.clients.size,
      maxPlayers: this.maxPlayers,
      state: this.state,
      timeRemaining: this.timeRemaining
    };
  }

  private getRandomSpawnPoint(): [number, number, number] {
    const spots: [number, number, number][] = [
      [0, 6, 0],
      [-14, 3, -14],
      [14, 3, 14],
      [-16, 3, 16],
      [16, 3, -16]
    ];
    return spots[Math.floor(Math.random() * spots.length)];
  }

  public addClient(session: ClientSession): void {
    // 1. Team Assignment
    if (this.mode === GameMode.TDM) {
      let redCount = 0;
      let blueCount = 0;
      for (const [, c] of this.clients) {
        if (c.team === Team.RED) redCount++;
        else if (c.team === Team.BLUE) blueCount++;
      }
      session.team = redCount <= blueCount ? Team.RED : Team.BLUE;
    } else {
      session.team = Team.NONE;
    }

    const spawn = this.getRandomSpawnPoint();
    session.state.position.set(spawn[0], spawn[1], spawn[2]);
    session.state.velocity.set(0, 0, 0);
    session.health = 100;

    this.clients.set(session.id, session);
    console.log(`[Room ${this.id}] ${session.username} joined (${session.team === Team.RED ? 'RED' : session.team === Team.BLUE ? 'BLUE' : 'FFA'}). Players: ${this.clients.size}/${this.maxPlayers}`);

    // Welcome packet
    const welcome: WelcomeMessage = {
      type: MessageType.S2C_WELCOME,
      playerId: session.id,
      initialState: session.state,
      serverTick: this.tickCount,
      serverTime: this.getServerTime()
    };
    session.ws.send(JSON.stringify(welcome));

    // Notify other players
    this.broadcast(
      {
        type: MessageType.S2C_PLAYER_JOINED,
        playerId: session.id,
        username: session.username
      },
      session.id
    );

    // Check match start condition
    if (this.state === MatchState.WAITING && this.clients.size >= 1) {
      this.state = MatchState.PLAYING;
      this.timeRemaining = 180;
    }

    this.broadcastMatchUpdate();
  }

  public removeClient(playerId: string): void {
    this.bots.delete(playerId);
    this.clients.delete(playerId);
    console.log(`[Room ${this.id}] Player ${playerId} left. Remaining: ${this.clients.size}`);

    this.broadcast({
      type: MessageType.S2C_PLAYER_LEFT,
      playerId
    });

    if (this.clients.size === 0) {
      this.state = MatchState.WAITING;
      this.timeRemaining = 180;
    }

    this.broadcastMatchUpdate();
  }

  public addBot(difficulty: BotDifficulty = 'medium', weaponId?: WeaponId): ClientSession | null {
    if (this.clients.size >= this.maxPlayers) return null;

    this.botCounter++;
    const botNames = [
      'Viper', 'Apex', 'Striker', 'Shadow', 'Cyber',
      'Phantom', 'Titan', 'Nova', 'Blitz', 'Valkyrie',
      'Specter', 'Echo', 'Raptor', 'Havoc', 'Zero'
    ];
    const nameIndex = (this.botCounter - 1) % botNames.length;
    const botName = `[BOT] ${botNames[nameIndex]}`;
    const botId = `bot_${Date.now()}_${this.botCounter}`;

    const weapons = [
      WeaponId.ASSAULT_RIFLE,
      WeaponId.ASSAULT_RIFLE,
      WeaponId.SNIPER_RIFLE,
      WeaponId.SHOTGUN,
      WeaponId.PISTOL
    ];
    const chosenWeapon = weaponId || weapons[this.botCounter % weapons.length];
    const def = getWeaponDef(chosenWeapon);

    // Dummy WebSocket for Bot session (safe no-op send)
    const mockWS = {
      readyState: 1, // WebSocket.OPEN
      send: () => {},
      close: () => {},
      on: () => {},
      once: () => {},
      removeListener: () => {}
    } as unknown as WebSocket;

    const botSession: ClientSession = {
      id: botId,
      username: botName,
      ws: mockWS,
      state: createInitialPlayerState(botId, 0, 8, 0),
      inputQueue: [],
      lastPingTime: Date.now(),
      health: 100,
      maxHealth: 100,
      activeWeapon: chosenWeapon,
      ammoInMag: def.magazineSize,
      reserveAmmo: def.reserveAmmo,
      lastShotTime: 0,
      isReloading: false,
      team: Team.NONE,
      kills: 0,
      deaths: 0,
      score: 0,
      ping: Math.floor(Math.random() * 12 + 8),
      isBot: true,
      packetCount: 0,
      lastRateReset: Date.now()
    };

    this.addClient(botSession);
    const bot = new AIBot(botSession, this, difficulty);
    this.bots.set(botId, bot);

    console.log(`[Room ${this.id}] Added AI Bot ${botName} (${difficulty.toUpperCase()}) with ${def.name}`);
    return botSession;
  }

  public removeBot(botId?: string): void {
    if (botId) {
      if (this.bots.has(botId)) {
        this.bots.delete(botId);
        this.removeClient(botId);
      }
    } else {
      // Remove latest bot in room
      const lastKey = Array.from(this.bots.keys()).pop();
      if (lastKey) {
        this.bots.delete(lastKey);
        this.removeClient(lastKey);
      }
    }
  }

  public clearBots(): void {
    for (const botId of Array.from(this.bots.keys())) {
      this.bots.delete(botId);
      this.removeClient(botId);
    }
  }

  public handleInput(session: ClientSession, input: UserInput): void {
    // In post-match screen, lock movement
    if (this.state === MatchState.ENDED) return;

    if (!input || typeof input.sequence !== 'number' || !Number.isFinite(input.sequence)) {
      return;
    }

    // Input sanitization & anti-NaN / overflow enforcement
    const sanitizedYaw = Number.isFinite(input.yaw) ? input.yaw : session.state.yaw;
    const sanitizedPitch = Number.isFinite(input.pitch)
      ? Math.max(-1.55, Math.min(1.55, input.pitch))
      : session.state.pitch;

    const validatedInput: UserInput = {
      sequence: Math.floor(input.sequence),
      forward: Boolean(input.forward),
      backward: Boolean(input.backward),
      left: Boolean(input.left),
      right: Boolean(input.right),
      jump: Boolean(input.jump),
      crouch: Boolean(input.crouch),
      sprint: Boolean(input.sprint),
      yaw: sanitizedYaw,
      pitch: sanitizedPitch,
      dt: FIXED_DT
    };

    if (session.inputQueue.length < 30) {
      session.inputQueue.push(validatedInput);
    }
  }

  public handleBlockEdit(session: ClientSession, x: number, y: number, z: number, blockId: number): void {
    // Structural coordinate & range validation
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z) || !Number.isInteger(blockId)) {
      return;
    }
    if (y < 0 || y >= 64 || blockId < 0 || blockId > 48) {
      return;
    }

    const dx = x - session.state.position.x;
    const dy = y - session.state.position.y;
    const dz = z - session.state.position.z;
    if (dx * dx + dy * dy + dz * dz <= 144) {
      this.world.setBlock(x, y, z, blockId);
      this.broadcast({
        type: MessageType.S2C_BLOCK_UPDATE,
        x,
        y,
        z,
        blockId
      });
    }
  }

  public handleShoot(session: ClientSession, shoot: ShootMessage): void {
    if (session.health <= 0 || this.state === MatchState.ENDED) return;

    const weapon = getWeaponDef(shoot.weaponId || session.activeWeapon);
    const now = this.getServerTime();

    // Strict rate-of-fire enforcement (reject trigger macros / rapid-fire cheats)
    if (now - session.lastShotTime < weapon.fireRateMs * 0.85) return;
    session.lastShotTime = now;

    // Validate bullet origin against player's authoritative server eye position
    const eyeY = session.state.position.y + (session.state.isCrouching ? PLAYER_CROUCH_EYE_HEIGHT : PLAYER_EYE_HEIGHT);
    const authEye = new Vec3(session.state.position.x, eyeY, session.state.position.z);

    let origin = new Vec3(shoot.origin?.[0] ?? authEye.x, shoot.origin?.[1] ?? authEye.y, shoot.origin?.[2] ?? authEye.z);
    if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y) || !Number.isFinite(origin.z) || origin.distanceTo(authEye) > 2.5) {
      origin = authEye;
    }

    let direction = new Vec3(shoot.direction?.[0] ?? 0, shoot.direction?.[1] ?? 0, shoot.direction?.[2] ?? -1);
    if (!Number.isFinite(direction.x) || !Number.isFinite(direction.y) || !Number.isFinite(direction.z) || direction.lengthSq() < 0.001) {
      direction = new Vec3(0, 0, -1);
    } else {
      direction = direction.normalize();
    }

    const shotResult = this.lagCompensator.evaluateShot(
      session.id,
      origin,
      direction,
      shoot.clientTime,
      now,
      this.world,
      weapon
    );

    // Bullet tracer
    this.broadcast({
      type: MessageType.S2C_BULLET_TRACER,
      shooterId: session.id,
      origin: [origin.x, origin.y, origin.z],
      target: [shotResult.hitPoint.x, shotResult.hitPoint.y, shotResult.hitPoint.z],
      isHit: shotResult.hitTargetId !== null
    });

    if (shotResult.hitTargetId) {
      const victim = this.clients.get(shotResult.hitTargetId);
      if (!victim || victim.health <= 0) return;

      // Friendly fire check in TDM
      if (this.mode === GameMode.TDM && victim.team === session.team) {
        return; // Ignore friendly fire
      }

      victim.health = Math.max(0, victim.health - shotResult.damage);

      // Hit confirmation to shooter
      session.ws.send(JSON.stringify({
        type: MessageType.S2C_HIT_CONFIRM,
        targetId: victim.id,
        damage: shotResult.damage,
        isHeadshot: shotResult.isHeadshot,
        targetRemainingHealth: victim.health
      } as HitConfirmMessage));

      // Damage taken to victim
      victim.ws.send(JSON.stringify({
        type: MessageType.S2C_DAMAGE_TAKEN,
        attackerId: session.id,
        damage: shotResult.damage,
        currentHealth: victim.health
      } as DamageTakenMessage));

      // Check elimination
      if (victim.health === 0) {
        session.kills++;
        victim.deaths++;
        const points = shotResult.isHeadshot ? 150 : 100;
        session.score += points;

        if (this.mode === GameMode.TDM) {
          if (session.team === Team.RED) this.teamScores.red++;
          else if (session.team === Team.BLUE) this.teamScores.blue++;
        }

        // Kill feed notice
        this.broadcast({
          type: MessageType.S2C_KILL_FEED,
          killerId: session.id,
          killerName: session.username,
          victimId: victim.id,
          victimName: victim.username,
          weaponId: weapon.id,
          isHeadshot: shotResult.isHeadshot
        } as KillFeedMessage);

        this.broadcastMatchUpdate();

        // Check Match Win Condition
        this.checkWinCondition();

        // Schedule Respawn after 2.5s
        setTimeout(() => {
          if (this.clients.has(victim.id) && this.state !== MatchState.ENDED) {
            const respawnSpot = this.getRandomSpawnPoint();
            victim.health = victim.maxHealth;
            victim.state.position.set(respawnSpot[0], respawnSpot[1], respawnSpot[2]);
            victim.state.velocity.set(0, 0, 0);

            this.broadcast({
              type: MessageType.S2C_RESPAWN,
              playerId: victim.id,
              x: respawnSpot[0],
              y: respawnSpot[1],
              z: respawnSpot[2],
              health: victim.health
            } as RespawnMessage);
          }
        }, 2500);
      }
    }
  }

  public handleThrowGrenade(session: ClientSession, msg: ThrowGrenadeMessage): void {
    if (session.health <= 0 || this.state === MatchState.ENDED) return;
    const gId = `g_${session.id}_${Date.now()}`;
    this.broadcast({
      type: MessageType.S2C_GRENADE_SPAWN,
      id: gId,
      throwerId: session.id,
      origin: msg.origin,
      velocity: msg.velocity
    } as GrenadeSpawnMessage, session.id);
  }

  public handleGrenadeExplode(session: ClientSession, msg: GrenadeExplodeMessage): void {
    const x = msg.x;
    const y = msg.y;
    const z = msg.z;
    const radius = msg.radius || 2.4;

    // 1. Carve physical crater in server voxel world
    const rx = Math.ceil(radius);
    const ry = Math.ceil(radius);
    const rz = Math.ceil(radius);
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);
    const rSq = radius * radius;

    for (let dx = -rx; dx <= rx; dx++) {
      for (let dy = -ry; dy <= ry; dy++) {
        for (let dz = -rz; dz <= rz; dz++) {
          if (dx * dx + dy * dy + dz * dz <= rSq) {
            const cur = this.world.getBlock(bx + dx, by + dy, bz + dz);
            if (cur !== 0) { // AIR
              this.world.setBlock(bx + dx, by + dy, bz + dz, 0);
            }
          }
        }
      }
    }

    // 2. Blast splash damage falloff to players & bots
    const blastCenter = new Vec3(x, y, z);
    const maxDamage = 120;
    const damageRadius = 5.2;

    for (const [, victim] of this.clients) {
      if (victim.health <= 0) continue;
      // Friendly fire check in TDM
      if (this.mode === GameMode.TDM && victim.team === session.team && victim.id !== session.id) {
        continue;
      }

      const dist = blastCenter.distanceTo(victim.state.position);
      if (dist <= damageRadius) {
        const falloff = 1.0 - (dist / damageRadius);
        const dmg = Math.round(maxDamage * falloff);
        if (dmg > 0) {
          victim.health = Math.max(0, victim.health - dmg);

          victim.ws.send(JSON.stringify({
            type: MessageType.S2C_DAMAGE_TAKEN,
            attackerId: session.id,
            damage: dmg,
            currentHealth: victim.health
          } as DamageTakenMessage));

          if (victim.id !== session.id) {
            session.ws.send(JSON.stringify({
              type: MessageType.S2C_HIT_CONFIRM,
              targetId: victim.id,
              damage: dmg,
              isHeadshot: false,
              targetRemainingHealth: victim.health
            } as HitConfirmMessage));
          }

          if (victim.health === 0) {
            if (victim.id !== session.id) {
              session.kills++;
              session.score += 100;
              if (this.mode === GameMode.TDM) {
                if (session.team === Team.RED) this.teamScores.red++;
                else if (session.team === Team.BLUE) this.teamScores.blue++;
              }
            }
            victim.deaths++;

            this.broadcast({
              type: MessageType.S2C_KILL_FEED,
              killerId: session.id,
              killerName: session.username,
              victimId: victim.id,
              victimName: victim.username,
              weaponId: 1,
              isHeadshot: false
            } as KillFeedMessage);

            this.broadcastMatchUpdate();
            this.checkWinCondition();

            setTimeout(() => {
              if (this.clients.has(victim.id) && this.state !== MatchState.ENDED) {
                const respawnSpot = this.getRandomSpawnPoint();
                victim.health = victim.maxHealth;
                victim.state.position.set(respawnSpot[0], respawnSpot[1], respawnSpot[2]);
                victim.state.velocity.set(0, 0, 0);

                this.broadcast({
                  type: MessageType.S2C_RESPAWN,
                  playerId: victim.id,
                  x: respawnSpot[0],
                  y: respawnSpot[1],
                  z: respawnSpot[2],
                  health: victim.health
                } as RespawnMessage);
              }
            }, 2500);
          }
        }
      }
    }

    // 3. Broadcast detonation event to all other clients in room
    this.broadcast({
      type: MessageType.S2C_GRENADE_EXPLODE,
      id: msg.id,
      x,
      y,
      z,
      radius
    } as GrenadeExplodeMessage, session.id);
  }

  private checkWinCondition(): void {
    if (this.state !== MatchState.PLAYING) return;

    let matchWon = false;
    let winnerId: string | null = null;
    let winnerName = '';
    let winningTeam = Team.NONE;

    if (this.mode === GameMode.TDM) {
      if (this.teamScores.red >= this.scoreLimit) {
        matchWon = true;
        winningTeam = Team.RED;
        winnerName = 'RED TEAM';
      } else if (this.teamScores.blue >= this.scoreLimit) {
        matchWon = true;
        winningTeam = Team.BLUE;
        winnerName = 'BLUE TEAM';
      }
    } else {
      // FFA: check individual kills
      for (const [, c] of this.clients) {
        if (c.kills >= this.scoreLimit) {
          matchWon = true;
          winnerId = c.id;
          winnerName = c.username;
          break;
        }
      }
    }

    if (matchWon || this.timeRemaining <= 0) {
      this.endMatch(winnerId, winnerName, winningTeam);
    }
  }

  private endMatch(winnerId: string | null, winnerName: string, winningTeam: Team): void {
    this.state = MatchState.ENDED;
    this.stateCountdown = 10; // 10s podium

    // Find MVP (highest score)
    let mvp: PlayerScore | null = null;
    let highestScore = -1;
    const scores = this.getPlayerScores();

    for (const s of scores) {
      if (s.score > highestScore) {
        highestScore = s.score;
        mvp = s;
      }
    }

    if (!winnerName && mvp) {
      winnerName = mvp.username;
      winnerId = mvp.id;
    }

    const overData: MatchOverData = {
      winnerId,
      winnerName: winnerName || 'Draw',
      winningTeam,
      mvp,
      scores,
      nextRoundCountdown: this.stateCountdown
    };

    this.broadcast({
      type: MessageType.S2C_MATCH_OVER,
      overData
    } as MatchOverMessage);

    console.log(`[Room ${this.id}] Match Over! Winner: ${winnerName}. Next round in 10s.`);
  }

  public getPlayerScores(): PlayerScore[] {
    const list: PlayerScore[] = [];
    for (const [, c] of this.clients) {
      list.push({
        id: c.id,
        username: c.username,
        team: c.team,
        kills: c.kills,
        deaths: c.deaths,
        score: c.score,
        ping: c.ping
      });
    }
    return list.sort((a, b) => b.score - a.score);
  }

  public broadcastMatchUpdate(): void {
    const matchData: MatchStatusData = {
      roomId: this.id,
      roomName: this.name,
      mode: this.mode,
      state: this.state,
      timeRemaining: this.timeRemaining,
      scoreLimit: this.scoreLimit,
      scores: this.getPlayerScores(),
      teamScores: this.teamScores
    };

    this.broadcast({
      type: MessageType.S2C_MATCH_UPDATE,
      matchData
    } as MatchUpdateMessage);
  }

  public tick(): void {
    this.tickCount++;
    const now = Date.now();
    const currentServerTime = this.getServerTime();

    // 1. One-second match timer countdown
    if (now - this.lastSecondTimer >= 1000) {
      this.lastSecondTimer = now;

      if (this.state === MatchState.PLAYING) {
        this.timeRemaining--;
        if (this.timeRemaining <= 0) {
          this.checkWinCondition();
        }
        this.broadcastMatchUpdate();
      } else if (this.state === MatchState.ENDED) {
        this.stateCountdown--;
        if (this.stateCountdown <= 0) {
          // Restart next round!
          this.restartRound();
        }
      }
    }

    // 1b. AI Bot Decision Step (60Hz Tick)
    for (const [, bot] of this.bots) {
      const botInput = bot.update(FIXED_DT);
      bot.session.inputQueue.push(botInput);
    }

    // 2. Authoritative physics step
    const activePlayerRecords: Array<{ id: string; pos: Vec3; crouched: boolean }> = [];

    for (const [, session] of this.clients) {
      if (session.health > 0) {
        const count = Math.min(session.inputQueue.length, 4);
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            const input = session.inputQueue.shift();
            if (input) {
              PlayerPhysics.simulate(session.state, input, this.world, FIXED_DT);
            }
          }
        } else {
          const idleInput: UserInput = {
            sequence: session.state.lastSequenceProcessed,
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            crouch: session.state.isCrouching,
            sprint: false,
            yaw: session.state.yaw,
            pitch: session.state.pitch,
            dt: FIXED_DT
          };
          PlayerPhysics.simulate(session.state, idleInput, this.world, FIXED_DT);
        }

        activePlayerRecords.push({
          id: session.id,
          pos: session.state.position,
          crouched: session.state.isCrouching
        });
      }
    }

    // 3. Lag Compensator tick record
    this.lagCompensator.recordTick(this.tickCount, currentServerTime, activePlayerRecords);

    // 4. Snapshot broadcasting (30Hz)
    if (this.tickCount % 2 === 0) {
      this.broadcastSnapshot();
    }
  }

  private restartRound(): void {
    this.state = MatchState.PLAYING;
    this.timeRemaining = 180;
    this.teamScores = { red: 0, blue: 0 };

    for (const [, c] of this.clients) {
      c.kills = 0;
      c.deaths = 0;
      c.score = 0;
      c.health = 100;
      const spot = this.getRandomSpawnPoint();
      c.state.position.set(spot[0], spot[1], spot[2]);
      c.state.velocity.set(0, 0, 0);

      this.broadcast({
        type: MessageType.S2C_RESPAWN,
        playerId: c.id,
        x: spot[0],
        y: spot[1],
        z: spot[2],
        health: c.health
      });
    }

    this.broadcastMatchUpdate();
    console.log(`[Room ${this.id}] New round started!`);
  }

  private broadcastSnapshot(): void {
    if (this.clients.size === 0) return;

    const playersList: RemotePlayerSnapshot[] = Array.from(this.clients.values()).map((s) => ({
      id: s.id,
      username: s.username,
      x: s.state.position.x,
      y: s.state.position.y,
      z: s.state.position.z,
      vx: s.state.velocity.x,
      vy: s.state.velocity.y,
      vz: s.state.velocity.z,
      yaw: s.state.yaw,
      pitch: s.state.pitch,
      grounded: s.state.isGrounded,
      crouched: s.state.isCrouching,
      isSliding: s.state.isSliding,
      isMantling: s.state.isMantling,
      health: s.health,
      activeWeapon: s.activeWeapon,
      lastSequence: s.state.lastSequenceProcessed
    }));

    const snapshot: ServerSnapshotMessage = {
      type: MessageType.S2C_SNAPSHOT,
      tick: this.tickCount,
      serverTime: this.getServerTime(),
      players: playersList
    };

    this.broadcast(snapshot);
  }

  public broadcast(data: object, excludeId?: string): void {
    const json = JSON.stringify(data);
    for (const [id, session] of this.clients) {
      if (id !== excludeId && session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(json);
      }
    }
  }
}
