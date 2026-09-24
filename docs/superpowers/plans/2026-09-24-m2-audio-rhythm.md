# Space Alliance M2 — Audio & Rhythm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Procedurally synthesized heavy-metal soundtrack (Earth song, E minor 140 BPM) with a beat clock that drives a rhythm multiplier (x1–x4), kill combo (x1–x2), beat-synced visuals and synthesized SFX.

**Architecture:** Pure, tested modules (`BeatClock`, rhythm judge, pattern parser, song compiler, step window math, scoring) plus Web Audio modules (synth rig, sequencer, SFX, engine) verified by offline rendering in the browser. Input adapters judge fire timing at keydown/pointerdown against the audio clock and pass `fireOnBeat` in `InputFrame`; the sim stays deterministic and audio-free.

**Tech Stack:** TypeScript, Web Audio API, PixiJS 8, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-24-space-alliance-design.md` (§6 Score, §7 Audio & Rhythm, §8 beat pulse)

## Global Constraints

- Rhythm: on-beat = within ±70 ms of the quarter-note grid (+ calibration offset, 0 until M5). Every 4 on-beat shots = +x0.5, cap x4. Off-beat shot = −x0.5 step (partial progress lost), floor x1. Player hit resets to x1. No shot = neutral. Multiplier captured at fire time on the bullet.
- Kill combo: kills < 1 s apart chain, +x0.1 per chained kill, cap x2.
- `points = round(base × rhythmMult × comboMult)`.
- Audio unavailable → rhythm locked x1, HUD shows "NO AUDIO".
- Scheduler: 25 ms interval, 100 ms lookahead, 16th-note resolution, `audioCtx.currentTime` clock. Judge uses heard time = `currentTime − outputLatency`.
- AudioContext unlocked (resumed) inside the first keydown/pointerdown handler.
- Pause / hidden tab → `ctx.suspend()`; resume on unpause. Game over → song fades out.
- `src/sim` and `src/data` must not import Web Audio or Pixi. Pure audio math lives in `src/audio/{beatClock,rhythmJudge,pattern,song}.ts` with no Web Audio calls.
- All tuning in `src/data/balance.ts`.

## File Map

| File | Responsibility |
|---|---|
| `src/data/balance.ts` (mod) | `RHYTHM`, `COMBO` constants |
| `src/sim/types.ts` (mod) | `Bullet.mult`, `SimState.rhythm/combo`, `stats.onBeatShots` |
| `src/sim/scoring.ts` | Rhythm streak/mult, combo, kill points |
| `src/sim/{state,player,collision,step}.ts` (mod) | Wire scoring |
| `src/audio/beatClock.ts` | Tempo math |
| `src/audio/rhythmJudge.ts` | On-beat decision |
| `src/audio/pattern.ts` | Note/drum pattern parsing |
| `src/audio/song.ts` | Song types, compile, arrangement lookup, step windows |
| `src/data/songs/earth.ts` | Earth song data |
| `src/audio/synth.ts` | Buses, distortion, instrument rig |
| `src/audio/sequencer.ts` | Schedules compiled song onto rig |
| `src/audio/sfx.ts` | Synthesized SFX |
| `src/audio/engine.ts` | AudioContext lifecycle, realtime scheduler, judge |
| `src/input/{keyboard,touch}.ts` (mod) | Judge at press time |
| `src/view/beatPulse.ts` | Pulse curve + color lerp |
| `src/view/{renderer,hud}.ts` (mod) | Beat frames, backdrop pulse, on-beat bullets, multiplier ring |
| `src/app/app.ts` (mod) | Wire audio, SFX, pause |

---

### Task 1: Scoring model in the sim

**Files:**
- Modify: `src/data/balance.ts`, `src/sim/types.ts`, `src/sim/state.ts`, `src/sim/player.ts`, `src/sim/collision.ts`, `src/sim/step.ts`, `tests/sim/collision.test.ts`, `tests/sim/player.test.ts`
- Create: `src/sim/scoring.ts`
- Test: `tests/sim/scoring.test.ts`

**Interfaces:**
- Produces:
  - `RHYTHM = { windowSec: 0.07, subdivision: 1, shotsPerStep: 4, multStep: 0.5, maxMult: 4 }`, `COMBO = { window: 1, step: 0.1, maxChain: 10 }`
  - `Bullet.mult: number`; `SimState.rhythm: { streak: number; mult: number }`; `SimState.combo: { chain: number; timer: number }`; `SimState.stats.onBeatShots: number`
  - `rhythmMultForStreak(streak: number): number`
  - `applyShotRhythm(state: SimState, onBeat: boolean | null): void`
  - `resetRhythm(state: SimState): void`
  - `comboMult(state: SimState): number`
  - `registerKill(state: SimState, base: number, bulletMult: number): number` (adds to score, returns points)
  - `updateCombo(state: SimState, dt: number): void`

- [ ] **Step 1: Write failing test** `tests/sim/scoring.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { COMBO, PLAYER, RHYTHM, SIM_DT } from '../../src/data/balance';
import { hitPlayer, updatePlayer } from '../../src/sim/player';
import {
  applyShotRhythm,
  comboMult,
  registerKill,
  rhythmMultForStreak,
  updateCombo,
} from '../../src/sim/scoring';
import { createInitialState } from '../../src/sim/state';
import { NO_INPUT } from '../../src/sim/types';

