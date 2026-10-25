import { DIFFICULTY, ENEMY, FIELD_H, GAUNTLET } from '../data/balance';
import { worldAt } from '../data/worlds';
import { aimVelocity, spawnEnemyBullet } from './bullets';
import { enemyHp } from './difficulty';
import { allocId } from './ids';
import { nextRandom } from './rng';
import { bezier } from './swarm';
import type { Enemy, EnemyKind, FightState, Path, SimEvent, SimState, Wave, WaveShape } from './types';

type Rng = { seed: number };

const SHAPES: readonly WaveShape[] = ['column', 'line', 'vee', 'weave'];
const OFF = ENEMY.h + 8;

/** Difficulty-eased value between `range[0]` (d = 0) and `range[1]` (high d). */
function ease(range: readonly [number, number], d: number): number {
  const [a, b] = range;
  return a + (b - a) * (1 - Math.exp(-d / DIFFICULTY.k));
}

function kindCycle(state: SimState): EnemyKind[] {
  const d = state.diff.d;
  const cycle: EnemyKind[] = ['grunt', 'grunt', 'gunner'];
  if (d >= 1) cycle.push('diver');
  if (d >= 2) cycle.push('shield');
  if (d >= 3) cycle.push(worldAt(state.world).special);
  if (state.diff.elite) cycle.push('gunner');
  return cycle;
}

/**
 * The stage's wave script, rolled from the difficulty and the seeded RNG: waves every `waveGap`
 * seconds (closer as the difficulty rises) until `GAUNTLET.length`.
 */
export function generateScript(state: SimState, rng: Rng = state.rng): Wave[] {
  const { d, elite } = state.diff;
  const gap = ease(GAUNTLET.waveGap, d) * (elite ? GAUNTLET.eliteGapMul : 1);
  const [minMembers, maxMembers] = GAUNTLET.members;
  const speed = GAUNTLET.speed + GAUNTLET.speedPerD * d;
  const cycle = kindCycle(state);
  const margin = ENEMY.w;
  const script: Wave[] = [];
  let t = 0.8;
  for (let i = 0; t < GAUNTLET.length; i++) {
    const shape = SHAPES[Math.floor(nextRandom(rng) * SHAPES.length)]!;
    const count = minMembers + Math.floor(nextRandom(rng) * (maxMembers - minMembers + 1));
    // Keep the whole shape inside the field: lines and vees spread from their lead x.
    const span = shape === 'line' || shape === 'vee' ? (count - 1) * GAUNTLET.spacing : 0;
    const x = margin + span / 2 + nextRandom(rng) * (state.fieldW - 2 * margin - span);
    script.push({
      at: t,
      kind: cycle[i % cycle.length]!,
      count,
      shape,
      stagger: shape === 'line' ? 0 : GAUNTLET.stagger,
      speed,
      x,
    });
    t += gap * (0.8 + 0.4 * nextRandom(rng));
  }
  return script;
}

export function initGauntlet(state: SimState): FightState {
  const script = generateScript(state);
  const budget = script.reduce((n, w) => n + w.count, 0);
  return { budget, timer: 0, launched: 0, groups: {}, clock: 0, script, cursor: 0, pending: [] };
}

/** Field-wide S-curve from the top, through the player's band, out the bottom. */
function weavePath(state: SimState, x: number): Path['pts'] {
  const w = state.fieldW;
  const swing = Math.min(w * 0.45, 90);
  const left = x - ENEMY.w / 2;
  // Control points clamp to the field so the weave never swings out of reach.
  return [
    [left, -OFF],
    [Math.max(0, left - swing), 110],
    [Math.min(w - ENEMY.w, left + swing), 210],
    [Math.min(w - ENEMY.w, Math.max(0, left)), FIELD_H + OFF],
  ];
}

