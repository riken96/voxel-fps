import { VoxelWorld } from '../world/VoxelWorld.ts';
import { BlockId, PLAYER_WIDTH, PLAYER_HEIGHT, FIXED_DT } from '../constants.ts';
import { Vec3 } from '../math/Vector3.ts';
import { Ray } from '../math/Ray.ts';
import { VoxelPhysics } from '../physics/VoxelPhysics.ts';
import { PlayerPhysics } from '../physics/PlayerPhysics.ts';
import { createInitialPlayerState } from '../physics/PlayerState.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('Running deterministic physics & voxel test suite...');

// Test 1: Voxel World Block Access
const world = new VoxelWorld();
world.setBlock(5, 0, 5, BlockId.STONE);
assert(world.getBlock(5, 0, 5) === BlockId.STONE, 'Block retrieval failed');
assert(world.isSolid(5, 0, 5) === true, 'Solid check failed');
assert(world.getBlock(5, 1, 5) === BlockId.AIR, 'Air check failed');
console.log('✓ Voxel World get/set tests passed.');

// Test 2: Amanatides & Woo 3D DDA Raycasting
const ray = new Ray(new Vec3(5.5, 5, 5.5), new Vec3(0, -1, 0));
const hit = world.raycast(ray, 10);
assert(hit.hit === true, 'Raycast should hit stone block');
assert(hit.blockX === 5 && hit.blockY === 0 && hit.blockZ === 5, 'Hit coordinates incorrect');
assert(hit.faceNormal.y === 1, 'Hit normal should be top face (+Y)');
assert(Math.abs(hit.distance - 4.0) < 0.001, `Distance expected 4.0, got ${hit.distance}`);
console.log('✓ Amanatides & Woo 3D DDA raycaster tests passed.');

// Test 3: Swept-AABB Falling & Ground Collision
const playerPos = new Vec3(5.5, 2.0, 5.5);
const vel = new Vec3(0, -5.0, 0); // Moving down towards Y=1 (top of block at Y=0)
const collision = VoxelPhysics.moveAABB(
  playerPos,
  vel,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  world,
  0.5, // 0.5s * -5 = -2.5m, should land at Y=1.0
  false
);

assert(collision.isGrounded === true, 'Player should be grounded');
assert(Math.abs(collision.position.y - 1.0) < 0.001, `Expected Y=1.0, got ${collision.position.y}`);
assert(collision.velocity.y === 0, 'Velocity Y should be zeroed upon ground impact');
console.log('✓ Swept-AABB vertical ground landing test passed.');

// Test 4: Wall Collision & Sliding
world.setBlock(6, 1, 5, BlockId.STONE); // Wall in front along +X
const walkVel = new Vec3(4.0, 0, 0); // Walking into wall
const wallCollision = VoxelPhysics.moveAABB(
  new Vec3(5.5, 1.0, 5.5),
  walkVel,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  world,
  0.2,
  true
);
assert(wallCollision.collidedX === true, 'Player should detect collision with X wall');
assert(wallCollision.velocity.x === 0, 'Velocity X should be clamped');
// Half width is 0.3. Wall minX is 6. Max posX is 6 - 0.3 = 5.7
assert(wallCollision.position.x <= 5.7001, 'Player must not penetrate wall');
console.log('✓ Wall collision clipping prevention test passed.');

// Test 5: Full Player Physics Simulation Tick
const pState = createInitialPlayerState('test', 0, 5, 0);
world.fillBox(-5, 0, -5, 5, 0, 5, BlockId.CONCRETE); // Floor at Y=0

// Simulate falling onto floor
for (let i = 0; i < 40; i++) {
  PlayerPhysics.simulate(
    pState,
    {
      sequence: i,
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
    },
    world,
    FIXED_DT
  );
}

assert(pState.isGrounded === true, 'Player should have landed after 40 ticks');
assert(Math.abs(pState.position.y - 1.0) < 0.01, `Player should rest at Y=1.0, got ${pState.position.y}`);
console.log('✓ Full deterministic physics simulation tick test passed.');

console.log('ALL TESTS PASSED SUCCESSFULLY!');
