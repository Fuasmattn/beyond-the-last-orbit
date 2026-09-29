import { describe, expect, it } from 'vitest';
import { BEAT_STAGE, CANCEL, COMBO, PLAYER, RHYTHM, SIM_DT } from '../../src/data/balance';
import { hitPlayer, updatePlayer } from '../../src/sim/player';
import {
  applyShotRhythm,
  cancelBullets,
  comboMult,
  registerKill,
  rhythmMultForStreak,
  updateCombo,
} from '../../src/sim/scoring';
import { defaultRunOptions } from '../../src/sim/ship';
import { createInitialState } from '../../src/sim/state';
import { finishStage } from '../../src/sim/stageFlow';
import { NO_INPUT, type SimEvent } from '../../src/sim/types';

/** A run under beat lock: every stage judges timing. */
const beatRun = () => createInitialState(1, undefined, { ...defaultRunOptions(), beatLock: true });

describe('rhythm multiplier', () => {
  it('maps streak to multiplier steps with a cap', () => {
    expect(rhythmMultForStreak(0)).toBe(1);
    expect(rhythmMultForStreak(3)).toBe(1);
    expect(rhythmMultForStreak(4)).toBe(1.5);
    expect(rhythmMultForStreak(8)).toBe(2);
    expect(rhythmMultForStreak(999)).toBe(RHYTHM.maxMult);
  });

  it('builds on on-beat shots and counts them', () => {
    const s = beatRun();
    for (let i = 0; i < 4; i++) applyShotRhythm(s, true);
    expect(s.rhythm.mult).toBe(1.5);
    expect(s.stats.onBeatShots).toBe(4);
  });

  it('drops two levels on an off-beat shot and loses partial progress', () => {
    const s = beatRun();
    for (let i = 0; i < 14; i++) applyShotRhythm(s, true); // streak 14 → x2.5
    applyShotRhythm(s, false);
    expect(s.rhythm.streak).toBe(4);
    expect(s.rhythm.mult).toBe(1.5);
    applyShotRhythm(s, false);
    expect(s.rhythm.streak).toBe(0);
    expect(s.rhythm.mult).toBe(1);
  });

  it('caps the streak at max multiplier so one miss drops just two levels', () => {
    const s = beatRun();
    for (let i = 0; i < 100; i++) applyShotRhythm(s, true);
    expect(s.rhythm.mult).toBe(BEAT_STAGE.maxMult);
    applyShotRhythm(s, false);
    expect(s.rhythm.mult).toBe(BEAT_STAGE.maxMult - BEAT_STAGE.offBeatDrop * RHYTHM.multStep);
  });

  it('is neutral without audio', () => {
    const s = beatRun();
    applyShotRhythm(s, true);
    applyShotRhythm(s, null);
    expect(s.rhythm.streak).toBe(1);
  });

  it('is not judged outside beat stages', () => {
    const s = createInitialState(1);
    for (let i = 0; i < 8; i++) applyShotRhythm(s, true);
    expect(s.rhythm.streak).toBe(0);
    expect(s.stats.onBeatShots).toBe(0);
  });

  it('drops one level when the player is hit', () => {
    const s = beatRun();
    for (let i = 0; i < 8; i++) applyShotRhythm(s, true);
    hitPlayer(s, []);
    expect(s.rhythm).toEqual({ streak: 4, mult: 1.5 });
  });

  it('captures the multiplier on the fired bullet', () => {
    const s = beatRun();
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

describe('bullet cancel', () => {
  it('turns leftover enemy bullets into points on stage clear', () => {
    const s = createInitialState(1);
    s.rhythm.mult = 2;
    s.bullets = [
      { id: 1, x: 10, y: 10, w: 2, h: 6, vx: 0, vy: 50, owner: 'enemy', onBeat: false, mult: 1 },
      { id: 2, x: 30, y: 40, w: 2, h: 6, vx: 0, vy: 50, owner: 'enemy', onBeat: false, mult: 1 },
      { id: 3, x: 50, y: 40, w: 2, h: 6, vx: 0, vy: -50, owner: 'player', onBeat: false, mult: 1 },
    ];
    const events: SimEvent[] = [];
    cancelBullets(s, events);
    expect(s.score).toBe(2 * CANCEL.points * 2);
    expect(s.bullets.map((b) => b.id)).toEqual([3]);
    const e = events.find((x) => x.type === 'bulletCancel');
    expect(e && e.type === 'bulletCancel' ? [e.count, e.points, e.spots.length] : null).toEqual([2, 20, 2]);
    cancelBullets(s, events);
    expect(events.filter((x) => x.type === 'bulletCancel')).toHaveLength(1);
  });

  it('runs on stage clear and counts kills, grazes and the best beat rank for the run', () => {
    const s = createInitialState(1);
    s.bullets = [{ id: 1, x: 10, y: 10, w: 2, h: 6, vx: 0, vy: 50, owner: 'enemy', onBeat: false, mult: 1 }];
    const events: SimEvent[] = [];
    finishStage(s, events);
    expect(events.some((x) => x.type === 'bulletCancel')).toBe(true);
    expect(s.bullets).toEqual([]);
    expect(s.run.bestBeatRank).toBeNull();
    s.beatMode = 'master';
    s.stageStats = { shots: 20, hits: 20, onBeatShots: 16, hitsTaken: 0, grazes: 0, time: 10 , escaped: 0 };
    finishStage(s, events);
    expect(s.run.bestBeatRank).toBe('A');
    s.stageStats = { shots: 20, hits: 20, onBeatShots: 10, hitsTaken: 0, grazes: 0, time: 10 , escaped: 0 };
    finishStage(s, events);
    expect(s.run.bestBeatRank).toBe('A');
  });
});
