import { clamp } from '../sim/math';

/** How fast the camera eases toward its target, per second. */
const FOLLOW_RATE = 12;

/**
 * Camera x (left edge of the view in field coords) for a ship at `shipX`: maps the ship's range
 * linearly onto the pan range, so each wall brings that edge of the field into view.
 * A field narrower than the view is centered.
 */
export function cameraTarget(shipX: number, shipW: number, fieldW: number, viewW: number): number {
  const slack = fieldW - viewW;
  if (slack <= 0) return slack / 2;
  return clamp(shipX / Math.max(1, fieldW - shipW), 0, 1) * slack;
}

/** Eases toward the target; `null` snaps (first frame). */
export function followCamera(current: number | null, target: number, dt: number): number {
  if (current === null) return target;
  return current + (target - current) * Math.min(1, dt * FOLLOW_RATE);
}
