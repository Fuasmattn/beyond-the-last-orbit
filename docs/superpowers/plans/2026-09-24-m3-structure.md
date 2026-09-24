# Space Alliance M3 — Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single looping stage into the real run structure: 5 stages per world (stage 5 = boss), ORBITAL WARDEN boss with 3 beat-synced phases, divers and shield enemies, difficulty curve, stage results + bonus, extra lives, hit-stop, boss music, local top-10 highscores with arcade initials entry, and title / run / game-over scenes.

**Architecture:** Sim stays pure and deterministic; beat position now enters the sim through `InputFrame.beat` (audio clock, or a sim-time fallback), so bosses attack on beats without touching Web Audio. Stage/world/loop progression lives in `stageFlow.ts`; bosses live under `src/sim/boss/`. Persistence is a pure parse/migrate/serialize layer over a `KeyValueStore`. The app becomes a small scene manager (Title → Run → GameOver).

**Tech Stack:** TypeScript, PixiJS 8, Web Audio, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-24-space-alliance-design.md` (§4 Gameplay, §5 Worlds & Bosses, §6 Score/Highscore/Save, §9 Input, §12 Errors)

**Plan format:** every file is given complete under a `**File: \`path\`**` heading (new or full replacement). `python3 /tmp/sa/extract.py <plan> <task> tests|src` materializes a task's test or source files.

## Global Constraints

- Difficulty scalar `d = world*5 + stage + loop*15`; capped curves `min + (max−min)(1 − e^(−d/18))`; all tuning in `src/data/balance.ts`.
- Stages 1–4 formation, stage 5 boss; after the last world → loop+1 back to world 0.
- Boss: 3 phases at 100/66/33 % HP; phase change = hit-stop 40 ms + music section switch on next bar; attacks fire on beats.
- Player hit: hit-stop 40 ms. Extra life every 50 000 points, max 5.
- Stage bonus: `accuracy×1000 + beat%×1000 + 2000 if no hit + max(0, par − time)×50`; perfect = no hit ∧ beat % ≥ 70 %.
- Boss kill: `5000 × world number × loop number`.
- Highscores: local top 10, 3 initials, arcade picker usable with keyboard and touch. Save: `localStorage['space-alliance:v1']`, versioned, corrupt → defaults + notice.
- `src/sim` and `src/data` must not import Pixi/Web Audio.
- `npm run typecheck` is expected to fail between Task 1 and Task 4 (view/app catch up in Task 4); `npm test` must pass after every task.

---

### Task 1: Sim — difficulty, beats, enemy variety, stage flow, Warden boss

**Files:** all below (complete contents). Existing tests `formation`, `enemyFire`, `collision`, `step`, `inputFrame`, `keyboard` are replaced.

**Interfaces (produced):**
- `difficultyFor(world, stage, loop): Difficulty`, `difficultyScalar`, `kindForRow(row, d)`, `enemyHp(kind, diff)`
- `beatsCrossed(state, external: number | null): number`, `currentBeat(state, external)`
- `spawnEnemyBullet(state, cx, y, vx, vy)`, `aimVelocity(state, cx, cy, speed)`
- `slotPosition(state, enemy)`, `formationWidth(cols)`, `formationSpeed(alive, total, min, max)`
- `divePosition(dive, slotX, slotY)`, `updateDives(state, dt, events)`
- `recordShot(state)`, `recordHit(state)`
- `startStage`, `finishStage`, `advanceStage`, `computeStageResult(stats, boss)`, `checkExtraLife`, `emptyStageStats()`
- `spawnBoss`, `updateBoss(state, dt, beats, events)`, `hitBoss(state, bullet, events)`; `wardenCore(b)`, `laserBox(b, l)`, `hitWarden`, `updateWarden`
- `InputFrame.beat: number | null`; `MenuAction`, `Tap`, `KeyboardInput.consumeMenu()`, `TouchInput.consumeTaps()`
- `WORLDS`, `worldAt(index)`, `WorldId`

- [ ] **Step 1: Write the tests** (`extract.py … 1 tests`), run `npx vitest run tests/sim tests/input` → FAIL (missing modules).
- [ ] **Step 2: Write the sources** (`extract.py … 1 src`).
- [ ] **Step 3: Run** `npm test` → PASS.
- [ ] **Step 4: Commit** `feat(sim): difficulty curve, divers, shields, stage flow, Warden boss`

**File: `src/data/balance.ts`**
```ts
export const FIELD_W = 240;
export const FIELD_H = 320;
/** Top edge of the player movement zone (bottom 25 % of the field). */
export const PLAYER_ZONE_TOP = 240;
export const SIM_DT = 1 / 60;
export const MAX_STEPS_PER_FRAME = 5;

export const PLAYER = {
  w: 13,
  h: 8,
  maxSpeed: 140,
  /** Velocity approach rate per second; higher = snappier, lower = more inertia. */
  response: 18,
  bottomMargin: 6,
  fireCooldown: 0.12,
  maxBullets: 3,
  bulletSpeed: 320,
  bulletW: 2,
  bulletH: 6,
  startLives: 3,
  maxLives: 5,
  extraLifeEvery: 50_000,
  invulnTime: 1.5,
} as const;

export const ENEMY = {
  w: 11,
  h: 8,
  spacingX: 18,
  spacingY: 14,
  rows: 5,
  startY: 36,
  bulletW: 2,
  bulletH: 6,
  flashTime: 0.08,
} as const;

export const FORMATION = {
  dropStep: 6,
  edgeMargin: 4,
} as const;

export const POINTS = { grunt: 10, gunner: 20, diver: 30, shield: 40 } as const;
export const TURRET_POINTS = 250;

export const DIVE = {
  duration: 2.4,
  /** Lowest point of the swoop — inside the player zone. */
  bottomY: 270,
  swing: 30,
  /** Fraction of the dive at which the diver fires its aimed shot. */
  fireAt: 0.3,
} as const;

export const DIFFICULTY = {
  k: 18,
  loopWeight: 15,
  marchMin: [12, 40],
  marchMax: [80, 150],
  fireRate: [0.7, 2.6],
  bulletSpeed: [100, 170],
  diveInterval: [7, 2],
} as const;

export const STAGE = {
  perWorld: 5,
  introTime: 1.5,
  bossIntroTime: 2.2,
  clearTime: 3,
  parTime: 35,
  bossParTime: 60,
  timeBonusPerSec: 50,
  perfectBeatPct: 0.7,
} as const;

export const HITSTOP = {
  playerHit: 0.04,
  bossPhase: 0.04,
} as const;

export const BOSS_DYING_TIME = 1.6;
export const BOSS_POINTS = 5000;

export const WARDEN = {
  w: 56,
  h: 20,
  y: 34,
  hp: 90,
  coreX: 18,
  coreW: 20,
  turretW: 10,
  turretH: 8,
  turretHp: 10,
  turretOffsets: [
    [4, 18],
    [42, 18],
  ],
  enterTime: 2,
  swayAmp: 50,
  swaySpeed: 0.6,
  spreadAngle: 0.3,
  ringCount: 10,
  ringSpin: 0.35,
  laserWarn: 0.8,
  laserFire: 1.2,
  laserSweep: 60,
  laserW: 8,
} as const;

export const RHYTHM = {
  /** ± seconds around a grid line that count as on-beat. */
  windowSec: 0.07,
  /** Grid lines per beat (1 = quarter notes). */
  subdivision: 1,
  shotsPerStep: 4,
  multStep: 0.5,
  maxMult: 4,
} as const;

export const COMBO = {
  window: 1,
  step: 0.1,
  maxChain: 10,
} as const;
```

**File: `src/data/worlds.ts`**
```ts
import type { BossKind } from '../sim/types';

export type WorldId = 'earth' | 'moon' | 'mars';

export interface WorldDef {
  id: WorldId;
  name: string;
  bpm: number;
  boss: BossKind;
  bossName: string;
}

export const WORLDS: readonly WorldDef[] = [
  { id: 'earth', name: 'NEAR EARTH ORBIT', bpm: 140, boss: 'warden', bossName: 'ORBITAL WARDEN' },
];

export function worldAt(index: number): WorldDef {
  const n = WORLDS.length;
  const w = WORLDS[((index % n) + n) % n];
  if (!w) throw new Error(`no world at index ${index}`);
  return w;
}
```

**File: `src/sim/types.ts`**
```ts
export type EnemyKind = 'grunt' | 'gunner' | 'diver' | 'shield';
export type BossKind = 'warden';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Dive {
  t: number;
  duration: number;
  startX: number;
  startY: number;
  targetX: number;
  dir: 1 | -1;
  fired: boolean;
}

export interface Enemy extends Box {
  id: number;
  kind: EnemyKind;
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  flash: number;
  dive: Dive | null;
}

export interface Bullet extends Box {
  id: number;
  vx: number;
  vy: number;
  owner: 'player' | 'enemy';
  onBeat: boolean;
  /** Rhythm multiplier captured at fire time. */
  mult: number;
}

export interface Player extends Box {
  vx: number;
  vy: number;
  cooldown: number;
  invuln: number;
  lives: number;
}

export interface Formation {
  x: number;
  y: number;
  dir: 1 | -1;
  total: number;
}

export interface BossPart extends Box {
  id: number;
  offsetX: number;
  offsetY: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  flash: number;
}

export interface Laser {
  state: 'warn' | 'fire';
  t: number;
  x: number;
  dir: 1 | -1;
}

export interface Boss extends Box {
  kind: BossKind;
  hp: number;
  maxHp: number;
  phase: 1 | 2 | 3;
  t: number;
  entering: boolean;
  flash: number;
  turrets: BossPart[];
  laser: Laser | null;
  beatCount: number;
  spiralAngle: number;
  /** Seconds of death animation left; 0 while alive. */
  dying: number;
}

export interface Difficulty {
  d: number;
  marchMin: number;
  marchMax: number;
  fireRate: number;
  bulletSpeed: number;
  diveInterval: number;
  cols: number;
  hpBonus: number;
  bossHpScale: number;
}

export interface StageStats {
  shots: number;
  hits: number;
  onBeatShots: number;
  hitsTaken: number;
  time: number;
}

export interface StageResult {
  accuracy: number;
  beatPct: number;
  noHit: boolean;
  time: number;
  bonus: number;
  perfect: boolean;
}

export type Phase = 'stageIntro' | 'playing' | 'bossDying' | 'stageClear' | 'gameOver';

export interface SimState {
  time: number;
  rng: { seed: number };
  nextId: number;
  phase: Phase;
  phaseTimer: number;
  world: number;
  stage: number;
  loop: number;
  score: number;
  nextExtraLife: number;
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  formation: Formation;
  boss: Boss | null;
  diff: Difficulty;
  enemyFireTimer: number;
  diveTimer: number;
  hitStop: number;
  beat: { last: number | null };
  rhythm: { streak: number; mult: number };
  combo: { chain: number; timer: number };
  stats: { shots: number; hits: number; onBeatShots: number };
  stageStats: StageStats;
  result: StageResult | null;
  run: { bossesKilled: number; perfectStages: number; stagesCleared: number };
}

export type SimEvent =
  | { type: 'shot'; x: number; y: number; onBeat: boolean }
  | { type: 'enemyHit'; id: number; x: number; y: number }
  | { type: 'enemyKilled'; id: number; kind: EnemyKind; x: number; y: number; points: number }
  | { type: 'enemyShot'; x: number; y: number }
  | { type: 'playerHit'; x: number; y: number; livesLeft: number }
  | { type: 'formationInvaded' }
  | { type: 'stageIntro'; world: number; stage: number; loop: number; boss: boolean }
  | { type: 'stageStart'; stage: number }
  | { type: 'stageClear'; stage: number; result: StageResult }
  | { type: 'worldClear'; world: number }
  | { type: 'extraLife'; lives: number }
  | { type: 'dive'; id: number }
  | { type: 'bossPhase'; phase: 2 | 3 }
  | { type: 'bossHit'; x: number; y: number }
  | { type: 'turretDestroyed'; x: number; y: number }
  | { type: 'bossKilled'; x: number; y: number; points: number }
  | { type: 'laserWarn'; x: number }
  | { type: 'laserFire'; x: number }
  | { type: 'gameOver'; score: number };

/** Input for one sim tick. Produced by input adapters, consumed by the sim. */
export interface InputFrame {
  /** Digital/analog movement axis, -1..1. */
  moveX: number;
  moveY: number;
  /** Direct displacement in logical px (touch relative drag). */
  dragX: number;
  dragY: number;
  /** Fire was pressed since the previous tick (edge, not held). */
  firePressed: boolean;
  /** Rhythm judgement for the press; null when no audio / no press. */
  fireOnBeat: boolean | null;
  /** Current beat position from the audio clock; null → sim-time fallback. */
  beat: number | null;
}

export const NO_INPUT: Readonly<InputFrame> = {
  moveX: 0,
  moveY: 0,
  dragX: 0,
  dragY: 0,
  firePressed: false,
  fireOnBeat: null,
  beat: null,
};
```

**File: `src/sim/geometry.ts`**
```ts
import type { Box } from './types';

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
```

**File: `src/sim/difficulty.ts`**
```ts
import { DIFFICULTY, STAGE } from '../data/balance';
import type { Difficulty, EnemyKind } from './types';

export function difficultyScalar(world: number, stage: number, loop: number): number {
  return world * STAGE.perWorld + stage + loop * DIFFICULTY.loopWeight;
}

function curve(range: readonly [number, number], d: number): number {
  const [min, max] = range;
  return min + (max - min) * (1 - Math.exp(-d / DIFFICULTY.k));
}

export function difficultyFor(world: number, stage: number, loop: number): Difficulty {
  const d = difficultyScalar(world, stage, loop);
  return {
    d,
    marchMin: curve(DIFFICULTY.marchMin, d),
    marchMax: curve(DIFFICULTY.marchMax, d),
    fireRate: curve(DIFFICULTY.fireRate, d),
    bulletSpeed: curve(DIFFICULTY.bulletSpeed, d),
    diveInterval: curve(DIFFICULTY.diveInterval, d),
    cols: 8 + Math.min(2, Math.floor(d / 5)),
    hpBonus: loop >= 1 ? 1 : 0,
    bossHpScale: 1 + loop * 0.5,
  };
}

/** Enemy type per formation row; new types appear as difficulty rises. */
export function kindForRow(row: number, d: number): EnemyKind {
  if (row === 0) return 'gunner';
  if (row === 1) return d >= 3 ? 'shield' : 'grunt';
  if (row === 2) return d >= 2 ? 'diver' : 'grunt';
  return 'grunt';
}

export function enemyHp(kind: EnemyKind, diff: Difficulty): number {
  return (kind === 'shield' ? 2 : 1) + diff.hpBonus;
}
```

**File: `src/sim/beat.ts`**
```ts
import { worldAt } from '../data/worlds';
import type { SimState } from './types';

const MAX_BEATS_PER_STEP = 4;

/** Beat position from the audio clock when available, else from sim time and the world BPM. */
export function currentBeat(state: SimState, external: number | null): number {
  return external ?? (state.time * worldAt(state.world).bpm) / 60;
}

/** Whole beats crossed since the previous call (0 on the first call, never negative). */
export function beatsCrossed(state: SimState, external: number | null): number {
  const b = Math.floor(currentBeat(state, external));
  const last = state.beat.last;
  state.beat.last = last === null ? b : Math.max(last, b);
  if (last === null) return 0;
  return Math.min(MAX_BEATS_PER_STEP, Math.max(0, b - last));
}
```

**File: `src/sim/bullets.ts`**
```ts
import { ENEMY, FIELD_H, FIELD_W } from '../data/balance';
import { allocId } from './ids';
import type { SimState } from './types';

export function moveBullets(state: SimState, dt: number): void {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  state.bullets = state.bullets.filter(
    (b) => b.y + b.h > 0 && b.y < FIELD_H && b.x + b.w > 0 && b.x < FIELD_W,
  );
}

/** Spawns an enemy bullet horizontally centered on `cx`. */
export function spawnEnemyBullet(state: SimState, cx: number, y: number, vx: number, vy: number): void {
  state.bullets.push({
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
  });
}

/** Velocity from (cx, cy) toward the player's center; always heads downward. */
export function aimVelocity(state: SimState, cx: number, cy: number, speed: number): { vx: number; vy: number } {
  const p = state.player;
  const dx = p.x + p.w / 2 - cx;
  const dy = Math.max(1, p.y + p.h / 2 - cy);
  const len = Math.hypot(dx, dy);
  return { vx: (dx / len) * speed, vy: (dy / len) * speed };
}
```

**File: `src/sim/formation.ts`**
```ts
import { ENEMY, FIELD_W, FORMATION } from '../data/balance';
import { enemyHp, kindForRow } from './difficulty';
import { allocId } from './ids';
import type { Enemy, SimState } from './types';

export function formationWidth(cols: number): number {
  return (cols - 1) * ENEMY.spacingX + ENEMY.w;
}

export function spawnFormation(state: SimState): void {
  const { cols, d } = state.diff;
  const x = Math.round((FIELD_W - formationWidth(cols)) / 2);
  const y = ENEMY.startY;
  state.formation = { x, y, dir: 1, total: ENEMY.rows * cols };
  state.enemies = [];
  for (let row = 0; row < ENEMY.rows; row++) {
    const kind = kindForRow(row, d);
    const hp = enemyHp(kind, state.diff);
    for (let col = 0; col < cols; col++) {
      state.enemies.push({
        id: allocId(state),
        kind,
        row,
        col,
        hp,
        maxHp: hp,
        flash: 0,
        dive: null,
        x: x + col * ENEMY.spacingX,
        y: y + row * ENEMY.spacingY,
        w: ENEMY.w,
        h: ENEMY.h,
      });
    }
  }
}

/** Classic rule: fewer survivors → faster march. Quadratic ease-in between min and max. */
export function formationSpeed(alive: number, total: number, min: number, max: number): number {
  if (total <= 0) return min;
  const t = 1 - alive / total;
  return min + (max - min) * t * t;
}

export function slotPosition(state: SimState, e: Enemy): { x: number; y: number } {
  return {
    x: state.formation.x + e.col * ENEMY.spacingX,
    y: state.formation.y + e.row * ENEMY.spacingY,
  };
}

export function updateFormation(state: SimState, dt: number): void {
  const f = state.formation;
  const enemies = state.enemies;
  if (enemies.length === 0) return;

  f.x += f.dir * formationSpeed(enemies.length, f.total, state.diff.marchMin, state.diff.marchMax) * dt;

  let minCol = Infinity;
  let maxCol = -Infinity;
  for (const e of enemies) {
    if (e.col < minCol) minCol = e.col;
    if (e.col > maxCol) maxCol = e.col;
  }
  const left = f.x + minCol * ENEMY.spacingX;
  const right = f.x + maxCol * ENEMY.spacingX + ENEMY.w;
  const rightLimit = FIELD_W - FORMATION.edgeMargin;

  if (f.dir === 1 && right > rightLimit) {
    f.x -= right - rightLimit;
    f.dir = -1;
    f.y += FORMATION.dropStep;
  } else if (f.dir === -1 && left < FORMATION.edgeMargin) {
    f.x += FORMATION.edgeMargin - left;
    f.dir = 1;
    f.y += FORMATION.dropStep;
  }

  for (const e of enemies) {
    if (!e.dive) {
      e.x = f.x + e.col * ENEMY.spacingX;
      e.y = f.y + e.row * ENEMY.spacingY;
    }
    if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
  }
}

/** Lowest edge of enemies still in formation (divers excluded). */
export function formationBottom(state: SimState): number {
  let bottom = -Infinity;
  for (const e of state.enemies) if (!e.dive) bottom = Math.max(bottom, e.y + e.h);
  return bottom;
}
```

**File: `src/sim/dive.ts`**
```ts
import { DIVE, FIELD_W } from '../data/balance';
import { aimVelocity, spawnEnemyBullet } from './bullets';
import { slotPosition } from './formation';
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
    const candidates = state.enemies.filter((e) => e.kind === 'diver' && !e.dive);
    const e = candidates[Math.floor(nextRandom(state.rng) * candidates.length)];
    if (e) {
      const p = state.player;
      e.dive = {
        t: 0,
        duration: DIVE.duration,
        startX: e.x,
        startY: e.y,
        targetX: clamp(p.x + p.w / 2 - e.w / 2, 0, FIELD_W - e.w),
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
```

