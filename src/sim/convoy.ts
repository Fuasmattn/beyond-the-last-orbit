import { CONVOY, ENEMY } from '../data/balance';
import { spawnBomb } from './bullets';
import { allocId } from './ids';
import { spawnFree } from './specials';
import type { Enemy, FightState, SimEvent, SimState } from './types';

/** Freighter count grows slowly with difficulty. */
export function initConvoy(state: SimState): FightState {
  return { budget: CONVOY.baseCount + Math.floor(state.diff.d / 4), timer: 1.0, launched: 0, groups: {} };
}

function launchFreighter(state: SimState): void {
  const f = state.fight;
  const dir = f.launched % 2 === 0 ? 1 : -1;
  const y = CONVOY.lanesY[f.launched % CONVOY.lanesY.length]!;
  const hp = CONVOY.hp + state.world + state.diff.hpBonus * 2;
  state.enemies.push({
    id: allocId(state),
    kind: 'freighter',
    row: -1,
    col: f.launched,
    hp,
    maxHp: hp,
    flash: 0,
    dive: null,
    entry: null,
    free: { vx: dir * CONVOY.speed, vy: 0 },
    phased: false,
    x: dir > 0 ? -CONVOY.w : state.fieldW,
    y,
    w: CONVOY.w,
    h: CONVOY.h,
    bombTimer: CONVOY.bombEvery,
    escorts: [...CONVOY.escortAt],
  });
  f.launched++;
  f.budget--;
  f.timer = state.diff.elite ? CONVOY.eliteEvery : CONVOY.every;
}

/** Launches freighters on the timer; each drops bombs and releases escorts, and escapes off the far side. */
export function updateConvoy(state: SimState, dt: number, events: SimEvent[]): void {
  const f = state.fight;
  for (const e of state.enemies) if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
  f.timer -= dt;
  if (f.timer <= 0 && f.budget > 0) launchFreighter(state);

  const escaped: Enemy[] = [];
  const p = state.player;
  for (const e of state.enemies) {
    if (e.kind !== 'freighter' || !e.free) continue;
    // Motion is applied by updateSpecials (freighters do not bounce); escapes are judged here.
    const inField = e.x + e.w > 0 && e.x < state.fieldW;
    if ((e.free.vx > 0 && e.x >= state.fieldW) || (e.free.vx < 0 && e.x + e.w <= 0)) {
      escaped.push(e);
      continue;
    }
    if (!inField) continue;
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h;
    if (e.escorts && e.escorts.length > 0) {
      e.escorts = e.escorts.map((t) => t - dt);
      while (e.escorts.length > 0 && e.escorts[0]! <= 0) {
        e.escorts.shift();
        const dx = p.x + p.w / 2 - cx;
        const dy = Math.max(20, p.y + p.h / 2 - cy);
        const len = Math.hypot(dx, dy);
        spawnFree(state, 'diver', cx, cy, (dx / len) * CONVOY.escortSpeed, (dy / len) * CONVOY.escortSpeed, ENEMY);
        events.push({ type: 'dive', id: e.id });
      }
    }
    if (e.bombTimer !== undefined) {
      e.bombTimer -= dt;
      if (e.bombTimer <= 0) {
        e.bombTimer = CONVOY.bombEvery;
        spawnBomb(state, cx, cy);
        events.push({ type: 'enemyShot', x: cx, y: cy });
      }
    }
  }
  if (escaped.length > 0) {
    state.enemies = state.enemies.filter((e) => !escaped.includes(e));
    for (const e of escaped) {
      state.stageStats.escaped++;
      events.push({ type: 'escaped', x: e.x + e.w / 2, y: e.y + e.h / 2 });
    }
  }
}