describe('rhythm multiplier', () => {
  it('maps streak to multiplier steps with a cap', () => {
    expect(rhythmMultForStreak(0)).toBe(1);
    expect(rhythmMultForStreak(3)).toBe(1);
    expect(rhythmMultForStreak(4)).toBe(1.5);
    expect(rhythmMultForStreak(8)).toBe(2);
    expect(rhythmMultForStreak(999)).toBe(RHYTHM.maxMult);
  });

  it('builds on on-beat shots and counts them', () => {
    const s = createInitialState(1);
    for (let i = 0; i < 4; i++) applyShotRhythm(s, true);
    expect(s.rhythm.mult).toBe(1.5);
    expect(s.stats.onBeatShots).toBe(4);
  });

  it('drops one step on an off-beat shot and loses partial progress', () => {
    const s = createInitialState(1);
    for (let i = 0; i < 10; i++) applyShotRhythm(s, true); // streak 10 → x2
    applyShotRhythm(s, false);
    expect(s.rhythm.streak).toBe(4);
    expect(s.rhythm.mult).toBe(1.5);
    applyShotRhythm(s, false);
    applyShotRhythm(s, false);
    expect(s.rhythm.streak).toBe(0);
    expect(s.rhythm.mult).toBe(1);
  });

  it('caps the streak at max multiplier so one miss drops just one step', () => {
    const s = createInitialState(1);
    for (let i = 0; i < 100; i++) applyShotRhythm(s, true);
    expect(s.rhythm.mult).toBe(4);
    applyShotRhythm(s, false);
    expect(s.rhythm.mult).toBe(3.5);
  });

  it('is neutral without audio', () => {
    const s = createInitialState(1);
    applyShotRhythm(s, true);
    applyShotRhythm(s, null);
    expect(s.rhythm.streak).toBe(1);
  });

  it('resets when the player is hit', () => {
    const s = createInitialState(1);
    for (let i = 0; i < 8; i++) applyShotRhythm(s, true);
    hitPlayer(s, []);
    expect(s.rhythm).toEqual({ streak: 0, mult: 1 });
  });

  it('captures the multiplier on the fired bullet', () => {
    const s = createInitialState(1);
    for (let i = 0; i < 3; i++) applyShotRhythm(s, true);
    updatePlayer(s, { ...NO_INPUT, firePressed: true, fireOnBeat: true }, SIM_DT, []);
    expect(s.bullets[0]!.mult).toBe(1.5);
  });

  it('does not change rhythm when the shot is blocked', () => {
    const s = createInitialState(1);
    s.player.cooldown = PLAYER.fireCooldown;
    updatePlayer(s, { ...NO_INPUT, firePressed: true, fireOnBeat: false }, SIM_DT, []);
    expect(s.rhythm.streak).toBe(0);
    expect(s.stats.shots).toBe(0);
  });
});

