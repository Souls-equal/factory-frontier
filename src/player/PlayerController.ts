import type { ControlsConfig } from '../core/Configuration';
import type { CameraView } from '../engine/types';

/**
 * Foundation first-person player controller.
 *
 * The controller is deliberately independent from Three.js: it owns plain
 * position/orientation numbers and produces a `CameraView` that the rendering
 * engine applies. This keeps movement logic testable in Node.
 *
 * Scope of this foundation increment:
 * - mouse-look with pitch clamping,
 * - accelerated walking/strafe/sprint on the flat foundation plane,
 * - a circular safety bound so the player cannot walk off the ground.
 *
 * It does **not** implement terrain following, gravity, jumping or collision.
 * Those belong to Phase 1 and must replace the flat-ground assumptions here.
 */

export interface PlayerInput {
  /** Strafe axis: -1 left, +1 right. */
  readonly moveX: number;
  /** Forward axis: -1 backward, +1 forward. */
  readonly moveZ: number;
  readonly sprint: boolean;
  /** Horizontal mouse movement in pixels for this frame. */
  readonly lookDeltaX: number;
  /** Vertical mouse movement in pixels for this frame. */
  readonly lookDeltaY: number;
}

export interface PlayerSpawn {
  readonly x: number;
  readonly z: number;
  readonly yaw?: number;
  readonly pitch?: number;
}

export const DEFAULT_PLAYER_SPAWN: Readonly<Required<PlayerSpawn>> = Object.freeze({
  x: 0,
  z: 18,
  yaw: 0,
  pitch: 0,
});

/** Largest frame delta the controller integrates in one call (seconds). */
const MAX_UPDATE_SECONDS = 0.25;

export interface PlayerControllerOptions {
  readonly controls: ControlsConfig;
  readonly spawn?: PlayerSpawn;
}

export class PlayerController {
  private readonly controls: ControlsConfig;
  private readonly spawn: Required<PlayerSpawn>;

  private x: number;
  private z: number;
  private yaw: number;
  private pitch: number;
  private velocityX = 0;
  private velocityZ = 0;

  constructor(options: PlayerControllerOptions) {
    this.controls = options.controls;

    const spawn: Required<PlayerSpawn> = {
      x: options.spawn?.x ?? DEFAULT_PLAYER_SPAWN.x,
      z: options.spawn?.z ?? DEFAULT_PLAYER_SPAWN.z,
      yaw: options.spawn?.yaw ?? DEFAULT_PLAYER_SPAWN.yaw,
      pitch: options.spawn?.pitch ?? DEFAULT_PLAYER_SPAWN.pitch,
    };

    if (![spawn.x, spawn.z, spawn.yaw, spawn.pitch].every((value) => Number.isFinite(value))) {
      throw new RangeError('Player spawn contains non-finite values.');
    }

    this.spawn = Object.freeze(spawn);
    this.x = spawn.x;
    this.z = spawn.z;
    this.yaw = normalizeRadians(spawn.yaw);
    this.pitch = clamp(spawn.pitch, -this.controls.pitchLimit, this.controls.pitchLimit);
  }

  /**
   * Advance the player for one rendered frame.
   *
   * Mouse look is applied even when `frameDeltaSeconds` is zero so the first
   * frame and very short frames stay responsive. Movement uses the frame delta
   * and is frame-rate independent because velocities are in metres/second.
   */
  update(frameDeltaSeconds: number, input: PlayerInput): void {
    this.applyLook(input);

    if (!Number.isFinite(frameDeltaSeconds) || frameDeltaSeconds <= 0) {
      return;
    }
    const dt = Math.min(frameDeltaSeconds, MAX_UPDATE_SECONDS);

    const moveX = clampAxis(input.moveX);
    const moveZ = clampAxis(input.moveZ);

    let directionX = 0;
    let directionZ = 0;

    if (moveX !== 0 || moveZ !== 0) {
      // Camera-forward on the XZ plane for the current yaw.
      const forwardX = -Math.sin(this.yaw);
      const forwardZ = -Math.cos(this.yaw);
      const rightX = Math.cos(this.yaw);
      const rightZ = -Math.sin(this.yaw);

      directionX = forwardX * moveZ + rightX * moveX;
      directionZ = forwardZ * moveZ + rightZ * moveX;

      const length = Math.hypot(directionX, directionZ);
      if (length > 1) {
        directionX /= length;
        directionZ /= length;
      }
    }

    const speed = this.controls.moveSpeed * (input.sprint ? this.controls.sprintMultiplier : 1);
    const targetVelocityX = directionX * speed;
    const targetVelocityZ = directionZ * speed;
    const maxVelocityChange = this.controls.acceleration * dt;

    this.velocityX = moveTowards(this.velocityX, targetVelocityX, maxVelocityChange);
    this.velocityZ = moveTowards(this.velocityZ, targetVelocityZ, maxVelocityChange);

    this.x += this.velocityX * dt;
    this.z += this.velocityZ * dt;

    this.clampToPlayArea();
  }

  /** Reset to the spawn pose and remove all momentum. */
  reset(): void {
    this.x = this.spawn.x;
    this.z = this.spawn.z;
    this.yaw = normalizeRadians(this.spawn.yaw);
    this.pitch = clamp(this.spawn.pitch, -this.controls.pitchLimit, this.controls.pitchLimit);
    this.velocityX = 0;
    this.velocityZ = 0;
  }

  /** Current camera pose derived from the player state. */
  get view(): CameraView {
    return {
      position: { x: this.x, y: this.controls.eyeHeight, z: this.z },
      yaw: this.yaw,
      pitch: this.pitch,
    };
  }

  /** Current horizontal speed in metres per second (for UI/diagnostics). */
  get horizontalSpeed(): number {
    return Math.hypot(this.velocityX, this.velocityZ);
  }

  private applyLook(input: PlayerInput): void {
    const deltaX = Number.isFinite(input.lookDeltaX) ? input.lookDeltaX : 0;
    const deltaY = Number.isFinite(input.lookDeltaY) ? input.lookDeltaY : 0;

    this.yaw = normalizeRadians(this.yaw - deltaX * this.controls.lookSensitivity);
    this.pitch = clamp(
      this.pitch - deltaY * this.controls.lookSensitivity,
      -this.controls.pitchLimit,
      this.controls.pitchLimit,
    );
  }

  private clampToPlayArea(): void {
    const distance = Math.hypot(this.x, this.z);
    const radius = this.controls.playAreaRadius;
    if (distance <= radius || distance === 0) {
      return;
    }

    const scale = radius / distance;
    this.x *= scale;
    this.z *= scale;

    // Remove the outward component of the velocity at the boundary.
    const normalX = this.x / radius;
    const normalZ = this.z / radius;
    const outwardSpeed = this.velocityX * normalX + this.velocityZ * normalZ;
    if (outwardSpeed > 0) {
      this.velocityX -= outwardSpeed * normalX;
      this.velocityZ -= outwardSpeed * normalZ;
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampAxis(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return clamp(value, -1, 1);
}

function normalizeRadians(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function moveTowards(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) {
    return target;
  }
  return current + Math.sign(target - current) * maxDelta;
}
