import { UserInput, PlayerState } from '../physics/PlayerState.ts';
import { WeaponId } from '../combat/Weapons.ts';
import {
  GameMode,
  MatchState,
  Team,
  RoomSummary,
  MatchStatusData,
  MatchOverData
} from '../match/MatchTypes.ts';

export enum MessageType {
  C2S_JOIN = 1,
  S2C_WELCOME = 2,
  C2S_INPUT = 3,
  S2C_SNAPSHOT = 4,
  S2C_PLAYER_JOINED = 5,
  S2C_PLAYER_LEFT = 6,
  C2S_BLOCK_EDIT = 7,
  S2C_BLOCK_UPDATE = 8,
  C2S_PING = 9,
  S2C_PONG = 10,

  // Combat Protocol Messages
  C2S_SHOOT = 11,
  C2S_RELOAD = 12,
  C2S_SWITCH_WEAPON = 13,
  S2C_HIT_CONFIRM = 14,
  S2C_DAMAGE_TAKEN = 15,
  S2C_BULLET_TRACER = 16,
  S2C_KILL_FEED = 17,
  S2C_RESPAWN = 18,

  // Map Synchronization Messages
  C2S_MAP_LOAD = 19,
  S2C_MAP_LOAD = 20,

  // Room Management & Matchmaking
  C2S_LIST_ROOMS = 21,
  S2C_ROOM_LIST = 22,
  C2S_CREATE_ROOM = 23,
  C2S_JOIN_ROOM = 24,
  S2C_MATCH_UPDATE = 25,
  S2C_MATCH_OVER = 26,

  // Bot Management Messages
  C2S_ADD_BOT = 27,
  C2S_REMOVE_BOT = 28,

  // Tactical Grenade Messages
  C2S_THROW_GRENADE = 29,
  S2C_GRENADE_SPAWN = 30,
  S2C_GRENADE_EXPLODE = 31
}

export interface JoinMessage {
  type: MessageType.C2S_JOIN;
  username: string;
}

export interface WelcomeMessage {
  type: MessageType.S2C_WELCOME;
  playerId: string;
  initialState: PlayerState;
  serverTick: number;
  serverTime: number;
}

export interface ClientInputMessage {
  type: MessageType.C2S_INPUT;
  input: UserInput;
  clientTime: number;
}

export interface RemotePlayerSnapshot {
  id: string;
  username: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  grounded: boolean;
  crouched: boolean;
  isSliding?: boolean;
  isMantling?: boolean;
  health: number;
  activeWeapon: WeaponId;
  lastSequence: number;
}

export interface ServerSnapshotMessage {
  type: MessageType.S2C_SNAPSHOT;
  tick: number;
  serverTime: number;
  players: RemotePlayerSnapshot[];
}

export interface PlayerJoinedMessage {
  type: MessageType.S2C_PLAYER_JOINED;
  playerId: string;
  username: string;
}

export interface PlayerLeftMessage {
  type: MessageType.S2C_PLAYER_LEFT;
  playerId: string;
}

export interface BlockEditMessage {
  type: MessageType.C2S_BLOCK_EDIT;
  x: number;
  y: number;
  z: number;
  blockId: number;
}

export interface BlockUpdateMessage {
  type: MessageType.S2C_BLOCK_UPDATE;
  x: number;
  y: number;
  z: number;
  blockId: number;
}

export interface PingMessage {
  type: MessageType.C2S_PING;
  clientSendTime: number;
}

export interface PongMessage {
  type: MessageType.S2C_PONG;
  clientSendTime: number;
  serverTime: number;
}

// -------------------------------------------------------------
// COMBAT PROTOCOL MESSAGES
// -------------------------------------------------------------
export interface ShootMessage {
  type: MessageType.C2S_SHOOT;
  weaponId: WeaponId;
  origin: [number, number, number];
  direction: [number, number, number];
  clientTime: number;
}

export interface ReloadMessage {
  type: MessageType.C2S_RELOAD;
  weaponId: WeaponId;
}

export interface SwitchWeaponMessage {
  type: MessageType.C2S_SWITCH_WEAPON;
  weaponId: WeaponId;
}

export interface HitConfirmMessage {
  type: MessageType.S2C_HIT_CONFIRM;
  targetId: string;
  damage: number;
  isHeadshot: boolean;
  targetRemainingHealth: number;
}

export interface DamageTakenMessage {
  type: MessageType.S2C_DAMAGE_TAKEN;
  attackerId: string;
  damage: number;
  currentHealth: number;
}

export interface BulletTracerMessage {
  type: MessageType.S2C_BULLET_TRACER;
  shooterId: string;
  origin: [number, number, number];
  target: [number, number, number];
  isHit: boolean;
}

export interface KillFeedMessage {
  type: MessageType.S2C_KILL_FEED;
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
  weaponId: WeaponId;
  isHeadshot: boolean;
}

export interface RespawnMessage {
  type: MessageType.S2C_RESPAWN;
  playerId: string;
  x: number;
  y: number;
  z: number;
  health: number;
}

export interface MapLoadMessage {
  type: MessageType.C2S_MAP_LOAD | MessageType.S2C_MAP_LOAD;
  mapData: {
    formatVersion: number;
    name: string;
    author: string;
    createdAt: string;
    spawnPoints: [number, number, number][];
    blocks: [number, number, number, number][];
  };
}

export interface ListRoomsMessage {
  type: MessageType.C2S_LIST_ROOMS;
}

export interface RoomListMessage {
  type: MessageType.S2C_ROOM_LIST;
  rooms: RoomSummary[];
}

export interface CreateRoomMessage {
  type: MessageType.C2S_CREATE_ROOM;
  name: string;
  mode: GameMode;
  mapTemplate?: 'arena' | 'warehouse';
}

export interface JoinRoomMessage {
  type: MessageType.C2S_JOIN_ROOM;
  roomId: string;
}

export interface MatchUpdateMessage {
  type: MessageType.S2C_MATCH_UPDATE;
  matchData: MatchStatusData;
}

export interface MatchOverMessage {
  type: MessageType.S2C_MATCH_OVER;
  overData: MatchOverData;
}

export interface AddBotMessage {
  type: MessageType.C2S_ADD_BOT;
  difficulty?: 'easy' | 'medium' | 'hard';
  count?: number;
}

export interface RemoveBotMessage {
  type: MessageType.C2S_REMOVE_BOT;
}

export interface ThrowGrenadeMessage {
  type: MessageType.C2S_THROW_GRENADE;
  origin: [number, number, number];
  velocity: [number, number, number];
}

export interface GrenadeSpawnMessage {
  type: MessageType.S2C_GRENADE_SPAWN;
  id: string;
  throwerId: string;
  origin: [number, number, number];
  velocity: [number, number, number];
}

export interface GrenadeExplodeMessage {
  type: MessageType.S2C_GRENADE_EXPLODE;
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
}
