import { Vec3 } from '../math/Vector3.ts';

export interface UserInput {
  sequence: number;
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  crouch: boolean;
  sprint: boolean;
  yaw: number;   // In radians
  pitch: number; // In radians
  dt: number;
}

export interface PlayerState {
  id: string;
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  isGrounded: boolean;
  isCrouching: boolean;
  isSprinting: boolean;
  isSliding: boolean;
  slideTimer: number;
  slideCooldown: number;
  isMantling: boolean;
  mantleTimer: number;
  wallJumpCooldown: number;
  lastJumpTime: number;
  lastSequenceProcessed: number;
  isInLava?: boolean;
  onJumpPad?: boolean;
}

export function createInitialPlayerState(id = 'local', x = 0, y = 5, z = 0): PlayerState {
  return {
    id,
    position: new Vec3(x, y, z),
    velocity: new Vec3(0, 0, 0),
    yaw: 0,
    pitch: 0,
    isGrounded: false,
    isCrouching: false,
    isSprinting: false,
    isSliding: false,
    slideTimer: 0,
    slideCooldown: 0,
    isMantling: false,
    mantleTimer: 0,
    wallJumpCooldown: 0,
    lastJumpTime: 0,
    lastSequenceProcessed: 0,
    isInLava: false,
    onJumpPad: false
  };
}
