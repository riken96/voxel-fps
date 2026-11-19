import { Room, ClientSession } from '../../server/src/match/Room.ts';
import { RoomManager } from '../../server/src/match/RoomManager.ts';
import { GameMode, MatchState, Team } from '../match/MatchTypes.ts';
import { createInitialPlayerState } from '../physics/PlayerState.ts';
import { WeaponId, getWeaponDef } from '../combat/Weapons.ts';
import { MessageType, ShootMessage } from '../protocol/Messages.ts';
import { Vec3 } from '../math/Vector3.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('Running Room Management, Matchmaking & Match State Test Suite...');

// Mock WebSocket
function createMockWS() {
  return {
    send: () => {},
    readyState: 1 // OPEN
  } as any;
}

function createMockSession(id: string, name: string): ClientSession {
  return {
    id,
    username: name,
    ws: createMockWS(),
    state: createInitialPlayerState(id, 0, 1, 0),
    inputQueue: [],
    lastPingTime: Date.now(),
    health: 100,
    maxHealth: 100,
    activeWeapon: WeaponId.ASSAULT_RIFLE,
    ammoInMag: 30,
    reserveAmmo: 120,
    lastShotTime: 0,
    isReloading: false,
    team: Team.NONE,
    kills: 0,
    deaths: 0,
    score: 0,
    ping: 20
  };
}

// -------------------------------------------------------------
// Test 1: Room Manager & Multi-room Matchmaking
// -------------------------------------------------------------
const roomManager = new RoomManager();
const summaries = roomManager.getSummaries();
assert(summaries.length >= 3, `Expected at least 3 default rooms, got ${summaries.length}`);

const p1 = createMockSession('p1', 'Alice');
const assignedRoom = roomManager.joinRoom(p1);
assert(assignedRoom !== undefined, 'Player should be assigned to an active room');
assert(assignedRoom.clients.size === 1, 'Room should have 1 player');
console.log(`✓ RoomManager matched player into "${assignedRoom.name}" (${assignedRoom.id}).`);

// -------------------------------------------------------------
// Test 2: Team Deathmatch (TDM) Auto-Balancing
// -------------------------------------------------------------
const tdmRoom = new Room('test_tdm', 'Test TDM Room', GameMode.TDM, 'arena', 8);

const t1 = createMockSession('t1', 'RedLeader');
const t2 = createMockSession('t2', 'BlueLeader');
const t3 = createMockSession('t3', 'RedSoldier');
const t4 = createMockSession('t4', 'BlueSoldier');

tdmRoom.addClient(t1);
assert(t1.team === Team.RED, `First player in TDM should be RED, got ${t1.team}`);

tdmRoom.addClient(t2);
assert(t2.team === Team.BLUE, `Second player in TDM should be BLUE, got ${t2.team}`);

tdmRoom.addClient(t3);
assert(t3.team === Team.RED, `Third player in TDM should balance to RED, got ${t3.team}`);

tdmRoom.addClient(t4);
assert(t4.team === Team.BLUE, `Fourth player in TDM should balance to BLUE, got ${t4.team}`);
console.log('✓ TDM Automatic Team Balancing verified (2 RED vs 2 BLUE).');

// -------------------------------------------------------------
// Test 3: Friendly Fire Prevention in TDM
// -------------------------------------------------------------
// Position shooter and teammate in open courtyard (X = 12)
t1.state.position.set(12, 1, 0);
t2.state.position.set(12, 1, 5);
t3.state.position.set(12, 1, 5);

// Record tick in lag compensator with all room players
const now3 = tdmRoom.getServerTime();
tdmRoom.lagCompensator.recordTick(1, now3, [
  { id: t1.id, pos: t1.state.position, crouched: false },
  { id: t2.id, pos: t2.state.position, crouched: false },
  { id: t3.id, pos: t3.state.position, crouched: false }
]);

const friendlyShot: ShootMessage = {
  type: MessageType.C2S_SHOOT,
  weaponId: WeaponId.ASSAULT_RIFLE,
  origin: [12, 2.55, 0],
  direction: [0, 0, 1],
  clientTime: now3
};

const prevHealth = t3.health;
tdmRoom.handleShoot(t1, friendlyShot);
assert(t3.health === prevHealth, 'Friendly fire must NOT damage teammates in TDM');
console.log('✓ TDM Friendly fire prevention verified.');

// -------------------------------------------------------------
// Test 4: Enemy Damage, Scoring & Win Condition
// -------------------------------------------------------------
t1.lastShotTime = -1000; // Reset weapon cooldown to well in the past
t2.health = 20; // Low health to trigger elimination

const now4 = tdmRoom.getServerTime() + 20;
tdmRoom.lagCompensator.recordTick(2, now4, [
  { id: t1.id, pos: t1.state.position, crouched: false },
  { id: t2.id, pos: t2.state.position, crouched: false },
  { id: t3.id, pos: t3.state.position, crouched: false }
]);

const enemyShot: ShootMessage = {
  type: MessageType.C2S_SHOOT,
  weaponId: WeaponId.ASSAULT_RIFLE,
  origin: [12, 2.55, 0],
  direction: [0, 0, 1],
  clientTime: now4
};

tdmRoom.handleShoot(t1, enemyShot);
assert(t2.health === 0, 'Enemy must take damage and be eliminated');
assert(t1.kills === 1, 'Shooter kills must increment');
assert(t1.score > 0, 'Shooter score must increase');
assert(tdmRoom.teamScores.red === 1, 'Red team score must increment');
console.log(`✓ Enemy elimination & TDM scoring verified (RED: ${tdmRoom.teamScores.red}).`);

// Test Win Condition trigger
tdmRoom.scoreLimit = 2;
tdmRoom.teamScores.red = 2; // Trigger score limit
(tdmRoom as any).checkWinCondition();
assert(tdmRoom.state === MatchState.ENDED, 'Room state must transition to ENDED upon score limit');
console.log('✓ Match win condition & transition to ENDED / Podium verified.');

console.log('ALL PHASE 5 ROOMS & MATCHMAKING TESTS PASSED SUCCESSFULLY!');