describe('kill combo', () => {
  it('chains kills inside the window', () => {
    const s = createInitialState(1);
    expect(registerKill(s, 10, 1)).toBe(10);
    expect(registerKill(s, 10, 1)).toBe(11);
    expect(comboMult(s)).toBeCloseTo(1.1);
  });

  it('breaks the chain after the window', () => {
    const s = createInitialState(1);
    registerKill(s, 10, 1);
    registerKill(s, 10, 1);
    updateCombo(s, COMBO.window + 0.01);
    expect(comboMult(s)).toBe(1);
    expect(registerKill(s, 10, 1)).toBe(10);
  });

  it('caps the combo at x2 and multiplies with rhythm', () => {
    const s = createInitialState(1);
    for (let i = 0; i < 30; i++) registerKill(s, 10, 1);
    expect(comboMult(s)).toBe(2);
    expect(registerKill(s, 10, 4)).toBe(80);
  });

  it('adds points to the score', () => {
    const s = createInitialState(1);
    registerKill(s, 20, 1.5);
    expect(s.score).toBe(30);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/sim/scoring.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Append to `src/data/balance.ts`:
```ts
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

`src/sim/types.ts` changes:
- In `Bullet` add `/** Rhythm multiplier captured at fire time. */ mult: number;`
- In `SimState` add:
```ts
  rhythm: { streak: number; mult: number };
  combo: { chain: number; timer: number };
```
- Change `stats` to `stats: { shots: number; hits: number; onBeatShots: number };`

`src/sim/state.ts`: add to the literal
```ts
    rhythm: { streak: 0, mult: 1 },
    combo: { chain: 0, timer: 0 },
    stats: { shots: 0, hits: 0, onBeatShots: 0 },
```
(replacing the old `stats` line)

`src/sim/scoring.ts`:
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

`src/sim/player.ts`:
- import `{ applyShotRhythm, resetRhythm } from './scoring'`
- in `tryFire`, after the `maxBullets` check and before pushing the bullet, replace `const onBeat = input.fireOnBeat === true;` with:
```ts
  applyShotRhythm(state, input.fireOnBeat);
  const onBeat = input.fireOnBeat === true;
```
- add `mult: state.rhythm.mult,` to the pushed bullet
- in `hitPlayer`, after `p.invuln = PLAYER.invulnTime;` add `resetRhythm(state);`

`src/sim/enemyFire.ts`: add `mult: 1,` to the pushed enemy bullet.

`src/sim/collision.ts`:
- import `{ registerKill } from './scoring'`; drop the `POINTS` import usage change below
- replace
```ts
        const points = POINTS[e.kind];
        state.score += points;
```
with
```ts
        const points = registerKill(state, POINTS[e.kind], b.mult);
```

`src/sim/step.ts`: import `{ updateCombo } from './scoring'`; in the playing branch call `updateCombo(state, dt);` right after `updatePlayer(...)`.

Test fixture updates:
- `tests/sim/collision.test.ts` bullet helper: add `mult: 1,` before `...over`.
- `tests/sim/player.test.ts` `hitPlayer` test: add `mult: 1` to both pushed bullets.
- `tests/sim/bullets.test.ts`: add `mult: 1` to the three bullets.

- [ ] **Step 4: Run** `npm test && npm run typecheck` — Expected: PASS.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(sim): rhythm streak multiplier and kill combo scoring"`

---

### Task 2: Beat clock and rhythm judge

**Files:**
- Create: `src/audio/beatClock.ts`, `src/audio/rhythmJudge.ts`
- Test: `tests/audio/beatClock.test.ts`, `tests/audio/rhythmJudge.test.ts`

**Interfaces:**
- Produces:
  - `class BeatClock { readonly bpm; readonly startTime; readonly beatDur; constructor(bpm: number, startTime: number); beatAt(t: number): number; timeOfBeat(beat: number): number; gridDelta(t: number, subdivision: number): number; beatPhase(t: number): number }`
  - `judgeShot(clock: BeatClock | null, heardTime: number, offsetMs?: number): boolean | null`

- [ ] **Step 1: Write failing tests**

`tests/audio/beatClock.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { BeatClock } from '../../src/audio/beatClock';

describe('BeatClock', () => {
  const clock = new BeatClock(120, 10); // 0.5 s per beat

  it('converts time to beats and back', () => {
    expect(clock.beatDur).toBe(0.5);
    expect(clock.beatAt(10)).toBe(0);
    expect(clock.beatAt(11.25)).toBeCloseTo(2.5);
    expect(clock.timeOfBeat(4)).toBe(12);
    expect(clock.beatAt(9.5)).toBe(-1);
  });

  it('measures signed distance to the nearest grid line', () => {
    expect(clock.gridDelta(11, 1)).toBeCloseTo(0);
    expect(clock.gridDelta(11.05, 1)).toBeCloseTo(0.05);
    expect(clock.gridDelta(10.95, 1)).toBeCloseTo(-0.05);
    expect(clock.gridDelta(11.3, 2)).toBeCloseTo(0.05); // 8th grid every 0.25 s
  });

  it('reports phase within the beat', () => {
    expect(clock.beatPhase(10.25)).toBeCloseTo(0.5);
    expect(clock.beatPhase(9.75)).toBeCloseTo(0.5);
  });
});
```

`tests/audio/rhythmJudge.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { BeatClock } from '../../src/audio/beatClock';
import { judgeShot } from '../../src/audio/rhythmJudge';
import { RHYTHM } from '../../src/data/balance';

describe('judgeShot', () => {
  const clock = new BeatClock(120, 0);

  it('returns null without a clock', () => {
    expect(judgeShot(null, 1)).toBeNull();
  });

  it('accepts shots inside the window and rejects outside', () => {
    expect(judgeShot(clock, 1 + RHYTHM.windowSec - 0.001)).toBe(true);
    expect(judgeShot(clock, 1 - RHYTHM.windowSec + 0.001)).toBe(true);
    expect(judgeShot(clock, 1 + RHYTHM.windowSec + 0.01)).toBe(false);
    expect(judgeShot(clock, 1.25)).toBe(false);
  });

  it('applies the calibration offset', () => {
    // player consistently 100 ms late → offset +100 ms makes it on-beat
    expect(judgeShot(clock, 1.1)).toBe(false);
    expect(judgeShot(clock, 1.1, 100)).toBe(true);
  });

  it('rejects shots before the song starts', () => {
    expect(judgeShot(new BeatClock(120, 5), 1)).toBe(false);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/audio` — Expected: FAIL.

- [ ] **Step 3: Implement**

`src/audio/beatClock.ts`:
```ts
/** Constant-tempo clock anchored at an AudioContext time. Pure math. */
export class BeatClock {
  readonly beatDur: number;

  constructor(
    readonly bpm: number,
    readonly startTime: number,
  ) {
    this.beatDur = 60 / bpm;
  }

  beatAt(t: number): number {
    return (t - this.startTime) / this.beatDur;
  }

  timeOfBeat(beat: number): number {
    return this.startTime + beat * this.beatDur;
  }

  /** Signed seconds from the nearest grid line (`subdivision` lines per beat) to t. */
  gridDelta(t: number, subdivision: number): number {
    const g = this.beatDur / subdivision;
    const x = (t - this.startTime) / g;
    return (x - Math.round(x)) * g;
  }

  beatPhase(t: number): number {
    const b = this.beatAt(t);
    return b - Math.floor(b);
  }
}
```

`src/audio/rhythmJudge.ts`:
```ts
import { RHYTHM } from '../data/balance';
import type { BeatClock } from './beatClock';

/**
 * Was a press at `heardTime` (audio clock minus output latency) on the beat?
 * `offsetMs` > 0 compensates a player who presses late.
 */
export function judgeShot(clock: BeatClock | null, heardTime: number, offsetMs = 0): boolean | null {
  if (!clock) return null;
  const t = heardTime - offsetMs / 1000;
  if (t < clock.startTime - RHYTHM.windowSec) return false;
  return Math.abs(clock.gridDelta(t, RHYTHM.subdivision)) <= RHYTHM.windowSec;
}
```

- [ ] **Step 4: Run** `npx vitest run tests/audio && npm run typecheck` — Expected: PASS.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(audio): beat clock and rhythm judge"`

---

### Task 3: Patterns, song compiler, Earth song

**Files:**
- Create: `src/audio/pattern.ts`, `src/audio/song.ts`, `src/data/songs/earth.ts`
- Test: `tests/audio/pattern.test.ts`, `tests/audio/song.test.ts`

**Interfaces:**
- Consumes: `BeatClock`
- Produces:
  - `noteToMidi(name: string): number`
  - `interface NoteEvent { step: number; midi: number; len: number; mute: boolean }`
  - `parseNotePattern(src: string): { events: NoteEvent[]; steps: number }` — tokens split on whitespace, `|` ignored; `.` rest, `-` sustain, note `[A-G]#?\d` with optional `p` suffix (palm mute)
  - `parseDrumPattern(src: string): number[]` — chars (whitespace/`|` ignored): `.`=0, `x`=1, `X`/`o`=2
  - `interface SectionDef { bars: number; guitar: string; lead?: string; kick: string; snare: string; hat: string; crash?: string }`
  - `interface SongDef { name: string; bpm: number; sections: Record<string, SectionDef>; order: readonly string[]; loopFrom: number }`
  - `STEPS_PER_BEAT = 4`, `STEPS_PER_BAR = 16`
  - `interface CompiledSection { name: string; steps: number; guitar: (NoteEvent | undefined)[]; lead: (NoteEvent | undefined)[]; kick: number[]; snare: number[]; hat: number[]; crash: number[] }`
  - `interface CompiledSong { name: string; bpm: number; entries: { section: CompiledSection; offset: number }[]; totalSteps: number; loopStartStep: number }`
  - `compileSong(def: SongDef): CompiledSong` (throws on malformed data)
  - `resolveStep(song: CompiledSong, globalStep: number): { section: CompiledSection; step: number } | null`
  - `stepsInWindow(clock: BeatClock, from: number, to: number): { index: number; time: number }[]` (16th steps, index ≥ 0, half-open `[from, to)`)
  - `EARTH_SONG: SongDef`

- [ ] **Step 1: Write failing tests**

`tests/audio/pattern.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { noteToMidi, parseDrumPattern, parseNotePattern } from '../../src/audio/pattern';

describe('noteToMidi', () => {
  it('converts scientific pitch names', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('E2')).toBe(40);
    expect(noteToMidi('F#2')).toBe(42);
    expect(noteToMidi('C-1')).toBe(0);
  });

  it('rejects garbage', () => {
    expect(() => noteToMidi('H2')).toThrow();
  });
});

describe('parseNotePattern', () => {
  it('parses notes, sustains, rests and palm mutes', () => {
    const p = parseNotePattern('E2p . E2 - - | G2 -');
    expect(p.steps).toBe(7);
    expect(p.events).toEqual([
      { step: 0, midi: 40, len: 1, mute: true },
      { step: 2, midi: 40, len: 3, mute: false },
      { step: 5, midi: 43, len: 2, mute: false },
    ]);
  });

  it('rejects a sustain with nothing to sustain', () => {
    expect(() => parseNotePattern('. -')).toThrow(/step 1/);
  });
});

describe('parseDrumPattern', () => {
  it('maps hits and accents', () => {
    expect(parseDrumPattern('x.X. o|x')).toEqual([1, 0, 2, 0, 2, 1]);
  });

  it('rejects unknown chars', () => {
    expect(() => parseDrumPattern('x?')).toThrow();
  });
});
```

`tests/audio/song.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { BeatClock } from '../../src/audio/beatClock';
import {
  compileSong,
  resolveStep,
  STEPS_PER_BAR,
  stepsInWindow,
  type SongDef,
} from '../../src/audio/song';
import { EARTH_SONG } from '../../src/data/songs/earth';

const bar = (s: string) => s;
const tiny: SongDef = {
  name: 'tiny',
  bpm: 120,
  sections: {
    a: {
      bars: 1,
      guitar: bar('E2 - - - . . . . . . . . . . . .'),
      kick: 'x...............',
      snare: '................',
      hat: '................',
    },
    b: {
      bars: 1,
      guitar: bar('G2 . . . . . . . . . . . . . . .'),
      kick: '....x...........',
      snare: '................',
      hat: '................',
    },
  },
  order: ['a', 'b'],
  loopFrom: 1,
};

describe('compileSong', () => {
  it('lays out sections in order with offsets', () => {
    const song = compileSong(tiny);
    expect(song.totalSteps).toBe(32);
    expect(song.loopStartStep).toBe(16);
    expect(song.entries.map((e) => [e.section.name, e.offset])).toEqual([
      ['a', 0],
      ['b', 16],
    ]);
    expect(song.entries[0]!.section.guitar[0]).toMatchObject({ midi: 40, len: 4 });
    expect(song.entries[0]!.section.crash).toHaveLength(16);
  });

  it('rejects tracks with the wrong length', () => {
    const bad: SongDef = {
      ...tiny,
      sections: { ...tiny.sections, a: { ...tiny.sections.a!, kick: 'x...' } },
    };
    expect(() => compileSong(bad)).toThrow(/a\.kick/);
  });

  it('rejects unknown sections in the order', () => {
    expect(() => compileSong({ ...tiny, order: ['a', 'zzz'] })).toThrow(/zzz/);
  });
});

describe('resolveStep', () => {
  const song = compileSong(tiny);

  it('finds section and local step', () => {
    expect(resolveStep(song, 3)).toMatchObject({ step: 3, section: { name: 'a' } });
    expect(resolveStep(song, 20)).toMatchObject({ step: 4, section: { name: 'b' } });
  });

  it('loops from loopFrom after the end', () => {
    expect(resolveStep(song, 32)).toMatchObject({ step: 0, section: { name: 'b' } });
    expect(resolveStep(song, 49)).toMatchObject({ step: 1, section: { name: 'b' } });
  });

  it('returns null before the song starts', () => {
    expect(resolveStep(song, -1)).toBeNull();
  });
});

describe('stepsInWindow', () => {
  const clock = new BeatClock(120, 0); // 16th = 0.125 s

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
  it('compiles and is in E minor at 140 BPM', () => {
    const song = compileSong(EARTH_SONG);
    expect(song.bpm).toBe(140);
    expect(song.totalSteps % STEPS_PER_BAR).toBe(0);
    expect(song.totalSteps).toBeGreaterThan(STEPS_PER_BAR * 16);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/audio` — Expected: FAIL.

- [ ] **Step 3: Implement**

`src/audio/pattern.ts`:
```ts
const NOTE_RE = /^([A-G])(#?)(-?\d)$/;
const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteToMidi(name: string): number {
  const m = NOTE_RE.exec(name);
  if (!m) throw new Error(`bad note "${name}"`);
  const [, letter, sharp, octave] = m;
  return (Number(octave) + 1) * 12 + SEMITONES[letter!]! + (sharp ? 1 : 0);
}

export interface NoteEvent {
  step: number;
  midi: number;
  /** Length in 16th steps. */
  len: number;
  mute: boolean;
}

function tokens(src: string): string[] {
  return src.split(/\s+/).filter((t) => t !== '' && t !== '|');
}

export function parseNotePattern(src: string): { events: NoteEvent[]; steps: number } {
  const toks = tokens(src);
  const events: NoteEvent[] = [];
  let current: NoteEvent | null = null;
  toks.forEach((tok, step) => {
    if (tok === '.') {
      current = null;
    } else if (tok === '-') {
      if (!current) throw new Error(`sustain without note at step ${step}`);
      current.len++;
    } else {
      const mute = tok.endsWith('p');
      const midi = noteToMidi(mute ? tok.slice(0, -1) : tok);
      current = { step, midi, len: 1, mute };
      events.push(current);
    }
  });
  return { events, steps: toks.length };
}

const DRUM_LEVELS: Record<string, number> = { '.': 0, x: 1, X: 2, o: 2 };

export function parseDrumPattern(src: string): number[] {
  const out: number[] = [];
  for (const ch of src) {
    if (ch === '|' || /\s/.test(ch)) continue;
    const level = DRUM_LEVELS[ch];
    if (level === undefined) throw new Error(`bad drum char "${ch}"`);
    out.push(level);
  }
  return out;
}
```

`src/audio/song.ts`:
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

export interface SongDef {
  name: string;
  bpm: number;
  sections: Record<string, SectionDef>;
  order: readonly string[];
  /** Index into `order` where playback loops back to after the end. */
  loopFrom: number;
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

export interface CompiledSong {
  name: string;
  bpm: number;
  entries: { section: CompiledSection; offset: number }[];
  totalSteps: number;
  loopStartStep: number;
}

function noteTrack(name: string, src: string | undefined, steps: number): (NoteEvent | undefined)[] {
  const track: (NoteEvent | undefined)[] = new Array(steps).fill(undefined);
  if (src === undefined) return track;
  const parsed = parseNotePattern(src);
  if (parsed.steps !== steps) throw new Error(`${name}: expected ${steps} steps, got ${parsed.steps}`);
  for (const e of parsed.events) track[e.step] = e;
  return track;
}

function drumTrack(name: string, src: string | undefined, steps: number): number[] {
  if (src === undefined) return new Array(steps).fill(0);
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

export function compileSong(def: SongDef): CompiledSong {
  const compiled = new Map<string, CompiledSection>();
  for (const [name, section] of Object.entries(def.sections)) {
    compiled.set(name, compileSection(name, section));
  }
  const entries: CompiledSong['entries'] = [];
  let offset = 0;
  let loopStartStep = 0;
  def.order.forEach((name, i) => {
    const section = compiled.get(name);
    if (!section) throw new Error(`unknown section "${name}" in order`);
    if (i === def.loopFrom) loopStartStep = offset;
    entries.push({ section, offset });
    offset += section.steps;
  });
  return { name: def.name, bpm: def.bpm, entries, totalSteps: offset, loopStartStep };
}

export function resolveStep(
  song: CompiledSong,
  globalStep: number,
): { section: CompiledSection; step: number } | null {
  if (globalStep < 0) return null;
  let i = globalStep;
  if (i >= song.totalSteps) {
    const loopLen = song.totalSteps - song.loopStartStep;
    i = song.loopStartStep + ((i - song.loopStartStep) % loopLen);
  }
  for (const entry of song.entries) {
    if (i < entry.offset + entry.section.steps) return { section: entry.section, step: i - entry.offset };
  }
  return null;
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

`src/data/songs/earth.ts`:
```ts
import type { SongDef } from '../../audio/song';

const bars = (...b: string[]) => b.join(' | ');

const GALLOP = 'E2p . E2p E2p E2p . E2p E2p E2p . E2p E2p E2p . E2p E2p';
const GALLOP_KICK = 'x.xxx.xxx.xxx.xx';
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
      guitar: bars(
        'E2 - - - - - - - - - - - - - - -',
        'G2 - - - - - - - A2 - - - B2 - - -',
      ),
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
      guitar: bars(
        'E2p . . E2p . . E2p . . . E2p . E2p . . .',
        'E2p . . E2p . . E2p . F2 - - - F#2 - - -',
      ),
      kick: bars('x..x..x...x.x...', 'x..x..x.x...x...'),
      snare: bars('........x.......', '........x...xxxx'),
      hat: bars(EMPTY, EMPTY),
    },
  },
  order: ['intro', 'A', 'A', 'B', 'chorus', 'A', 'B', 'chorus', 'breakdown'],
  loopFrom: 1,
};
```

- [ ] **Step 4: Run** `npm test && npm run typecheck` — Expected: PASS.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(audio): pattern parser, song compiler, Earth song data"`

---

### Task 4: Synth rig, sequencer, SFX, engine

**Files:**
- Create: `src/audio/synth.ts`, `src/audio/sequencer.ts`, `src/audio/sfx.ts`, `src/audio/engine.ts`

**Interfaces:**
- Consumes: `BeatClock`, `CompiledSong`, `resolveStep`, `stepsInWindow`, `STEPS_PER_BEAT`, `judgeShot`
- Produces:
  - `midiToHz(midi: number): number`, `makeDistortionCurve(amount: number): Float32Array<ArrayBuffer>`, `makeNoiseBuffer(ctx: BaseAudioContext): AudioBuffer`
  - `interface Buses { master: GainNode; music: GainNode; sfx: GainNode }`, `createBuses(ctx: BaseAudioContext): Buses`
  - `interface Rig { guitar(t, midi, dur, mute): void; bass(t, midi, dur, mute): void; lead(t, midi, dur): void; kick(t, level): void; snare(t, level): void; hat(t, level): void; crash(t): void }`, `createRig(ctx: BaseAudioContext, out: AudioNode): Rig`
  - `class Sequencer { constructor(ctx: BaseAudioContext, out: AudioNode, song: CompiledSong, clock: BeatClock); scheduleRange(from: number, to: number): void }`
  - `class Sfx { constructor(ctx: BaseAudioContext, out: AudioNode); laser(onBeat: boolean): void; explosion(): void; playerHit(): void; enemyShot(): void; stageClear(): void; start(): void }`
  - `class AudioEngine { static create(): AudioEngine | null; readonly sfx: Sfx; unlock(): void; startSong(song: CompiledSong): void; stopSong(): void; setPaused(paused: boolean): void; currentBeat(): number | null; judgeFire(offsetMs?: number): boolean | null }`

- [ ] **Step 1: Implement `src/audio/synth.ts`**

```ts
export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(n);
  const norm = Math.tanh(amount);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = Math.tanh(amount * x) / norm;
  }
  return curve;
}

export function makeNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export interface Buses {
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
}

export function createBuses(ctx: BaseAudioContext): Buses {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 4;
  comp.attack.value = 0.005;
  comp.release.value = 0.15;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;
  const master = ctx.createGain();
  master.gain.value = 0.8;
  const music = ctx.createGain();
  music.gain.value = 0.7;
  const sfx = ctx.createGain();
  sfx.gain.value = 0.8;
  music.connect(comp);
  sfx.connect(comp);
  comp.connect(limiter).connect(master).connect(ctx.destination);
  return { master, music, sfx };
}

export interface Rig {
  guitar(t: number, midi: number, dur: number, mute: boolean): void;
  bass(t: number, midi: number, dur: number, mute: boolean): void;
  lead(t: number, midi: number, dur: number): void;
  kick(t: number, level: number): void;
  snare(t: number, level: number): void;
  hat(t: number, level: number): void;
  crash(t: number): void;
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.7, gain = 0): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  f.gain.value = gain;
  return f;
}

/** One amp: highpass → heavy tanh distortion → scooped mids → cab lowpass → pan. */
function guitarAmp(ctx: BaseAudioContext, out: AudioNode, pan: number): AudioNode {
  const input = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  shaper.curve = makeDistortionCurve(30);
  shaper.oversample = '4x';
  const post = ctx.createGain();
  post.gain.value = 0.16;
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  input
    .connect(filter(ctx, 'highpass', 110))
    .connect(shaper)
    .connect(filter(ctx, 'peaking', 700, 1, -4))
    .connect(filter(ctx, 'peaking', 2800, 1, 4))
    .connect(filter(ctx, 'lowpass', 4200, 0.9))
    .connect(post)
    .connect(panner)
    .connect(out);
  return input;
}

function envelope(ctx: BaseAudioContext, t: number, dur: number, peak: number): GainNode {
  const g = ctx.createGain();
  const release = Math.min(0.03, dur / 3);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.004);
  g.gain.setValueAtTime(peak, t + dur - release);
  g.gain.linearRampToValueAtTime(0, t + dur);
  return g;
}

function decay(ctx: BaseAudioContext, t: number, peak: number, length: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + length);
  return g;
}

export function createRig(ctx: BaseAudioContext, out: AudioNode): Rig {
  const noise = makeNoiseBuffer(ctx);
  const amps = [guitarAmp(ctx, out, -0.6), guitarAmp(ctx, out, 0.6)];

  const bassBus = ctx.createGain();
  bassBus.gain.value = 0.3;
  const bassShaper = ctx.createWaveShaper();
  bassShaper.curve = makeDistortionCurve(2.5);
  bassBus.connect(bassShaper).connect(out);

  const leadBus = ctx.createGain();
  leadBus.gain.value = 0.1;
  const leadShaper = ctx.createWaveShaper();
  leadShaper.curve = makeDistortionCurve(8);
  const leadTone = filter(ctx, 'lowpass', 5000);
  const echo = ctx.createDelay(1);
  echo.delayTime.value = 0.32;
  const echoFb = ctx.createGain();
  echoFb.gain.value = 0.28;
  leadBus.connect(leadShaper).connect(leadTone).connect(out);
  leadTone.connect(echo).connect(echoFb).connect(echo);
  echoFb.connect(out);

  const drums = ctx.createGain();
  drums.gain.value = 0.8;
  drums.connect(out);

  const noiseBurst = (t: number, length: number, dest: AudioNode) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + length);
  };

  return {
    guitar(t, midi, dur, mute) {
      amps.forEach((amp, side) => {
        const env = envelope(ctx, t, dur, 0.5);
        const tone = filter(ctx, 'lowpass', mute ? 900 : 6000);
        tone.connect(env).connect(amp);
        for (const interval of [0, 7, 12]) {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = midiToHz(midi + interval);
          osc.detune.value = side === 0 ? -8 : 8;
          osc.connect(tone);
          osc.start(t);
          osc.stop(t + dur + 0.01);
        }
      });
    },

    bass(t, midi, dur, mute) {
      const env = envelope(ctx, t, dur, 0.8);
      const tone = filter(ctx, 'lowpass', mute ? 400 : 800);
      tone.connect(env).connect(bassBus);
      for (const type of ['sawtooth', 'triangle'] as const) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = midiToHz(midi);
        osc.connect(tone);
        osc.start(t);
        osc.stop(t + dur + 0.01);
      }
    },

    lead(t, midi, dur) {
      const env = envelope(ctx, t, dur, 0.7);
      env.connect(leadBus);
      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = 5.5;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(18, t + Math.min(0.25, dur));
      vibrato.connect(depth);
      for (const [type, detune] of [['sawtooth', 0], ['square', 6]] as const) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = midiToHz(midi);
        osc.detune.value = detune;
        depth.connect(osc.detune);
        osc.connect(env);
        osc.start(t);
        osc.stop(t + dur + 0.01);
      }
      vibrato.start(t);
      vibrato.stop(t + dur + 0.01);
    },

    kick(t, level) {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      osc.connect(decay(ctx, t, level === 2 ? 1.2 : 1, 0.3)).connect(drums);
      osc.start(t);
      osc.stop(t + 0.32);
      const clickEnv = decay(ctx, t, 0.3, 0.012);
      clickEnv.connect(drums);
      const clickHp = filter(ctx, 'highpass', 3000);
      clickHp.connect(clickEnv);
      noiseBurst(t, 0.012, clickHp);
    },

    snare(t, level) {
      const body = decay(ctx, t, level === 2 ? 0.8 : 0.6, 0.18);
      body.connect(drums);
      const bp = filter(ctx, 'bandpass', 1800, 0.8);
      bp.connect(body);
      noiseBurst(t, 0.2, bp);
      const tone = ctx.createOscillator();
      tone.type = 'triangle';
      tone.frequency.value = 190;
      tone.connect(decay(ctx, t, 0.4, 0.1)).connect(drums);
      tone.start(t);
      tone.stop(t + 0.12);
    },

    hat(t, level) {
      const open = level === 2;
      const g = decay(ctx, t, 0.16, open ? 0.25 : 0.04);
      g.connect(drums);
      const hp = filter(ctx, 'highpass', 7500);
      hp.connect(g);
      noiseBurst(t, open ? 0.26 : 0.05, hp);
    },

    crash(t) {
      const g = decay(ctx, t, 0.22, 1.4);
      g.connect(drums);
      const hp = filter(ctx, 'highpass', 4000);
      hp.connect(g);
      noiseBurst(t, 1.4, hp);
    },
  };
}
```

- [ ] **Step 2: Implement `src/audio/sequencer.ts`**

```ts
import type { BeatClock } from './beatClock';
import { resolveStep, STEPS_PER_BEAT, stepsInWindow, type CompiledSong } from './song';
import { createRig, type Rig } from './synth';

const MIN_NOTE = 0.04;

export class Sequencer {
  private readonly rig: Rig;
  private readonly stepDur: number;

  constructor(
    ctx: BaseAudioContext,
    out: AudioNode,
    private readonly song: CompiledSong,
    private readonly clock: BeatClock,
  ) {
    this.rig = createRig(ctx, out);
    this.stepDur = clock.beatDur / STEPS_PER_BEAT;
  }

  /** Schedules every 16th step whose time falls in [from, to). */
  scheduleRange(from: number, to: number): void {
    for (const { index, time } of stepsInWindow(this.clock, from, to)) {
      const r = resolveStep(this.song, index);
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
}
```

- [ ] **Step 3: Implement `src/audio/sfx.ts`**

```ts
import { makeNoiseBuffer } from './synth';

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

  private burst(length: number, peak: number, f0: number, f1: number): void {
    const t = this.ctx.currentTime;
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
    [64, 67, 71, 76].forEach((midi, i) => {
      const f = 440 * 2 ** ((midi - 69) / 12);
      this.tone('square', f, f, 0.14, 0.08, i * 0.09);
    });
  }

  start(): void {
    this.tone('square', 440, 880, 0.12, 0.08);
  }
}
```

- [ ] **Step 4: Implement `src/audio/engine.ts`**

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
    this.playing = { seq: new Sequencer(this.ctx, gain, song, clock), clock, gain, scheduledTo: start };
    this.tick();
    this.timer = setInterval(() => this.tick(), SCHEDULE_INTERVAL_MS);
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

- [ ] **Step 5: Verify** `npm run typecheck && npm test` PASS. Offline render check in the browser (dev server running), via `javascript_tool`:

```js
const { compileSong } = await import('/src/audio/song.ts');
const { EARTH_SONG } = await import('/src/data/songs/earth.ts');
const { Sequencer } = await import('/src/audio/sequencer.ts');
const { BeatClock } = await import('/src/audio/beatClock.ts');
const { createBuses } = await import('/src/audio/synth.ts');
const ctx = new OfflineAudioContext(2, 44100 * 12, 44100);
const buses = createBuses(ctx);
new Sequencer(ctx, buses.music, compileSong(EARTH_SONG), new BeatClock(140, 0.05)).scheduleRange(0, 12);
const buf = await ctx.startRendering();
const d = buf.getChannelData(0);
let peak = 0, sum = 0;
for (const v of d) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
({ peak, rms: Math.sqrt(sum / d.length) });
```
Expected: `peak` between 0.3 and 1.0 (no silence, no hard clipping > 1), `rms` > 0.05.

- [ ] **Step 6: Commit** `git add -A && git commit -m "feat(audio): synth rig, sequencer, sfx and realtime audio engine"`

---

### Task 5: Judge fire timing in input adapters

**Files:**
- Modify: `src/input/keyboard.ts`, `src/input/touch.ts`
- Test: `tests/input/keyboard.test.ts`

**Interfaces:**
- Produces:
  - `type FireJudge = () => boolean | null` (exported from `src/input/inputFrame.ts`)
  - `new KeyboardInput(target: EventTarget, judgeFire?: FireJudge)` — judge called inside keydown
  - `new TouchInput(el, getLayout, judgeFire?: FireJudge)` — judge called inside pointerdown

- [ ] **Step 1: Write failing test** `tests/input/keyboard.test.ts`:

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
    verdict = false; // changes after the press must not matter
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
});
```

- [ ] **Step 2: Run** `npx vitest run tests/input` — Expected: FAIL (constructor signature / `preventDefault` on plain Event is fine; `fireOnBeat` null).

- [ ] **Step 3: Implement**

`src/input/inputFrame.ts` — add:
```ts
/** Called at the moment fire is pressed; returns rhythm verdict or null (no audio). */
export type FireJudge = () => boolean | null;
```

`src/input/keyboard.ts` — replace class body parts:
```ts
import type { InputFrame } from '../sim/types';
import type { FireJudge, InputSource } from './inputFrame';
// … key constants unchanged …

export class KeyboardInput implements InputSource {
  private readonly held = new Set<string>();
  private firePending = false;
  private fireOnBeat: boolean | null = null;
  private pausePending = false;

  constructor(target: EventTarget, private readonly judgeFire: FireJudge = () => null) {
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
    };
    this.firePending = false;
    this.fireOnBeat = null;
    return frame;
  }
  // consumePause and axis unchanged
}
```

`src/input/touch.ts`:
- import `FireJudge` type; constructor becomes `constructor(el: HTMLElement, getLayout: () => Layout, private readonly judgeFire: FireJudge = () => null)`
- add field `private fireOnBeat: boolean | null = null;`
- in the fire-button branch of `pointerdown`: `if (!this.firePending) { this.firePending = true; this.fireOnBeat = this.judgeFire(); } return;`
- in `poll()`: `fireOnBeat: this.firePending ? this.fireOnBeat : null,` and reset `this.fireOnBeat = null;`

- [ ] **Step 4: Run** `npm test && npm run typecheck` — Expected: PASS.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(input): judge fire timing against the beat at press time"`

---

### Task 6: Beat-synced view, HUD multiplier, app wiring

**Files:**
- Create: `src/view/beatPulse.ts`
- Modify: `src/view/renderer.ts`, `src/view/hud.ts`, `src/app/app.ts`
- Test: `tests/view/beatPulse.test.ts`

**Interfaces:**
- Produces:
  - `beatPulse(beat: number | null): number` in [0, 1]; downbeat (beat % 4 == 0) full, other beats half, decays `(1 − frac)^4`
  - `lerpColor(a: number, b: number, t: number): number`
  - `GameRenderer.render(state: SimState, dt: number, beat: number | null): void`
  - `Hud.update(state: SimState, mode: AppMode, paused: boolean, beat: number | null, audioOk: boolean): void`

- [ ] **Step 1: Write failing test** `tests/view/beatPulse.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { beatPulse, lerpColor } from '../../src/view/beatPulse';

describe('beatPulse', () => {
  it('peaks on the downbeat and halves on other beats', () => {
    expect(beatPulse(0)).toBe(1);
    expect(beatPulse(4)).toBe(1);
    expect(beatPulse(1)).toBe(0.5);
  });

  it('decays within the beat', () => {
    expect(beatPulse(0.5)).toBeCloseTo(0.0625);
    expect(beatPulse(0.99)).toBeLessThan(0.001);
  });

  it('is zero before the song and without audio', () => {
    expect(beatPulse(-0.5)).toBe(0);
    expect(beatPulse(null)).toBe(0);
  });
});

describe('lerpColor', () => {
  it('interpolates per channel', () => {
    expect(lerpColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(lerpColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(lerpColor(0x000000, 0x204060, 0.5)).toBe(0x102030);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/view` — Expected: FAIL.

- [ ] **Step 3: Implement `src/view/beatPulse.ts`**

```ts
export function beatPulse(beat: number | null): number {
  if (beat === null || beat < 0) return 0;
  const whole = Math.floor(beat);
  const frac = beat - whole;
  const strength = whole % 4 === 0 ? 1 : 0.5;
  return strength * (1 - frac) ** 4;
}

export function lerpColor(a: number, b: number, t: number): number {
  const ch = (shift: number) => {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * t) << shift;
  };
  return ch(16) | ch(8) | ch(0);
}
```

- [ ] **Step 4: Modify `src/view/renderer.ts`**

- Add imports: `import { FIELD_H, FIELD_W } from '../data/balance';` and `import { beatPulse, lerpColor } from './beatPulse';`
- Add constants:
```ts
const ON_BEAT_BULLET_COLOR = 0xffe14a;
const BACKDROP_BASE = 0x05060d;
const BACKDROP_PULSE = 0x1a2244;
```
- Add a backdrop sprite field and put it first in `root`:
```ts
  private readonly backdrop = new Sprite(Texture.WHITE);
```
  In the constructor before `this.root.addChild(...)`:
```ts
    this.backdrop.width = FIELD_W;
    this.backdrop.height = FIELD_H;
    this.backdrop.tint = BACKDROP_BASE;
```
  and `this.root.addChild(this.backdrop, this.starfield, this.entities);`
- Change signature to `render(state: SimState, dt: number, beat: number | null): void` and at its top:
```ts
    this.backdrop.tint = lerpColor(BACKDROP_BASE, BACKDROP_PULSE, beatPulse(beat) * 0.6);
```
- Enemy frame: replace the `frame` line with
```ts
    const tick = beat !== null && beat >= 0 ? Math.floor(beat) : Math.floor(state.time * 2);
    const frame = tick % 2 === 0 ? 0 : 1;
```
- Bullet tint in create: `s.tint = b.owner === 'enemy' ? ENEMY_BULLET_COLOR : b.onBeat ? ON_BEAT_BULLET_COLOR : PLAYER_BULLET_COLOR;`

In `src/app/app.ts` remove the `backdrop` Graphics (renderer owns it now).

- [ ] **Step 5: Modify `src/view/hud.ts`**

- Imports: add `Graphics` from pixi, `RHYTHM` from balance, `beatPulse` from `./beatPulse`.
- Add fields and constants:
```ts
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
```
```ts
  private readonly ring = new Graphics();
  private readonly mult: PixelText;
```
- Constructor: create `this.mult = new PixelText(glyphs);` position `this.ring.position.set(104, 6); this.mult.position.set(111, 4);` and add both to children.
- In `update(state, mode, paused, beat, audioOk)` after the lives line:
```ts
    const showRhythm = mode === 'run';
    this.ring.visible = showRhythm && audioOk;
    this.mult.visible = showRhythm;
    if (showRhythm) {
      if (!audioOk) {
        this.mult.setText('NO AUDIO');
        this.mult.x = Math.round((FIELD_W - this.mult.pixelWidth) / 2);
      } else {
        const m = state.rhythm.mult;
        this.mult.setText(`X${m.toFixed(1)}`);
        this.mult.x = 111;
        this.mult.tint = multColor(m);
        const progress =
          m >= RHYTHM.maxMult ? 1 : (state.rhythm.streak % RHYTHM.shotsPerStep) / RHYTHM.shotsPerStep;
        const color = multColor(m);
        this.ring
          .clear()
          .circle(0, 0, 4)
          .stroke({ color: 0x333a55, width: 1 });
        if (progress > 0) {
          this.ring
            .arc(0, 0, 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress)
            .stroke({ color, width: 1 });
        }
        this.ring.scale.set(1 + 0.35 * beatPulse(beat));
      }
    }
```
  (`PixelText` sprites use per-sprite tint; setting `this.mult.tint` on the container multiplies with it — glyphs are white so container tint is the visible color. Construct `mult` with color `0xffffff`.)

- [ ] **Step 6: Modify `src/app/app.ts`**

- Imports:
```ts
import { AudioEngine } from '../audio/engine';
import { compileSong } from '../audio/song';
import { EARTH_SONG } from '../data/songs/earth';
import type { SimEvent } from '../sim/types';
```
- After Pixi init:
```ts
  const audio = AudioEngine.create();
  const earthSong = compileSong(EARTH_SONG);
  const unlockAudio = () => audio?.unlock();
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('pointerdown', unlockAudio);
  const judgeFire = () => audio?.judgeFire() ?? null;
```
- Construct inputs with the judge: `new KeyboardInput(window, judgeFire)`, `new TouchInput(app.canvas, () => layout, judgeFire)`.
- Add a pause helper and use it everywhere `paused` changes:
```ts
  const setPaused = (p: boolean) => {
    if (paused === p) return;
    paused = p;
    audio?.setPaused(p);
  };
```
  - visibilitychange: `if (document.hidden && mode === 'run') setPaused(true);`
  - P key: `if (keyboard.consumePause() && mode === 'run' && state.phase !== 'gameOver') setPaused(!paused);`
  - touch resume: `if (input.firePressed && isTouch) setPaused(false);`
- SFX event handler:
```ts
  const playEvents = (events: readonly SimEvent[]) => {
    if (!audio) return;
    for (const e of events) {
      switch (e.type) {
        case 'shot': audio.sfx.laser(e.onBeat); break;
        case 'enemyKilled': audio.sfx.explosion(); break;
        case 'enemyShot': audio.sfx.enemyShot(); break;
        case 'playerHit': audio.sfx.playerHit(); break;
        case 'stageClear': audio.sfx.stageClear(); break;
        case 'gameOver': audio.stopSong(); break;
        default: break;
      }
    }
  };
```
- Title → run: after `mode = 'run';` add `audio?.sfx.start(); audio?.startSong(earthSong);`
- Replace `step(state, input);` with `playEvents(step(state, input));`
- Render: 
```ts
    const beat = audio?.currentBeat() ?? null;
    renderer.render(state, paused ? 0 : elapsed, beat);
    hud.update(state, mode, paused, beat, audio !== null);
```

- [ ] **Step 7: Verify** `npm test && npm run typecheck && npm run build` PASS. In the browser: no console errors; run starts music (engine `currentBeat()` advances — check via HUD ring pulsing / enemies flipping frames in steps); shots near beats turn gold and raise "X1.5" after 4; HUD shows multiplier. Offline render check from Task 4 still passes.

- [ ] **Step 8: Commit** `git add -A && git commit -m "feat: beat-synced visuals, multiplier HUD, music and sfx in game"`

---

## Self-Review Notes

- Spec §6 rhythm + combo → T1; §7 scheduler/BeatClock/instruments/song structure/SFX/mobile unlock/pause → T2–T4, T6; §8 beat pulse, enemy frames on beat → T6; §12 audio unavailable → T6 (NO AUDIO, judge null → x1).
- Deferred: latency calibration UI (M5; judge already takes `offsetMs`), boss riff sections and world songs 2–3 (M3/M4), volume settings (M5).
- Known simplification: one song object per run; stage transitions keep music running.
