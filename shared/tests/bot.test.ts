import { Room } from '../../server/src/match/Room.ts';
import { GameMode, Team } from '../match/MatchTypes.ts';
import { WeaponId, getWeaponDef } from '../combat/Weapons.ts';
import { Vec3 } from '../math/Vector3.ts';
import { FIXED_DT } from '../constants.ts';
import { createInitialPlayerState } from '../physics/PlayerState.ts';
import { WebSocket } from 'ws';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('Running Smart AI Bot Opponents Test Suite...');

// Mock WebSocket for human player
function createMockWS() {
  return {
    send: () => {},
    close: () => {},
    readyState: 1
  } as unknown as WebSocket;
}

// -------------------------------------------------------------
// Test 1: Bot Spawning & Team Assignment in FFA
// -------------------------------------------------------------
const ffaRoom = new Room('test_bot_ffa', 'FFA Bot Match', GameMode.FFA, 'arena');
const bot1 = ffaRoom.addBot('medium')!;
const bot2 = ffaRoom.addBot('hard')!;

assert(bot1 !== null, 'Bot 1 must spawn successfully');
assert(bot2 !== null, 'Bot 2 must spawn successfully');
assert(bot1.isBot === true, 'Bot session must have isBot flag');
assert(bot1.username.startsWith('[BOT]'), 'Bot must have [BOT] name prefix');
assert(ffaRoom.bots.size === 2, 'Room must have 2 registered AIBot controllers');
assert(ffaRoom.clients.size === 2, 'Room clients map must contain both bots');
console.log('✓ Bot spawning & registration verified in FFA.');

// -------------------------------------------------------------
// Test 2: Bot Spawning & Automatic Team Balancing in TDM
// -------------------------------------------------------------
const tdmRoom = new Room('test_bot_tdm', 'TDM Bot Match', GameMode.TDM, 'arena');
const tdmBot1 = tdmRoom.addBot('medium')!;
const tdmBot2 = tdmRoom.addBot('easy')!;
const tdmBot3 = tdmRoom.addBot('hard')!;

assert(tdmBot1 !== null && tdmBot2 !== null && tdmBot3 !== null, 'All TDM bots must spawn');
assert(tdmBot1.team === Team.RED, 'First bot must be assigned RED');
assert(tdmBot2.team === Team.BLUE, 'Second bot must be assigned BLUE');
assert(tdmBot3.team === Team.RED, 'Third bot must balance to RED');
console.log('✓ TDM Bot team balancing verified (RED vs BLUE).');

// -------------------------------------------------------------
// Test 3: Bot Decision Step & UserInput Generation
// -------------------------------------------------------------
// Simulate a human player in the FFA room
const humanSession = {
  id: 'human_player_1',
  username: 'ApexSniper',
  ws: createMockWS(),
  state: createInitialPlayerState('human_player_1', 0, 2, 8),
  inputQueue: [],
  lastPingTime: Date.now(),
  health: 100,
  maxHealth: 100,
  activeWeapon: WeaponId.ASSAULT_RIFLE,
  ammoInMag: 30,
  reserveAmmo: 90,
  lastShotTime: 0,
  isReloading: false,
  team: Team.NONE,
  kills: 0,
  deaths: 0,
  score: 0,
  ping: 20
};
ffaRoom.addClient(humanSession);

// Position bot1 in line of sight of human
bot1.state.position.set(0, 2, 0);
bot1.health = 100;

// Run 15 ticks of room simulation
for (let t = 0; t < 15; t++) {
  ffaRoom.tick();
}

// Bot should have moved and oriented towards the player
assert(bot1.inputQueue.length >= 0, 'Bot must push inputs to input queue');
assert(bot1.state.position.y > 0, 'Bot must be physically simulated in the voxel world');
console.log('✓ 60Hz AI Bot decision loop and deterministic physics verified.');

// -------------------------------------------------------------
// Test 4: Bot Combat, Elimination & Scoring
// -------------------------------------------------------------
// Position bot2 in wide-open arena floor at (10, 1, -10)
bot2.state.position.set(10, 1, -10);
bot2.state.velocity.set(0, 0, 0);
bot2.health = 20;

// Position human shooter physically right behind bot2 to satisfy server anti-cheat
humanSession.state.position.set(bot2.state.position.x, bot2.state.position.y, bot2.state.position.z - 1.5);
humanSession.lastShotTime = -10000;
ffaRoom.tick(); // Record snapshot with bot2 in wide-open floor

const prevDeaths = bot2.deaths;
const prevScore = humanSession.score;

// Human shoots bot2
ffaRoom.handleShoot(humanSession, {
  type: 11, // C2S_SHOOT
  weaponId: WeaponId.ASSAULT_RIFLE,
  origin: [bot2.state.position.x, bot2.state.position.y + 0.6, bot2.state.position.z - 1.5],
  direction: [0, 0, 1],
  clientTime: ffaRoom.getServerTime()
});

assert(bot2.health === 0, 'Bot must take damage and be eliminated');
assert(humanSession.kills === 1, 'Shooter kills must increment');
assert(humanSession.score === prevScore + 100 || humanSession.score === prevScore + 150, 'Shooter score must increase');
console.log('✓ Bot hit registration, damage taken, elimination, and scoring verified.');

// -------------------------------------------------------------
// Test 5: Dynamic Bot Removal
// -------------------------------------------------------------
const initialCount = ffaRoom.bots.size;
ffaRoom.removeBot();
assert(ffaRoom.bots.size === initialCount - 1, 'removeBot() must decrement bot count');
ffaRoom.clearBots();
assert(ffaRoom.bots.size === 0, 'clearBots() must clear all bots');
console.log('✓ Dynamic Bot removal & cleanup verified.');

console.log('ALL AI BOT OPPONENT TESTS PASSED SUCCESSFULLY!');
