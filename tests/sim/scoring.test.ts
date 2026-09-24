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