**File: `src/sim/enemyFire.ts`**
```ts
import { aimVelocity, spawnEnemyBullet } from './bullets';
import { nextRandom } from './rng';
import type { Enemy, SimEvent, SimState } from './types';

/** Bottom-most in-formation enemy of each column, plus every in-formation gunner. */
function shooters(enemies: readonly Enemy[]): Enemy[] {
  const bottomByCol = new Map<number, Enemy>();
  for (const e of enemies) {
    if (e.dive) continue;
    const cur = bottomByCol.get(e.col);
    if (!cur || e.row > cur.row) bottomByCol.set(e.col, e);
  }
  const result = [...bottomByCol.values()];
  for (const e of enemies) if (e.kind === 'gunner' && !e.dive && !result.includes(e)) result.push(e);
  return result;
}

export function updateEnemyFire(state: SimState, dt: number, events: SimEvent[]): void {
  if (state.enemies.length === 0) return;
  state.enemyFireTimer -= dt;
  if (state.enemyFireTimer > 0) return;
  state.enemyFireTimer = (0.5 + nextRandom(state.rng)) / state.diff.fireRate;

  const candidates = shooters(state.enemies);
  const shooter = candidates[Math.floor(nextRandom(state.rng) * candidates.length)];
  if (!shooter) return;

  const cx = shooter.x + shooter.w / 2;
  const y = shooter.y + shooter.h;
  const speed = state.diff.bulletSpeed;
  const v = shooter.kind === 'gunner' ? aimVelocity(state, cx, y, speed) : { vx: 0, vy: speed };
  spawnEnemyBullet(state, cx, y, v.vx, v.vy);
  events.push({ type: 'enemyShot', x: cx, y });
}
```

**File: `src/sim/scoring.ts`**
```ts
import { COMBO, RHYTHM } from '../data/balance';
import type { SimState } from './types';

const MAX_STREAK = ((RHYTHM.maxMult - 1) / RHYTHM.multStep) * RHYTHM.shotsPerStep;

export function rhythmMultForStreak(streak: number): number {
  return Math.min(RHYTHM.maxMult, 1 + RHYTHM.multStep * Math.floor(streak / RHYTHM.shotsPerStep));
}

/** onBeat null = no audio judgement → neutral. */
export function applyShotRhythm(state: SimState, onBeat: boolean | null): void {
  if (onBeat === null) return;
  const r = state.rhythm;
  if (onBeat) {
    r.streak = Math.min(MAX_STREAK, r.streak + 1);
    state.stats.onBeatShots++;
    state.stageStats.onBeatShots++;
  } else {
    const level = Math.floor(r.streak / RHYTHM.shotsPerStep);
    r.streak = Math.max(0, (level - 1) * RHYTHM.shotsPerStep);
  }
  r.mult = rhythmMultForStreak(r.streak);
}

export function resetRhythm(state: SimState): void {
  state.rhythm.streak = 0;
  state.rhythm.mult = 1;
}

export function recordShot(state: SimState): void {
  state.stats.shots++;
  state.stageStats.shots++;
}

export function recordHit(state: SimState): void {
  state.stats.hits++;
  state.stageStats.hits++;
}

export function comboMult(state: SimState): number {
  return 1 + COMBO.step * state.combo.chain;
}

export function registerKill(state: SimState, base: number, bulletMult: number): number {
  const c = state.combo;
  c.chain = c.timer > 0 ? Math.min(COMBO.maxChain, c.chain + 1) : 0;
  c.timer = COMBO.window;
  const points = Math.round(base * bulletMult * comboMult(state));
  state.score += points;
  return points;
}

export function updateCombo(state: SimState, dt: number): void {
  const c = state.combo;
  if (c.timer <= 0) return;
  c.timer = Math.max(0, c.timer - dt);
  if (c.timer === 0) c.chain = 0;
}
```

**File: `src/sim/player.ts`**
```ts
import { FIELD_H, FIELD_W, HITSTOP, PLAYER, PLAYER_ZONE_TOP } from '../data/balance';
import { allocId } from './ids';
import { clamp } from './math';
import { applyShotRhythm, recordShot, resetRhythm } from './scoring';
import type { InputFrame, SimEvent, SimState } from './types';

export function updatePlayer(
  state: SimState,
  input: InputFrame,
  dt: number,
  events: SimEvent[],
): void {
  const p = state.player;
  const approach = Math.min(1, PLAYER.response * dt);
  p.vx += (clamp(input.moveX, -1, 1) * PLAYER.maxSpeed - p.vx) * approach;
  p.vy += (clamp(input.moveY, -1, 1) * PLAYER.maxSpeed - p.vy) * approach;
  p.x = clamp(p.x + p.vx * dt + input.dragX, 0, FIELD_W - p.w);
  p.y = clamp(p.y + p.vy * dt + input.dragY, PLAYER_ZONE_TOP, FIELD_H - p.h - PLAYER.bottomMargin);
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.invuln = Math.max(0, p.invuln - dt);

  if (input.firePressed) tryFire(state, input, events);
}

function tryFire(state: SimState, input: InputFrame, events: SimEvent[]): void {
  const p = state.player;
  if (p.cooldown > 0) return;
  let active = 0;
  for (const b of state.bullets) if (b.owner === 'player') active++;
  if (active >= PLAYER.maxBullets) return;

  const x = p.x + p.w / 2 - PLAYER.bulletW / 2;
  const y = p.y - PLAYER.bulletH;
  applyShotRhythm(state, input.fireOnBeat);
  const onBeat = input.fireOnBeat === true;
  state.bullets.push({
    id: allocId(state),
    x,
    y,
    w: PLAYER.bulletW,
    h: PLAYER.bulletH,
    vx: 0,
    vy: -PLAYER.bulletSpeed,
    owner: 'player',
    onBeat,
    mult: state.rhythm.mult,
  });
  p.cooldown = PLAYER.fireCooldown;
  recordShot(state);
  events.push({ type: 'shot', x: x + PLAYER.bulletW / 2, y, onBeat });
}

export function hitPlayer(state: SimState, events: SimEvent[]): void {
  const p = state.player;
  p.lives--;
  p.invuln = PLAYER.invulnTime;
  resetRhythm(state);
  state.stageStats.hitsTaken++;
  state.hitStop = HITSTOP.playerHit;
  state.bullets = state.bullets.filter((b) => b.owner === 'player');
  events.push({ type: 'playerHit', x: p.x + p.w / 2, y: p.y + p.h / 2, livesLeft: p.lives });
  if (p.lives <= 0) {
    state.phase = 'gameOver';
    events.push({ type: 'gameOver', score: state.score });
  }
}
```

**File: `src/sim/collision.ts`**
```ts
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
```

**File: `src/sim/boss/common.ts`**
```ts
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
```

**File: `src/sim/boss/warden.ts`**
```ts
import { FIELD_H, FIELD_W, TURRET_POINTS, WARDEN } from '../../data/balance';
import { aimVelocity, spawnEnemyBullet } from '../bullets';
import { overlaps } from '../geometry';
import { allocId } from '../ids';
import { clamp } from '../math';
import { hitPlayer } from '../player';
import { nextRandom } from '../rng';
import { recordHit, registerKill } from '../scoring';
import type { Boss, Box, Bullet, Laser, SimEvent, SimState } from '../types';
import { applyPhase, fireRing, fireSpread, killBoss } from './common';

/** ORBITAL WARDEN — satellite station with two turrets, a sweeping laser and spiral rings. */
export function spawnWarden(state: SimState): void {
  const hp = Math.round(WARDEN.hp * state.diff.bossHpScale);
  const x = (FIELD_W - WARDEN.w) / 2;
  const y = -WARDEN.h;
  state.boss = {
    kind: 'warden',
    x,
    y,
    w: WARDEN.w,
    h: WARDEN.h,
    hp,
    maxHp: hp,
    phase: 1,
    t: 0,
    entering: true,
    flash: 0,
    turrets: WARDEN.turretOffsets.map(([ox, oy]) => ({
      id: allocId(state),
      offsetX: ox,
      offsetY: oy,
      x: x + ox,
      y: y + oy,
      w: WARDEN.turretW,
      h: WARDEN.turretH,
      hp: WARDEN.turretHp,
      maxHp: WARDEN.turretHp,
      alive: true,
      flash: 0,
    })),
    laser: null,
    beatCount: 0,
    spiralAngle: 0,
    dying: 0,
  };
}

export function wardenCore(b: Boss): Box {
  return { x: b.x + WARDEN.coreX, y: b.y, w: WARDEN.coreW, h: b.h };
}

export function laserBox(b: Boss, l: Laser): Box {
  const top = b.y + b.h;
  return { x: l.x - WARDEN.laserW / 2, y: top, w: WARDEN.laserW, h: FIELD_H - top };
}

function positionParts(b: Boss): void {
  for (const t of b.turrets) {
    t.x = b.x + t.offsetX;
    t.y = b.y + t.offsetY;
  }
}

export function updateWarden(state: SimState, dt: number, beats: number, events: SimEvent[]): void {
  const b = state.boss;
  if (!b) return;
  b.t += dt;
  b.flash = Math.max(0, b.flash - dt);
  for (const t of b.turrets) t.flash = Math.max(0, t.flash - dt);
  if (b.dying > 0) {
    b.dying = Math.max(0, b.dying - dt);
    return;
  }
  if (b.entering) {
    b.y += ((WARDEN.y + WARDEN.h) / WARDEN.enterTime) * dt;
    if (b.y >= WARDEN.y) {
      b.y = WARDEN.y;
      b.entering = false;
    }
  }
  b.x = FIELD_W / 2 + Math.sin(b.t * WARDEN.swaySpeed) * WARDEN.swayAmp - b.w / 2;
  positionParts(b);
  if (b.entering || state.phase !== 'playing') return;

  for (let i = 0; i < beats; i++) onBeat(state, b, events);
  updateLaser(state, b, dt, events);
}

function onBeat(state: SimState, b: Boss, events: SimEvent[]): void {
  b.beatCount++;
  const n = b.beatCount;
  const speed = state.diff.bulletSpeed;
  const core = wardenCore(b);
  const cx = core.x + core.w / 2;
  const cy = core.y + core.h;

  if (b.phase === 1) {
    if (n % 2 === 0) {
      const alive = b.turrets.filter((t) => t.alive);
      const t = alive[(n / 2) % Math.max(1, alive.length)];
      if (t) {
        const tx = t.x + t.w / 2;
        const ty = t.y + t.h;
        const v = aimVelocity(state, tx, ty, speed);
        spawnEnemyBullet(state, tx, ty, v.vx, v.vy);
        events.push({ type: 'enemyShot', x: tx, y: ty });
      }
    }
    if (n % 4 === 0) fireSpread(state, cx, cy, 3, WARDEN.spreadAngle, speed);
  } else if (b.phase === 2) {
    if (n % 8 === 0 && !b.laser) startLaser(state, b, events);
    if (n % 4 === 2) fireSpread(state, cx, cy, 5, WARDEN.spreadAngle, speed);
  } else {
    fireRing(state, cx, core.y + core.h / 2, WARDEN.ringCount, b.spiralAngle, speed * 0.7);
    b.spiralAngle += WARDEN.ringSpin;
    if (n % 12 === 0 && !b.laser) startLaser(state, b, events);
  }
}

function startLaser(state: SimState, b: Boss, events: SimEvent[]): void {
  const p = state.player;
  const x = clamp(p.x + p.w / 2, 8, FIELD_W - 8);
  b.laser = { state: 'warn', t: 0, x, dir: nextRandom(state.rng) < 0.5 ? -1 : 1 };
  events.push({ type: 'laserWarn', x });
}

function updateLaser(state: SimState, b: Boss, dt: number, events: SimEvent[]): void {
  const l = b.laser;
  if (!l) return;
  l.t += dt;
  if (l.state === 'warn') {
    if (l.t >= WARDEN.laserWarn) {
      l.state = 'fire';
      l.t = 0;
      events.push({ type: 'laserFire', x: l.x });
    }
    return;
  }
  l.x = clamp(l.x + ((l.dir * WARDEN.laserSweep) / WARDEN.laserFire) * dt, 4, FIELD_W - 4);
  if (state.player.invuln <= 0 && overlaps(laserBox(b, l), state.player)) hitPlayer(state, events);
  if (l.t >= WARDEN.laserFire) b.laser = null;
}

function destroyTurrets(b: Boss, events: SimEvent[]): void {
  for (const t of b.turrets) {
    if (!t.alive) continue;
    t.alive = false;
    events.push({ type: 'turretDestroyed', x: t.x + t.w / 2, y: t.y + t.h / 2 });
  }
}

/** Resolves a player bullet against the Warden. Returns true if the bullet was consumed. */
export function hitWarden(state: SimState, bullet: Bullet, events: SimEvent[]): boolean {
  const b = state.boss;
  if (!b || b.entering || b.dying > 0) return false;

  for (const t of b.turrets) {
    if (!t.alive || !overlaps(bullet, t)) continue;
    recordHit(state);
    t.hp--;
    t.flash = 0.06;
    if (t.hp <= 0) {
      t.alive = false;
      registerKill(state, TURRET_POINTS, bullet.mult);
      events.push({ type: 'turretDestroyed', x: t.x + t.w / 2, y: t.y + t.h / 2 });
    }
    return true;
  }

  const core = wardenCore(b);
  if (overlaps(bullet, core)) {
    recordHit(state);
    b.hp--;
    b.flash = 0.06;
    events.push({ type: 'bossHit', x: bullet.x, y: core.y + core.h });
    if (b.hp <= 0) {
      killBoss(state, events);
      return true;
    }
    if (applyPhase(state, b, events)) {
      b.laser = null;
      if (b.phase >= 2) destroyTurrets(b, events);
    }
    return true;
  }

  // Solar panels and struts are armor: they absorb bullets without damage.
  return overlaps(bullet, b);
}
```

**File: `src/sim/boss/index.ts`**
```ts
import { worldAt } from '../../data/worlds';
import type { Bullet, SimEvent, SimState } from '../types';
import { hitWarden, spawnWarden, updateWarden } from './warden';

export function spawnBoss(state: SimState): void {
  switch (worldAt(state.world).boss) {
    case 'warden':
      spawnWarden(state);
      return;
  }
}

export function updateBoss(state: SimState, dt: number, beats: number, events: SimEvent[]): void {
  switch (state.boss?.kind) {
    case 'warden':
      updateWarden(state, dt, beats, events);
      return;
    case undefined:
      return;
  }
}

export function hitBoss(state: SimState, bullet: Bullet, events: SimEvent[]): boolean {
  switch (state.boss?.kind) {
    case 'warden':
      return hitWarden(state, bullet, events);
    case undefined:
      return false;
  }
}
```

**File: `src/sim/stageFlow.ts`**
```ts
import { PLAYER, STAGE } from '../data/balance';
import { WORLDS } from '../data/worlds';
import { spawnBoss } from './boss';
import { difficultyFor } from './difficulty';
import { spawnFormation } from './formation';
import type { SimEvent, SimState, StageResult, StageStats } from './types';

export function emptyStageStats(): StageStats {
  return { shots: 0, hits: 0, onBeatShots: 0, hitsTaken: 0, time: 0 };
}

export function isBossStage(stage: number): boolean {
  return stage === STAGE.perWorld;
}

export function startStage(state: SimState, events: SimEvent[]): void {
  const boss = isBossStage(state.stage);
  state.diff = difficultyFor(state.world, state.stage, state.loop);
  state.bullets = [];
  state.enemies = [];
  state.boss = null;
  state.stageStats = emptyStageStats();
  state.result = null;
  if (boss) spawnBoss(state);
  else spawnFormation(state);
  state.enemyFireTimer = 1.5;
  state.diveTimer = state.diff.diveInterval;
  state.phase = 'stageIntro';
  state.phaseTimer = boss ? STAGE.bossIntroTime : STAGE.introTime;
  events.push({ type: 'stageIntro', world: state.world, stage: state.stage, loop: state.loop, boss });
}

export function computeStageResult(stats: StageStats, boss: boolean): StageResult {
  const accuracy = stats.shots > 0 ? Math.min(1, stats.hits / stats.shots) : 0;
  const beatPct = stats.shots > 0 ? stats.onBeatShots / stats.shots : 0;
  const noHit = stats.hitsTaken === 0;
  const par = boss ? STAGE.bossParTime : STAGE.parTime;
  const timeBonus = Math.max(0, par - stats.time) * STAGE.timeBonusPerSec;
  const bonus = Math.round(accuracy * 1000 + beatPct * 1000 + (noHit ? 2000 : 0) + timeBonus);
  return {
    accuracy,
    beatPct,
    noHit,
    time: stats.time,
    bonus,
    perfect: noHit && beatPct >= STAGE.perfectBeatPct,
  };
}

export function finishStage(state: SimState, events: SimEvent[]): void {
  const result = computeStageResult(state.stageStats, isBossStage(state.stage));
  state.result = result;
  state.score += result.bonus;
  if (result.perfect) state.run.perfectStages++;
  state.run.stagesCleared++;
  state.bullets = [];
  state.phase = 'stageClear';
  state.phaseTimer = STAGE.clearTime;
  events.push({ type: 'stageClear', stage: state.stage, result });
}

export function advanceStage(state: SimState, events: SimEvent[]): void {
  state.stage++;
  if (state.stage > STAGE.perWorld) {
    events.push({ type: 'worldClear', world: state.world });
    state.stage = 1;
    state.world++;
    if (state.world >= WORLDS.length) {
      state.world = 0;
      state.loop++;
    }
  }
  startStage(state, events);
}

export function checkExtraLife(state: SimState, events: SimEvent[]): void {
  while (state.score >= state.nextExtraLife) {
    state.nextExtraLife += PLAYER.extraLifeEvery;
    if (state.player.lives < PLAYER.maxLives) {
      state.player.lives++;
      events.push({ type: 'extraLife', lives: state.player.lives });
    }
  }
}
```

**File: `src/sim/state.ts`**
```ts
import { FIELD_H, FIELD_W, PLAYER } from '../data/balance';
import { difficultyFor } from './difficulty';
import { emptyStageStats, startStage } from './stageFlow';
import type { SimState } from './types';

/** New run at world 1, stage 1, in the stage intro. */
export function createInitialState(seed: number): SimState {
  const state: SimState = {
    time: 0,
    rng: { seed },
    nextId: 1,
    phase: 'stageIntro',
    phaseTimer: 0,
    world: 0,
    stage: 1,
    loop: 0,
    score: 0,
    nextExtraLife: PLAYER.extraLifeEvery,
    player: {
      x: (FIELD_W - PLAYER.w) / 2,
      y: FIELD_H - PLAYER.h - PLAYER.bottomMargin,
      w: PLAYER.w,
      h: PLAYER.h,
      vx: 0,
      vy: 0,
      cooldown: 0,
      invuln: 0,
      lives: PLAYER.startLives,
    },
    enemies: [],
    bullets: [],
    formation: { x: 0, y: 0, dir: 1, total: 0 },
    boss: null,
    diff: difficultyFor(0, 1, 0),
    enemyFireTimer: 1.5,
    diveTimer: 0,
    hitStop: 0,
    beat: { last: null },
    rhythm: { streak: 0, mult: 1 },
    combo: { chain: 0, timer: 0 },
    stats: { shots: 0, hits: 0, onBeatShots: 0 },
    stageStats: emptyStageStats(),
    result: null,
    run: { bossesKilled: 0, perfectStages: 0, stagesCleared: 0 },
  };
  startStage(state, []);
  return state;
}
```

**File: `src/sim/step.ts`**
```ts
import { PLAYER_ZONE_TOP, SIM_DT } from '../data/balance';
import { beatsCrossed } from './beat';
import { updateBoss } from './boss';
import { moveBullets } from './bullets';
import { resolveCollisions } from './collision';
import { updateDives } from './dive';
import { updateEnemyFire } from './enemyFire';
import { formationBottom, spawnFormation, updateFormation } from './formation';
import { hitPlayer, updatePlayer } from './player';
import { updateCombo } from './scoring';
import { advanceStage, checkExtraLife, finishStage } from './stageFlow';
import type { InputFrame, SimEvent, SimState } from './types';

export function step(state: SimState, input: InputFrame, dt: number = SIM_DT): SimEvent[] {
  const events: SimEvent[] = [];
  if (state.phase === 'gameOver') return events;
  if (state.hitStop > 0) {
    state.hitStop = Math.max(0, state.hitStop - dt);
    return events;
  }
  state.time += dt;
  const beats = beatsCrossed(state, input.beat);
  const noFire: InputFrame = { ...input, firePressed: false };

  switch (state.phase) {
    case 'stageIntro':
      updatePlayer(state, noFire, dt, events);
      updateBoss(state, dt, beats, events);
      moveBullets(state, dt);
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) {
        state.phase = 'playing';
        events.push({ type: 'stageStart', stage: state.stage });
      }
      return events;

    case 'stageClear':
      updatePlayer(state, noFire, dt, events);
      moveBullets(state, dt);
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) advanceStage(state, events);
      return events;

    case 'bossDying':
      updatePlayer(state, noFire, dt, events);
      updateBoss(state, dt, 0, events);
      moveBullets(state, dt);
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) {
        state.boss = null;
        finishStage(state, events);
      }
      return events;

    case 'playing':
      playing(state, input, dt, beats, events);
      return events;
  }
}

function playing(state: SimState, input: InputFrame, dt: number, beats: number, events: SimEvent[]): void {
  updatePlayer(state, input, dt, events);
  updateCombo(state, dt);
  state.stageStats.time += dt;
  if (state.boss) {
    updateBoss(state, dt, beats, events);
  } else {
    updateFormation(state, dt);
    updateDives(state, dt, events);
    updateEnemyFire(state, dt, events);
  }
  moveBullets(state, dt);
  resolveCollisions(state, events);
  checkExtraLife(state, events);
  if (state.phase !== 'playing' || state.boss) return;

  if (state.enemies.length === 0) {
    finishStage(state, events);
    return;
  }
  if (formationBottom(state) >= PLAYER_ZONE_TOP) {
    events.push({ type: 'formationInvaded' });
    hitPlayer(state, events);
    if (state.phase === 'playing') {
      state.bullets = [];
      spawnFormation(state);
    }
  }
}
```

