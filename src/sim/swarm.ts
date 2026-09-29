import { ENEMY, SWARM } from '../data/balance';
import { worldAt } from '../data/worlds';
import { aimVelocity, spawnEnemyBullet } from './bullets';
import { enemyHp } from './difficulty';
import { allocId } from './ids';
import { nextRandom } from './rng';
import type { Enemy, EnemyKind, FightState, Path, SimEvent, SimState } from './types';

type Pt = readonly [number, number];
type Pts = readonly [Pt, Pt, Pt, Pt];

/** Path templates in field coordinates for a field `w` wide: enter off-screen, sweep, leave. */
function templates(w: number): Pts[] {
  const off = ENEMY.w + 8;
  return [
    // Left swoop: in top-left, dip low on the left, sweep right, out the bottom middle.
    [[-off, 20], [w * 0.3, 210], [w * 1.1, 60], [w * 0.5, 340]],
    // Right swoop: mirror.
    [[w + off, 20], [w * 0.7, 210], [-w * 0.1, 60], [w * 0.5, 340]],
    // S-curve down the middle.
    [[w * 0.5, -off], [-w * 0.4, 110], [w * 1.4, 200], [w * 0.5, 340]],
    // Wide loop: in left, across the top, back out on the left lower down.
    [[-off, 60], [w * 1.3, 30], [w * 1.3, 230], [-off - 10, 190]],
  ];
}

/** Point on the cubic Bézier at 0 ≤ s ≤ 1. */
export function bezier(pts: Pts, s: number): { x: number; y: number } {
  const u = 1 - s;
  const a = u * u * u;
  const b = 3 * u * u * s;
  const c = 3 * u * s * s;
  const d = s * s * s;
  return {
    x: a * pts[0][0] + b * pts[1][0] + c * pts[2][0] + d * pts[3][0],
    y: a * pts[0][1] + b * pts[1][1] + c * pts[2][1] + d * pts[3][1],
  };
}

const GROUP_KINDS: readonly EnemyKind[] = ['grunt', 'diver', 'gunner'];

/** Budget: a share of the formation this stage would have fielded. */
export function initSwarm(state: SimState): FightState {
  const { rows, cols } = state.diff;
  return { budget: Math.max(SWARM.groupMin, Math.round(rows * cols * SWARM.budgetShare)), timer: 0.8, launched: 0, groups: {} };
}

function launchGroup(state: SimState): void {
  const f = state.fight;
  const rng = state.rng;
  const size = Math.min(f.budget, SWARM.groupMin + Math.floor(nextRandom(rng) * (SWARM.groupMax - SWARM.groupMin + 1)));
  const paths = templates(state.fieldW);
  const pts = paths[Math.floor(nextRandom(rng) * paths.length)]!;
  const cycle = [...GROUP_KINDS, worldAt(state.world).special];
  const kind = cycle[f.launched % cycle.length]!;
  const hp = enemyHp(kind, state.diff);
  const group = f.launched;
  for (let i = 0; i < size; i++) {
    const path: Path = { t: -i * SWARM.stagger, duration: SWARM.passTime, pts, shots: 0 };
    const start = bezier(pts, 0);
    state.enemies.push({
      id: allocId(state),
      kind,
      row: -1,
      col: i,
      hp,
      maxHp: hp,
      flash: 0,
      dive: null,
      entry: null,
      free: null,
      phased: false,
      path,
      group,
      x: start.x,
      y: start.y,
      w: ENEMY.w,
      h: ENEMY.h,
    });
  }
  f.groups[group] = { size, killed: 0 };
  f.launched++;
  f.budget -= size;
  f.timer = state.diff.elite ? SWARM.eliteGroupEvery : SWARM.groupEvery;
}

/** Launches groups on the timer and flies every path enemy; members fire once as they pass the player's band. */
export function updateSwarm(state: SimState, dt: number, events: SimEvent[]): void {
  const f = state.fight;
  for (const e of state.enemies) if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
  f.timer -= dt;
  if (f.timer <= 0 && f.budget > 0) launchGroup(state);

  const gone: Enemy[] = [];
  for (const e of state.enemies) {
    const p = e.path;
    if (!p) continue;
    p.t += dt;
    if (p.t < 0) continue;
    const s = p.t / p.duration;
    if (s >= 1) {
      gone.push(e);
      continue;
    }
    const pos = bezier(p.pts, s);
    e.x = pos.x;
    e.y = pos.y;
    const shotsWanted = e.kind === 'gunner' ? 2 : 1;
    if (p.shots < shotsWanted && s >= SWARM.fireAt + p.shots * 0.2) {
      p.shots++;
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h;
      const v = aimVelocity(state, cx, cy, state.diff.bulletSpeed);
      spawnEnemyBullet(state, cx, cy, v.vx, v.vy);
      events.push({ type: 'enemyShot', x: cx, y: cy });
    }
  }
  if (gone.length > 0) state.enemies = state.enemies.filter((e) => !gone.includes(e));
}

/** A path enemy died: count it toward its group; a full group pays the chain bonus. */
export function swarmKill(state: SimState, e: Enemy, cx: number, cy: number, events: SimEvent[]): void {
  if (e.group === undefined) return;
  const g = state.fight.groups[e.group];
  if (!g) return;
  g.killed++;
  if (g.killed !== g.size) return;
  const points = Math.round(SWARM.chainPoints * g.size * state.rhythm.mult * state.ship.scoreMul);
  state.score += points;
  events.push({ type: 'groupCleared', x: cx, y: cy, points });
}
