import { ENEMY, FIELD_H, FIELD_W } from '../data/balance';
import { allocId } from './ids';
import type { SimState } from './types';

export function moveBullets(state: SimState, dt: number): void {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  state.bullets = state.bullets.filter(
    (b) => b.y + b.h > 0 && b.y < FIELD_H && b.x + b.w > 0 && b.x < FIELD_W,
  );
}

/** Spawns an enemy bullet horizontally centered on `cx`. */
export function spawnEnemyBullet(state: SimState, cx: number, y: number, vx: number, vy: number): void {
  state.bullets.push({
    id: allocId(state),
    x: cx - ENEMY.bulletW / 2,
    y,
    w: ENEMY.bulletW,
    h: ENEMY.bulletH,
    vx,
    vy,
    owner: 'enemy',
    onBeat: false,
    mult: 1,
  });
}

/** Velocity from (cx, cy) toward the player's center; always heads downward. */
export function aimVelocity(state: SimState, cx: number, cy: number, speed: number): { vx: number; vy: number } {
  const p = state.player;
  const dx = p.x + p.w / 2 - cx;
  const dy = Math.max(1, p.y + p.h / 2 - cy);
  const len = Math.hypot(dx, dy);
  return { vx: (dx / len) * speed, vy: (dy / len) * speed };
}