**File: `src/input/inputFrame.ts`**
```ts
import { clamp } from '../sim/math';
import type { InputFrame } from '../sim/types';

export interface InputSource {
  /** Returns input since last poll; consumes pending edge events. */
  poll(): InputFrame;
}

/** Called at the moment fire is pressed; returns rhythm verdict or null (no audio). */
export type FireJudge = () => boolean | null;

export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

/** A pointer press in logical playfield coordinates. */
export interface Tap {
  x: number;
  y: number;
}

export function mergeInputs(frames: readonly InputFrame[]): InputFrame {
  let moveX = 0;
  let moveY = 0;
  let dragX = 0;
  let dragY = 0;
  let firePressed = false;
  let fireOnBeat: boolean | null = null;
  let beat: number | null = null;
  for (const f of frames) {
    moveX += f.moveX;
    moveY += f.moveY;
    dragX += f.dragX;
    dragY += f.dragY;
    if (f.firePressed && !firePressed) {
      firePressed = true;
      fireOnBeat = f.fireOnBeat;
    }
    if (beat === null && f.beat !== null) beat = f.beat;
  }
  return {
    moveX: clamp(moveX, -1, 1),
    moveY: clamp(moveY, -1, 1),
    dragX,
    dragY,
    firePressed,
    fireOnBeat,
    beat,
  };
}
```

**File: `src/input/keyboard.ts`**
```ts
import type { InputFrame } from '../sim/types';
import type { FireJudge, InputSource, MenuAction } from './inputFrame';

const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];
const UP = ['ArrowUp', 'KeyW'];
const DOWN = ['ArrowDown', 'KeyS'];
const FIRE = 'Space';
const PAUSE = ['KeyP', 'Escape'];
const MENU_KEYS: Readonly<Record<string, MenuAction>> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'confirm',
  Enter: 'confirm',
  Escape: 'back',
  Backspace: 'back',
};
const REPEATABLE: ReadonlySet<MenuAction> = new Set<MenuAction>(['up', 'down']);
const GAME_KEYS = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN, FIRE, ...PAUSE, 'Enter', 'Backspace']);

export class KeyboardInput implements InputSource {
  private readonly held = new Set<string>();
  private firePending = false;
  private fireOnBeat: boolean | null = null;
  private pausePending = false;
  private menu: MenuAction[] = [];

  constructor(
    target: EventTarget,
    private readonly judgeFire: FireJudge = () => null,
  ) {
    target.addEventListener('keydown', (ev) => {
      const e = ev as KeyboardEvent;
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) {
        if (e.code === FIRE && !this.firePending) {
          this.firePending = true;
          this.fireOnBeat = this.judgeFire();
        }
        if (PAUSE.includes(e.code)) this.pausePending = true;
      }
      const action = MENU_KEYS[e.code];
      if (action && (!e.repeat || REPEATABLE.has(action))) this.menu.push(action);
      this.held.add(e.code);
    });
    target.addEventListener('keyup', (ev) => this.held.delete((ev as KeyboardEvent).code));
    target.addEventListener('blur', () => this.held.clear());
  }

  poll(): InputFrame {
    const frame: InputFrame = {
      moveX: this.axis(LEFT, RIGHT),
      moveY: this.axis(UP, DOWN),
      dragX: 0,
      dragY: 0,
      firePressed: this.firePending,
      fireOnBeat: this.firePending ? this.fireOnBeat : null,
      beat: null,
    };
    this.firePending = false;
    this.fireOnBeat = null;
    return frame;
  }

  consumePause(): boolean {
    const p = this.pausePending;
    this.pausePending = false;
    return p;
  }

  consumeMenu(): MenuAction[] {
    const m = this.menu;
    this.menu = [];
    return m;
  }

  private axis(neg: readonly string[], pos: readonly string[]): number {
    const n = neg.some((k) => this.held.has(k)) ? 1 : 0;
    const p = pos.some((k) => this.held.has(k)) ? 1 : 0;
    return p - n;
  }
}
```

**File: `src/input/touch.ts`**
```ts
import type { Layout } from '../app/layout';
import type { InputFrame } from '../sim/types';
import type { FireJudge, InputSource, Tap } from './inputFrame';

/** Fire button in logical playfield coords. */
export const FIRE_BUTTON = { x: 206, y: 286, r: 22 } as const;
const FIRE_SLOP = 8;
const DRAG_SENSITIVITY = 1.25;

export function isInFireButton(lx: number, ly: number): boolean {
  return Math.hypot(lx - FIRE_BUTTON.x, ly - FIRE_BUTTON.y) <= FIRE_BUTTON.r + FIRE_SLOP;
}

/** Relative drag anywhere moves the ship; fire button taps shoot. Multi-touch. Every press is also a menu tap. */
export class TouchInput implements InputSource {
  private dragPointer: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private dx = 0;
  private dy = 0;
  private firePending = false;
  private fireOnBeat: boolean | null = null;
  private taps: Tap[] = [];

  constructor(
    el: HTMLElement,
    getLayout: () => Layout,
    private readonly judgeFire: FireJudge = () => null,
  ) {
    el.addEventListener('pointerdown', (e) => {
      const l = getLayout();
      const lx = (e.clientX - l.offsetX) / l.scale;
      const ly = (e.clientY - l.offsetY) / l.scale;
      this.taps.push({ x: lx, y: ly });
      if (e.pointerType === 'mouse') return;
      if (isInFireButton(lx, ly)) {
        if (!this.firePending) {
          this.firePending = true;
          this.fireOnBeat = this.judgeFire();
        }
        return;
      }
      if (this.dragPointer === null) {
        this.dragPointer = e.pointerId;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.dragPointer) return;
      const s = getLayout().scale;
      this.dx += ((e.clientX - this.lastX) / s) * DRAG_SENSITIVITY;
      this.dy += ((e.clientY - this.lastY) / s) * DRAG_SENSITIVITY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId === this.dragPointer) this.dragPointer = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  poll(): InputFrame {
    const frame: InputFrame = {
      moveX: 0,
      moveY: 0,
      dragX: this.dx,
      dragY: this.dy,
      firePressed: this.firePending,
      fireOnBeat: this.firePending ? this.fireOnBeat : null,
      beat: null,
    };
    this.fireOnBeat = null;
    this.dx = 0;
    this.dy = 0;
    this.firePending = false;
    return frame;
  }

  consumeTaps(): Tap[] {
    const t = this.taps;
    this.taps = [];
    return t;
  }
}
```

**File: `tests/sim/difficulty.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import { DIFFICULTY } from '../../src/data/balance';
import { difficultyFor, difficultyScalar, enemyHp, kindForRow } from '../../src/sim/difficulty';

describe('difficulty', () => {
  it('computes the scalar from world, stage and loop', () => {
    expect(difficultyScalar(0, 1, 0)).toBe(1);
    expect(difficultyScalar(2, 5, 0)).toBe(15);
    expect(difficultyScalar(0, 1, 1)).toBe(16);
  });

  it('ramps monotonically and stays under the caps', () => {
    const easy = difficultyFor(0, 1, 0);
    const hard = difficultyFor(2, 5, 3);
    expect(hard.fireRate).toBeGreaterThan(easy.fireRate);
    expect(hard.marchMax).toBeGreaterThan(easy.marchMax);
    expect(hard.diveInterval).toBeLessThan(easy.diveInterval);
    expect(hard.fireRate).toBeLessThanOrEqual(DIFFICULTY.fireRate[1]);
    expect(hard.bulletSpeed).toBeLessThanOrEqual(DIFFICULTY.bulletSpeed[1]);
  });

  it('widens the formation and toughens enemies on later loops', () => {
    expect(difficultyFor(0, 1, 0).cols).toBe(8);
    expect(difficultyFor(2, 5, 0).cols).toBe(10);
    expect(difficultyFor(0, 1, 0).hpBonus).toBe(0);
    expect(difficultyFor(0, 1, 1).hpBonus).toBe(1);
    expect(difficultyFor(0, 1, 2).bossHpScale).toBe(2);
  });

  it('introduces enemy types as difficulty rises', () => {
    expect(kindForRow(0, 1)).toBe('gunner');
    expect(kindForRow(2, 1)).toBe('grunt');
    expect(kindForRow(2, 2)).toBe('diver');
    expect(kindForRow(1, 3)).toBe('shield');
    expect(kindForRow(4, 99)).toBe('grunt');
  });

  it('gives shields and later loops extra hp', () => {
    expect(enemyHp('shield', difficultyFor(0, 1, 0))).toBe(2);
    expect(enemyHp('grunt', difficultyFor(0, 1, 0))).toBe(1);
    expect(enemyHp('grunt', difficultyFor(0, 1, 1))).toBe(2);
  });
});
```

**File: `tests/sim/beat.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import { worldAt } from '../../src/data/worlds';
import { beatsCrossed } from '../../src/sim/beat';
import { createInitialState } from '../../src/sim/state';

describe('beatsCrossed', () => {
  it('returns 0 on the first call, then counts whole-beat crossings', () => {
    const s = createInitialState(1);
    expect(beatsCrossed(s, 0.5)).toBe(0);
    expect(beatsCrossed(s, 0.9)).toBe(0);
    expect(beatsCrossed(s, 1.1)).toBe(1);
    expect(beatsCrossed(s, 3.2)).toBe(2);
  });

  it('caps large jumps', () => {
    const s = createInitialState(1);
    beatsCrossed(s, 0);
    expect(beatsCrossed(s, 100)).toBe(4);
  });

  it('never runs backwards', () => {
    const s = createInitialState(1);
    beatsCrossed(s, 5);
    expect(beatsCrossed(s, 2)).toBe(0);
    expect(beatsCrossed(s, 5.5)).toBe(0);
    expect(beatsCrossed(s, 6)).toBe(1);
  });

  it('falls back to sim time and world BPM without audio', () => {
    const s = createInitialState(1);
    s.time = 0;
    beatsCrossed(s, null);
    s.time = 60 / worldAt(0).bpm + 0.001;
    expect(beatsCrossed(s, null)).toBe(1);
  });
});
```

**File: `tests/sim/formation.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import { ENEMY, FIELD_W, FORMATION } from '../../src/data/balance';
import {
  formationBottom,
  formationSpeed,
  formationWidth,
  updateFormation,
} from '../../src/sim/formation';
import { createInitialState } from '../../src/sim/state';

describe('formation', () => {
  it('spawns rows × cols enemies centered horizontally', () => {
    const s = createInitialState(1);
    const cols = s.diff.cols;
    expect(s.enemies).toHaveLength(ENEMY.rows * cols);
    expect(s.formation.total).toBe(ENEMY.rows * cols);
    const left = s.formation.x;
    const right = FIELD_W - (left + formationWidth(cols));
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });

  it('puts gunners in the top row and grunts below on stage 1', () => {
    const s = createInitialState(1);
    expect(s.enemies.filter((e) => e.row === 0).every((e) => e.kind === 'gunner')).toBe(true);
    expect(s.enemies.filter((e) => e.row > 0).every((e) => e.kind === 'grunt')).toBe(true);
  });

  it('spawns enemies at full hp and not diving', () => {
    const s = createInitialState(1);
    expect(s.enemies.every((e) => e.hp === e.maxHp && e.dive === null)).toBe(true);
  });

  it('marches in its direction and moves enemies with it', () => {
    const s = createInitialState(1);
    const x0 = s.enemies[0]!.x;
    updateFormation(s, 0.1);
    expect(s.enemies[0]!.x).toBeGreaterThan(x0);
  });

  it('reverses and drops when hitting the right edge', () => {
    const s = createInitialState(1);
    s.formation.x = FIELD_W - formationWidth(s.diff.cols) - FORMATION.edgeMargin - 0.1;
    const y0 = s.formation.y;
    updateFormation(s, 0.5);
    expect(s.formation.dir).toBe(-1);
    expect(s.formation.y).toBe(y0 + FORMATION.dropStep);
    const maxRight = Math.max(...s.enemies.map((e) => e.x + e.w));
    expect(maxRight).toBeLessThanOrEqual(FIELD_W - FORMATION.edgeMargin + 1e-9);
  });

  it('uses only surviving columns for edge detection', () => {
    const s = createInitialState(1);
    s.enemies = s.enemies.filter((e) => e.col < 2);
    s.formation.x = 100;
    updateFormation(s, 0.1);
    expect(s.formation.dir).toBe(1);
  });

  it('speeds up as enemies die', () => {
    expect(formationSpeed(40, 40, 10, 90)).toBe(10);
    expect(formationSpeed(1, 40, 10, 90)).toBeGreaterThan(formationSpeed(20, 40, 10, 90));
    expect(formationSpeed(0, 40, 10, 90)).toBe(90);
  });

  it('reports formation bottom', () => {
    const s = createInitialState(1);
    const expected = s.formation.y + (ENEMY.rows - 1) * ENEMY.spacingY + ENEMY.h;
    expect(formationBottom(s)).toBe(expected);
    s.enemies = [];
    expect(formationBottom(s)).toBe(-Infinity);
  });
});
```

**File: `tests/sim/dive.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import { DIVE, PLAYER_ZONE_TOP, SIM_DT } from '../../src/data/balance';
import { divePosition, updateDives } from '../../src/sim/dive';
import { formationBottom, slotPosition } from '../../src/sim/formation';
import { startStage } from '../../src/sim/stageFlow';
import { createInitialState } from '../../src/sim/state';
import type { Dive, SimEvent } from '../../src/sim/types';

const dive = (over: Partial<Dive> = {}): Dive => ({
  t: 0,
  duration: DIVE.duration,
  startX: 50,
  startY: 60,
  targetX: 150,
  dir: 1,
  fired: false,
  ...over,
});

function diverStage() {
  const s = createInitialState(1);
  s.stage = 2; // d = 2 → row 2 are divers
  startStage(s, []);
  s.phase = 'playing';
  return s;
}

describe('divePosition', () => {
  it('starts at the start point', () => {
    expect(divePosition(dive(), 50, 60)).toEqual({ x: 50, y: 60 });
  });

  it('reaches the target at the bottom of the swoop', () => {
    const p = divePosition(dive({ t: DIVE.duration / 2 }), 50, 60);
    expect(p.x).toBeCloseTo(150);
    expect(p.y).toBeCloseTo(DIVE.bottomY);
  });

  it('ends in its formation slot', () => {
    const p = divePosition(dive({ t: DIVE.duration }), 70, 64);
    expect(p.x).toBeCloseTo(70);
    expect(p.y).toBeCloseTo(64);
  });
});

describe('updateDives', () => {
  it('launches a diver when the timer expires', () => {
    const s = diverStage();
    s.diveTimer = 0;
    const events: SimEvent[] = [];
    updateDives(s, SIM_DT, events);
    const diving = s.enemies.filter((e) => e.dive);
    expect(diving).toHaveLength(1);
    expect(diving[0]!.kind).toBe('diver');
    expect(events).toContainEqual({ type: 'dive', id: diving[0]!.id });
    expect(s.diveTimer).toBeGreaterThan(0);
  });

  it('fires exactly once and returns to its slot', () => {
    const s = diverStage();
    s.diveTimer = 0;
    const events: SimEvent[] = [];
    updateDives(s, SIM_DT, events);
    const e = s.enemies.find((x) => x.dive)!;
    s.diveTimer = 999;
    for (let t = 0; t < DIVE.duration + 0.1; t += SIM_DT) updateDives(s, SIM_DT, events);
    expect(e.dive).toBeNull();
    expect(events.filter((x) => x.type === 'enemyShot')).toHaveLength(1);
    const slot = slotPosition(s, e);
    expect(e.x).toBe(slot.x);
    expect(e.y).toBe(slot.y);
  });

  it('does not count diving enemies for the invasion line', () => {
    const s = diverStage();
    const e = s.enemies[0]!;
    e.dive = dive({ t: DIVE.duration / 2 });
    e.y = 300;
    expect(formationBottom(s)).toBeLessThan(PLAYER_ZONE_TOP);
  });
});
```

**File: `tests/sim/enemyFire.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import { ENEMY } from '../../src/data/balance';
import { updateEnemyFire } from '../../src/sim/enemyFire';
import { createInitialState } from '../../src/sim/state';
import type { SimEvent } from '../../src/sim/types';

describe('updateEnemyFire', () => {
  it('fires when the timer expires and resets it', () => {
    const s = createInitialState(3);
    s.enemyFireTimer = 0.01;
    const events: SimEvent[] = [];
    updateEnemyFire(s, 0.02, events);
    expect(s.bullets).toHaveLength(1);
    expect(s.bullets[0]!.owner).toBe('enemy');
    expect(s.bullets[0]!.vy).toBeGreaterThan(0);
    expect(events[0]!.type).toBe('enemyShot');
    expect(s.enemyFireTimer).toBeGreaterThan(0);
  });

  it('does not fire before the timer expires', () => {
    const s = createInitialState(3);
    s.enemyFireTimer = 1;
    updateEnemyFire(s, 0.1, []);
    expect(s.bullets).toHaveLength(0);
  });

  it('only fires from bottom-most enemies or gunners', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = createInitialState(seed);
      s.enemyFireTimer = 0;
      updateEnemyFire(s, 0.01, []);
      const b = s.bullets[0]!;
      const bottomY = s.formation.y + (ENEMY.rows - 1) * ENEMY.spacingY + ENEMY.h;
      const topY = s.formation.y + ENEMY.h;
      expect([bottomY, topY]).toContain(b.y);
    }
  });

  it('gunners aim at the player', () => {
    const s = createInitialState(3);
    s.enemies = s.enemies.filter((e) => e.kind === 'gunner' && e.col === 0);
    s.player.x = 200;
    s.enemyFireTimer = 0;
    updateEnemyFire(s, 0.01, []);
    const b = s.bullets[0]!;
    expect(b.vx).toBeGreaterThan(0);
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(s.diff.bulletSpeed);
  });
});
```

**File: `tests/sim/collision.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import { PLAYER, POINTS } from '../../src/data/balance';
import { overlaps, resolveCollisions } from '../../src/sim/collision';
import { createInitialState } from '../../src/sim/state';
import type { Bullet, SimEvent } from '../../src/sim/types';

const bullet = (over: Partial<Bullet>): Bullet => ({
  id: 999, x: 0, y: 0, w: 2, h: 6, vx: 0, vy: 0, owner: 'player', onBeat: false, mult: 1, ...over,
});

describe('overlaps', () => {
  it('detects intersection and separation', () => {
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
  });
});

describe('resolveCollisions', () => {
  it('kills an enemy hit by a player bullet and scores it', () => {
    const s = createInitialState(1);
    const target = s.enemies[0]!;
    s.bullets = [bullet({ x: target.x + 2, y: target.y + 1 })];
    const events: SimEvent[] = [];
    resolveCollisions(s, events);
    expect(s.enemies.find((e) => e.id === target.id)).toBeUndefined();
    expect(s.bullets).toHaveLength(0);
    expect(s.score).toBe(POINTS[target.kind]);
    expect(s.stats.hits).toBe(1);
    expect(s.stageStats.hits).toBe(1);
    expect(events[0]).toMatchObject({ type: 'enemyKilled', id: target.id, points: POINTS[target.kind] });
  });

  it('a bullet hits at most one enemy', () => {
    const s = createInitialState(1);
    const total = s.enemies.length;
    const a = s.enemies[0]!;
    s.bullets = [bullet({ x: a.x, y: a.y, w: 40, h: 40 })];
    resolveCollisions(s, []);
    expect(s.enemies).toHaveLength(total - 1);
  });

  it('damages multi-hp enemies without killing them', () => {
    const s = createInitialState(1);
    const a = s.enemies[0]!;
    a.hp = 2;
    s.bullets = [bullet({ x: a.x + 2, y: a.y + 1 })];
    const events: SimEvent[] = [];
    resolveCollisions(s, events);
    expect(a.hp).toBe(1);
    expect(a.flash).toBeGreaterThan(0);
    expect(events[0]!.type).toBe('enemyHit');
  });

  it('enemy bullet hits the player', () => {
    const s = createInitialState(1);
    const p = s.player;
    s.bullets = [bullet({ owner: 'enemy', x: p.x + 2, y: p.y + 1 })];
    const events: SimEvent[] = [];
    resolveCollisions(s, events);
    expect(p.lives).toBe(PLAYER.startLives - 1);
    expect(s.bullets).toHaveLength(0);
    expect(events.map((e) => e.type)).toContain('playerHit');
  });

  it('invulnerable player ignores enemy bullets', () => {
    const s = createInitialState(1);
    const p = s.player;
    p.invuln = 1;
    s.bullets = [bullet({ owner: 'enemy', x: p.x + 2, y: p.y + 1 })];
    resolveCollisions(s, []);
    expect(p.lives).toBe(PLAYER.startLives);
    expect(s.bullets).toHaveLength(1);
  });

  it('a diving enemy crashing into the player dies and costs a life', () => {
    const s = createInitialState(1);
    const e = s.enemies[0]!;
    e.dive = { t: 1, duration: 2.4, startX: 0, startY: 0, targetX: 0, dir: 1, fired: true };
    e.x = s.player.x;
    e.y = s.player.y;
    const events: SimEvent[] = [];
    resolveCollisions(s, events);
    expect(s.player.lives).toBe(PLAYER.startLives - 1);
    expect(s.enemies.find((x) => x.id === e.id)).toBeUndefined();
    expect(events.map((x) => x.type)).toEqual(['enemyKilled', 'playerHit']);
  });
});
```

