import * as THREE from 'three';
import {
  PLAYER_EYE_HEIGHT,
  PLAYER_CROUCH_EYE_HEIGHT,
  WALK_SPEED,
  FIXED_DT,
  BlockId
} from '@shared/constants.ts';
import {
  PlayerState,
  UserInput,
  createInitialPlayerState
} from '@shared/physics/PlayerState.ts';
import { PlayerPhysics } from '@shared/physics/PlayerPhysics.ts';
import { VoxelWorld } from '@shared/world/VoxelWorld.ts';
import { RemotePlayerSnapshot } from '@shared/protocol/Messages.ts';
import { SoundFx } from '../audio/SoundFx.ts';

export class LocalPlayer {
  public state: PlayerState;
  public camera: THREE.PerspectiveCamera;
  private soundFx: SoundFx;

  // Camera dynamics
  private currentEyeHeight = PLAYER_EYE_HEIGHT;
  private baseFOV = 82;
  private currentFOV = 82;
  private currentRoll = 0;
  private mantleLift = 0;

  // Head bobbing state
  private bobTimer = 0;
  private bobOffset = new THREE.Vector3();

  // Landing camera dip
  private landingDip = 0;
  private footstepDistance = 0;

  // Input buffer for reconciliation
  public pendingInputs: UserInput[] = [];
  public reconciliationCorrections = 0;
  public isFlying = false;
  public flyGraceTicks = 0;

  constructor(camera: THREE.PerspectiveCamera, soundFx: SoundFx) {
    this.camera = camera;
    this.soundFx = soundFx;
    // Spawn at center of arena on high platform
    this.state = createInitialPlayerState('local', 0, 8, 0);
  }

  /**
   * Fixed physics tick update with local prediction and optional Builder Free-Fly mode.
   */
  public fixedUpdate(input: UserInput, world: VoxelWorld, dt: number, isFlyMode = false): void {
    if (isFlyMode) {
      this.isFlying = true;
      this.flyGraceTicks = 45; // Grace ticks after flight ends to prevent rubberbanding to ancient server coordinates
      this.state.yaw = input.yaw;
      this.state.pitch = input.pitch;

      const flySpeed = input.sprint ? 32.0 : 16.0;

      let moveForward = 0;
      if (input.forward) moveForward += 1;
      if (input.backward) moveForward -= 1;

      let moveSide = 0;
      if (input.right) moveSide += 1;
      if (input.left) moveSide -= 1;

      const sinYaw = Math.sin(this.state.yaw);
      const cosYaw = Math.cos(this.state.yaw);
      const sinPitch = Math.sin(this.state.pitch);
      const cosPitch = Math.cos(this.state.pitch);

      // Camera forward & right vectors
      const fX = -sinYaw * cosPitch;
      const fY = sinPitch;
      const fZ = -cosYaw * cosPitch;

      const rX = cosYaw;
      const rZ = -sinYaw;

      let vx = (moveForward * fX + moveSide * rX) * flySpeed;
      let vy = (moveForward * fY) * flySpeed;
      let vz = (moveForward * fZ + moveSide * rZ) * flySpeed;

      if (input.jump) vy += flySpeed;
      if (input.crouch) vy -= flySpeed;

      this.state.position.x += vx * dt;
      this.state.position.y += vy * dt;
      this.state.position.z += vz * dt;
      this.state.velocity.set(vx, vy, vz);
      this.state.isGrounded = false;
      return;
    }

    this.isFlying = false;
    const prevGrounded = this.state.isGrounded;
    const prevVelY = this.state.velocity.y;
    const prevSliding = this.state.isSliding;
    const prevMantling = this.state.isMantling;
    const prevWallCooldown = this.state.wallJumpCooldown;

    // Simulate deterministic physics locally (Client-Side Prediction)
    PlayerPhysics.simulate(this.state, input, world, dt);

    // Advanced movement audio & tactile reactions
    if (!prevSliding && this.state.isSliding) {
      this.soundFx.playSlide();
    }
    if (!prevMantling && this.state.isMantling) {
      this.soundFx.playMantle();
      this.mantleLift = 0.16;
    }
    if (prevWallCooldown <= 0 && this.state.wallJumpCooldown > 0) {
      this.soundFx.playWallJump();
    }

    // Interactive audio reactions
    if (this.state.onJumpPad) {
      const bx = Math.floor(this.state.position.x);
      const by = Math.floor(this.state.position.y - 0.05);
      const bz = Math.floor(this.state.position.z);
      const bId = world.getBlock(bx, by, bz);
      if (bId === BlockId.BOUNCE_PAD) {
        this.soundFx.playBouncePad();
      } else {
        this.soundFx.playJumpPad();
      }
    }
    if (this.state.isInLava) {
      this.soundFx.playLavaSizzle();
    }

    // Save input to pending buffer for future server reconciliation
    this.pendingInputs.push(input);
    if (this.pendingInputs.length > 240) {
      this.pendingInputs.shift();
    }

    // Sound FX & Landing impact detection
    if (!prevGrounded && this.state.isGrounded) {
      if (prevVelY < -6.0) {
        this.soundFx.playLand();
        this.landingDip = Math.min(0.25, Math.abs(prevVelY) * 0.02);
      }
    } else if (input.jump && prevGrounded && !this.state.isGrounded) {
      this.soundFx.playJump();
    }

    // Footstep audio based on horizontal distance traveled
    if (this.state.isGrounded) {
      const hozSpeed = this.state.velocity.horizontalLength();
      if (hozSpeed > 1.5) {
        this.footstepDistance += hozSpeed * dt;
        const stepThreshold = this.state.isSprinting ? 2.4 : 1.9;
        if (this.footstepDistance >= stepThreshold) {
          const bx = Math.floor(this.state.position.x);
          const by = Math.floor(this.state.position.y - 0.05);
          const bz = Math.floor(this.state.position.z);
          const blockId = world.getBlock(bx, by, bz);
          this.soundFx.playFootstep(blockId);
          this.footstepDistance = 0;
        }
      }
    }
  }

