import { COMBO, ELITE, GRAZE, RHYTHM } from '../data/balance';
import type { Bullet, SimState } from './types';

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
    r.mult = rhythmMultForStreak(r.streak);
  } else {
    dropStreakLevel(state);
  }
}

/** Falls back to the start of the previous multiplier level. */
export function dropStreakLevel(state: SimState): void {
  const r = state.rhythm;
  const level = Math.floor(r.streak / RHYTHM.shotsPerStep);
  r.streak = Math.max(0, (level - 1) * RHYTHM.shotsPerStep);
  r.mult = rhythmMultForStreak(r.streak);
}

/** Rogue runs: hits and grazes build the multiplier instead of beat timing. */
export function bumpStreak(state: SimState): void {
  if (state.mode !== 'rogue') return;
  const r = state.rhythm;
  r.streak = Math.min(MAX_STREAK, r.streak + 1);
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

/** Rogue runs: an enemy bullet skimming past the ship scores and feeds the streak. */
export function registerGraze(state: SimState): number {
  bumpStreak(state);
  const points = Math.round(GRAZE.points * state.rhythm.mult * state.ship.scoreMul);
  state.score += points;
  state.stageStats.grazes++;
  return points;
}
