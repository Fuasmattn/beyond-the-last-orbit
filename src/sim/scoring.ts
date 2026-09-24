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
