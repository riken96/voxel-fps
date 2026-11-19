import { VoxelWorld } from '../world/VoxelWorld.ts';
import { BlockId, FIXED_DT } from '../constants.ts';
import { PlayerPhysics } from '../physics/PlayerPhysics.ts';
import { createInitialPlayerState, UserInput } from '../physics/PlayerState.ts';
import { RemotePlayerSnapshot } from '../protocol/Messages.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('Running Authoritative Server & Client Reconciliation Test Suite...');

const world = new VoxelWorld();
world.fillBox(-10, 0, -10, 10, 0, 10, BlockId.CONCRETE); // Floor at Y=0

// 1. Initialize Client and Server states at same position
const clientState = createInitialPlayerState('p1', 0, 1, 0);
const serverState = createInitialPlayerState('p1', 0, 1, 0);

const inputs: UserInput[] = [];
for (let seq = 1; seq <= 30; seq++) {
  inputs.push({
    sequence: seq,
    forward: true,
    backward: false,
    left: false,
    right: false,
    jump: false,
    crouch: false,
    sprint: false,
    yaw: 0,
    pitch: 0,
    dt: FIXED_DT
  });
}

// 2. Client predicts all 30 frames
for (const input of inputs) {
  PlayerPhysics.simulate(clientState, input, world, FIXED_DT);
}
console.log(`Client predicted 30 ticks: Pos Z = ${clientState.position.z.toFixed(4)}`);

// 3. Server receives and processes first 15 frames
for (let i = 0; i < 15; i++) {
  PlayerPhysics.simulate(serverState, inputs[i], world, FIXED_DT);
}
console.log(`Server simulated 15 ticks: Pos Z = ${serverState.position.z.toFixed(4)}`);

// 4. Server produces snapshot for tick 15
const snapshot: RemotePlayerSnapshot = {
  id: 'p1',
  username: 'Player 1',
  x: serverState.position.x,
  y: serverState.position.y,
  z: serverState.position.z,
  vx: serverState.velocity.x,
  vy: serverState.velocity.y,
  vz: serverState.velocity.z,
  yaw: serverState.yaw,
  pitch: serverState.pitch,
  grounded: serverState.isGrounded,
  crouched: serverState.isCrouching,
  health: 100,
  activeWeapon: 1,
  lastSequence: 15
};

// 5. Test reconciliation: Client receives snapshot.
// Pending inputs: sequences 16..30
let pendingInputs = inputs.filter((inp) => inp.sequence > snapshot.lastSequence);
assert(pendingInputs.length === 15, `Expected 15 pending inputs, got ${pendingInputs.length}`);

// Introduce intentional artificial glitch/cheat to client to test correction
clientState.position.x += 2.0; // Desync client by 2 meters
assert(Math.abs(clientState.position.x) > 1.9, 'Client must be desynced for test');

// Reconcile:
const errorDistSq = Math.pow(clientState.position.x - snapshot.x, 2);
assert(errorDistSq > 0.0016, 'Error must exceed reconciliation threshold');

// Rewind client to server confirmed state
clientState.position.set(snapshot.x, snapshot.y, snapshot.z);
clientState.velocity.set(snapshot.vx, snapshot.vy, snapshot.vz);
clientState.isGrounded = snapshot.grounded;

// Replay inputs 16..30
for (const pending of pendingInputs) {
  PlayerPhysics.simulate(clientState, pending, world, FIXED_DT);
}

// Server now also finishes processing frames 16..30
for (let i = 15; i < 30; i++) {
  PlayerPhysics.simulate(serverState, inputs[i], world, FIXED_DT);
}

// 6. Verify Convergence: Reconciled Client and Server MUST match identically!
assert(
  clientState.position.equals(serverState.position, 0.0001),
  `Position mismatch after reconciliation: Client ${clientState.position.z} vs Server ${serverState.position.z}`
);
assert(
  clientState.velocity.equals(serverState.velocity, 0.0001),
  `Velocity mismatch after reconciliation: Client ${clientState.velocity.z} vs Server ${serverState.velocity.z}`
);

console.log('✓ Client-side prediction and server reconciliation replay converged with 0.0000m drift!');
console.log('ALL PHASE 2 NETWORK TESTS PASSED SUCCESSFULLY!');
