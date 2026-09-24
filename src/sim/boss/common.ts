import { BOSS_DYING_TIME, BOSS_POINTS, HITSTOP } from '../../data/balance';
import { spawnEnemyBullet } from '../bullets';
import type { Boss, SimEvent, SimState } from '../types';

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
  state.phase = 'bossDying';
  state.phaseTimer = BOSS_DYING_TIME;
  state.run.bossesKilled++;
  state.bullets = state.bullets.filter((x) => x.owner === 'player');
  events.push({ type: 'bossKilled', x: b.x + b.w / 2, y: b.y + b.h / 2, points });
}