**File: `tests/sim/stageFlow.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import { PLAYER, STAGE } from '../../src/data/balance';
import { WORLDS } from '../../src/data/worlds';
import {
  advanceStage,
  checkExtraLife,
  computeStageResult,
  finishStage,
} from '../../src/sim/stageFlow';
import { createInitialState } from '../../src/sim/state';
import type { SimEvent } from '../../src/sim/types';

describe('computeStageResult', () => {
  it('scores accuracy, beat, no-hit and time', () => {
    const r = computeStageResult({ shots: 10, hits: 8, onBeatShots: 5, hitsTaken: 0, time: 20 }, false);
    expect(r.accuracy).toBeCloseTo(0.8);
    expect(r.beatPct).toBeCloseTo(0.5);
    expect(r.noHit).toBe(true);
    expect(r.bonus).toBe(800 + 500 + 2000 + (STAGE.parTime - 20) * STAGE.timeBonusPerSec);
    expect(r.perfect).toBe(false);
  });

  it('handles zero shots and slow clears', () => {
    const r = computeStageResult({ shots: 0, hits: 0, onBeatShots: 0, hitsTaken: 2, time: 999 }, false);
    expect(r.bonus).toBe(0);
    expect(r.noHit).toBe(false);
  });

  it('flags perfect stages', () => {
    const r = computeStageResult({ shots: 10, hits: 10, onBeatShots: 7, hitsTaken: 0, time: 10 }, false);
    expect(r.perfect).toBe(true);
  });

  it('uses the boss par time on boss stages', () => {
    const r = computeStageResult({ shots: 0, hits: 0, onBeatShots: 0, hitsTaken: 1, time: 40 }, true);
    expect(r.bonus).toBe((STAGE.bossParTime - 40) * STAGE.timeBonusPerSec);
  });
});

describe('stage progression', () => {
  it('finishStage adds the bonus and counts perfect stages', () => {
    const s = createInitialState(1);
    s.stageStats = { shots: 10, hits: 10, onBeatShots: 10, hitsTaken: 0, time: 10 };
    finishStage(s, []);
    expect(s.phase).toBe('stageClear');
    expect(s.score).toBe(s.result!.bonus);
    expect(s.run.perfectStages).toBe(1);
    expect(s.run.stagesCleared).toBe(1);
  });

  it('walks stages, then worlds, then loops', () => {
    const s = createInitialState(1);
    const events: SimEvent[] = [];
    for (let i = 0; i < STAGE.perWorld * WORLDS.length; i++) advanceStage(s, events);
    expect(s.stage).toBe(1);
    expect(s.world).toBe(0);
    expect(s.loop).toBe(1);
    expect(events.filter((e) => e.type === 'worldClear')).toHaveLength(WORLDS.length);
  });

  it('spawns a boss on the last stage of a world', () => {
    const s = createInitialState(1);
    s.stage = STAGE.perWorld - 1;
    const events: SimEvent[] = [];
    advanceStage(s, events);
    expect(s.stage).toBe(STAGE.perWorld);
    expect(s.boss).not.toBeNull();
    expect(s.enemies).toHaveLength(0);
    expect(s.phase).toBe('stageIntro');
    expect(events).toContainEqual({ type: 'stageIntro', world: 0, stage: STAGE.perWorld, loop: 0, boss: true });
  });
});

describe('checkExtraLife', () => {
  it('grants a ship at each threshold', () => {
    const s = createInitialState(1);
    s.score = PLAYER.extraLifeEvery * 2;
    const events: SimEvent[] = [];
    checkExtraLife(s, events);
    expect(s.player.lives).toBe(PLAYER.startLives + 2);
    expect(s.nextExtraLife).toBe(PLAYER.extraLifeEvery * 3);
    expect(events.filter((e) => e.type === 'extraLife')).toHaveLength(2);
  });

  it('never exceeds the ship cap', () => {
    const s = createInitialState(1);
    s.player.lives = PLAYER.maxLives;
    s.score = PLAYER.extraLifeEvery;
    const events: SimEvent[] = [];
    checkExtraLife(s, events);
    expect(s.player.lives).toBe(PLAYER.maxLives);
    expect(events).toHaveLength(0);
  });
});
```

**File: `tests/sim/warden.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import { BOSS_POINTS, PLAYER, SIM_DT, STAGE, WARDEN } from '../../src/data/balance';
import { hitWarden, updateWarden, wardenCore } from '../../src/sim/boss/warden';
import { startStage } from '../../src/sim/stageFlow';
import { createInitialState } from '../../src/sim/state';
import type { Boss, Bullet, SimEvent, SimState } from '../../src/sim/types';

const bullet = (x: number, y: number): Bullet => ({
  id: 9999, x, y, w: 2, h: 6, vx: 0, vy: -1, owner: 'player', onBeat: false, mult: 1,
});

function bossStage(): SimState {
  const s = createInitialState(1);
  s.stage = STAGE.perWorld;
  startStage(s, []);
  return s;
}

function ready(): { s: SimState; b: Boss } {
  const s = bossStage();
  s.phase = 'playing';
  const b = s.boss!;
  b.entering = false;
  b.y = WARDEN.y;
  updateWarden(s, 0, 0, []);
  return { s, b };
}

function hitCore(s: SimState, b: Boss, times = 1): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < times; i++) {
    const c = wardenCore(b);
    hitWarden(s, bullet(c.x + c.w / 2, c.y + 4), events);
  }
  return events;
}

describe('ORBITAL WARDEN', () => {
  it('spawns above the field and flies in', () => {
    const s = bossStage();
    expect(s.boss!.y).toBeLessThan(0);
    for (let t = 0; t < WARDEN.enterTime + 0.1; t += SIM_DT) updateWarden(s, SIM_DT, 0, []);
    expect(s.boss!.entering).toBe(false);
    expect(s.boss!.y).toBe(WARDEN.y);
  });

  it('ignores bullets while entering', () => {
    const s = bossStage();
    const b = s.boss!;
    expect(hitWarden(s, bullet(b.x + b.w / 2, b.y + 2), [])).toBe(false);
  });

  it('takes damage on the core', () => {
    const { s, b } = ready();
    const hp = b.hp;
    const events = hitCore(s, b);
    expect(b.hp).toBe(hp - 1);
    expect(events[0]!.type).toBe('bossHit');
  });

  it('absorbs bullets on its armor', () => {
    const { s, b } = ready();
    const hp = b.hp;
    expect(hitWarden(s, bullet(b.x + 2, b.y + 2), [])).toBe(true);
    expect(b.hp).toBe(hp);
  });

  it('loses turrets after enough hits and pays points', () => {
    const { s, b } = ready();
    const t = b.turrets[0]!;
    const events: SimEvent[] = [];
    for (let i = 0; i < WARDEN.turretHp; i++) hitWarden(s, bullet(t.x + 4, t.y + 2), events);
    expect(t.alive).toBe(false);
    expect(events.some((e) => e.type === 'turretDestroyed')).toBe(true);
    expect(s.score).toBeGreaterThan(0);
  });

  it('enters phase 2 at two thirds hp, loses turrets and hit-stops', () => {
    const { s, b } = ready();
    b.hp = Math.floor((b.maxHp * 2) / 3) + 1;
    const events = hitCore(s, b);
    expect(b.phase).toBe(2);
    expect(b.turrets.every((t) => !t.alive)).toBe(true);
    expect(s.hitStop).toBeGreaterThan(0);
    expect(events.map((e) => e.type)).toContain('bossPhase');
  });

  it('fires on beats in phase 1', () => {
    const { s } = ready();
    updateWarden(s, SIM_DT, 4, []);
    expect(s.bullets.filter((x) => x.owner === 'enemy')).toHaveLength(2 + 3);
  });

  it('telegraphs its phase 2 laser, then burns the player', () => {
    const { s, b } = ready();
    b.phase = 2;
    b.turrets.forEach((t) => (t.alive = false));
    const events: SimEvent[] = [];
    updateWarden(s, SIM_DT, 8, events);
    expect(events.map((e) => e.type)).toContain('laserWarn');
    expect(s.player.lives).toBe(PLAYER.startLives);
    for (let t = 0; t < WARDEN.laserWarn + 0.1; t += SIM_DT) updateWarden(s, SIM_DT, 0, events);
    expect(events.map((e) => e.type)).toContain('laserFire');
    expect(s.player.lives).toBe(PLAYER.startLives - 1);
  });

  it('fires spiral rings on every beat in phase 3', () => {
    const { s, b } = ready();
    b.phase = 3;
    updateWarden(s, SIM_DT, 1, []);
    expect(s.bullets).toHaveLength(WARDEN.ringCount);
  });

  it('dies at zero hp and pays out', () => {
    const { s, b } = ready();
    b.turrets.forEach((t) => (t.alive = false));
    b.hp = 1;
    const events = hitCore(s, b);
    expect(s.phase).toBe('bossDying');
    expect(s.score).toBe(BOSS_POINTS);
    expect(s.run.bossesKilled).toBe(1);
    expect(events.map((e) => e.type)).toContain('bossKilled');
  });
});
```

**File: `tests/sim/step.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import {
  BOSS_DYING_TIME,
  ENEMY,
  FIELD_W,
  PLAYER,
  PLAYER_ZONE_TOP,
  SIM_DT,
  STAGE,
  WARDEN,
} from '../../src/data/balance';
import { WORLDS } from '../../src/data/worlds';
import { startStage } from '../../src/sim/stageFlow';
import { createInitialState } from '../../src/sim/state';
import { step } from '../../src/sim/step';
import { NO_INPUT, type InputFrame, type SimEvent } from '../../src/sim/types';

function playing(seed = 1) {
  const s = createInitialState(seed);
  s.phase = 'playing';
  return s;
}

describe('step', () => {
  it('starts in the stage intro and then plays', () => {
    const s = createInitialState(1);
    expect(s.phase).toBe('stageIntro');
    let started = false;
    for (let t = 0; t < STAGE.introTime + 0.1; t += SIM_DT) {
      if (step(s, NO_INPUT).some((e) => e.type === 'stageStart')) started = true;
    }
    expect(started).toBe(true);
    expect(s.phase).toBe('playing');
  });

  it('does not fire during the intro', () => {
    const s = createInitialState(1);
    step(s, { ...NO_INPUT, firePressed: true });
    expect(s.bullets).toHaveLength(0);
  });

  it('clears the stage with a bonus, then intros the next stage', () => {
    const s = playing();
    s.enemies = [];
    const events = step(s, NO_INPUT);
    const clear = events.find((e) => e.type === 'stageClear');
    expect(s.phase).toBe('stageClear');
    expect(clear?.type === 'stageClear' ? clear.result.bonus : -1).toBe(s.score);
    for (let t = 0; t < STAGE.clearTime + 0.1; t += SIM_DT) step(s, NO_INPUT);
    expect(s.stage).toBe(2);
    expect(s.phase).toBe('stageIntro');
    expect(s.enemies).toHaveLength(ENEMY.rows * s.diff.cols);
  });

  it('does not fire during stageClear', () => {
    const s = playing();
    s.enemies = [];
    step(s, NO_INPUT);
    step(s, { ...NO_INPUT, firePressed: true });
    expect(s.bullets).toHaveLength(0);
  });

  it('formation invading the player zone costs a life and respawns it', () => {
    const s = playing();
    s.formation.y = PLAYER_ZONE_TOP;
    const events = step(s, NO_INPUT);
    expect(events.map((e) => e.type)).toContain('formationInvaded');
    expect(s.player.lives).toBe(PLAYER.startLives - 1);
    expect(s.formation.y).toBe(ENEMY.startY);
  });

  it('freezes everything during hit-stop', () => {
    const s = playing();
    s.hitStop = 0.04;
    const t = s.time;
    step(s, NO_INPUT);
    expect(s.time).toBe(t);
    expect(s.hitStop).toBeCloseTo(0.04 - SIM_DT);
  });

  it('awards an extra ship at the score threshold', () => {
    const s = playing();
    s.score = PLAYER.extraLifeEvery;
    const events = step(s, NO_INPUT);
    expect(s.player.lives).toBe(PLAYER.startLives + 1);
    expect(events.map((e) => e.type)).toContain('extraLife');
  });

  it('stops simulating after game over', () => {
    const s = playing();
    s.player.lives = 1;
    s.formation.y = PLAYER_ZONE_TOP;
    step(s, NO_INPUT);
    expect(s.phase).toBe('gameOver');
    const t = s.time;
    expect(step(s, NO_INPUT)).toEqual([]);
    expect(s.time).toBe(t);
  });

  it('boss kill leads to the next world (or loop)', () => {
    const s = createInitialState(1);
    s.stage = STAGE.perWorld;
    startStage(s, []);
    s.phase = 'playing';
    const b = s.boss!;
    b.entering = false;
    b.y = WARDEN.y;
    b.turrets.forEach((t) => (t.alive = false));
    b.hp = 1;
    s.bullets.push({
      id: 5000, x: 0, y: WARDEN.y, w: FIELD_W, h: WARDEN.h, vx: 0, vy: 0, owner: 'player', onBeat: false, mult: 1,
    });
    const events: SimEvent[] = [];
    for (let t = 0; t < BOSS_DYING_TIME + STAGE.clearTime + 0.5; t += SIM_DT) events.push(...step(s, NO_INPUT));
    const types = events.map((e) => e.type);
    expect(types).toContain('bossKilled');
    expect(types).toContain('worldClear');
    expect(s.stage).toBe(1);
    expect(s.world).toBe(1 % WORLDS.length);
    expect(s.loop).toBe(WORLDS.length === 1 ? 1 : 0);
  });

  it('is deterministic for same seed and inputs', () => {
    const script = (i: number): InputFrame => ({
      ...NO_INPUT,
      moveX: Math.sin(i / 20),
      firePressed: i % 9 === 0,
    });
    const a = createInitialState(1234);
    const b = createInitialState(1234);
    for (let i = 0; i < 3600; i++) {
      step(a, script(i));
      step(b, script(i));
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.stats.shots).toBeGreaterThan(0);
  });
});
```

**File: `tests/input/inputFrame.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import { mergeInputs } from '../../src/input/inputFrame';
import { NO_INPUT } from '../../src/sim/types';

describe('mergeInputs', () => {
  it('sums and clamps axes, sums drag, ORs fire', () => {
    const merged = mergeInputs([
      { ...NO_INPUT, moveX: 1, dragX: 2 },
      { ...NO_INPUT, moveX: 1, dragX: 3, firePressed: true, fireOnBeat: true },
    ]);
    expect(merged).toEqual({
      moveX: 1, moveY: 0, dragX: 5, dragY: 0, firePressed: true, fireOnBeat: true, beat: null,
    });
  });

  it('passes the first known beat through', () => {
    expect(mergeInputs([NO_INPUT, { ...NO_INPUT, beat: 3.5 }]).beat).toBe(3.5);
  });

  it('returns neutral input for no sources', () => {
    expect(mergeInputs([])).toEqual(NO_INPUT);
  });
});
```

**File: `tests/input/keyboard.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import { KeyboardInput } from '../../src/input/keyboard';

function key(target: EventTarget, type: 'keydown' | 'keyup', code: string, repeat = false) {
  const e = new Event(type) as Event & { code: string; repeat: boolean };
  Object.assign(e, { code, repeat });
  target.dispatchEvent(e);
}

describe('KeyboardInput', () => {
  it('judges the fire press at keydown time', () => {
    const target = new EventTarget();
    let verdict: boolean | null = true;
    const kb = new KeyboardInput(target, () => verdict);
    key(target, 'keydown', 'Space');
    verdict = false;
    const f = kb.poll();
    expect(f.firePressed).toBe(true);
    expect(f.fireOnBeat).toBe(true);
    expect(kb.poll().firePressed).toBe(false);
  });

  it('reads movement axes from held keys', () => {
    const target = new EventTarget();
    const kb = new KeyboardInput(target);
    key(target, 'keydown', 'ArrowLeft');
    expect(kb.poll().moveX).toBe(-1);
    key(target, 'keyup', 'ArrowLeft');
    expect(kb.poll().moveX).toBe(0);
  });

  it('ignores auto-repeat for fire', () => {
    const target = new EventTarget();
    const kb = new KeyboardInput(target);
    key(target, 'keydown', 'Space', true);
    expect(kb.poll().firePressed).toBe(false);
  });

  it('queues menu actions, repeating only up/down', () => {
    const target = new EventTarget();
    const kb = new KeyboardInput(target);
    key(target, 'keydown', 'ArrowUp');
    key(target, 'keydown', 'ArrowUp', true);
    key(target, 'keydown', 'Enter');
    key(target, 'keydown', 'Enter', true);
    expect(kb.consumeMenu()).toEqual(['up', 'up', 'confirm']);
    expect(kb.consumeMenu()).toEqual([]);
  });
});
```

---

### Task 2: Boss music — song arrangements, bar-aligned switching, new SFX

**Files:** `src/audio/song.ts`, `src/audio/sequencer.ts`, `src/audio/engine.ts`, `src/audio/sfx.ts`, `src/data/songs/earth.ts`, `tests/audio/song.test.ts`

**Interfaces (produced):**
- `SongDef.arrangements: Record<string, ArrangementDef> & { main: ArrangementDef }`; `CompiledSong.arrangements: Record<string, CompiledArrangement>`
- `resolveStep(arrangement: CompiledArrangement, step)`, `nextBarStep(clock, time): number`
- `Sequencer.queue(name, fromTime)`; `AudioEngine.queueArrangement(name)` (no-op when already current)
- `Sfx.bossHit/bossPhase/bossKilled/laserWarn/laserFire/extraLife/dive`

- [ ] **Step 1:** tests (`extract.py … 2 tests`), run `npx vitest run tests/audio` → FAIL.
- [ ] **Step 2:** sources (`extract.py … 2 src`).
- [ ] **Step 3:** `npm test` PASS; offline render of `boss` and `bossFinal` arrangements in browser: peak < 1, rms > 0.05.
- [ ] **Step 4: Commit** `feat(audio): boss arrangements with bar-aligned switching`

