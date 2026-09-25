import { BOMB, ENEMY, FIELD_H } from '../data/balance';
import { allocId } from './ids';
import { dropStreakLevel } from './scoring';
import type { Bullet, SimState } from './types';

export function moveBullets(state: SimState, dt: number): void {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  const inField = (b: Bullet) => b.y + b.h > 0 && b.y < FIELD_H && b.x + b.w > 0 && b.x < state.fieldW;
  if (state.mode === 'rogue' && state.beatMode === 'off' && state.phase === 'playing') {
    // A primary bolt that leaves the field without hitting anything breaks the streak by a level.
    for (const b of state.bullets) {
      if (b.owner === 'player' && !b.extra && !b.pierced?.length && !inField(b)) dropStreakLevel(state);
    }
  }
  state.bullets = state.bullets.filter(inField);
}

/** Spawns an enemy bullet horizontally centered on `cx`; returns it for tweaking. */
export function spawnEnemyBullet(state: SimState, cx: number, y: number, vx: number, vy: number): Bullet {
  const b: Bullet = {
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
  };
  state.bullets.push(b);
  return b;
}

/** Slow bomb that bursts into a ring when its fuse runs out (see `updateSpecials`). */
export function spawnBomb(state: SimState, cx: number, y: number): Bullet {
  const b = spawnEnemyBullet(state, cx, y, 0, BOMB.speed);
  b.x = cx - BOMB.w / 2;
  b.w = BOMB.w;
  b.h = BOMB.h;
  b.fuse = BOMB.fuse;
  return b;
}

/** Velocity from (cx, cy) toward the player's center; always heads downward. */
export function aimVelocity(state: SimState, cx: number, cy: number, speed: number): { vx: number; vy: number } {
  const p = state.player;
  const dx = p.x + p.w / 2 - cx;
  const dy = Math.max(1, p.y + p.h / 2 - cy);
  const len = Math.hypot(dx, dy);
  return { vx: (dx / len) * speed, vy: (dy / len) * speed };
}
