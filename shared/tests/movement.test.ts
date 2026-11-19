import { Vec3 } from '../math/Vector3.ts';
import { VoxelWorld } from '../world/VoxelWorld.ts';
import { BlockId, FIXED_DT, WALK_SPEED, SPRINT_SPEED, JUMP_VELOCITY, SLIDE_INITIAL_SPEED, MANTLE_IMPULSE_Y } from '../constants.ts';
import { PlayerPhysics } from '../physics/PlayerPhysics.ts';
import { UserInput, createInitialPlayerState } from '../physics/PlayerState.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

function createInput(overrides: Partial<UserInput> = {}): UserInput {
  return {
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
    dt: FIXED_DT,
    ...overrides
  };
}

console.log('Running Advanced Movement Mechanics Test Suite (Slide, BHOP, Mantle, Wall-Jump)...');

// -------------------------------------------------------------
// Test 1: Slide Initiation & High-Speed Impulse
// -------------------------------------------------------------
const world = new VoxelWorld();
world.fillBox(-50, 0, -50, 50, 0, 50, BlockId.CONCRETE); // Clean flat open floor

const state = createInitialPlayerState('test_mover', 0, 1.0, 0);
state.isGrounded = true;

// First sprint forward to build momentum
for (let i = 0; i < 25; i++) {
  const sprintInput = createInput({ sequence: i + 1, forward: true, sprint: true });
  PlayerPhysics.simulate(state, sprintInput, world, FIXED_DT);
}

const speedBeforeSlide = state.velocity.horizontalLength();
assert(speedBeforeSlide > WALK_SPEED, `Player should reach sprint speed, got ${speedBeforeSlide.toFixed(2)}`);

// Now press crouch while sprinting -> triggers Slide!
const slideInput = createInput({ sequence: 16, forward: true, sprint: true, crouch: true });
PlayerPhysics.simulate(state, slideInput, world, FIXED_DT);

assert(state.isSliding === true, 'Player should enter isSliding state');
assert(state.slideTimer > 0, 'Slide timer should be active');
assert(state.slideCooldown > 0, 'Slide cooldown should be active');
const slideSpeed = state.velocity.horizontalLength();
assert(slideSpeed >= SLIDE_INITIAL_SPEED * 0.95, `Slide should surge speed to >= ${SLIDE_INITIAL_SPEED}, got ${slideSpeed.toFixed(2)}`);
console.log(`✓ Slide initiation verified: speed surged to ${slideSpeed.toFixed(2)} m/s.`);

// -------------------------------------------------------------
// Test 2: Low-Friction Slide Glide
// -------------------------------------------------------------
// Simulate 10 ticks of slide
for (let i = 0; i < 10; i++) {
  const maintainSlideInput = createInput({ sequence: 17 + i, forward: true, crouch: true });
  PlayerPhysics.simulate(state, maintainSlideInput, world, FIXED_DT);
}
assert(state.isSliding === true, 'Player should remain in slide while holding crouch');
const glidingSpeed = state.velocity.horizontalLength();
assert(glidingSpeed > SPRINT_SPEED * 0.9, `Slide should glide with low friction, speed: ${glidingSpeed.toFixed(2)}`);
console.log(`✓ Low-friction slide glide verified: speed remains ${glidingSpeed.toFixed(2)} m/s over 10 ticks.`);

// -------------------------------------------------------------
// Test 3: Slide-Hop Momentum Carryover into Air
// -------------------------------------------------------------
// Jump while sliding!
const slideHopInput = createInput({ sequence: 30, forward: true, jump: true });
PlayerPhysics.simulate(state, slideHopInput, world, FIXED_DT);

assert(state.isSliding === false, 'Slide-hop should exit sliding state');
assert(!state.isGrounded, 'Player should be launched airborne');
assert(state.velocity.y > JUMP_VELOCITY, `Vertical velocity should receive slide-hop boost (> ${JUMP_VELOCITY}), got ${state.velocity.y.toFixed(2)}`);
const airHozSpeed = state.velocity.horizontalLength();
assert(airHozSpeed > SPRINT_SPEED, `Horizontal momentum should carry over into air, got ${airHozSpeed.toFixed(2)} m/s`);
console.log(`✓ Slide-Hop verified: vertical launch vy=${state.velocity.y.toFixed(2)}, air speed=${airHozSpeed.toFixed(2)} m/s.`);

// -------------------------------------------------------------
// Test 4: Bunny-Hop (BHOP) Ground Momentum Preservation
// -------------------------------------------------------------
// Reset to floor with high horizontal velocity
const bhopState = createInitialPlayerState('test_bhop', 0, 1.0, 0);
bhopState.velocity.set(0, 0, -12.0); // 12 m/s forward (-Z)
bhopState.isGrounded = true;

// Player jumps on ground
const bhopJumpInput = createInput({ sequence: 1, forward: true, jump: true });
PlayerPhysics.simulate(bhopState, bhopJumpInput, world, FIXED_DT);

