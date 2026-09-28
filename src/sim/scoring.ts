import { BEAT_STAGE, COMBO, ELITE, GRAZE, RHYTHM } from '../data/balance';
import type { Bullet, SimState } from './types';

export function rhythmMultForStreak(streak: number, maxMult: number = RHYTHM.maxMult): number {
  return Math.min(maxMult, 1 + RHYTHM.multStep * Math.floor(streak / RHYTHM.shotsPerStep));
}

/** Highest multiplier right now: x8 in beat stages, x4 otherwise. */
export function multCap(state: SimState): number {
  return state.beatMode === 'master' ? BEAT_STAGE.maxMult : RHYTHM.maxMult;
}

function maxStreak(state: SimState): number {
  return ((multCap(state) - 1) / RHYTHM.multStep) * RHYTHM.shotsPerStep;
}

function setStreak(state: SimState, streak: number): void {
  const r = state.rhythm;
  r.streak = Math.max(0, Math.min(maxStreak(state), streak));
  r.mult = rhythmMultForStreak(r.streak, multCap(state));
}

/** onBeat null = no audio judgement → neutral. Only judged runs/stages (beatMode ≠ off) score timing. */
export function applyShotRhythm(state: SimState, onBeat: boolean | null): void {
  if (onBeat === null || state.beatMode === 'off') return;
  if (onBeat) {
    setStreak(state, state.rhythm.streak + 1);
    state.stats.onBeatShots++;
    state.stageStats.onBeatShots++;
  } else {
    dropStreakLevel(state, state.beatMode === 'master' ? BEAT_STAGE.offBeatDrop : 1);
  }
}

/** Falls back to the start of the multiplier level `levels` below the current one. */
export function dropStreakLevel(state: SimState, levels = 1): void {
  const level = Math.floor(state.rhythm.streak / RHYTHM.shotsPerStep);
  setStreak(state, (level - levels) * RHYTHM.shotsPerStep);
}

/** Re-applies the current cap (entering or leaving a beat stage). */
export function clampStreak(state: SimState): void {
  setStreak(state, state.rhythm.streak);
}

/** Outside beat stages: hits and grazes build the multiplier instead of beat timing. */
export function bumpStreak(state: SimState): void {
  if (state.beatMode !== 'off') return;
  setStreak(state, state.rhythm.streak + 1);
}

export function resetRhythm(state: SimState): void {
  state.rhythm.streak = 0;
  state.rhythm.mult = 1;
}

export function recordShot(state: SimState): void {
  state.stats.shots++;
  state.stageStats.shots++;
}

/** Every hit builds the rogue streak. Counts a player bolt's hit for accuracy: once per primary bolt (side bolts and repeat pierce hits are free). */
export function recordHit(state: SimState, bullet: Bullet): void {
  bumpStreak(state);
  if (bullet.extra || (bullet.pierced && bullet.pierced.length > 0)) return;
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
  const elite = state.diff.elite ? ELITE.scoreMul : 1;
  const points = Math.round(base * bulletMult * comboMult(state) * state.ship.scoreMul * elite);
  state.score += points;
  return points;
}

export function updateCombo(state: SimState, dt: number): void {
  const c = state.combo;
  if (c.timer <= 0) return;
  c.timer = Math.max(0, c.timer - dt);
  if (c.timer === 0) c.chain = 0;
}

/** An enemy bullet skimming past the ship scores and feeds the streak. */
export function registerGraze(state: SimState): number {
  bumpStreak(state);
  const points = Math.round(GRAZE.points * state.rhythm.mult * state.ship.scoreMul);
  state.score += points;
  state.stageStats.grazes++;
  return points;
}
