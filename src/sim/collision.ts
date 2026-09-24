import { ENEMY, POINTS } from '../data/balance';
import { hitPlayer } from './player';
import type { Box, SimEvent, SimState } from './types';

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function resolveCollisions(state: SimState, events: SimEvent[]): void {
  const spent = new Set<number>();

  for (const b of state.bullets) {
    if (b.owner !== 'player') continue;
    for (const e of state.enemies) {
      if (e.hp <= 0 || !overlaps(b, e)) continue;
      spent.add(b.id);
      e.hp--;
      e.flash = ENEMY.flashTime;
      state.stats.hits++;
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;
      if (e.hp <= 0) {
        const points = POINTS[e.kind];
        state.score += points;
        events.push({ type: 'enemyKilled', id: e.id, kind: e.kind, x: cx, y: cy, points });
      } else {
        events.push({ type: 'enemyHit', id: e.id, x: cx, y: cy });
      }
      break;
    }
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0);

  if (state.player.invuln <= 0) {
    for (const b of state.bullets) {
      if (b.owner === 'enemy' && overlaps(b, state.player)) {
        spent.add(b.id);
        hitPlayer(state, events);
        break;
      }
    }
  }

  if (spent.size > 0) state.bullets = state.bullets.filter((b) => !spent.has(b.id));
}