  /**
   * Authoritative Server Reconciliation.
   * Compares the server's verified state with our prediction,
   * corrects any discrepancies, and replays unacknowledged inputs.
   */
  public reconcile(snapshot: RemotePlayerSnapshot, world: VoxelWorld): void {
    // If player is in free-fly building mode or in grace period, ignore server physics reconciliation!
    if (this.isFlying || this.flyGraceTicks > 0) {
      if (this.flyGraceTicks > 0) {
        this.flyGraceTicks--;
      }
      this.pendingInputs = [];
      return;
    }

    // 1. Remove inputs that have already been acknowledged by the server
    const ackSequence = snapshot.lastSequence;
    this.pendingInputs = this.pendingInputs.filter((input) => input.sequence > ackSequence);

    // 2. Check position deviation between local and server state
    const dx = this.state.position.x - snapshot.x;
    const dy = this.state.position.y - snapshot.y;
    const dz = this.state.position.z - snapshot.z;
    const errorDistSq = dx * dx + dy * dy + dz * dz;

    // Reconciliation threshold: if deviation exceeds ~0.04m (4cm), perform state rewind & replay
    if (errorDistSq > 0.0016) {
      this.reconciliationCorrections++;

      // Rewind to server authoritative state
      this.state.position.set(snapshot.x, snapshot.y, snapshot.z);
      this.state.velocity.set(snapshot.vx, snapshot.vy, snapshot.vz);
      this.state.isGrounded = snapshot.grounded;

      // Replay all remaining unacknowledged inputs deterministically
      for (const input of this.pendingInputs) {
        PlayerPhysics.simulate(this.state, input, world, FIXED_DT);
      }
    }
  }

  /**
   * Frame-rate independent render update with camera smoothing,
   * head-bob, and dynamic FOV.
   */
  public updateCamera(alpha: number, dt: number): void {
    // 1. Smooth Crouch / Stand / Slide eye height transition
    let targetEyeHeight = PLAYER_EYE_HEIGHT;
    if (this.state.isSliding) {
      targetEyeHeight = PLAYER_CROUCH_EYE_HEIGHT * 0.88;
    } else if (this.state.isCrouching) {
      targetEyeHeight = PLAYER_CROUCH_EYE_HEIGHT;
    }
    this.currentEyeHeight += (targetEyeHeight - this.currentEyeHeight) * Math.min(1, dt * 15);

    // 2. Head-bobbing
    const hozSpeed = this.state.velocity.horizontalLength();
    if (this.state.isGrounded && hozSpeed > 1.0 && !this.state.isSliding) {
      const bobFreq = this.state.isSprinting ? 14 : 10;
      const bobAmp = this.state.isSprinting ? 0.06 : 0.035;

      this.bobTimer += dt * bobFreq;
      this.bobOffset.y = Math.sin(this.bobTimer) * bobAmp;
      this.bobOffset.x = Math.cos(this.bobTimer * 0.5) * (bobAmp * 0.5);
    } else {
      // Gently return to zero
      this.bobOffset.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 10));
    }

    // 3. Landing camera dip & mantle lift decay
    if (this.landingDip > 0.001) {
      this.landingDip -= this.landingDip * Math.min(1, dt * 12);
    } else {
      this.landingDip = 0;
    }

    if (this.mantleLift > 0.001) {
      this.mantleLift -= this.mantleLift * Math.min(1, dt * 10);
    } else {
      this.mantleLift = 0;
    }

    // 4. Dynamic Speed & Slide FOV
    const speedRatio = Math.min(1.6, hozSpeed / WALK_SPEED);
    let targetFOV = this.state.isSprinting
      ? this.baseFOV + 10 * speedRatio
      : this.baseFOV + 3 * (speedRatio - 1);

    if (this.state.isSliding) {
      targetFOV += 7.5;
    }

    this.currentFOV += (targetFOV - this.currentFOV) * Math.min(1, dt * 8);
    if (Math.abs(this.camera.fov - this.currentFOV) > 0.05) {
      this.camera.fov = this.currentFOV;
      this.camera.updateProjectionMatrix();
    }

    // 5. Dynamic Camera Roll (Slide tilt & Strafe roll)
    const targetRoll = this.state.isSliding ? -0.055 : 0;
    this.currentRoll += (targetRoll - this.currentRoll) * Math.min(1, dt * 12);

    // 6. Position camera at player eye level + headbob - landingDip + mantleLift
    this.camera.position.set(
      this.state.position.x + this.bobOffset.x,
      this.state.position.y + this.currentEyeHeight + this.bobOffset.y - this.landingDip + this.mantleLift,
      this.state.position.z
    );

    // 7. Set camera rotation using Euler angles (order: YXZ for FPS)
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.state.yaw;
    this.camera.rotation.x = this.state.pitch;
    this.camera.rotation.z = -this.bobOffset.x * 0.2 + this.currentRoll; // Subtle camera roll during strafing/slide
  }

  public getPosition(): THREE.Vector3 {
    return this.camera.position;
  }

  public getForwardVector(): THREE.Vector3 {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    return forward;
  }
}
