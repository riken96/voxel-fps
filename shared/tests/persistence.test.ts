import path from 'path';
import fs from 'fs';
import { Database } from '../../server/src/db/Database.ts';
import { VoxelWorld } from '../world/VoxelWorld.ts';
import { BlockId } from '../constants.ts';
import { exportMapToJSON } from '../world/MapFormat.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('Running Persistence, Auth & Community Maps Test Suite...');

// Use temporary isolated test directory
const testDataDir = path.resolve(process.cwd(), 'data_test_temp');
if (fs.existsSync(testDataDir)) {
  fs.rmSync(testDataDir, { recursive: true, force: true });
}

const db = new Database(testDataDir);

// -------------------------------------------------------------
// Test 1: User Registration & Password Hashing
// -------------------------------------------------------------
const user = db.registerUser('TestViper', 'SecretVoxelPass99');
assert(user !== null, 'User registration should succeed');
assert(user!.username === 'TestViper', 'Username must match');
assert(user!.passwordHash !== 'SecretVoxelPass99', 'Password must be securely hashed');

// Duplicate username prevention
const duplicate = db.registerUser('testviper', 'AnotherPass');
assert(duplicate === null, 'Duplicate username registration must be rejected');
console.log('✓ User registration & duplicate check passed.');

// -------------------------------------------------------------
// Test 2: Authentication & Password Verification
// -------------------------------------------------------------
const validAuth = db.authenticateUser('TestViper', 'SecretVoxelPass99');
assert(validAuth !== null, 'Authentication with valid credentials must succeed');
assert(validAuth!.id === user!.id, 'User ID must match');

const invalidAuth = db.authenticateUser('TestViper', 'WrongPassword!');
assert(invalidAuth === null, 'Authentication with invalid credentials must fail');
console.log('✓ Password authentication and verification passed.');

// -------------------------------------------------------------
// Test 3: Career Stats Recording & Global Leaderboard
// -------------------------------------------------------------
db.recordMatchStats('TestViper', 18, 4, 1850, true);
const updatedUser = db.getUserByUsername('TestViper');
assert(updatedUser !== undefined, 'User must exist');
assert(updatedUser!.kills === 18, `Expected 18 kills, got ${updatedUser!.kills}`);
assert(updatedUser!.deaths === 4, `Expected 4 deaths, got ${updatedUser!.deaths}`);
assert(updatedUser!.wins === 1, `Expected 1 win, got ${updatedUser!.wins}`);
assert(updatedUser!.score === 1850, `Expected 1850 score, got ${updatedUser!.score}`);

// Register a second player for leaderboard test
db.registerUser('SecondPilot', 'pass2');
db.recordMatchStats('SecondPilot', 8, 8, 800, false);

const leaderboard = db.getLeaderboard(10);
assert(leaderboard.length === 2, `Expected 2 leaderboard entries, got ${leaderboard.length}`);
assert(leaderboard[0].username === 'TestViper', 'Highest score must be ranked #1');
assert(leaderboard[0].kd === '4.50', `Expected KD 4.50, got ${leaderboard[0].kd}`);
console.log('✓ Career stats tracking & global leaderboard ranking verified.');

// -------------------------------------------------------------
// Test 4: Community Map Repository Publishing & Retrieval
// -------------------------------------------------------------
const world = new VoxelWorld();
world.setBlock(5, 1, 5, BlockId.NEON_CYAN);
world.setBlock(5, 2, 5, BlockId.NEON_ORANGE);
const mapData = exportMapToJSON(world, 'Neon Fortress', 'TestViper');

const published = db.publishMap('Neon Fortress', 'TestViper', mapData);
assert(published.id.startsWith('map_'), 'Published map must receive unique ID');
assert(published.blockCount === 2, `Expected 2 blocks, got ${published.blockCount}`);

// Search & List
const listAll = db.listMaps();
assert(listAll.length === 1, 'Map must appear in community list');

const searchFound = db.listMaps('fortress');
assert(searchFound.length === 1, 'Search query must find map');

const searchMiss = db.listMaps('nonexistent');
assert(searchMiss.length === 0, 'Search query with no match must return empty');

// Like Map
db.likeMap(published.id);
const likedRecord = db.getMap(published.id);
assert(likedRecord !== undefined, 'Map must exist');
assert(likedRecord!.likes === 1, `Expected 1 like, got ${likedRecord!.likes}`);
assert(likedRecord!.downloads === 1, 'Downloads must increment on fetch');

// Parse dataJSON
const parsedData = JSON.parse(likedRecord!.dataJSON);
assert(parsedData.name === 'Neon Fortress', 'Parsed map name must match');
assert(parsedData.blocks.length === 2, 'Parsed blocks length must match');
console.log('✓ Community map repository publishing, search, likes, and retrieval verified.');

// Cleanup test temp directory
fs.rmSync(testDataDir, { recursive: true, force: true });

console.log('ALL PHASE 6 PERSISTENCE & API TESTS PASSED SUCCESSFULLY!');