**File: `src/audio/song.ts`**
```ts
import type { BeatClock } from './beatClock';
import { parseDrumPattern, parseNotePattern, type NoteEvent } from './pattern';

export const STEPS_PER_BEAT = 4;
export const STEPS_PER_BAR = 16;

export interface SectionDef {
  bars: number;
  guitar: string;
  lead?: string;
  kick: string;
  snare: string;
  hat: string;
  crash?: string;
}

export interface ArrangementDef {
  order: readonly string[];
  /** Index into `order` where playback loops back to after the end. */
  loopFrom: number;
}

export interface SongDef {
  name: string;
  bpm: number;
  sections: Record<string, SectionDef>;
  arrangements: Record<string, ArrangementDef> & { main: ArrangementDef };
}

export interface CompiledSection {
  name: string;
  steps: number;
  guitar: (NoteEvent | undefined)[];
  lead: (NoteEvent | undefined)[];
  kick: number[];
  snare: number[];
  hat: number[];
  crash: number[];
}

export interface CompiledArrangement {
  entries: { section: CompiledSection; offset: number }[];
  totalSteps: number;
  loopStartStep: number;
}

export interface CompiledSong {
  name: string;
  bpm: number;
  arrangements: Record<string, CompiledArrangement>;
}

function noteTrack(name: string, src: string | undefined, steps: number): (NoteEvent | undefined)[] {
  const track = new Array<NoteEvent | undefined>(steps).fill(undefined);
  if (src === undefined) return track;
  const parsed = parseNotePattern(src);
  if (parsed.steps !== steps) throw new Error(`${name}: expected ${steps} steps, got ${parsed.steps}`);
  for (const e of parsed.events) track[e.step] = e;
  return track;
}

function drumTrack(name: string, src: string | undefined, steps: number): number[] {
  if (src === undefined) return new Array<number>(steps).fill(0);
  const track = parseDrumPattern(src);
  if (track.length !== steps) throw new Error(`${name}: expected ${steps} steps, got ${track.length}`);
  return track;
}

function compileSection(name: string, def: SectionDef): CompiledSection {
  const steps = def.bars * STEPS_PER_BAR;
  return {
    name,
    steps,
    guitar: noteTrack(`${name}.guitar`, def.guitar, steps),
    lead: noteTrack(`${name}.lead`, def.lead, steps),
    kick: drumTrack(`${name}.kick`, def.kick, steps),
    snare: drumTrack(`${name}.snare`, def.snare, steps),
    hat: drumTrack(`${name}.hat`, def.hat, steps),
    crash: drumTrack(`${name}.crash`, def.crash, steps),
  };
}

function compileArrangement(
  name: string,
  def: ArrangementDef,
  sections: Map<string, CompiledSection>,
): CompiledArrangement {
  const entries: CompiledArrangement['entries'] = [];
  let offset = 0;
  let loopStartStep = 0;
  def.order.forEach((sectionName, i) => {
    const section = sections.get(sectionName);
    if (!section) throw new Error(`arrangement "${name}": unknown section "${sectionName}"`);
    if (i === def.loopFrom) loopStartStep = offset;
    entries.push({ section, offset });
    offset += section.steps;
  });
  if (offset === 0) throw new Error(`arrangement "${name}" is empty`);
  return { entries, totalSteps: offset, loopStartStep };
}

export function compileSong(def: SongDef): CompiledSong {
  const sections = new Map<string, CompiledSection>();
  for (const [name, section] of Object.entries(def.sections)) sections.set(name, compileSection(name, section));
  const arrangements: Record<string, CompiledArrangement> = {};
  for (const [name, arr] of Object.entries(def.arrangements)) {
    arrangements[name] = compileArrangement(name, arr, sections);
  }
  return { name: def.name, bpm: def.bpm, arrangements };
}

export function resolveStep(
  arr: CompiledArrangement,
  step: number,
): { section: CompiledSection; step: number } | null {
  if (step < 0) return null;
  let i = step;
  if (i >= arr.totalSteps) {
    const loopLen = arr.totalSteps - arr.loopStartStep;
    i = arr.loopStartStep + ((i - arr.loopStartStep) % loopLen);
  }
  for (const entry of arr.entries) {
    if (i < entry.offset + entry.section.steps) return { section: entry.section, step: i - entry.offset };
  }
  return null;
}

/** First 16th-step index on a bar line at or after `time`. */
export function nextBarStep(clock: BeatClock, time: number): number {
  const stepDur = clock.beatDur / STEPS_PER_BEAT;
  const step = Math.ceil((time - clock.startTime) / stepDur - 1e-6);
  return Math.max(0, Math.ceil(step / STEPS_PER_BAR) * STEPS_PER_BAR);
}

export function stepsInWindow(
  clock: BeatClock,
  from: number,
  to: number,
): { index: number; time: number }[] {
  const stepDur = clock.beatDur / STEPS_PER_BEAT;
  const out: { index: number; time: number }[] = [];
  let i = Math.max(0, Math.ceil((from - clock.startTime) / stepDur - 1e-6));
  for (;; i++) {
    const time = clock.startTime + i * stepDur;
    if (time >= to) break;
    if (time >= from) out.push({ index: i, time });
  }
  return out;
}
```

**File: `src/audio/sequencer.ts`**
```ts
import type { BeatClock } from './beatClock';
import {
  nextBarStep,
  resolveStep,
  STEPS_PER_BEAT,
  stepsInWindow,
  type CompiledArrangement,
  type CompiledSong,
} from './song';
import { createRig, type Rig } from './synth';

const MIN_NOTE = 0.04;

interface Cursor {
  arr: CompiledArrangement;
  startStep: number;
}

export class Sequencer {
  private readonly rig: Rig;
  private readonly stepDur: number;
  private current: Cursor;
  private pending: Cursor | null = null;

  constructor(
    ctx: BaseAudioContext,
    out: AudioNode,
    private readonly song: CompiledSong,
    private readonly clock: BeatClock,
  ) {
    this.rig = createRig(ctx, out);
    this.stepDur = clock.beatDur / STEPS_PER_BEAT;
    this.current = { arr: this.arrangement('main'), startStep: 0 };
  }

  /** Switch to arrangement `name` at the first bar line at or after `fromTime`. */
  queue(name: string, fromTime: number): void {
    this.pending = { arr: this.arrangement(name), startStep: nextBarStep(this.clock, fromTime) };
  }

  /** Schedules every 16th step whose time falls in [from, to). */
  scheduleRange(from: number, to: number): void {
    for (const { index, time } of stepsInWindow(this.clock, from, to)) {
      if (this.pending && index >= this.pending.startStep) {
        this.current = this.pending;
        this.pending = null;
      }
      const r = resolveStep(this.current.arr, index - this.current.startStep);
      if (!r) continue;
      const { section: s, step } = r;

      const g = s.guitar[step];
      if (g) {
        const dur = Math.max(MIN_NOTE, g.mute ? this.stepDur * 0.8 : g.len * this.stepDur);
        this.rig.guitar(time, g.midi, dur, g.mute);
        this.rig.bass(time, g.midi - 12, dur, g.mute);
      }
      const l = s.lead[step];
      if (l) this.rig.lead(time, l.midi, Math.max(MIN_NOTE, l.len * this.stepDur));

      const kick = s.kick[step] ?? 0;
      if (kick) this.rig.kick(time, kick);
      const snare = s.snare[step] ?? 0;
      if (snare) this.rig.snare(time, snare);
      const hat = s.hat[step] ?? 0;
      if (hat) this.rig.hat(time, hat);
      if (s.crash[step]) this.rig.crash(time);
    }
  }

  private arrangement(name: string): CompiledArrangement {
    const a = this.song.arrangements[name];
    if (!a) throw new Error(`unknown arrangement "${name}" in song "${this.song.name}"`);
    return a;
  }
}
```

**File: `src/audio/engine.ts`**
```ts
import { BeatClock } from './beatClock';
import { judgeShot } from './rhythmJudge';
import { Sequencer } from './sequencer';
import { Sfx } from './sfx';
import type { CompiledSong } from './song';
import { createBuses, type Buses } from './synth';

const SCHEDULE_INTERVAL_MS = 25;
const LOOKAHEAD_SEC = 0.1;
const START_DELAY_SEC = 0.1;
const FADE_SEC = 0.5;

interface Playing {
  seq: Sequencer;
  clock: BeatClock;
  gain: GainNode;
  scheduledTo: number;
  arrangement: string;
}

export class AudioEngine {
  readonly sfx: Sfx;
  private playing: Playing | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private unlocked = false;

  private constructor(
    private readonly ctx: AudioContext,
    private readonly buses: Buses,
  ) {
    this.sfx = new Sfx(ctx, buses.sfx);
  }

  static create(): AudioEngine | null {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      const ctx = new Ctor({ latencyHint: 'interactive' });
      return new AudioEngine(ctx, createBuses(ctx));
    } catch (err) {
      console.warn('Audio unavailable', err);
      return null;
    }
  }

  /** Call from inside a user-gesture handler. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    void this.ctx.resume();
  }

  /** Time the listener is hearing now (audio clock minus output latency). */
  private heardTime(): number {
    return this.ctx.currentTime - (this.ctx.outputLatency || 0);
  }

  startSong(song: CompiledSong): void {
    this.stopSong();
    const gain = this.ctx.createGain();
    gain.connect(this.buses.music);
    const start = this.ctx.currentTime + START_DELAY_SEC;
    const clock = new BeatClock(song.bpm, start);
    this.playing = {
      seq: new Sequencer(this.ctx, gain, song, clock),
      clock,
      gain,
      scheduledTo: start,
      arrangement: 'main',
    };
    this.tick();
    this.timer = setInterval(() => this.tick(), SCHEDULE_INTERVAL_MS);
  }

  /** Switch arrangement at the next bar line; no-op if it is already playing or queued. */
  queueArrangement(name: string): void {
    const p = this.playing;
    if (!p || p.arrangement === name) return;
    p.arrangement = name;
    p.seq.queue(name, p.scheduledTo);
  }

  stopSong(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const p = this.playing;
    if (!p) return;
    this.playing = null;
    const t = this.ctx.currentTime;
    p.gain.gain.setValueAtTime(p.gain.gain.value, t);
    p.gain.gain.linearRampToValueAtTime(0, t + FADE_SEC);
    setTimeout(() => p.gain.disconnect(), (FADE_SEC + LOOKAHEAD_SEC) * 1000 + 100);
  }

  setPaused(paused: boolean): void {
    if (!this.unlocked) return;
    void (paused ? this.ctx.suspend() : this.ctx.resume());
  }

  currentBeat(): number | null {
    return this.playing ? this.playing.clock.beatAt(this.heardTime()) : null;
  }

  judgeFire(offsetMs = 0): boolean | null {
    return judgeShot(this.playing?.clock ?? null, this.heardTime(), offsetMs);
  }

  private tick(): void {
    const p = this.playing;
    if (!p) return;
    const to = this.ctx.currentTime + LOOKAHEAD_SEC;
    if (to <= p.scheduledTo) return;
    p.seq.scheduleRange(p.scheduledTo, to);
    p.scheduledTo = to;
  }
}
```

**File: `src/audio/sfx.ts`**
```ts
import { makeNoiseBuffer, midiToHz } from './synth';

export class Sfx {
  private readonly noise: AudioBuffer;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly out: AudioNode,
  ) {
    this.noise = makeNoiseBuffer(ctx);
  }

  private tone(type: OscillatorType, f0: number, f1: number, length: number, peak: number, delay = 0): void {
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + length);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + length);
    osc.connect(g).connect(this.out);
    osc.start(t);
    osc.stop(t + length + 0.01);
  }

  private burst(length: number, peak: number, f0: number, f1: number, delay = 0): void {
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f0, t);
    lp.frequency.exponentialRampToValueAtTime(f1, t + length);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + length);
    src.connect(lp).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + length + 0.01);
  }

  private arpeggio(midis: readonly number[], gap: number, peak: number): void {
    midis.forEach((midi, i) => {
      const f = midiToHz(midi);
      this.tone('square', f, f, 0.14, peak, i * gap);
    });
  }

  laser(onBeat: boolean): void {
    if (onBeat) {
      this.tone('square', 1800, 400, 0.09, 0.12);
      this.tone('sawtooth', 3600, 800, 0.07, 0.05);
      this.tone('sine', 2400, 2400, 0.12, 0.08);
    } else {
      this.tone('square', 1200, 300, 0.08, 0.1);
    }
  }

  explosion(): void {
    this.burst(0.28, 0.5, 3000, 200);
    this.tone('sine', 200, 60, 0.2, 0.3);
  }

  playerHit(): void {
    this.burst(0.7, 0.7, 2000, 80);
    this.tone('sawtooth', 400, 40, 0.6, 0.25);
  }

  enemyShot(): void {
    this.tone('square', 420, 240, 0.06, 0.03);
  }

  stageClear(): void {
    this.arpeggio([64, 67, 71, 76], 0.09, 0.08);
  }

  extraLife(): void {
    this.arpeggio([72, 76, 79, 84, 88], 0.07, 0.07);
  }

  start(): void {
    this.tone('square', 440, 880, 0.12, 0.08);
  }

  dive(): void {
    this.tone('triangle', 900, 300, 0.4, 0.05);
  }

  bossHit(): void {
    this.tone('square', 180, 120, 0.04, 0.04);
  }

  bossPhase(): void {
    this.burst(1.0, 0.8, 1500, 60);
    this.tone('sawtooth', 120, 40, 0.8, 0.3);
  }

  bossKilled(): void {
    this.burst(1.6, 0.9, 4000, 50);
    this.burst(1.0, 0.6, 3000, 80, 0.4);
    this.tone('sine', 150, 30, 1.4, 0.4);
  }

  laserWarn(): void {
    this.tone('square', 300, 1200, 0.7, 0.05);
  }

  laserFire(): void {
    this.burst(1.2, 0.3, 6000, 1500);
    this.tone('sawtooth', 90, 80, 1.2, 0.15);
  }
}
```

**File: `src/data/songs/earth.ts`**
```ts
import type { SongDef } from '../../audio/song';

const bars = (...b: string[]) => b.join(' | ');

const GALLOP = 'E2p . E2p E2p E2p . E2p E2p E2p . E2p E2p E2p . E2p E2p';
const GALLOP_KICK = 'x.xxx.xxx.xxx.xx';
const DOUBLE_KICK = 'xxxxxxxxxxxxxxxx';
const BACKBEAT = '....x.......x...';
const EIGHTH_HAT = 'x.x.x.x.x.x.x.x.';
const EMPTY = '................';

/** World 1 — Near Earth Orbit. E minor, 140 BPM, galloping NWOBHM. */
export const EARTH_SONG: SongDef = {
  name: 'Earthbound Gallop',
  bpm: 140,
  sections: {
    intro: {
      bars: 2,
      guitar: bars('E2 - - - - - - - - - - - - - - -', 'G2 - - - - - - - A2 - - - B2 - - -'),
      kick: bars('X...............', 'x.......x...x...'),
      snare: bars(EMPTY, '........x.x.xxxx'),
      hat: bars(EMPTY, EMPTY),
      crash: bars('X...............', EMPTY),
    },
    A: {
      bars: 4,
      guitar: bars(
        GALLOP,
        'E2p . E2p E2p E2p . E2p E2p G2 - - . A2 - - .',
        GALLOP,
        'E2p . E2p E2p E2p . E2p E2p D3 - - . C3 - B2 -',
      ),
      kick: bars(GALLOP_KICK, GALLOP_KICK, GALLOP_KICK, GALLOP_KICK),
      snare: bars(BACKBEAT, BACKBEAT, BACKBEAT, BACKBEAT),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('x...............', EMPTY, EMPTY, EMPTY),
    },
    B: {
      bars: 4,
      guitar: bars(
        'E2p E2p . E2p . E2p E2p . G2 - . G2 - . F#2 -',
        'E2p E2p . E2p . E2p E2p . A2 - . A2 - . B2 -',
        'E2p E2p . E2p . E2p E2p . G2 - . G2 - . F#2 -',
        'E2p E2p . E2p . E2p E2p . C3 - - - B2 - - -',
      ),
      kick: bars('xx.x.xx.x..x..x.', 'xx.x.xx.x..x..x.', 'xx.x.xx.x..x..x.', 'xx.x.xx.x...x...'),
      snare: bars(BACKBEAT, BACKBEAT, BACKBEAT, '....x.......x.xx'),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('x...............', EMPTY, EMPTY, EMPTY),
    },
    chorus: {
      bars: 4,
      guitar: bars(
        'C3 - - - - - - - D3 - - - - - - -',
        'E2 - - - - - - - E2 - - - D3 - B2 -',
        'C3 - - - - - - - D3 - - - - - - -',
        'B2 - - - - - - - B2 - - - D3 - F#2 -',
      ),
      lead: bars(
        'E4 - - - G4 - - - F#4 - - - D4 - - -',
        'E4 - - - - - - - B3 - D4 - E4 - - -',
        'E4 - - - G4 - - - A4 - - - B4 - - -',
        'A4 - G4 - F#4 - - - D#4 - - - - - - -',
      ),
      kick: bars('x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.xxxx'),
      snare: bars(BACKBEAT, BACKBEAT, BACKBEAT, '....x.......x.x.'),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('X...............', EMPTY, 'X...............', EMPTY),
    },
    breakdown: {
      bars: 2,
      guitar: bars('E2p . . E2p . . E2p . . . E2p . E2p . . .', 'E2p . . E2p . . E2p . F2 - - - F#2 - - -'),
      kick: bars('x..x..x...x.x...', 'x..x..x.x...x...'),
      snare: bars('........x.......', '........x...xxxx'),
      hat: bars(EMPTY, EMPTY),
    },
    bossRiff: {
      bars: 2,
      guitar: bars(
        'E2p E2p E2p E2p F2 - E2p E2p E2p E2p E2p E2p A#2 - A2 -',
        'E2p E2p E2p E2p F2 - E2p E2p G2 - F#2 - F2 - E2 -',
      ),
      kick: bars(DOUBLE_KICK, DOUBLE_KICK),
      snare: bars(BACKBEAT, '....x.......x.xx'),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('X...............', EMPTY),
    },
    bossFinal: {
      bars: 2,
      guitar: bars(
        'E2p E2p E2p E2p E2p E2p E2p E2p G2p G2p G2p G2p F#2p F#2p F#2p F#2p',
        'E2p E2p E2p E2p E2p E2p E2p E2p A#2p A#2p A#2p A#2p A2p A2p A2p A2p',
      ),
      lead: bars('E5 - - - - - - - D#5 - - - D5 - - -', 'C#5 - - - C5 - - - B4 - - - A#4 - - -'),
      kick: bars(DOUBLE_KICK, DOUBLE_KICK),
      snare: bars('x...x...x...x...', 'x...x...x...xxxx'),
      hat: bars(EMPTY, EMPTY),
      crash: bars('X...............', '........X.......'),
    },
  },
  arrangements: {
    main: { order: ['intro', 'A', 'A', 'B', 'chorus', 'A', 'B', 'chorus', 'breakdown'], loopFrom: 1 },
    boss: { order: ['bossRiff'], loopFrom: 0 },
    bossFinal: { order: ['bossFinal'], loopFrom: 0 },
  },
};
```

**File: `tests/audio/song.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import { BeatClock } from '../../src/audio/beatClock';
import {
  compileSong,
  nextBarStep,
  resolveStep,
  STEPS_PER_BAR,
  stepsInWindow,
  type SongDef,
} from '../../src/audio/song';
import { EARTH_SONG } from '../../src/data/songs/earth';

const tiny: SongDef = {
  name: 'tiny',
  bpm: 120,
  sections: {
    a: {
      bars: 1,
      guitar: 'E2 - - - . . . . . . . . . . . .',
      kick: 'x...............',
      snare: '................',
      hat: '................',
    },
    b: {
      bars: 1,
      guitar: 'G2 . . . . . . . . . . . . . . .',
      kick: '....x...........',
      snare: '................',
      hat: '................',
    },
  },
  arrangements: {
    main: { order: ['a', 'b'], loopFrom: 1 },
    alt: { order: ['b'], loopFrom: 0 },
  },
};

describe('compileSong', () => {
  it('lays out each arrangement with offsets', () => {
    const song = compileSong(tiny);
    const main = song.arrangements.main!;
    expect(main.totalSteps).toBe(32);
    expect(main.loopStartStep).toBe(16);
    expect(main.entries.map((e) => [e.section.name, e.offset])).toEqual([
      ['a', 0],
      ['b', 16],
    ]);
    expect(main.entries[0]!.section.guitar[0]).toMatchObject({ midi: 40, len: 4 });
    expect(main.entries[0]!.section.crash).toHaveLength(16);
    expect(song.arrangements.alt!.totalSteps).toBe(16);
  });

  it('rejects tracks with the wrong length', () => {
    const bad: SongDef = {
      ...tiny,
      sections: { ...tiny.sections, a: { ...tiny.sections.a!, kick: 'x...' } },
    };
    expect(() => compileSong(bad)).toThrow(/a\.kick/);
  });

  it('rejects unknown sections in an arrangement', () => {
    expect(() =>
      compileSong({ ...tiny, arrangements: { main: { order: ['a', 'zzz'], loopFrom: 0 } } }),
    ).toThrow(/zzz/);
  });
});

describe('resolveStep', () => {
  const main = compileSong(tiny).arrangements.main!;

  it('finds section and local step', () => {
    expect(resolveStep(main, 3)).toMatchObject({ step: 3, section: { name: 'a' } });
    expect(resolveStep(main, 20)).toMatchObject({ step: 4, section: { name: 'b' } });
  });

  it('loops from loopFrom after the end', () => {
    expect(resolveStep(main, 32)).toMatchObject({ step: 0, section: { name: 'b' } });
    expect(resolveStep(main, 49)).toMatchObject({ step: 1, section: { name: 'b' } });
  });

  it('returns null before the start', () => {
    expect(resolveStep(main, -1)).toBeNull();
  });
});

describe('nextBarStep', () => {
  const clock = new BeatClock(120, 0); // 16th = 0.125 s, bar = 2 s

  it('rounds up to the next bar line', () => {
    expect(nextBarStep(clock, 0)).toBe(0);
    expect(nextBarStep(clock, 0.01)).toBe(16);
    expect(nextBarStep(clock, 2)).toBe(16);
    expect(nextBarStep(clock, 2.01)).toBe(32);
  });
});

describe('stepsInWindow', () => {
  const clock = new BeatClock(120, 0);

  it('lists 16th steps inside a half-open window', () => {
    expect(stepsInWindow(clock, 0, 1).map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('partitions contiguous windows without gaps or duplicates', () => {
    const a = stepsInWindow(clock, 0, 0.3).map((s) => s.index);
    const b = stepsInWindow(clock, 0.3, 1).map((s) => s.index);
    expect([...a, ...b]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('skips negative steps before the start', () => {
    expect(stepsInWindow(new BeatClock(120, 1), 0.8, 1.1).map((s) => s.index)).toEqual([0]);
  });
});

describe('EARTH_SONG', () => {
  it('compiles main and boss arrangements at 140 BPM', () => {
    const song = compileSong(EARTH_SONG);
    expect(song.bpm).toBe(140);
    for (const name of ['main', 'boss', 'bossFinal']) {
      const arr = song.arrangements[name];
      expect(arr, name).toBeDefined();
      expect(arr!.totalSteps % STEPS_PER_BAR).toBe(0);
    }
    expect(song.arrangements.main!.totalSteps).toBeGreaterThan(STEPS_PER_BAR * 16);
  });
});
```

