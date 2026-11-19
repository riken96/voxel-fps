import {
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_CROUCH_HEIGHT,
  GRAVITY,
  JUMP_VELOCITY,
  WALK_SPEED,
  SPRINT_SPEED,
  CROUCH_SPEED,
  GROUND_ACCELERATION,
  AIR_ACCELERATION,
  GROUND_FRICTION,
  AIR_DRAG,
  SLIDE_INITIAL_SPEED,
  SLIDE_DURATION,
  SLIDE_COOLDOWN,
  SLIDE_FRICTION,
  SLIDE_HOP_BOOST,
  BHOP_SPEED_BONUS,
  BHOP_MAX_SPEED,
  MANTLE_REACH_DIST,
  MANTLE_IMPULSE_Y,
  MANTLE_IMPULSE_FORWARD,
  WALL_JUMP_IMPULSE_Y,
  WALL_JUMP_PUSH,
  BlockId
} from '../constants.ts';
import { Vec3 } from '../math/Vector3.ts';
import { VoxelWorld } from '../world/VoxelWorld.ts';
import { VoxelPhysics } from './VoxelPhysics.ts';
import { PlayerState, UserInput } from './PlayerState.ts';

export class PlayerPhysics {
  /**
   * Deterministic step simulation.
   * Can be executed identically on both client (for local prediction)
   * and server (for authoritative validation).
   */
  public static simulate(
    state: PlayerState,
    input: UserInput,
    world: VoxelWorld,
    dt: number
  ): void {
    // 1. Update orientation from input and tick cooldowns
    state.yaw = input.yaw;
    state.pitch = input.pitch;
    state.isCrouching = input.crouch;
    state.isSprinting = input.sprint && !input.crouch;

    if (state.slideCooldown > 0) {
      state.slideCooldown = Math.max(0, state.slideCooldown - dt);
    }
    if (state.wallJumpCooldown > 0) {
      state.wallJumpCooldown = Math.max(0, state.wallJumpCooldown - dt);
    }
    if (state.isMantling) {
      state.mantleTimer -= dt;
      if (state.mantleTimer <= 0) {
        state.isMantling = false;
      }
    }

    // 2. Compute wish direction in world space
    let moveForward = 0;
    if (input.forward) moveForward += 1;
    if (input.backward) moveForward -= 1;

    let moveSide = 0;
    if (input.right) moveSide += 1;
    if (input.left) moveSide -= 1;

    const wishDir = new Vec3();
    if (moveForward !== 0 || moveSide !== 0) {
      // Rotate input based on yaw (yaw = 0 points towards -Z)
      const sin = Math.sin(state.yaw);
      const cos = Math.cos(state.yaw);

      // In FPS coordinate system:
      // forward: -sin(yaw)*X, -cos(yaw)*Z
      // right:    cos(yaw)*X, -sin(yaw)*Z
      const wx = moveSide * cos - moveForward * sin;
      const wz = -moveSide * sin - moveForward * cos;

      wishDir.set(wx, 0, wz).normalize();
    }

    // 3. Slide State Machine (Initiation & Maintenance)
    const currentHozSpeed = state.velocity.horizontalLength();
    if (state.isGrounded && input.crouch && !state.isSliding && state.slideCooldown <= 0) {
      const isMovingFast = currentHozSpeed > WALK_SPEED * 1.05;
      const isSprintSlide = input.sprint && (moveForward > 0 || currentHozSpeed > WALK_SPEED * 0.7);

      if (isMovingFast || isSprintSlide) {
        state.isSliding = true;
        state.slideTimer = SLIDE_DURATION;
        state.slideCooldown = SLIDE_COOLDOWN;

        let slideDir = wishDir;
        if (slideDir.lengthSq() < 0.01) {
          if (currentHozSpeed > 0.1) {
            slideDir = new Vec3(state.velocity.x, 0, state.velocity.z).normalize();
          } else {
            slideDir = new Vec3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
          }
        }
        const impulseSpeed = Math.max(currentHozSpeed * 1.05, SLIDE_INITIAL_SPEED);
        state.velocity.x = slideDir.x * impulseSpeed;
        state.velocity.z = slideDir.z * impulseSpeed;
      }
    }

    const wasSliding = state.isSliding;

    if (state.isSliding) {
      if (input.jump) {
        // Player is jumping out of slide (Slide-Hop) -> handled in jump section below
      } else if (!input.crouch || !state.isGrounded) {
        state.isSliding = false;
        state.slideTimer = 0;
      } else {
        state.slideTimer -= dt;
        if (state.slideTimer <= 0) {
          state.isSliding = false;
        }
      }
    }

    const currentHeight = (state.isCrouching || state.isSliding || wasSliding) ? PLAYER_CROUCH_HEIGHT : PLAYER_HEIGHT;

    // 4. Determine target speed
    let targetSpeed = WALK_SPEED;
    if (state.isSliding) {
      targetSpeed = SLIDE_INITIAL_SPEED;
    } else if (state.isCrouching) {
      targetSpeed = CROUCH_SPEED;
    } else if (state.isSprinting) {
      targetSpeed = SPRINT_SPEED;
    }

    // 5. Ground vs Air movement dynamics (Quake / Apex / Krunker mechanics)
    if (state.isGrounded) {
      const isBhopJump = input.jump;

      if (state.isSliding) {
        // Reduced friction during slide for smooth glide
        const curSpeed = state.velocity.horizontalLength();
        if (curSpeed > 0.0001) {
          const drop = curSpeed * SLIDE_FRICTION * dt;
          const newSpeed = Math.max(0, curSpeed - drop);
          const ratio = newSpeed / curSpeed;
          state.velocity.x *= ratio;
          state.velocity.z *= ratio;
        }
        if (wishDir.lengthSq() > 0.01) {
          this.accelerate(state.velocity, wishDir, targetSpeed, 18.0, dt);
        }
      } else if (!isBhopJump) {
        // Standard ground friction (low friction on ice, bypassed on instant bhop jump frame)
        const bUnderX = Math.floor(state.position.x);
        const bUnderY = Math.floor(state.position.y - 0.05);
        const bUnderZ = Math.floor(state.position.z);
        const bUnderId = world.getBlock(bUnderX, bUnderY, bUnderZ);
        const friction = (bUnderId === BlockId.ICE) ? 0.8 : GROUND_FRICTION;
        const curSpeed = state.velocity.horizontalLength();
        if (curSpeed > 0.0001) {
          const drop = curSpeed * friction * dt;
          const newSpeed = Math.max(0, curSpeed - drop);
          const ratio = newSpeed / curSpeed;
          state.velocity.x *= ratio;
          state.velocity.z *= ratio;
        }
        const accelRate = (bUnderId === BlockId.ICE) ? GROUND_ACCELERATION * 0.45 : GROUND_ACCELERATION;
        this.accelerate(state.velocity, wishDir, targetSpeed, accelRate, dt);
      }

      // Jump Impulses (Slide-Hop vs Bunny-Hop)
      if (input.jump) {
        if (state.isSliding || wasSliding) {
          // Slide-hop: Launch high into the air conserving forward slide momentum
          state.velocity.y = JUMP_VELOCITY * SLIDE_HOP_BOOST;
          state.isSliding = false;
          state.slideTimer = 0;
          state.isGrounded = false;
        } else {
          // Standard / BHOP Jump
          state.velocity.y = JUMP_VELOCITY;
          state.isGrounded = false;
          const curHoz = state.velocity.horizontalLength();
          if (curHoz > WALK_SPEED * 0.8 && curHoz < BHOP_MAX_SPEED) {
            state.velocity.x *= BHOP_SPEED_BONUS;
            state.velocity.z *= BHOP_SPEED_BONUS;
          }
        }
        state.lastJumpTime = Date.now();
      }
    } else {
      // Air acceleration (Quake / Source air-strafing)
      this.accelerate(state.velocity, wishDir, targetSpeed, AIR_ACCELERATION, dt);

      // Subtle air drag
      state.velocity.x *= Math.max(0, 1 - AIR_DRAG * dt);
      state.velocity.z *= Math.max(0, 1 - AIR_DRAG * dt);

      // Gravity (reduced slightly during active mantle)
      const currentGravity = state.isMantling ? GRAVITY * 0.35 : GRAVITY;
      state.velocity.y += currentGravity * dt;

      // Ledge Mantle (Vault) Detection
      if (!state.isMantling && (input.forward || input.jump)) {
        const sinY = Math.sin(state.yaw);
        const cosY = Math.cos(state.yaw);
        const fX = -sinY;
        const fZ = -cosY;

        const aheadX = Math.floor(state.position.x + fX * MANTLE_REACH_DIST);
        const aheadZ = Math.floor(state.position.z + fZ * MANTLE_REACH_DIST);
        const footY = Math.floor(state.position.y);
        const waistY = Math.floor(state.position.y + 0.8);
        const headY = Math.floor(state.position.y + 1.8);
        const overLedgeY = waistY + 1;

        const obstacleSolid = world.isSolid(aheadX, waistY, aheadZ) || world.isSolid(aheadX, footY, aheadZ);
        const ledgeTopAir = !world.isSolid(aheadX, overLedgeY, aheadZ) && !world.isSolid(aheadX, overLedgeY + 1, aheadZ);
        const overheadAir = !world.isSolid(Math.floor(state.position.x), headY, Math.floor(state.position.z));

        if (obstacleSolid && ledgeTopAir && overheadAir) {
          state.isMantling = true;
          state.mantleTimer = 0.22;
          state.velocity.y = MANTLE_IMPULSE_Y;
          state.velocity.x = fX * MANTLE_IMPULSE_FORWARD;
          state.velocity.z = fZ * MANTLE_IMPULSE_FORWARD;
        }
      }
    }

    // 6. Swept-AABB Voxel Collision Resolution
    const collision = VoxelPhysics.moveAABB(
      state.position,
      state.velocity,
      PLAYER_WIDTH,
      currentHeight,
      world,
      dt,
      state.isGrounded
    );

    // 7. Apply resolved state
    state.position.copy(collision.position);
    state.velocity.copy(collision.velocity);
    state.isGrounded = collision.isGrounded;

    // Wall-Jump / Wall-Kick (Airborne + colliding with wall + pressing jump, not mantling)
    if (!state.isGrounded && !state.isMantling && (collision.collidedX || collision.collidedZ)) {
      if (input.jump && state.wallJumpCooldown <= 0) {
        let nx = 0;
        let nz = 0;
        if (collision.collidedX) {
          nx = -Math.sign(wishDir.x || -Math.sin(state.yaw));
        }
        if (collision.collidedZ) {
          nz = -Math.sign(wishDir.z || -Math.cos(state.yaw));
        }
        if (nx !== 0 || nz !== 0) {
          state.velocity.y = WALL_JUMP_IMPULSE_Y;
          state.velocity.x = nx * WALL_JUMP_PUSH;
          state.velocity.z = nz * WALL_JUMP_PUSH;
          state.wallJumpCooldown = 0.45;
        }
      }
    }

    // 8. Interactive Blocks Check (Protox Jump Pad, Speed Pad, Hazard Lava)
    const blockUnderX = Math.floor(state.position.x);
    const blockUnderY = Math.floor(state.position.y - 0.05);
    const blockUnderZ = Math.floor(state.position.z);
    const blockUnder = world.getBlock(blockUnderX, blockUnderY, blockUnderZ);
    const blockAtFeet = world.getBlock(blockUnderX, Math.floor(state.position.y + 0.1), blockUnderZ);

    state.onJumpPad = false;
    state.isInLava = false;

    if (blockUnder === BlockId.JUMP_PAD || blockAtFeet === BlockId.JUMP_PAD) {
      // Powerful vertical spring launch (19.5 m/s)
      state.velocity.y = 19.5;
      state.isGrounded = false;
      state.onJumpPad = true;
    } else if (blockUnder === BlockId.BOUNCE_PAD || blockAtFeet === BlockId.BOUNCE_PAD) {
      // Trampoline bounce (scaled by incoming downward momentum or minimum 16.5 m/s)
      state.velocity.y = Math.max(16.5, Math.abs(state.velocity.y) * 1.25);
      state.isGrounded = false;
      state.onJumpPad = true;
    } else if (blockUnder === BlockId.SPEED_PAD || blockAtFeet === BlockId.SPEED_PAD) {
      // Horizontal speed surge (up to 28 m/s)
      const hSpeed = state.velocity.horizontalLength();
      if (hSpeed < 28.0) {
        state.velocity.x *= 1.35;
        state.velocity.z *= 1.35;
      }
    }

    if (blockUnder === BlockId.HAZARD_LAVA || blockAtFeet === BlockId.HAZARD_LAVA) {
      state.isInLava = true;
    }

    if (blockUnder === BlockId.WATER || blockAtFeet === BlockId.WATER) {
      // Fluid viscosity and swimming buoyancy
      if (state.velocity.y < -4.0) {
        state.velocity.y = -4.0;
      }
      if (input.jump) {
        state.velocity.y = 7.5; // Swimming upward
      }
    }

    state.lastSequenceProcessed = input.sequence;
  }

  /**
   * Quake-style vector acceleration projection.
   * Only accelerates along wish direction if current projected speed is less than target speed.
   */
  private static accelerate(
    vel: Vec3,
    wishDir: Vec3,
    wishSpeed: number,
    accel: number,
    dt: number
  ): void {
    const currentSpeedProj = vel.x * wishDir.x + vel.z * wishDir.z;
    const addSpeed = wishSpeed - currentSpeedProj;

    if (addSpeed <= 0) return;

    let accelSpeed = accel * dt * wishSpeed;
    if (accelSpeed > addSpeed) {
      accelSpeed = addSpeed;
    }

    vel.x += wishDir.x * accelSpeed;
    vel.z += wishDir.z * accelSpeed;
  }
}
