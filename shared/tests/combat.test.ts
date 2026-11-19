import { Vec3 } from '../math/Vector3.ts';
import { Ray } from '../math/Ray.ts';
import { VoxelWorld } from '../world/VoxelWorld.ts';
import { BlockId } from '../constants.ts';
import { PlayerHitbox, HitboxPart } from '../combat/Hitbox.ts';
import { WeaponId, getWeaponDef } from '../combat/Weapons.ts';
import { LagCompensator } from '../../server/src/combat/LagCompensator.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('Running Combat & Lag Compensation Test Suite...');

// -------------------------------------------------------------
// Test 1: Hitbox Precision (Headshot vs Bodyshot)
// -------------------------------------------------------------
const hitbox = new PlayerHitbox();
const targetPos = new Vec3(0, 1.0, 10);
hitbox.update(targetPos, false);

// Ray directly aimed at head (Y = 1.0 + 1.55 = 2.55)
const headRay = new Ray(new Vec3(0, 2.55, 0), new Vec3(0, 0, 1));
const headHit = hitbox.testRay(headRay);
assert(headHit.hit === true, 'Headshot ray should hit');
assert(headHit.part === HitboxPart.HEAD, `Expected HEAD hit, got ${headHit.part}`);
console.log('✓ Headshot hitbox detection passed.');

// Ray directly aimed at body (Y = 1.0 + 0.6 = 1.6)
const bodyRay = new Ray(new Vec3(0, 1.6, 0), new Vec3(0, 0, 1));
const bodyHit = hitbox.testRay(bodyRay);
assert(bodyHit.hit === true, 'Bodyshot ray should hit');
assert(bodyHit.part === HitboxPart.BODY, `Expected BODY hit, got ${bodyHit.part}`);
console.log('✓ Bodyshot hitbox detection passed.');

// Ray aimed wide
const missRay = new Ray(new Vec3(5.0, 2.0, 0), new Vec3(0, 0, 1));
const missHit = hitbox.testRay(missRay);
assert(missHit.hit === false, 'Miss ray should not register hit');
console.log('✓ Miss ray test passed.');

// -------------------------------------------------------------
// Test 2: Server Lag Compensation Tick Buffer Rewind
// -------------------------------------------------------------
const world = new VoxelWorld();
const lagComp = new LagCompensator();
const sniperDef = getWeaponDef(WeaponId.SNIPER_RIFLE);

// Record history over time: target moves from X=0 to X=4 between t=1000 and t=1200
lagComp.recordTick(60, 1000, [{ id: 'target_1', pos: new Vec3(0, 1.0, 10), crouched: false }]);
lagComp.recordTick(66, 1100, [{ id: 'target_1', pos: new Vec3(2, 1.0, 10), crouched: false }]);
lagComp.recordTick(72, 1200, [{ id: 'target_1', pos: new Vec3(4, 1.0, 10), crouched: false }]);

// Shooter fires at t=1200, but saw target at rewindTime=1000ms (aimed at X=0)
const shooterOrigin = new Vec3(0, 2.55, 0);
const shooterDir = new Vec3(0, 0, 1); // Pointing straight down Z towards X=0, Z=10

// Test A: Without lag compensation (evaluated at current time t=1200, target is at X=4)
const shotAtPresent = lagComp.evaluateShot(
  'shooter',
  shooterOrigin,
  shooterDir,
  1200, // No lag compensation
  1200,
  world,
  sniperDef
);
assert(shotAtPresent.hitTargetId === null, 'Without lag compensation, shot at X=0 should miss moving target at X=4');
console.log('✓ Present-time test correctly missed moving target.');

// Test B: WITH lag compensation (rewound to t=1000ms where shooter aimed)
const shotWithRewind = lagComp.evaluateShot(
  'shooter',
  shooterOrigin,
  shooterDir,
  1000, // Rewound to when shooter fired!
  1200,
  world,
  sniperDef
);
assert(shotWithRewind.hitTargetId === 'target_1', 'With lag compensation, rewound shot should register hit');
assert(shotWithRewind.isHeadshot === true, 'Rewound shot should register critical headshot');
assert(shotWithRewind.damage === sniperDef.damageHead, `Expected ${sniperDef.damageHead} headshot damage`);
console.log(`✓ Lag compensation rewound target position from 200ms ago and confirmed HEADSHOT (${shotWithRewind.damage} dmg)!`);

// Test C: Voxel Wall Occlusion
// Place a solid stone wall between shooter (Z=0) and target (Z=10) at Z=5
world.setBlock(0, 2, 5, BlockId.STONE);
world.setBlock(0, 3, 5, BlockId.STONE);

const shotBlockedByWall = lagComp.evaluateShot(
  'shooter',
  shooterOrigin,
  shooterDir,
  1000,
  1200,
  world,
  sniperDef
);
assert(shotBlockedByWall.hitTargetId === null, 'Shot blocked by voxel wall must not hit player through wall');
assert(shotBlockedByWall.distance < 6.0, 'Shot must terminate at voxel wall');
console.log('✓ Voxel wall occlusion verified: bullets cannot penetrate solid blocks.');

console.log('ALL COMBAT & LAG COMPENSATION TESTS PASSED SUCCESSFULLY!');