---

### Task 3: Persistence, highscores, initials picker

**Files:** `src/persist/schema.ts`, `src/persist/migrations.ts`, `src/persist/save.ts`, `src/app/initialsPicker.ts`, `src/view/highscoreTable.ts`; tests `tests/persist/save.test.ts`, `tests/app/initialsPicker.test.ts`, `tests/view/highscoreTable.test.ts`

**Interfaces (produced):**
- `SAVE_KEY`, `SAVE_VERSION`, `MAX_HIGHSCORES`, `HighscoreEntry`, `Settings`, `SaveData`, `defaultSave()`
- `migrate(raw: unknown): SaveData` (throws on unknown)
- `KeyValueStore`, `parseSave(raw)`, `loadSave(store)`, `writeSave(store, data): boolean`, `memoryStore()`, `qualifiesForHighscore(list, score)`, `insertHighscore(list, entry)`
- `InitialsPicker { index; done; text; charAt(i); up(); down(); confirm(); back(); select(i); finish() }`, `INITIALS_LENGTH`
- `formatHighscoreLine(rank, entry): string`

- [ ] **Step 1:** tests → FAIL. **Step 2:** sources. **Step 3:** `npm test` PASS.
- [ ] **Step 4: Commit** `feat(persist): versioned save, highscore table, initials picker`

**File: `src/persist/schema.ts`**
```ts
export const SAVE_KEY = 'space-alliance:v1';
export const SAVE_VERSION = 1;
export const MAX_HIGHSCORES = 10;

export interface HighscoreEntry {
  initials: string;
  score: number;
  world: number;
  stage: number;
  loop: number;
  /** ISO date (YYYY-MM-DD). */
  date: string;
}

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  crt: boolean;
  bloom: boolean;
  shake: boolean;
  latencyOffsetMs: number;
}

export interface SaveData {
  version: number;
  credits: number;
  highscores: HighscoreEntry[];
  owned: string[];
  equipped: { skin: string; laser: string };
  settings: Settings;
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    credits: 0,
    highscores: [],
    owned: ['skin.classic', 'laser.classic'],
    equipped: { skin: 'skin.classic', laser: 'laser.classic' },
    settings: {
      musicVolume: 0.8,
      sfxVolume: 0.8,
      crt: true,
      bloom: true,
      shake: true,
      latencyOffsetMs: 0,
    },
  };
}
```

**File: `src/persist/migrations.ts`**
```ts
import {
  defaultSave,
  MAX_HIGHSCORES,
  SAVE_VERSION,
  type HighscoreEntry,
  type SaveData,
  type Settings,
} from './schema';

type Rec = Record<string, unknown>;

const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

const str = (v: unknown, fallback: string): string => (typeof v === 'string' && v.length > 0 ? v : fallback);

function isHighscore(v: unknown): v is HighscoreEntry {
  return (
    isRecord(v) &&
    typeof v.initials === 'string' &&
    typeof v.score === 'number' &&
    Number.isFinite(v.score) &&
    typeof v.world === 'number' &&
    typeof v.stage === 'number' &&
    typeof v.loop === 'number' &&
    typeof v.date === 'string'
  );
}

function sanitizeSettings(v: unknown): Settings {
  const d = defaultSave().settings;
  if (!isRecord(v)) return d;
  return {
    musicVolume: num(v.musicVolume, d.musicVolume, 0, 1),
    sfxVolume: num(v.sfxVolume, d.sfxVolume, 0, 1),
    crt: bool(v.crt, d.crt),
    bloom: bool(v.bloom, d.bloom),
    shake: bool(v.shake, d.shake),
    latencyOffsetMs: num(v.latencyOffsetMs, d.latencyOffsetMs, -300, 300),
  };
}

function sanitizeV1(o: Rec): SaveData {
  const d = defaultSave();
  const owned = Array.isArray(o.owned) ? o.owned.filter((x): x is string => typeof x === 'string') : [];
  const equipped: Rec = isRecord(o.equipped) ? o.equipped : {};
  return {
    version: SAVE_VERSION,
    credits: Math.floor(num(o.credits, d.credits, 0)),
    highscores: Array.isArray(o.highscores)
      ? o.highscores
          .filter(isHighscore)
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_HIGHSCORES)
      : [],
    owned: [...new Set([...d.owned, ...owned])],
    equipped: {
      skin: str(equipped.skin, d.equipped.skin),
      laser: str(equipped.laser, d.equipped.laser),
    },
    settings: sanitizeSettings(o.settings),
  };
}

/** Upgrades any known save version to the current `SaveData`; throws on unknown data. */
export function migrate(raw: unknown): SaveData {
  if (!isRecord(raw)) throw new Error('save is not an object');
  switch (raw.version) {
    case 1:
      return sanitizeV1(raw);
    default:
      throw new Error(`unsupported save version ${String(raw.version)}`);
  }
}
```

**File: `src/persist/save.ts`**
```ts
import { migrate } from './migrations';
import { defaultSave, MAX_HIGHSCORES, SAVE_KEY, type HighscoreEntry, type SaveData } from './schema';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function parseSave(raw: string | null): { data: SaveData; reset: boolean } {
  if (raw === null) return { data: defaultSave(), reset: false };
  try {
    return { data: migrate(JSON.parse(raw)), reset: false };
  } catch {
    return { data: defaultSave(), reset: true };
  }
}

export function loadSave(store: KeyValueStore): { data: SaveData; reset: boolean } {
  let raw: string | null = null;
  try {
    raw = store.getItem(SAVE_KEY);
  } catch (err) {
    console.warn('Save storage unavailable', err);
  }
  const result = parseSave(raw);
  if (result.reset) console.warn('Save data was corrupt and has been reset');
  return result;
}

export function writeSave(store: KeyValueStore, data: SaveData): boolean {
  try {
    store.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.warn('Could not write save', err);
    return false;
  }
}

/** In-memory fallback when localStorage is unavailable (private mode, sandboxed iframes). */
export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

export function qualifiesForHighscore(list: readonly HighscoreEntry[], score: number): boolean {
  if (score <= 0) return false;
  if (list.length < MAX_HIGHSCORES) return true;
  const last = list[list.length - 1];
  return last === undefined || score > last.score;
}

export function insertHighscore(list: readonly HighscoreEntry[], entry: HighscoreEntry): HighscoreEntry[] {
  return [...list, entry].sort((a, b) => b.score - a.score).slice(0, MAX_HIGHSCORES);
}
```

**File: `src/app/initialsPicker.ts`**
```ts
export const INITIALS_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const INITIALS_LENGTH = 3;

/** Arcade-style 3-letter name entry: up/down cycles the current letter, confirm advances. */
export class InitialsPicker {
  private readonly letters = [0, 0, 0];
  private cursor = 0;

  get index(): number {
    return this.cursor;
  }

  get done(): boolean {
    return this.cursor >= INITIALS_LENGTH;
  }

  get text(): string {
    return this.letters.map((_, i) => this.charAt(i)).join('');
  }

  charAt(i: number): string {
    return INITIALS_CHARSET[this.letters[i] ?? 0] ?? 'A';
  }

  up(): void {
    this.shift(1);
  }

  down(): void {
    this.shift(-1);
  }

  confirm(): void {
    if (!this.done) this.cursor++;
  }

  back(): void {
    if (this.cursor > 0 && !this.done) this.cursor--;
  }

  select(i: number): void {
    if (!this.done && i >= 0 && i < INITIALS_LENGTH) this.cursor = i;
  }

  finish(): void {
    this.cursor = INITIALS_LENGTH;
  }

  private shift(delta: number): void {
    if (this.done) return;
    const n = INITIALS_CHARSET.length;
    const i = this.cursor;
    this.letters[i] = ((this.letters[i] ?? 0) + delta + n) % n;
  }
}
```

**File: `src/view/highscoreTable.ts`**
```ts
import type { HighscoreEntry } from '../persist/schema';

/** " 1. ABC    1234 1-3" — fixed-width row for the pixel font. */
export function formatHighscoreLine(rank: number, e: HighscoreEntry): string {
  const where = `${e.loop > 0 ? `L${e.loop + 1} ` : ''}${e.world + 1}-${e.stage}`;
  return `${String(rank).padStart(2, ' ')}. ${e.initials.padEnd(3, ' ')} ${String(e.score).padStart(7, ' ')} ${where}`;
}
```

**File: `tests/persist/save.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import {
  insertHighscore,
  loadSave,
  memoryStore,
  parseSave,
  qualifiesForHighscore,
  writeSave,
} from '../../src/persist/save';
import { defaultSave, MAX_HIGHSCORES, type HighscoreEntry } from '../../src/persist/schema';

const entry = (score: number): HighscoreEntry => ({
  initials: 'ABC',
  score,
  world: 0,
  stage: 1,
  loop: 0,
  date: '2026-09-24',
});

describe('parseSave', () => {
  it('returns defaults for a fresh install', () => {
    expect(parseSave(null)).toEqual({ data: defaultSave(), reset: false });
  });

  it('resets on garbage JSON', () => {
    expect(parseSave('{nope').reset).toBe(true);
  });

  it('resets on unknown versions', () => {
    expect(parseSave(JSON.stringify({ version: 99 })).reset).toBe(true);
  });

  it('round-trips a valid save', () => {
    const d = defaultSave();
    d.credits = 123;
    d.highscores = [entry(500)];
    expect(parseSave(JSON.stringify(d))).toEqual({ data: d, reset: false });
  });

  it('sanitizes bad fields instead of failing', () => {
    const r = parseSave(
      JSON.stringify({
        version: 1,
        credits: -5,
        highscores: [{ bogus: true }, entry(10)],
        owned: ['skin.gold', 7],
        equipped: { skin: 42 },
        settings: { musicVolume: 3, crt: 'yes' },
      }),
    );
    expect(r.reset).toBe(false);
    expect(r.data.credits).toBe(0);
    expect(r.data.highscores).toEqual([entry(10)]);
    expect(r.data.owned).toContain('skin.gold');
    expect(r.data.owned).toContain('skin.classic');
    expect(r.data.equipped.skin).toBe('skin.classic');
    expect(r.data.settings.musicVolume).toBe(1);
    expect(r.data.settings.crt).toBe(true);
  });
});

describe('loadSave / writeSave', () => {
  it('round-trips through a store', () => {
    const store = memoryStore();
    const d = defaultSave();
    d.credits = 9;
    expect(writeSave(store, d)).toBe(true);
    expect(loadSave(store).data.credits).toBe(9);
  });

  it('survives a throwing store', () => {
    const bad = {
      getItem(): string | null {
        throw new Error('denied');
      },
      setItem(): void {
        throw new Error('denied');
      },
    };
    expect(loadSave(bad).data).toEqual(defaultSave());
    expect(writeSave(bad, defaultSave())).toBe(false);
  });
});

describe('highscores', () => {
  it('qualifies any positive score while there is room', () => {
    expect(qualifiesForHighscore([], 1)).toBe(true);
    expect(qualifiesForHighscore([], 0)).toBe(false);
  });

  it('requires beating the last entry when full', () => {
    const full = Array.from({ length: MAX_HIGHSCORES }, (_, i) => entry(1000 - i * 10));
    expect(qualifiesForHighscore(full, 910)).toBe(false);
    expect(qualifiesForHighscore(full, 911)).toBe(true);
  });

  it('inserts sorted and keeps the top ten', () => {
    let list: HighscoreEntry[] = [];
    for (let i = 0; i < 12; i++) list = insertHighscore(list, entry(i * 100));
    expect(list).toHaveLength(MAX_HIGHSCORES);
    expect(list[0]!.score).toBe(1100);
    expect(list[list.length - 1]!.score).toBe(200);
  });
});
```

**File: `tests/app/initialsPicker.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import { InitialsPicker } from '../../src/app/initialsPicker';

describe('InitialsPicker', () => {
  it('starts at AAA on the first letter', () => {
    const p = new InitialsPicker();
    expect(p.text).toBe('AAA');
    expect(p.index).toBe(0);
    expect(p.done).toBe(false);
  });

  it('cycles letters with wrap-around', () => {
    const p = new InitialsPicker();
    p.up();
    expect(p.text).toBe('BAA');
    p.down();
    p.down();
    expect(p.text).toBe('9AA');
  });

  it('confirms letter by letter until done', () => {
    const p = new InitialsPicker();
    p.up();
    p.confirm();
    p.up();
    p.up();
    p.confirm();
    p.back();
    expect(p.index).toBe(1);
    p.confirm();
    p.confirm();
    expect(p.done).toBe(true);
    expect(p.text).toBe('BCA');
    p.up();
    expect(p.text).toBe('BCA');
  });

  it('selects a letter directly and can finish early', () => {
    const p = new InitialsPicker();
    p.select(2);
    p.up();
    expect(p.text).toBe('AAB');
    p.finish();
    expect(p.done).toBe(true);
  });
});
```

**File: `tests/view/highscoreTable.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import { formatHighscoreLine } from '../../src/view/highscoreTable';

describe('formatHighscoreLine', () => {
  it('pads rank, initials and score to fixed columns', () => {
    expect(
      formatHighscoreLine(1, { initials: 'ABC', score: 1234, world: 0, stage: 3, loop: 0, date: '' }),
    ).toBe(' 1. ABC    1234 1-3');
  });

  it('shows the loop when past the first', () => {
    expect(
      formatHighscoreLine(10, { initials: 'Z', score: 9, world: 2, stage: 5, loop: 1, date: '' }),
    ).toBe('10. Z         9 L2 3-5');
  });
});
```

---

### Task 4: View, scenes and app wiring

**Files:** `src/data/font.ts`, `src/data/sprites.ts`, `src/view/textures.ts`, `src/view/pixelText.ts`, `src/view/anim.ts`, `src/view/renderer.ts`, `src/view/hud.ts`, `src/scenes/scene.ts`, `src/scenes/titleScene.ts`, `src/scenes/runScene.ts`, `src/scenes/gameOverScene.ts`, `src/app/app.ts`; tests `tests/data/font.test.ts`, `tests/view/anim.test.ts`

**Interfaces (produced):**
- `GameTextures` gains `shieldCracked`, `wardenBody`, `turret`
- `centerText(t: PixelText, y: number)`; `popInScale(progress, row)`, `blink(time, hz)`
- `GameRenderer.render(state, dt, beat)` draws divers, shields (cracked when damaged), Warden body/turrets, laser warn/beam, intro pop-in
- `Hud.update(state, paused, beat, audioOk, dt)`, `Hud.notify(events)`
- Scenes: `Scene`, `SceneContext`, `FrameInput`, `RunSummary`; `TitleScene`, `RunScene`, `GameOverScene`

- [ ] **Step 1:** tests → FAIL. **Step 2:** sources. **Step 3:** `npm test && npm run typecheck && npm run build` PASS.
- [ ] **Step 4: Browser verify:** title shows logo and alternates to highscores once any exist; fire starts run with "STAGE 1-1" intro and pop-in; stage clear shows results; forcing stage 5 (`__sa.run.stage=4; __sa.run.enemies=[]`) shows WARNING → Warden flies in, turrets, laser telegraph; game over → initials entry → table → title; no console errors.
- [ ] **Step 5: Commit** `feat: scenes, highscore entry, boss and new enemy rendering`

**File: `src/data/font.ts`**
```ts
export const GLYPH_W = 3;
export const GLYPH_H = 5;
export const GLYPH_ADVANCE = 4;

export const GLYPHS: Record<string, readonly string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '..#', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  ' ': ['...', '...', '...', '...', '...'],
  '-': ['...', '...', '###', '...', '...'],
  ':': ['...', '.#.', '...', '.#.', '...'],
  '.': ['...', '...', '...', '...', '.#.'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  '%': ['#.#', '..#', '.#.', '#..', '#.#'],
  '+': ['...', '.#.', '###', '.#.', '...'],
};

export function textWidth(text: string): number {
  return text.length === 0 ? 0 : text.length * GLYPH_ADVANCE - 1;
}
```

**File: `src/data/sprites.ts`**
```ts
import type { PixelGrid } from '../view/pixelArt';

const PLAYER_PALETTE = { '#': 0x4af2ff, o: 0xffffff } as const;
const GRUNT_PALETTE = { '#': 0x7dff6b } as const;
const GUNNER_PALETTE = { '#': 0xff5ad1 } as const;
const DIVER_PALETTE = { '#': 0xffb341 } as const;
const SHIELD_PALETTE = { '#': 0x9aa7ff, o: 0xe6ebff } as const;
const SHIELD_CRACKED_PALETTE = { '#': 0x5a6099, o: 0xff5a5a } as const;
const TURRET_PALETTE = { '#': 0x9aa0aa, o: 0xff5a5a } as const;
const WARDEN_PALETTE = {
  '#': 0x2b4a9e,
  l: 0x7fa8ff,
  '=': 0x9aa0aa,
  h: 0xc8ccd6,
  e: 0x6b7080,
  c: 0xff3b5c,
  a: 0xffe14a,
} as const;

const SHIELD_ROWS_A = [
  '..#######..',
  '.#ooooooo#.',
  '##o#####o##',
  '##o#.#.#o##',
  '###########',
  '.#.#...#.#.',
  '#.........#',
  '.#.......#.',
];
const SHIELD_ROWS_B = [
  '..#######..',
  '.#ooooooo#.',
  '##o#####o##',
  '##o#.#.#o##',
  '###########',
  '..#.#.#.#..',
  '.#.......#.',
  '#.........#',
];

/** 56×20 satellite station: solar panels, struts, hub with a red core window, antenna. */
function wardenPixel(x: number, y: number): string {
  const r = Math.hypot(x - 27.5, y - 9.5);
  if (r <= 3.2) return 'c';
  if (r <= 8.5) return r > 7.4 ? 'e' : 'h';
  if (y >= 5 && y <= 14 && (x <= 16 || x >= 39)) return x % 4 === 0 || y === 5 || y === 14 ? 'l' : '#';
  if ((y === 9 || y === 10) && x > 16 && x < 39) return '=';
  if ((x === 27 || x === 28) && y <= 1) return 'a';
  return '.';
}

function generate(w: number, h: number, pixel: (x: number, y: number) => string): string[] {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) row += pixel(x, y);
    rows.push(row);
  }
  return rows;
}

export const SPRITES = {
  player: {
    palette: PLAYER_PALETTE,
    rows: [
      '......o......',
      '.....###.....',
      '.....###.....',
      '.###########.',
      '#############',
      '#############',
      '#############',
      '#############',
    ],
  },
  grunt: [
    {
      palette: GRUNT_PALETTE,
      rows: [
        '..#.....#..',
        '...#...#...',
        '..#######..',
        '.##.###.##.',
        '###########',
        '#.#######.#',
        '#.#.....#.#',
        '...##.##...',
      ],
    },
    {
      palette: GRUNT_PALETTE,
      rows: [
        '..#.....#..',
        '#..#...#..#',
        '#.#######.#',
        '###.###.###',
        '###########',
        '.#########.',
        '..#.....#..',
        '.#.......#.',
      ],
    },
  ],
  gunner: [
    {
      palette: GUNNER_PALETTE,
      rows: [
        '....###....',
        '..#######..',
        '.#########.',
        '.##..#..##.',
        '.#########.',
        '...##.##...',
        '..##.#.##..',
        '.##.....##.',
      ],
    },
    {
      palette: GUNNER_PALETTE,
      rows: [
        '....###....',
        '..#######..',
        '.#########.',
        '.##..#..##.',
        '.#########.',
        '..##...##..',
        '.##.###.##.',
        '..##...##..',
      ],
    },
  ],
  diver: [
    {
      palette: DIVER_PALETTE,
      rows: [
        '...#...#...',
        '...#####...',
        '..##.#.##..',
        '.#########.',
        '##.#####.##',
        '#..#...#..#',
        '...#...#...',
        '..#.....#..',
      ],
    },
    {
      palette: DIVER_PALETTE,
      rows: [
        '...#...#...',
        '...#####...',
        '..##.#.##..',
        '.#########.',
        '##.#####.##',
        '...#...#...',
        '..#.....#..',
        '.#.......#.',
      ],
    },
  ],
  shield: [
    { palette: SHIELD_PALETTE, rows: SHIELD_ROWS_A },
    { palette: SHIELD_PALETTE, rows: SHIELD_ROWS_B },
  ],
  shieldCracked: [
    { palette: SHIELD_CRACKED_PALETTE, rows: SHIELD_ROWS_A },
    { palette: SHIELD_CRACKED_PALETTE, rows: SHIELD_ROWS_B },
  ],
  turret: {
    palette: TURRET_PALETTE,
    rows: [
      '...####...',
      '..#oooo#..',
      '.########.',
      '##########',
      '#.######.#',
      '...#..#...',
      '...#..#...',
      '...####...',
    ],
  },
  wardenBody: { palette: WARDEN_PALETTE, rows: generate(56, 20, wardenPixel) },
} satisfies {
  player: PixelGrid;
  grunt: readonly [PixelGrid, PixelGrid];
  gunner: readonly [PixelGrid, PixelGrid];
  diver: readonly [PixelGrid, PixelGrid];
  shield: readonly [PixelGrid, PixelGrid];
  shieldCracked: readonly [PixelGrid, PixelGrid];
  turret: PixelGrid;
  wardenBody: PixelGrid;
};
```