assert(!bhopState.isGrounded, 'Player should become airborne from bhop jump');
assert(bhopState.velocity.y >= JUMP_VELOCITY, 'Bhop jump should impart vertical impulse');
const postBhopSpeed = bhopState.velocity.horizontalLength();
assert(postBhopSpeed >= 12.0 * 1.02, `Bhop should preserve and boost momentum (> 12.2), got ${postBhopSpeed.toFixed(2)}`);
console.log(`✓ Bunny-Hop momentum preservation verified: boosted speed to ${postBhopSpeed.toFixed(2)} m/s.`);

// -------------------------------------------------------------
// Test 5: Quake-Style Air-Strafing
// -------------------------------------------------------------
const airState = createInitialPlayerState('test_airstrafe', 0, 5.0, 0); // In midair
airState.velocity.set(0, 0, -10.0); // Moving forward along -Z
airState.isGrounded = false;

// Strafe right (D key) in midair
const strafeInput = createInput({ sequence: 1, right: true });
PlayerPhysics.simulate(airState, strafeInput, world, FIXED_DT);

assert(airState.velocity.x > 0, `Air strafe should generate sideways velocity on X, got ${airState.velocity.x.toFixed(3)}`);
assert(airState.velocity.z < -9.5, `Air strafe should conserve forward velocity, got ${airState.velocity.z.toFixed(2)}`);
console.log(`✓ Air-strafing responsive velocity redirection verified: vx=${airState.velocity.x.toFixed(3)}, vz=${airState.velocity.z.toFixed(2)}.`);

// -------------------------------------------------------------
// Test 6: Ledge Mantle (Vault) Detection
// -------------------------------------------------------------
// Create a 1-block obstacle directly in front of the player
// Player at (20, 1.2, 20) facing -Z (yaw = 0)
// Obstacle at (20, 1, 19)
const mantleWorld = new VoxelWorld();
mantleWorld.generateDefaultArena();
mantleWorld.setBlock(20, 1, 19, BlockId.CRATE); // Obstacle 1 block high at z=19
mantleWorld.setBlock(20, 2, 19, BlockId.AIR);   // Empty air above obstacle
mantleWorld.setBlock(20, 3, 19, BlockId.AIR);

const mantleState = createInitialPlayerState('test_mantle', 20, 1.2, 19.8);
mantleState.yaw = 0; // Facing -Z
mantleState.isGrounded = false; // Jumping / in air
mantleState.velocity.set(0, 1.5, -3.0); // Moving forward towards the crate

const mantleInput = createInput({ sequence: 1, forward: true, jump: true, yaw: 0 });
PlayerPhysics.simulate(mantleState, mantleInput, mantleWorld, FIXED_DT);

assert(mantleState.isMantling === true, 'Player should trigger isMantling when jumping towards climbable ledge');
assert(mantleState.velocity.y >= MANTLE_IMPULSE_Y * 0.9, `Mantle should impart upward vault impulse (>= ${MANTLE_IMPULSE_Y}), got ${mantleState.velocity.y.toFixed(2)}`);

// Simulate vault progression over 12 ticks as player climbs up and over
for (let i = 0; i < 12; i++) {
  PlayerPhysics.simulate(mantleState, createInput({ sequence: 2 + i, forward: true, yaw: 0 }), mantleWorld, FIXED_DT);
}
assert(mantleState.position.y > 2.0, `Player should have vaulted over the 1-block obstacle (y > 2.0), got y=${mantleState.position.y.toFixed(2)}`);
assert(mantleState.position.z < 19.5, `Player should have advanced forward onto the ledge (z < 19.5), got z=${mantleState.position.z.toFixed(2)}`);
console.log(`✓ Ledge Mantle (Vault) verified: climbed onto ledge at y=${mantleState.position.y.toFixed(2)}, z=${mantleState.position.z.toFixed(2)}.`);

// -------------------------------------------------------------
// Test 7: Wall-Jump / Wall-Kick
// -------------------------------------------------------------
// Build a vertical wall at x = 10
world.fillBox(10, 1, -5, 10, 6, 5, BlockId.STONE);

const wallState = createInitialPlayerState('test_walljump', 9.68, 3.0, 0);
wallState.yaw = -Math.PI / 2; // Facing +X towards the wall
wallState.isGrounded = false;
wallState.velocity.set(5.0, 0, 0); // Moving into the wall

// Press jump against the wall
const wallJumpInput = createInput({ sequence: 1, forward: true, jump: true, yaw: -Math.PI / 2 });
PlayerPhysics.simulate(wallState, wallJumpInput, world, FIXED_DT);

assert(wallState.velocity.y > 0, `Wall-jump should bounce vertically upwards, got ${wallState.velocity.y.toFixed(2)}`);
assert(wallState.wallJumpCooldown > 0, 'Wall-jump cooldown should be set');
console.log(`✓ Wall-Jump kick verified: bounced off wall with vy=${wallState.velocity.y.toFixed(2)}, vx=${wallState.velocity.x.toFixed(2)}.`);

console.log('ALL ADVANCED MOVEMENT TESTS PASSED SUCCESSFULLY!');
