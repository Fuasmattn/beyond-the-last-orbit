import { BOON, ENEMY, PLAYER, POINTS, SCRAP } from '../data/balance';
import { allocId } from './ids';
import { hitBoss } from './boss';
import { overlaps } from './geometry';
import { hitPlayer, hurtbox } from './player';
import { recordHit, registerGraze, registerKill } from './scoring';
import { spawnMini } from './specials';
import type { Box, Bullet, SimEvent, SimState } from './types';

export { overlaps } from './geometry';

export function resolveCollisions(state: SimState, events: SimEvent[]): void {
  const spent = new Set<number>();

  for (const b of state.bullets) {
    if (b.owner !== 'player') continue;
    if (state.boss && hitBoss(state, b, events)) {
      spent.add(b.id);
      continue;
    }
    for (const e of state.enemies) {
      if (e.hp <= 0 || e.phased || b.pierced?.includes(e.id) || !overlaps(b, e)) continue;
      recordHit(state, b);
      if ((b.pierce ?? 0) > 0) {
        b.pierce!--;
        (b.pierced ??= []).push(e.id);
      } else {
        spent.add(b.id);
      }
      e.hp -= b.damage ?? 1;
      e.flash = ENEMY.flashTime;
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;
      if (e.hp <= 0) {
        const points = registerKill(state, POINTS[e.kind], b.mult);
        state.rogue.scrap += state.diff.elite ? SCRAP.eliteKill : SCRAP.kill;
        state.run.kills++;
        events.push({ type: 'enemyKilled', id: e.id, kind: e.kind, x: cx, y: cy, points });
        if (state.ship.shrapnel && !b.ttl) spawnShrapnel(state, cx, cy, b, events);
        if (e.kind === 'splitter') {
          spawnMini(state, cx, cy, -1);
          spawnMini(state, cx, cy, 1);
          events.push({ type: 'split', id: e.id, x: cx, y: cy });
        }
      } else {
        events.push({ type: 'enemyHit', id: e.id, x: cx, y: cy });
      }
      break;
    }
  }

  if (state.player.invuln <= 0) {
    const hurt = hurtbox(state);
    for (const b of state.bullets) {
      if (b.owner === 'enemy' && !spent.has(b.id) && overlaps(b, hurt)) {
        spent.add(b.id);
        hitPlayer(state, events);
        break;
      }
    }
  }

  if (state.player.invuln <= 0 && state.phase === 'playing') checkGrazes(state, spent, events);

  if (state.player.invuln <= 0) {
    for (const e of state.enemies) {
      if ((e.dive || e.free) && e.hp > 0 && overlaps(e, state.player)) {
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

/**
 * Enemy bullets that enter the graze margin around the ship and then leave it without hitting
 * score once each. (A hit clears all enemy bullets, so a bullet that hits never scores.)
 */
function checkGrazes(state: SimState, spent: ReadonlySet<number>, events: SimEvent[]): void {
  const h = hurtbox(state);
  const m = state.ship.grazeMargin;
  const zone: Box = { x: h.x - m, y: h.y - m, w: h.w + m * 2, h: h.h + m * 2 };
  for (const b of state.bullets) {
    if (b.owner !== 'enemy' || b.grazed || spent.has(b.id)) continue;
    if (overlaps(b, zone)) {
      b.nearMiss = true;
      continue;
    }
    if (!b.nearMiss) continue;
    b.grazed = true;
    const points = registerGraze(state);
    events.push({ type: 'graze', x: b.x + b.w / 2, y: b.y + b.h / 2, points });
  }
}

/** SHRAPNEL: two short-lived fragments fly diagonally up from a kill, carrying the bolt's damage. */
function spawnShrapnel(state: SimState, cx: number, cy: number, from: Bullet, events: SimEvent[]): void {
  for (const dir of [-1, 1] as const) {
    state.bullets.push({
      id: allocId(state),
      x: cx - PLAYER.bulletW / 2,
      y: cy - PLAYER.bulletH / 2,
      w: PLAYER.bulletW,
      h: PLAYER.bulletH,
      vx: Math.sin(BOON.shrapnelAngle) * BOON.shrapnelSpeed * dir,
      vy: -Math.cos(BOON.shrapnelAngle) * BOON.shrapnelSpeed,
      owner: 'player',
      onBeat: from.onBeat,
      mult: from.mult,
      damage: state.ship.damage,
      extra: true,
      ttl: BOON.shrapnelTtl,
    });
  }
  events.push({ type: 'shrapnel', x: cx, y: cy });
}