**File: `src/view/textures.ts`**
```ts
import { Texture } from 'pixi.js';
import { GLYPHS } from '../data/font';
import { SPRITES } from '../data/sprites';
import type { EnemyKind } from '../sim/types';
import { gridToRGBA, type PixelGrid } from './pixelArt';

export type TexturePair = readonly [Texture, Texture];

export interface GameTextures {
  player: Texture;
  enemies: Record<EnemyKind, TexturePair>;
  shieldCracked: TexturePair;
  wardenBody: Texture;
  turret: Texture;
  glyphs: Map<string, Texture>;
}

export function textureFromGrid(grid: PixelGrid): Texture {
  const { width, height, data } = gridToRGBA(grid);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.putImageData(new ImageData(data, width, height), 0, 0);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'nearest';
  return texture;
}

function pair(grids: readonly [PixelGrid, PixelGrid]): TexturePair {
  return [textureFromGrid(grids[0]), textureFromGrid(grids[1])];
}

export function loadTextures(): GameTextures {
  const glyphs = new Map<string, Texture>();
  for (const [ch, rows] of Object.entries(GLYPHS)) {
    glyphs.set(ch, textureFromGrid({ rows, palette: { '#': 0xffffff } }));
  }
  return {
    player: textureFromGrid(SPRITES.player),
    enemies: {
      grunt: pair(SPRITES.grunt),
      gunner: pair(SPRITES.gunner),
      diver: pair(SPRITES.diver),
      shield: pair(SPRITES.shield),
    },
    shieldCracked: pair(SPRITES.shieldCracked),
    wardenBody: textureFromGrid(SPRITES.wardenBody),
    turret: textureFromGrid(SPRITES.turret),
    glyphs,
  };
}
```

**File: `src/view/pixelText.ts`**
```ts
import { Container, Sprite, type Texture } from 'pixi.js';
import { FIELD_W } from '../data/balance';
import { GLYPH_ADVANCE, textWidth } from '../data/font';

export class PixelText extends Container {
  private current = '';

  constructor(
    private readonly glyphs: Map<string, Texture>,
    text = '',
    private readonly color = 0xffffff,
  ) {
    super();
    this.setText(text);
  }

  get text(): string {
    return this.current;
  }

  /** Width in logical px including this container's scale. */
  get pixelWidth(): number {
    return textWidth(this.current) * this.scale.x;
  }

  setText(text: string): void {
    const upper = text.toUpperCase();
    if (upper === this.current) return;
    this.current = upper;
    for (const child of this.removeChildren()) child.destroy();
    let x = 0;
    for (const ch of upper) {
      const tex = this.glyphs.get(ch);
      if (tex) {
        const s = new Sprite(tex);
        s.x = x;
        s.tint = this.color;
        this.addChild(s);
      }
      x += GLYPH_ADVANCE;
    }
  }
}

/** Horizontally centers `t` on the playfield at row `y`. */
export function centerText(t: PixelText, y: number): void {
  t.position.set(Math.round((FIELD_W - t.pixelWidth) / 2), y);
}
```

**File: `src/view/anim.ts`**
```ts
import { clamp } from '../sim/math';

/** Staggered pop-in scale for formation rows during the stage intro (progress 0..1). */
export function popInScale(progress: number, row: number): number {
  return clamp((progress - row * 0.1) / 0.5, 0, 1);
}

/** Square-wave on/off at `hz` full cycles per second. */
export function blink(time: number, hz: number): boolean {
  return Math.floor(time * hz * 2) % 2 === 0;
}
```

**File: `src/view/renderer.ts`**
```ts
import { Container, Sprite, Texture } from 'pixi.js';
import { FIELD_H, FIELD_W, STAGE, WARDEN } from '../data/balance';
import { laserBox } from '../sim/boss/warden';
import type { Boss, Bullet, Enemy, SimState } from '../sim/types';
import { blink, popInScale } from './anim';
import { beatPulse, lerpColor } from './beatPulse';
import { Starfield } from './starfield';
import type { GameTextures } from './textures';

const PLAYER_BULLET_COLOR = 0x9ff6ff;
const ENEMY_BULLET_COLOR = 0xffa040;
const ON_BEAT_BULLET_COLOR = 0xffe14a;
const BACKDROP_BASE = 0x05060d;
const BACKDROP_PULSE = 0x1a2244;
const LASER_COLOR = 0xff3b5c;

function syncSprites<T extends { id: number }>(
  sprites: Map<number, Sprite>,
  items: readonly T[],
  layer: Container,
  create: (item: T) => Sprite,
  update: (sprite: Sprite, item: T) => void,
): void {
  const seen = new Set<number>();
  for (const item of items) {
    let s = sprites.get(item.id);
    if (!s) {
      s = create(item);
      sprites.set(item.id, s);
      layer.addChild(s);
    }
    update(s, item);
    seen.add(item.id);
  }
  for (const [id, s] of sprites) {
    if (!seen.has(id)) {
      s.destroy();
      sprites.delete(id);
    }
  }
}

function whiteSprite(tint: number): Sprite {
  const s = new Sprite(Texture.WHITE);
  s.tint = tint;
  return s;
}

export class GameRenderer {
  readonly root = new Container();
  private readonly backdrop = whiteSprite(BACKDROP_BASE);
  private readonly starfield = new Starfield();
  private readonly entities = new Container();
  private readonly player: Sprite;
  private readonly enemySprites = new Map<number, Sprite>();
  private readonly bulletSprites = new Map<number, Sprite>();
  private readonly bossLayer = new Container();
  private readonly bossBody: Sprite;
  private readonly turretSprites: Sprite[] = [];
  private readonly laserWarn = whiteSprite(LASER_COLOR);
  private readonly laserBeam = whiteSprite(LASER_COLOR);
  private readonly laserCore = whiteSprite(0xffffff);

  constructor(private readonly tex: GameTextures) {
    this.backdrop.width = FIELD_W;
    this.backdrop.height = FIELD_H;
    this.player = new Sprite(tex.player);
    this.bossBody = new Sprite(tex.wardenBody);
    for (let i = 0; i < WARDEN.turretOffsets.length; i++) this.turretSprites.push(new Sprite(tex.turret));
    this.laserBeam.alpha = 0.85;
    this.bossLayer.addChild(this.laserWarn, this.laserBeam, this.laserCore, this.bossBody, ...this.turretSprites);
    this.bossLayer.visible = false;
    this.entities.addChild(this.player);
    this.root.addChild(this.backdrop, this.starfield, this.bossLayer, this.entities);
  }

  render(state: SimState, dt: number, beat: number | null): void {
    const pulse = beatPulse(beat);
    this.backdrop.tint = lerpColor(BACKDROP_BASE, BACKDROP_PULSE, pulse * 0.6);
    this.starfield.update(dt);

    const p = state.player;
    this.player.position.set(Math.round(p.x), Math.round(p.y));
    const blinkOff = p.invuln > 0 && Math.floor(state.time * 20) % 2 === 1;
    this.player.visible = state.phase !== 'gameOver' && !blinkOff;

    const tick = beat !== null && beat >= 0 ? Math.floor(beat) : Math.floor(state.time * 2);
    const frame = tick % 2 === 0 ? 0 : 1;
    const intro = state.phase === 'stageIntro' && !state.boss ? 1 - state.phaseTimer / STAGE.introTime : 1;

    syncSprites<Enemy>(
      this.enemySprites,
      state.enemies,
      this.entities,
      (e) => {
        const s = new Sprite(this.tex.enemies[e.kind][0]);
        s.anchor.set(0.5);
        return s;
      },
      (s, e) => {
        s.texture =
          e.kind === 'shield' && e.hp < e.maxHp ? this.tex.shieldCracked[frame] : this.tex.enemies[e.kind][frame];
        s.position.set(Math.round(e.x + e.w / 2), Math.round(e.y + e.h / 2));
        s.scale.set(popInScale(intro, e.row));
        s.alpha = e.flash > 0 ? 0.5 : 1;
      },
    );

    syncSprites<Bullet>(
      this.bulletSprites,
      state.bullets,
      this.entities,
      (b) => {
        const s = whiteSprite(
          b.owner === 'enemy' ? ENEMY_BULLET_COLOR : b.onBeat ? ON_BEAT_BULLET_COLOR : PLAYER_BULLET_COLOR,
        );
        s.width = b.w;
        s.height = b.h;
        return s;
      },
      (s, b) => s.position.set(Math.round(b.x), Math.round(b.y)),
    );

    this.renderBoss(state.boss, state.time, pulse);
  }

  private renderBoss(b: Boss | null, time: number, pulse: number): void {
    this.bossLayer.visible = b !== null;
    if (!b) return;
    this.bossBody.position.set(Math.round(b.x), Math.round(b.y));
    this.bossBody.visible = b.dying === 0 || blink(time, 10);
    this.bossBody.alpha = b.flash > 0 ? 0.6 : 1;
    this.bossBody.tint = b.phase === 3 ? lerpColor(0xffffff, 0xff6070, 0.4 + 0.6 * pulse) : 0xffffff;
    b.turrets.forEach((t, i) => {
      const s = this.turretSprites[i];
      if (!s) return;
      s.visible = t.alive && b.dying === 0;
      s.position.set(Math.round(t.x), Math.round(t.y));
      s.alpha = t.flash > 0 ? 0.5 : 1;
    });

    const l = b.laser;
    this.laserWarn.visible = l !== null && l.state === 'warn' && blink(time, 8);
    this.laserBeam.visible = l !== null && l.state === 'fire';
    this.laserCore.visible = this.laserBeam.visible;
    if (!l) return;
    const box = laserBox(b, l);
    this.laserWarn.position.set(Math.round(l.x), Math.round(box.y));
    this.laserWarn.width = 1;
    this.laserWarn.height = box.h;
    this.laserBeam.position.set(Math.round(box.x), Math.round(box.y));
    this.laserBeam.width = box.w;
    this.laserBeam.height = box.h;
    this.laserCore.position.set(Math.round(l.x) - 1, Math.round(box.y));
    this.laserCore.width = 2;
    this.laserCore.height = box.h;
  }
}
```

**File: `src/view/hud.ts`**
```ts
import { Container, Graphics, type Texture } from 'pixi.js';
import { FIELD_H, FIELD_W, RHYTHM, STAGE } from '../data/balance';
import { worldAt } from '../data/worlds';
import type { SimEvent, SimState } from '../sim/types';
import { beatPulse } from './beatPulse';
import { centerText, PixelText } from './pixelText';

const MULT_COLORS: readonly [number, number][] = [
  [4, 0xffe14a],
  [3, 0xff5ad1],
  [2, 0x4af2ff],
  [1.5, 0x7dff6b],
  [1, 0xffffff],
];

function multColor(mult: number): number {
  for (const [min, color] of MULT_COLORS) if (mult >= min) return color;
  return 0xffffff;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

const RING_X = 104;
const MULT_X = 111;
const RESULT_LINES = 5;
const RESULT_LINE_DELAY = 0.25;
const POPUP_TIME = 1.5;
const BOSS_BAR = { x: 40, y: 13, w: 160, h: 3 } as const;

export class Hud extends Container {
  private readonly score: PixelText;
  private readonly stage: PixelText;
  private readonly lives: PixelText;
  private readonly banner: PixelText;
  private readonly sub: PixelText;
  private readonly mult: PixelText;
  private readonly popup: PixelText;
  private readonly results: PixelText[] = [];
  private readonly ring = new Graphics();
  private readonly bossBar = new Graphics();
  private popupTime = 0;

  constructor(glyphs: Map<string, Texture>) {
    super();
    this.score = new PixelText(glyphs);
    this.stage = new PixelText(glyphs);
    this.lives = new PixelText(glyphs, '', 0x4af2ff);
    this.banner = new PixelText(glyphs, '', 0xffe14a);
    this.banner.scale.set(2);
    this.sub = new PixelText(glyphs, '', 0xcccccc);
    this.mult = new PixelText(glyphs);
    this.popup = new PixelText(glyphs, '', 0x7dff6b);
    for (let i = 0; i < RESULT_LINES; i++) {
      const t = new PixelText(glyphs, '', i === RESULT_LINES - 1 ? 0xffe14a : 0xcccccc);
      t.position.set(72, 138 + i * 9);
      this.results.push(t);
    }
    this.score.position.set(4, 4);
    this.stage.y = 4;
    this.lives.position.set(4, FIELD_H - 9);
    this.ring.position.set(RING_X, 6);
    this.mult.position.set(MULT_X, 4);
    this.addChild(
      this.score,
      this.stage,
      this.lives,
      this.ring,
      this.mult,
      this.bossBar,
      this.banner,
      this.sub,
      ...this.results,
      this.popup,
    );
  }

  notify(events: readonly SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'extraLife') {
        this.popup.setText('EXTRA SHIP!');
        this.popupTime = POPUP_TIME;
      }
    }
  }

  update(state: SimState, paused: boolean, beat: number | null, audioOk: boolean, dt: number): void {
    this.score.setText(`SCORE ${state.score}`);
    const label = `${state.world + 1}-${state.stage}`;
    this.stage.setText(state.loop > 0 ? `L${state.loop + 1} ${label}` : `STAGE ${label}`);
    this.stage.x = FIELD_W - 4 - this.stage.pixelWidth;
    this.lives.setText(`SHIPS ${Math.max(0, state.player.lives)}`);
    this.updateRhythm(state, beat, audioOk);
    this.updateBossBar(state);
    this.updateBanner(state, paused);
    this.updateResults(state);
    this.popupTime = Math.max(0, this.popupTime - dt);
    this.popup.visible = this.popupTime > 0;
    centerText(this.popup, 200);
  }

  private updateRhythm(state: SimState, beat: number | null, audioOk: boolean): void {
    this.ring.visible = audioOk;
    if (!audioOk) {
      this.mult.setText('NO AUDIO');
      centerText(this.mult, 4);
      return;
    }
    const m = state.rhythm.mult;
    const color = multColor(m);
    this.mult.setText(`X${m.toFixed(1)}`);
    this.mult.x = MULT_X;
    this.mult.tint = color;
    const progress =
      m >= RHYTHM.maxMult ? 1 : (state.rhythm.streak % RHYTHM.shotsPerStep) / RHYTHM.shotsPerStep;
    this.ring.clear().circle(0, 0, 4).stroke({ color: 0x333a55, width: 1 });
    if (progress > 0) {
      this.ring.arc(0, 0, 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress).stroke({ color, width: 1 });
    }
    this.ring.scale.set(1 + 0.35 * beatPulse(beat));
  }

  private updateBossBar(state: SimState): void {
    const b = state.boss;
    this.bossBar.visible = b !== null && !b.entering && b.dying === 0;
    if (!b || !this.bossBar.visible) return;
    const ratio = Math.max(0, b.hp / b.maxHp);
    this.bossBar
      .clear()
      .rect(BOSS_BAR.x, BOSS_BAR.y, BOSS_BAR.w, BOSS_BAR.h)
      .fill(0x331018)
      .rect(BOSS_BAR.x, BOSS_BAR.y, BOSS_BAR.w * ratio, BOSS_BAR.h)
      .fill(0xff3b5c);
  }

  private updateBanner(state: SimState, paused: boolean): void {
    let banner = '';
    let sub = '';
    let y = 140;
    if (paused) {
      banner = 'PAUSED';
      sub = 'PRESS P TO RESUME';
    } else if (state.phase === 'gameOver') {
      banner = 'GAME OVER';
      sub = 'PRESS FIRE';
    } else if (state.phase === 'stageIntro') {
      const world = worldAt(state.world);
      if (state.boss) {
        banner = Math.floor(state.time * 6) % 2 === 0 ? 'WARNING' : '';
        sub = world.bossName;
      } else {
        banner = `STAGE ${state.world + 1}-${state.stage}`;
        if (state.stage === 1) sub = state.loop > 0 ? `${world.name} - LOOP ${state.loop + 1}` : world.name;
      }
    } else if (state.phase === 'stageClear') {
      banner = state.stage === STAGE.perWorld ? 'WORLD CLEAR' : 'STAGE CLEAR';
      y = 110;
    }
    this.banner.setText(banner);
    this.sub.setText(sub);
    centerText(this.banner, y);
    centerText(this.sub, y + 20);
  }

  private updateResults(state: SimState): void {
    const r = state.phase === 'stageClear' ? state.result : null;
    const lines = r
      ? [
          `ACCURACY  ${pct(r.accuracy)}`,
          `ON BEAT   ${pct(r.beatPct)}`,
          r.noHit ? 'NO HIT    +2000' : 'HIT TAKEN',
          r.perfect ? 'PERFECT!' : '',
          `BONUS     +${r.bonus}`,
        ]
      : [];
    const shown = r ? Math.floor((STAGE.clearTime - state.phaseTimer) / RESULT_LINE_DELAY) : 0;
    this.results.forEach((t, i) => {
      t.setText(lines[i] ?? '');
      t.visible = i < shown;
    });
  }
}
```

**File: `src/scenes/scene.ts`**
```ts
import type { Container } from 'pixi.js';
import type { AudioEngine } from '../audio/engine';
import type { CompiledSong } from '../audio/song';
import type { MenuAction, Tap } from '../input/inputFrame';
import type { SaveData } from '../persist/schema';
import type { InputFrame } from '../sim/types';
import type { GameTextures } from '../view/textures';

/** Everything input-related for one fixed sim step. */
export interface FrameInput {
  sim: InputFrame;
  menu: readonly MenuAction[];
  taps: readonly Tap[];
  pause: boolean;
}

export interface RunSummary {
  score: number;
  world: number;
  stage: number;
  loop: number;
}

export interface Scene {
  readonly root: Container;
  /** Fixed-step update (SIM_DT). */
  update(input: FrameInput, dt: number): void;
  /** Once per rendered frame. */
  render(elapsed: number): void;
  onHidden?(): void;
  destroy(): void;
}

export interface SceneFactory {
  title(): Scene;
  run(): Scene;
  gameOver(summary: RunSummary): Scene;
}

export interface SceneContext {
  readonly textures: GameTextures;
  readonly audio: AudioEngine | null;
  readonly save: SaveData;
  readonly isTouch: boolean;
  readonly scenes: SceneFactory;
  /** One-shot message for the title screen (e.g. save reset). */
  notice: string | null;
  songForWorld(world: number): CompiledSong;
  persist(): void;
  goto(next: Scene): void;
}
```

