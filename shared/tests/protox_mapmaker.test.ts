import { BlockId, FIXED_DT } from '../constants.ts';
import { VoxelWorld } from '../world/VoxelWorld.ts';
import { PlayerPhysics } from '../physics/PlayerPhysics.ts';
import { createInitialPlayerState, UserInput } from '../physics/PlayerState.ts';
import {
  exportMapToJSON,
  importMapFromJSON,
  encodeMapCode,
  decodeMapCode,
  generateProtoxJumpArenaTemplate
} from '../world/MapFormat.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('Running Protox.io Mapmaker & Gameplay Utilities Test Suite...');

const dummyInput: UserInput = {
  sequence: 1,
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  crouch: false,
  sprint: false,
  yaw: 0,
  pitch: 0,
  dt: FIXED_DT
};

// -------------------------------------------------------------
// Test 1: Jump Pad Vertical Launch Impulse
// -------------------------------------------------------------
const world = new VoxelWorld();
// Place a jump pad at (0, 0, 0)
world.setBlock(0, 0, 0, BlockId.JUMP_PAD);

// Player stands directly on top of the jump pad at Y = 1.0
const state = createInitialPlayerState('test_jumper', 0.5, 1.0, 0.5);
state.isGrounded = true;

PlayerPhysics.simulate(state, dummyInput, world, FIXED_DT);

assert(state.onJumpPad === true, 'Player must be detected on jump pad');
assert(state.velocity.y >= 19.0, `Expected vertical velocity ~19.5, got ${state.velocity.y}`);
assert(!state.isGrounded, 'Player launched from jump pad must be airborne');
console.log('✓ Protox Jump Pad vertical spring launch verified (19.5 m/s upward impulse).');

// -------------------------------------------------------------
// Test 2: Speed Boost Pad Acceleration
// -------------------------------------------------------------
world.setBlock(5, 0, 5, BlockId.SPEED_PAD);
const speedState = createInitialPlayerState('test_speeder', 5.5, 1.0, 5.5);
speedState.velocity.set(6.0, 0, 0); // Moving forward at 6 m/s
speedState.isGrounded = true;

PlayerPhysics.simulate(speedState, dummyInput, world, FIXED_DT);
assert(speedState.velocity.x > 6.0, `Expected speed surge > 6.0 m/s, got ${speedState.velocity.x}`);
console.log('✓ Protox Speed Boost Pad horizontal surge verified.');

// -------------------------------------------------------------
// Test 3: Hazard Lava Contact Detection
// -------------------------------------------------------------
world.setBlock(10, 0, 10, BlockId.HAZARD_LAVA);
const lavaState = createInitialPlayerState('test_lava', 10.5, 1.0, 10.5);
lavaState.isGrounded = true;

PlayerPhysics.simulate(lavaState, dummyInput, world, FIXED_DT);
assert(lavaState.isInLava === true, 'Player must be flagged in lava hazard zone');
console.log('✓ Hazard Lava contact detection verified.');

// -------------------------------------------------------------
// Test 3b: Trampoline Bounce Pad & Ice Low-Friction Physics
// -------------------------------------------------------------
world.setBlock(15, 0, 15, BlockId.BOUNCE_PAD);
const bounceState = createInitialPlayerState('test_bouncer', 15.5, 1.0, 15.5);
bounceState.velocity.set(0, -12.0, 0); // Fast downward fall onto trampoline
bounceState.isGrounded = true;

PlayerPhysics.simulate(bounceState, dummyInput, world, FIXED_DT);
assert(bounceState.onJumpPad === true, 'Player must be flagged on bounce pad');
assert(bounceState.velocity.y >= 15.0, `Expected bounce launch vy >= 15.0, got ${bounceState.velocity.y}`);
console.log('✓ Trampoline Bounce Pad upward spring rebound verified.');

world.setBlock(20, 0, 20, BlockId.ICE);
const iceState = createInitialPlayerState('test_ice', 20.5, 1.0, 20.5);
iceState.velocity.set(12.0, 0, 0);
iceState.isGrounded = true;

PlayerPhysics.simulate(iceState, dummyInput, world, FIXED_DT);
assert(iceState.velocity.x > 11.5, `Expected low friction glide > 11.5 m/s, got ${iceState.velocity.x}`);
console.log('✓ Ice low-friction sliding drift verified.');

// -------------------------------------------------------------
// Test 4: Protox Map Code (Single-Line Base64) Encode & Decode
// -------------------------------------------------------------
const testMap = exportMapToJSON(world, 'Protox Test Map', 'Tester', 'cyber');
const mapCode = encodeMapCode(testMap);
assert(typeof mapCode === 'string' && mapCode.length > 0, 'Map Code must be a non-empty string');
assert(!mapCode.includes('\n'), 'Map Code must be a single-line string');

const decodedMap = decodeMapCode(mapCode);
assert(decodedMap.name === 'Protox Test Map', 'Decoded map name must match');
assert(decodedMap.environmentPreset === 'cyber', 'Decoded environment preset must match');
assert(decodedMap.blocks.length === 5, `Expected 5 blocks, got ${decodedMap.blocks.length}`);
console.log('✓ Protox single-line Map Code encode/decode round-trip verified.');

// -------------------------------------------------------------
// Test 5: Protox Neon Jump Arena Template Generation
// -------------------------------------------------------------
const arenaTemplate = generateProtoxJumpArenaTemplate();
assert(arenaTemplate.name === 'Protox Neon Jump Arena', 'Template name must match');
assert(arenaTemplate.environmentPreset === 'dusk', 'Template environment preset must match');
assert(arenaTemplate.blocks.length > 500, `Expected >500 blocks in arena, got ${arenaTemplate.blocks.length}`);

// Verify it contains jump pads and lava
const hasJumpPad = arenaTemplate.blocks.some((b) => b[3] === BlockId.JUMP_PAD);
const hasLava = arenaTemplate.blocks.some((b) => b[3] === BlockId.HAZARD_LAVA);
const hasSpeedPad = arenaTemplate.blocks.some((b) => b[3] === BlockId.SPEED_PAD);
assert(hasJumpPad, 'Template must contain JUMP_PAD blocks');
assert(hasLava, 'Template must contain HAZARD_LAVA blocks');
assert(hasSpeedPad, 'Template must contain SPEED_PAD blocks');
console.log('✓ Protox Neon Jump Arena template verified with Jump Pads, Speed Pads & Lava.');

console.log('ALL PROTOX MAPMAKER TESTS PASSED SUCCESSFULLY!');