function spawnMember(state: SimState, wave: Wave, index: number, group: number): void {
  const hp = enemyHp(wave.kind, state.diff);
  const base: Enemy = {
    id: allocId(state),
    kind: wave.kind,
    row: -1,
    col: index,
    hp,
    maxHp: hp,
    flash: 0,
    dive: null,
    entry: null,
    free: null,
    phased: false,
    group,
    x: wave.x - ENEMY.w / 2,
    y: -OFF,
    w: ENEMY.w,
    h: ENEMY.h,
  };
  // Members alternate right / left of the lead so lines and vees stay centered on the wave x.
  const side = index % 2 === 0 ? 1 : -1;
  const offset = Math.ceil(index / 2) * GAUNTLET.spacing * side;
  switch (wave.shape) {
    case 'column':
      // The whole column drifts toward the far wall (and bounces), so it cannot be camped from one spot.
      base.free = { vx: wave.x < state.fieldW / 2 ? GAUNTLET.columnDrift : -GAUNTLET.columnDrift, vy: wave.speed };
      break;
    case 'line':
      base.x += offset;
      base.free = { vx: 0, vy: wave.speed };
      break;
    case 'vee':
      // Staggered launch plus the sideways offset traces the V.
      base.x += offset;
      base.free = { vx: 0, vy: wave.speed };
      break;
    case 'weave':
      base.path = { t: 0, duration: GAUNTLET.weaveTime, pts: weavePath(state, wave.x), shots: 0 };
      break;
  }
  state.enemies.push(base);
}

function passShot(state: SimState, e: Enemy, events: SimEvent[]): void {
  e.fired = true;
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h;
  const v = aimVelocity(state, cx, cy, state.diff.bulletSpeed);
  spawnEnemyBullet(state, cx, cy, v.vx, v.vy);
  events.push({ type: 'enemyShot', x: cx, y: cy });
}

/**
 * Releases waves on the script clock, launches their members, flies the weaves, lets gunners take
 * one aimed shot on the way down, and counts everything that leaves the bottom as escaped.
 */
export function updateGauntlet(state: SimState, dt: number, events: SimEvent[]): void {
  const f = state.fight;
  const script = f.script ?? [];
  const pending = (f.pending ??= []);
  f.clock = (f.clock ?? 0) + dt;
  f.cursor ??= 0;
  for (const e of state.enemies) if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);

  while (f.cursor < script.length && script[f.cursor]!.at <= f.clock) {
    const wave = script[f.cursor++]!;
    const group = f.launched++;
    f.groups[group] = { size: wave.count, killed: 0 };
    pending.push({ wave, group, left: wave.count, next: 0 });
  }
  for (const p of pending) {
    p.next -= dt;
    while (p.left > 0 && p.next <= 0) {
      spawnMember(state, p.wave, p.wave.count - p.left, p.group);
      p.left--;
      p.next += p.wave.stagger;
      f.budget--;
    }
  }
  f.pending = pending.filter((p) => p.left > 0);

  const escaped: Enemy[] = [];
  for (const e of state.enemies) {
    if (e.group === undefined) continue;
    if (e.path) {
      e.path.t += dt;
      const s = e.path.t / e.path.duration;
      if (s >= 1) {
        escaped.push(e);
        continue;
      }
      const pos = bezier(e.path.pts, s);
      e.x = pos.x;
      e.y = pos.y;
    } else if (e.free) {
      // updateSpecials moves free movers after this and drops them past the bottom; judge the escape first.
      if (e.y + e.free.vy * dt > FIELD_H) {
        escaped.push(e);
        continue;
      }
    }
    if (e.kind === 'gunner' && !e.fired && e.y >= GAUNTLET.fireY) passShot(state, e, events);
  }
  if (escaped.length > 0) {
    state.enemies = state.enemies.filter((e) => !escaped.includes(e));
    for (const e of escaped) {
      state.stageStats.escaped++;
      events.push({ type: 'escaped', x: e.x + e.w / 2, y: Math.min(FIELD_H, e.y) });
    }
  }
}
