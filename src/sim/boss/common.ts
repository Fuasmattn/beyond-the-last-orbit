import { BOSS_DYING_TIME, BOSS_POINTS, HITSTOP } from '../../data/balance';
import { cancelBullets } from '../scoring';
import { aimVelocity, spawnEnemyBullet } from '../bullets';
import type { Boss, Box, SimEvent, SimState } from '../types';

export interface Motion {
  y: number;
  h: number;
  enterTime: number;
  swayAmp: number;
  swaySpeed: number;
}

/**
 * Shared per-step boss upkeep: timers, flashes, entrance, sway, part positions.
 * Returns true when the boss may act (entered, alive, stage playing).
 */
export function tickBoss(state: SimState, b: Boss, dt: number, m: Motion): boolean {
  b.t += dt;
  b.flash = Math.max(0, b.flash - dt);
  for (const p of b.parts) p.flash = Math.max(0, p.flash - dt);
  if (b.dying > 0) {
    b.dying = Math.max(0, b.dying - dt);
    return false;
  }
  if (b.entering) {
    b.y += ((m.y + m.h) / m.enterTime) * dt;
    if (b.y >= m.y) {
      b.y = m.y;
      b.entering = false;
    }
  }
  // Wider fields get a wider sway, but the boss always stays inside.
  const amp = Math.min(m.swayAmp * Math.min(1.6, state.fieldW / 240), Math.max(0, (state.fieldW - b.w) / 2 - 4));
  b.x = state.fieldW / 2 + Math.sin(b.t * m.swaySpeed) * amp - b.w / 2;
  for (const p of b.parts) {
    p.x = b.x + p.offsetX;
    p.y = b.y + p.offsetY;
  }
  return !b.entering && state.phase === 'playing';
}

export function coreBox(b: Boss, coreX: number, coreW: number): Box {
  return { x: b.x + coreX, y: b.y, w: coreW, h: b.h };
}

export function aimedShot(state: SimState, x: number, y: number, events: SimEvent[]): void {
  const v = aimVelocity(state, x, y, state.diff.bulletSpeed);
  spawnEnemyBullet(state, x, y, v.vx, v.vy);
  events.push({ type: 'enemyShot', x, y });
}

export function destroyParts(b: Boss, events: SimEvent[]): void {
  for (const p of b.parts) {
    if (!p.alive) continue;
    p.alive = false;
    events.push({ type: 'partDestroyed', x: p.x + p.w / 2, y: p.y + p.h / 2 });
  }
}

export function phaseForHp(hp: number, maxHp: number): 1 | 2 | 3 {
  const r = hp / maxHp;
  return r <= 1 / 3 ? 3 : r <= 2 / 3 ? 2 : 1;
}

/** Advances the boss phase if HP crossed a threshold. Returns true when the phase changed. */
export function applyPhase(state: SimState, b: Boss, events: SimEvent[]): boolean {
  const target = phaseForHp(b.hp, b.maxHp);
  if (target <= b.phase) return false;
  b.phase = target;
  state.hitStop = HITSTOP.bossPhase;
  events.push({ type: 'bossPhase', phase: target as 2 | 3 });
  return true;
}

export function killBoss(state: SimState, events: SimEvent[]): void {
  const b = state.boss;
  if (!b) return;
  const points = BOSS_POINTS * (state.world + 1) * (state.loop + 1);
  state.score += points;
  b.hp = 0;
  b.dying = BOSS_DYING_TIME;
  b.laser = null;
  b.phased = false;
  state.phase = 'bossDying';
  state.phaseTimer = BOSS_DYING_TIME;
  state.run.bossesKilled++;
  cancelBullets(state, events);
  state.enemies = [];
  events.push({ type: 'bossKilled', x: b.x + b.w / 2, y: b.y + b.h / 2, points });
}
