import { ENEMY, POINTS } from '../data/balance';
import { hitBoss } from './boss';
import { overlaps } from './geometry';
import { hitPlayer } from './player';
import { recordHit, registerKill } from './scoring';
import type { SimEvent, SimState } from './types';

export { overlaps } from './geometry';

export function resolveCollisions(state: SimState, events: SimEvent[]): void {
  const spent = new Set<number>();

  for (const b of state.bullets) {
    if (b.owner !== 'player') continue;
    if (state.boss) {
      if (hitBoss(state, b, events)) spent.add(b.id);
      continue;
    }
    for (const e of state.enemies) {
      if (e.hp <= 0 || !overlaps(b, e)) continue;
      spent.add(b.id);
      e.hp--;
      e.flash = ENEMY.flashTime;
      recordHit(state);
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;
      if (e.hp <= 0) {
        const points = registerKill(state, POINTS[e.kind], b.mult);
        events.push({ type: 'enemyKilled', id: e.id, kind: e.kind, x: cx, y: cy, points });
      } else {
        events.push({ type: 'enemyHit', id: e.id, x: cx, y: cy });
      }
      break;
    }
  }

  if (state.player.invuln <= 0) {
    for (const b of state.bullets) {
      if (b.owner === 'enemy' && !spent.has(b.id) && overlaps(b, state.player)) {
        spent.add(b.id);
        hitPlayer(state, events);
        break;
      }
    }
  }

  if (state.player.invuln <= 0) {
    for (const e of state.enemies) {
      if (e.dive && e.hp > 0 && overlaps(e, state.player)) {
        e.hp = 0;
        events.push({ type: 'enemyKilled', id: e.id, kind: e.kind, x: e.x + e.w / 2, y: e.y + e.h / 2, points: 0 });
        hitPlayer(state, events);
        break;
      }
    }
  }

  state.enemies = state.enemies.filter((e) => e.hp > 0);
  if (spent.size > 0) state.bullets = state.bullets.filter((b) => !spent.has(b.id));
}