**File: `src/scenes/titleScene.ts`**
```ts
import { Container, Sprite, Texture } from 'pixi.js';
import { FIELD_H, FIELD_W } from '../data/balance';
import { blink } from '../view/anim';
import { formatHighscoreLine } from '../view/highscoreTable';
import { centerText, PixelText } from '../view/pixelText';
import { Starfield } from '../view/starfield';
import type { FrameInput, Scene, SceneContext } from './scene';

const PAGE_TIME = 5;
const NOTICE_TIME = 3;
const TABLE_X = 82;

export class TitleScene implements Scene {
  readonly root = new Container();
  private readonly starfield = new Starfield();
  private readonly tagline: PixelText;
  private readonly prompt: PixelText;
  private readonly notice: PixelText;
  private readonly tableHeader: PixelText;
  private readonly table: PixelText[] = [];
  private t = 0;

  constructor(private readonly ctx: SceneContext) {
    const g = ctx.textures.glyphs;
    const bg = new Sprite(Texture.WHITE);
    bg.width = FIELD_W;
    bg.height = FIELD_H;
    bg.tint = 0x05060d;

    const logo = new PixelText(g, 'SPACE ALLIANCE', 0xffe14a);
    logo.scale.set(2);
    centerText(logo, 70);
    this.tagline = new PixelText(g, 'DEFEND THE ORBIT. KEEP THE BEAT.', 0x4af2ff);
    centerText(this.tagline, 96);
    this.prompt = new PixelText(g, ctx.isTouch ? 'TAP TO START' : 'PRESS FIRE TO START');
    centerText(this.prompt, 250);
    this.notice = new PixelText(g, ctx.notice ?? '', 0xff5a5a);
    centerText(this.notice, 280);
    this.tableHeader = new PixelText(g, 'HIGH SCORES', 0xff5ad1);
    centerText(this.tableHeader, 120);
    ctx.save.highscores.forEach((e, i) => {
      const t = new PixelText(g, formatHighscoreLine(i + 1, e), i === 0 ? 0xffe14a : 0xcccccc);
      t.position.set(TABLE_X, 134 + i * 9);
      this.table.push(t);
    });

    this.root.addChild(bg, this.starfield, logo, this.tagline, this.tableHeader, ...this.table, this.prompt, this.notice);
  }

  update(input: FrameInput, dt: number): void {
    this.t += dt;
    if (input.menu.includes('confirm') || input.taps.length > 0) this.ctx.goto(this.ctx.scenes.run());
  }

  render(elapsed: number): void {
    this.starfield.update(elapsed);
    const showTable = this.table.length > 0 && Math.floor(this.t / PAGE_TIME) % 2 === 1;
    this.tableHeader.visible = showTable;
    for (const t of this.table) t.visible = showTable;
    this.tagline.visible = !showTable;
    this.prompt.visible = blink(this.t, 1);
    this.notice.visible = this.ctx.notice !== null && this.t < NOTICE_TIME;
    if (this.t >= NOTICE_TIME) this.ctx.notice = null;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
```

**File: `src/scenes/runScene.ts`**
```ts
import { Container } from 'pixi.js';
import { createInitialState } from '../sim/state';
import { step } from '../sim/step';
import type { SimEvent, SimState } from '../sim/types';
import { Hud } from '../view/hud';
import { GameRenderer } from '../view/renderer';
import type { FrameInput, Scene, SceneContext } from './scene';

const GAME_OVER_DELAY = 1;

function newSeed(): number {
  return (Math.random() * 2 ** 32) >>> 0;
}

export class RunScene implements Scene {
  readonly root = new Container();
  readonly state: SimState;
  private readonly renderer: GameRenderer;
  private readonly hud: Hud;
  private paused = false;
  private gameOverTime = 0;

  constructor(private readonly ctx: SceneContext) {
    this.state = createInitialState(newSeed());
    this.renderer = new GameRenderer(ctx.textures);
    this.hud = new Hud(ctx.textures.glyphs);
    this.root.addChild(this.renderer.root, this.hud);
    ctx.audio?.sfx.start();
    ctx.audio?.startSong(ctx.songForWorld(this.state.world));
  }

  onHidden(): void {
    this.setPaused(true);
  }

  update(input: FrameInput, dt: number): void {
    const s = this.state;
    if (input.pause && s.phase !== 'gameOver') this.setPaused(!this.paused);
    if (this.paused) {
      if (this.ctx.isTouch && input.taps.length > 0) this.setPaused(false);
      return;
    }
    if (s.phase === 'gameOver') {
      this.gameOverTime += dt;
      if (this.gameOverTime > GAME_OVER_DELAY && (input.menu.includes('confirm') || input.taps.length > 0)) {
        this.ctx.goto(this.ctx.scenes.gameOver({ score: s.score, world: s.world, stage: s.stage, loop: s.loop }));
      }
      return;
    }
    const events = step(s, input.sim);
    this.hud.notify(events);
    this.playEvents(events);
  }

  render(elapsed: number): void {
    const beat = this.ctx.audio?.currentBeat() ?? null;
    this.renderer.render(this.state, this.paused ? 0 : elapsed, beat);
    this.hud.update(this.state, this.paused, beat, this.ctx.audio !== null, elapsed);
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }

  private setPaused(p: boolean): void {
    if (this.paused === p) return;
    this.paused = p;
    this.ctx.audio?.setPaused(p);
  }

  private playEvents(events: readonly SimEvent[]): void {
    const audio = this.ctx.audio;
    if (!audio) return;
    for (const e of events) {
      switch (e.type) {
        case 'shot':
          audio.sfx.laser(e.onBeat);
          break;
        case 'enemyKilled':
        case 'turretDestroyed':
          audio.sfx.explosion();
          break;
        case 'enemyShot':
          audio.sfx.enemyShot();
          break;
        case 'playerHit':
          audio.sfx.playerHit();
          break;
        case 'stageClear':
          audio.sfx.stageClear();
          break;
        case 'extraLife':
          audio.sfx.extraLife();
          break;
        case 'dive':
          audio.sfx.dive();
          break;
        case 'bossHit':
          audio.sfx.bossHit();
          break;
        case 'bossPhase':
          audio.sfx.bossPhase();
          if (e.phase === 3) audio.queueArrangement('bossFinal');
          break;
        case 'bossKilled':
          audio.sfx.bossKilled();
          break;
        case 'laserWarn':
          audio.sfx.laserWarn();
          break;
        case 'laserFire':
          audio.sfx.laserFire();
          break;
        case 'stageIntro':
          audio.queueArrangement(e.boss ? 'boss' : 'main');
          break;
        case 'gameOver':
          audio.stopSong();
          break;
        default:
          break;
      }
    }
  }
}
```

**File: `src/scenes/gameOverScene.ts`**
```ts
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { INITIALS_LENGTH, InitialsPicker } from '../app/initialsPicker';
import { FIELD_H, FIELD_W } from '../data/balance';
import type { Tap } from '../input/inputFrame';
import { insertHighscore, qualifiesForHighscore } from '../persist/save';
import type { HighscoreEntry } from '../persist/schema';
import { blink } from '../view/anim';
import { formatHighscoreLine } from '../view/highscoreTable';
import { centerText, PixelText } from '../view/pixelText';
import type { FrameInput, RunSummary, Scene, SceneContext } from './scene';

const LETTER_SCALE = 3;
const LETTER_Y = 130;
const LETTER_H = 15;
const LETTER_SPACING = 24;
const OK_BOX = { x: 104, y: 172, w: 32, h: 12 } as const;
const TABLE_X = 82;
const CONTINUE_DELAY = 0.5;

function letterLeft(i: number): number {
  return Math.round(FIELD_W / 2 + (i - 1) * LETTER_SPACING - 4.5);
}

export class GameOverScene implements Scene {
  readonly root = new Container();
  private readonly glyphs;
  private readonly picker: InitialsPicker | null;
  private readonly letters: PixelText[] = [];
  private readonly cursor = new Graphics();
  private readonly ok: PixelText;
  private readonly okBox = new Graphics();
  private readonly help: PixelText;
  private readonly heading: PixelText;
  private readonly prompt: PixelText;
  private readonly tableLayer = new Container();
  private t = 0;

  constructor(
    private readonly ctx: SceneContext,
    private readonly summary: RunSummary,
  ) {
    const g = (this.glyphs = ctx.textures.glyphs);
    const bg = new Sprite(Texture.WHITE);
    bg.width = FIELD_W;
    bg.height = FIELD_H;
    bg.tint = 0x05060d;

    const title = new PixelText(g, 'GAME OVER', 0xff3b5c);
    title.scale.set(2);
    centerText(title, 40);
    const score = new PixelText(g, `SCORE ${summary.score}`, 0xffe14a);
    centerText(score, 70);
    const loop = summary.loop > 0 ? `LOOP ${summary.loop + 1} ` : '';
    const reached = new PixelText(g, `REACHED ${loop}${summary.world + 1}-${summary.stage}`, 0xcccccc);
    centerText(reached, 82);

    this.picker = qualifiesForHighscore(ctx.save.highscores, summary.score) ? new InitialsPicker() : null;
    this.heading = new PixelText(g, this.picker ? 'NEW HIGH SCORE! ENTER NAME' : 'HIGH SCORES', 0x7dff6b);
    centerText(this.heading, 108);
    for (let i = 0; i < INITIALS_LENGTH; i++) {
      const t = new PixelText(g, 'A');
      t.scale.set(LETTER_SCALE);
      t.position.set(letterLeft(i), LETTER_Y);
      this.letters.push(t);
    }
    this.ok = new PixelText(g, 'OK', 0x7dff6b);
    this.ok.position.set(OK_BOX.x + 13, OK_BOX.y + 4);
    this.okBox.rect(OK_BOX.x, OK_BOX.y, OK_BOX.w, OK_BOX.h).stroke({ color: 0x7dff6b, width: 1 });
    this.help = new PixelText(g, ctx.isTouch ? 'TAP TOP OR BOTTOM OF A LETTER' : 'UP/DOWN CHANGE  FIRE NEXT', 0x888888);
    centerText(this.help, 196);
    this.prompt = new PixelText(g, ctx.isTouch ? 'TAP TO CONTINUE' : 'PRESS FIRE TO CONTINUE');
    centerText(this.prompt, 290);

    this.root.addChild(
      bg,
      title,
      score,
      reached,
      this.heading,
      ...this.letters,
      this.cursor,
      this.okBox,
      this.ok,
      this.help,
      this.tableLayer,
      this.prompt,
    );
    if (!this.picker) this.showTable(null);
    this.refresh();
  }

  update(input: FrameInput, dt: number): void {
    this.t += dt;
    const p = this.picker;
    if (p && !p.done) {
      for (const a of input.menu) {
        if (a === 'up') p.up();
        else if (a === 'down') p.down();
        else if (a === 'confirm' || a === 'right') p.confirm();
        else if (a === 'back' || a === 'left') p.back();
      }
      for (const tap of input.taps) this.handleTap(p, tap);
      if (p.done) this.submit(p);
      return;
    }
    if (this.t > CONTINUE_DELAY && (input.menu.includes('confirm') || input.taps.length > 0)) {
      this.ctx.goto(this.ctx.scenes.title());
    }
  }

  render(): void {
    this.refresh();
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }

  private handleTap(p: InitialsPicker, tap: Tap): void {
    if (tap.x >= OK_BOX.x && tap.x <= OK_BOX.x + OK_BOX.w && tap.y >= OK_BOX.y && tap.y <= OK_BOX.y + OK_BOX.h) {
      p.finish();
      return;
    }
    for (let i = 0; i < INITIALS_LENGTH; i++) {
      const cx = letterLeft(i) + 4.5;
      if (Math.abs(tap.x - cx) > 10 || tap.y < LETTER_Y - 12 || tap.y > LETTER_Y + LETTER_H + 12) continue;
      p.select(i);
      if (tap.y < LETTER_Y + LETTER_H / 2) p.up();
      else p.down();
    }
  }

  private submit(p: InitialsPicker): void {
    const entry: HighscoreEntry = {
      initials: p.text,
      score: this.summary.score,
      world: this.summary.world,
      stage: this.summary.stage,
      loop: this.summary.loop,
      date: new Date().toISOString().slice(0, 10),
    };
    this.ctx.save.highscores = insertHighscore(this.ctx.save.highscores, entry);
    this.ctx.persist();
    this.t = 0;
    this.heading.setText('HIGH SCORES');
    centerText(this.heading, 108);
    this.showTable(entry);
  }

  private showTable(highlight: HighscoreEntry | null): void {
    this.tableLayer.removeChildren().forEach((c) => c.destroy());
    this.ctx.save.highscores.forEach((e, i) => {
      const color = e === highlight ? 0xffe14a : 0xcccccc;
      const t = new PixelText(this.glyphs, formatHighscoreLine(i + 1, e), color);
      t.position.set(TABLE_X, 122 + i * 9);
      this.tableLayer.addChild(t);
    });
  }

  private refresh(): void {
    const p = this.picker;
    const editing = p !== null && !p.done;
    for (const [i, t] of this.letters.entries()) {
      t.visible = editing;
      if (p) {
        t.setText(p.charAt(i));
        t.tint = i === p.index ? 0xffe14a : 0xffffff;
      }
    }
    this.cursor.clear();
    if (editing && p) {
      const x = letterLeft(p.index);
      const top = LETTER_Y - 4;
      const bottom = LETTER_Y + LETTER_H + 4;
      this.cursor
        .poly([x + 4.5, top - 5, x, top, x + 9, top])
        .fill(0xffe14a)
        .poly([x + 4.5, bottom + 5, x, bottom, x + 9, bottom])
        .fill(0xffe14a);
    }
    this.ok.visible = editing;
    this.okBox.visible = editing;
    this.help.visible = editing;
    this.tableLayer.visible = !editing;
    this.prompt.visible = !editing && blink(this.t, 1);
  }
}
```

**File: `src/app/app.ts`**
```ts
import { Application, Container, Graphics, TextureSource } from 'pixi.js';
import { AudioEngine } from '../audio/engine';
import { compileSong, type CompiledSong } from '../audio/song';
import { MAX_STEPS_PER_FRAME, SIM_DT } from '../data/balance';
import { EARTH_SONG } from '../data/songs/earth';
import { worldAt, type WorldId } from '../data/worlds';
import { mergeInputs } from '../input/inputFrame';
import { KeyboardInput } from '../input/keyboard';
import { FIRE_BUTTON, TouchInput } from '../input/touch';
import { loadSave, memoryStore, writeSave, type KeyValueStore } from '../persist/save';
import { GameOverScene } from '../scenes/gameOverScene';
import { RunScene } from '../scenes/runScene';
import type { FrameInput, Scene, SceneContext } from '../scenes/scene';
import { TitleScene } from '../scenes/titleScene';
import { loadTextures } from '../view/textures';
import { FixedLoop } from './fixedLoop';
import { computeLayout, type Layout } from './layout';

function browserStore(): KeyValueStore {
  try {
    const s = window.localStorage;
    s.getItem('space-alliance:probe');
    return s;
  } catch {
    return memoryStore();
  }
}

export async function startApp(host: HTMLElement): Promise<void> {
  TextureSource.defaultOptions.scaleMode = 'nearest';
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#000000',
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  host.appendChild(app.canvas);

  const audio = AudioEngine.create();
  const unlockAudio = () => audio?.unlock();
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('pointerdown', unlockAudio);
  const judgeFire = () => audio?.judgeFire() ?? null;

  const songs: Partial<Record<WorldId, CompiledSong>> = { earth: compileSong(EARTH_SONG) };
  const fallbackSong = songs.earth!;
  const songForWorld = (world: number) => songs[worldAt(world).id] ?? fallbackSong;

  const store = browserStore();
  const { data: save, reset } = loadSave(store);

  const textures = loadTextures();
  const game = new Container();
  const sceneLayer = new Container();
  game.addChild(sceneLayer);

  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  if (isTouch) {
    const button = new Graphics()
      .circle(FIRE_BUTTON.x, FIRE_BUTTON.y, FIRE_BUTTON.r)
      .fill({ color: 0xff3b5c, alpha: 0.25 })
      .stroke({ color: 0xff3b5c, width: 1, alpha: 0.8 });
    game.addChild(button);
  }
  app.stage.addChild(game);

  let layout: Layout = computeLayout(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  const applyLayout = () => {
    layout = computeLayout(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    game.scale.set(layout.scale);
    game.position.set(layout.offsetX, layout.offsetY);
  };
  applyLayout();
  window.addEventListener('resize', applyLayout);

  const keyboard = new KeyboardInput(window, judgeFire);
  const touch = new TouchInput(app.canvas, () => layout, judgeFire);

  let scene: Scene;
  const ctx: SceneContext = {
    textures,
    audio,
    save,
    isTouch,
    notice: reset ? 'SAVE DATA WAS RESET' : null,
    songForWorld,
    persist: () => {
      writeSave(store, save);
    },
    goto: (next) => {
      scene.destroy();
      scene = next;
      sceneLayer.addChild(next.root);
    },
    scenes: {
      title: () => new TitleScene(ctx),
      run: () => new RunScene(ctx),
      gameOver: (summary) => new GameOverScene(ctx, summary),
    },
  };
  scene = ctx.scenes.title();
  sceneLayer.addChild(scene.root);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) scene.onHidden?.();
  });

  if (import.meta.env.DEV) {
    // Dev-only inspection hook for manual/browser verification.
    (window as unknown as { __sa: unknown }).__sa = {
      get scene() {
        return scene;
      },
      get run() {
        return scene instanceof RunScene ? scene.state : null;
      },
      audio,
      save,
    };
  }

  const loop = new FixedLoop(SIM_DT, MAX_STEPS_PER_FRAME);
  app.ticker.add((ticker) => {
    const elapsed = Math.min(ticker.deltaMS / 1000, 0.25);
    loop.advance(elapsed, () => {
      const sim = mergeInputs([keyboard.poll(), touch.poll()]);
      sim.beat = audio?.currentBeat() ?? null;
      const input: FrameInput = {
        sim,
        menu: keyboard.consumeMenu(),
        taps: touch.consumeTaps(),
        pause: keyboard.consumePause(),
      };
      scene.update(input, SIM_DT);
    });
    scene.render(elapsed);
  });
}
```

**File: `tests/data/font.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import { GLYPH_H, GLYPHS, textWidth } from '../../src/data/font';
import { SPRITES } from '../../src/data/sprites';

describe('font', () => {
  it('covers A-Z, 0-9 and HUD punctuation with 3x5 glyphs', () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -:.!/%+';
    for (const c of chars) {
      const g = GLYPHS[c];
      expect(g, c).toBeDefined();
      expect(g!).toHaveLength(GLYPH_H);
      for (const row of g!) expect(row).toHaveLength(3);
    }
  });

  it('measures text width', () => {
    expect(textWidth('')).toBe(0);
    expect(textWidth('AB')).toBe(7);
  });
});

describe('sprites', () => {
  it('animation frames share dimensions', () => {
    for (const frames of [SPRITES.grunt, SPRITES.gunner, SPRITES.diver, SPRITES.shield, SPRITES.shieldCracked]) {
      expect(frames[0].rows.length).toBe(frames[1].rows.length);
      expect(frames[0].rows[0]!.length).toBe(frames[1].rows[0]!.length);
    }
  });

  it('draws the Warden at its hitbox size', () => {
    expect(SPRITES.wardenBody.rows).toHaveLength(20);
    expect(SPRITES.wardenBody.rows.every((r) => r.length === 56)).toBe(true);
  });
});
```

**File: `tests/view/anim.test.ts`**
```ts
import { describe, expect, it } from 'vitest';
import { blink, popInScale } from '../../src/view/anim';

describe('popInScale', () => {
  it('grows from 0 to 1 with a per-row delay', () => {
    expect(popInScale(0, 0)).toBe(0);
    expect(popInScale(0.25, 0)).toBeCloseTo(0.5);
    expect(popInScale(0.25, 2)).toBeCloseTo(0.1);
    expect(popInScale(1, 4)).toBe(1);
  });
});

describe('blink', () => {
  it('alternates at the given rate', () => {
    expect(blink(0, 5)).toBe(true);
    expect(blink(0.1, 5)).toBe(false);
    expect(blink(0.2, 5)).toBe(true);
  });
});
```

---

## Self-Review Notes

- Spec coverage: §4 divers/shields/extra life/hit-stop/invasion → T1; difficulty curve → T1; §5 Warden 3 phases, beat-synced attacks, telegraphed laser, loop → T1; boss music + bar-aligned switch → T2; §6 stage bonus, boss points, perfect stages, highscores + initials → T1/T3/T4; save + migrations + corrupt reset notice → T3/T4; §8 stage intro pop-in, boss HP bar, results panel → T4.
- Deferred: Moon/Mars worlds and bosses, warp transition (M4); credits/shop/settings/calibration (M5); particles/post-FX/shake (M6).
- `GameOverScene` compares highscore entries by object identity to highlight the new one — `insertHighscore` keeps the same object reference.
