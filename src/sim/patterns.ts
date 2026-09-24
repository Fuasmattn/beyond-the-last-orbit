import { aimVelocity, spawnEnemyBullet } from './bullets';
import type { SimState } from './types';

/** `count` bullets fanned around straight down, `step` radians apart. */
export function fireSpread(state: SimState, cx: number, cy: number, count: number, step: number, speed: number): void {
  for (let i = 0; i < count; i++) {
    const a = step * (i - (count - 1) / 2);
    spawnEnemyBullet(state, cx, cy, Math.sin(a) * speed, Math.cos(a) * speed);
  }
}

/** `count` bullets evenly around a circle starting at `angle`. */
export function fireRing(state: SimState, cx: number, cy: number, count: number, angle: number, speed: number): void {
  for (let i = 0; i < count; i++) {
    const a = angle + (i * 2 * Math.PI) / count;
    spawnEnemyBullet(state, cx, cy, Math.cos(a) * speed, Math.sin(a) * speed);
  }
}

/** `count` bullets fanned around the direction to the player. */
export function fireAimedBurst(
  state: SimState,
  cx: number,
  cy: number,
  count: number,
  spread: number,
  speed: number,
): void {
  const v = aimVelocity(state, cx, cy, speed);
  const base = Math.atan2(v.vy, v.vx);
  for (let i = 0; i < count; i++) {
    const a = base + spread * (i - (count - 1) / 2);
    spawnEnemyBullet(state, cx, cy, Math.cos(a) * speed, Math.sin(a) * speed);
  }
}
