import { DIVE } from '../data/balance';
import { aimVelocity, spawnEnemyBullet } from './bullets';
import { inFormation, slotPosition } from './formation';
import { clamp } from './math';
import { nextRandom } from './rng';
import type { Dive, SimEvent, SimState } from './types';

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Swoop down to the target, swinging sideways, then blend back into the formation slot. */
export function divePosition(dive: Dive, slotX: number, slotY: number): { x: number; y: number } {
  const s = clamp(dive.t / dive.duration, 0, 1);
  const arc = Math.sin(s * Math.PI);
  const px = dive.startX + (dive.targetX - dive.startX) * arc + dive.dir * DIVE.swing * Math.sin(s * 2 * Math.PI);
  const py = dive.startY + (DIVE.bottomY - dive.startY) * arc;
  const w = smoothstep(0.85, 1, s);
  return { x: px + (slotX - px) * w, y: py + (slotY - py) * w };
}

export function updateDives(state: SimState, dt: number, events: SimEvent[]): void {
  state.diveTimer -= dt;
  if (state.diveTimer <= 0) {
    state.diveTimer = state.diff.diveInterval * (0.75 + 0.5 * nextRandom(state.rng));
    const candidates = state.enemies.filter((e) => e.kind === 'diver' && inFormation(e));
    const e = candidates[Math.floor(nextRandom(state.rng) * candidates.length)];
    if (e) {
      const p = state.player;
      e.dive = {
        t: 0,
        duration: DIVE.duration,
        startX: e.x,
        startY: e.y,
        targetX: clamp(p.x + p.w / 2 - e.w / 2, 0, state.fieldW - e.w),
        dir: nextRandom(state.rng) < 0.5 ? -1 : 1,
        fired: false,
      };
      events.push({ type: 'dive', id: e.id });
    }
  }

  for (const e of state.enemies) {
    const d = e.dive;
    if (!d) continue;
    d.t += dt;
    const slot = slotPosition(state, e);
    if (d.t >= d.duration) {
      e.dive = null;
      e.x = slot.x;
      e.y = slot.y;
      continue;
    }
    const pos = divePosition(d, slot.x, slot.y);
    e.x = pos.x;
    e.y = pos.y;
    if (!d.fired && d.t >= d.duration * DIVE.fireAt) {
      d.fired = true;
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h;
      const v = aimVelocity(state, cx, cy, state.diff.bulletSpeed);
      spawnEnemyBullet(state, cx, cy, v.vx, v.vy);
      events.push({ type: 'enemyShot', x: cx, y: cy });
    }
  }
}
