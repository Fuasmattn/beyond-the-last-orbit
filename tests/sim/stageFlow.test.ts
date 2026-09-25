import { describe, expect, it } from 'vitest';
import { PLAYER, SIM_DT, STAGE, WARP } from '../../src/data/balance';
import { WORLDS } from '../../src/data/worlds';
import {
  advanceStage,
  checkExtraLife,
  computeStageResult,
  finishStage,
  startStage,
} from '../../src/sim/stageFlow';
import { createInitialState } from '../../src/sim/state';
import { step } from '../../src/sim/step';
import { NO_INPUT, type SimEvent } from '../../src/sim/types';

describe('computeStageResult', () => {
  it('scores accuracy, beat, no-hit and time', () => {
    const r = computeStageResult({ shots: 10, hits: 8, onBeatShots: 5, hitsTaken: 0, grazes: 0, time: 20 }, false);
    expect(r.accuracy).toBeCloseTo(0.8);
    expect(r.beatPct).toBeCloseTo(0.5);
    expect(r.noHit).toBe(true);
    expect(r.bonus).toBe(800 + 500 + 2000 + (STAGE.parTime - 20) * STAGE.timeBonusPerSec);
    expect(r.perfect).toBe(false);
  });

  it('handles zero shots and slow clears', () => {
    const r = computeStageResult({ shots: 0, hits: 0, onBeatShots: 0, hitsTaken: 2, grazes: 0, time: 999 }, false);
    expect(r.bonus).toBe(0);
    expect(r.noHit).toBe(false);
  });

  it('flags perfect stages', () => {
    const r = computeStageResult({ shots: 10, hits: 10, onBeatShots: 7, hitsTaken: 0, grazes: 0, time: 10 }, false);
    expect(r.perfect).toBe(true);
  });

  it('uses the boss par time on boss stages', () => {
    const r = computeStageResult({ shots: 0, hits: 0, onBeatShots: 0, hitsTaken: 1, grazes: 0, time: 40 }, true);
    expect(r.bonus).toBe((STAGE.bossParTime - 40) * STAGE.timeBonusPerSec);
  });
});

describe('stage progression', () => {
  it('finishStage adds the bonus and counts perfect stages', () => {
    const s = createInitialState(1);
    s.stageStats = { shots: 10, hits: 10, onBeatShots: 10, hitsTaken: 0, grazes: 0, time: 10 };
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

describe('warp', () => {
  function afterBoss() {
    const s = createInitialState(1);
    s.stage = STAGE.perWorld;
    const events: SimEvent[] = [];
    advanceStage(s, events);
    return { s, events };
  }

  it('warps to the next world after its boss stage', () => {
    const { s, events } = afterBoss();
    expect(s.phase).toBe('warp');
    expect(s.world).toBe(1);
    expect(s.stage).toBe(1);
    expect(s.beat.last).toBeNull();
    expect(events).toContainEqual({ type: 'warpStart', world: 1, loop: 0 });
  });

  it('starts the stage when the warp ends', () => {
    const { s } = afterBoss();
    for (let t = 0; t < WARP.time + 0.1; t += SIM_DT) step(s, NO_INPUT);
    expect(s.phase).toBe('stageIntro');
    expect(s.enemies.length).toBeGreaterThan(0);
  });

  it('can be skipped with fire, but not instantly', () => {
    const { s } = afterBoss();
    step(s, { ...NO_INPUT, firePressed: true });
    expect(s.phase).toBe('warp');
    for (let t = 0; t < WARP.skipAfter + 0.05; t += SIM_DT) step(s, NO_INPUT);
    step(s, { ...NO_INPUT, firePressed: true });
    expect(s.phase).toBe('stageIntro');
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

describe('field width', () => {
  it('adopts the pending field width at stage start and keeps the player inside', () => {
    const s = createInitialState(1, 400);
    s.player.x = 390;
    s.nextFieldW = 200;
    startStage(s, []);
    expect(s.fieldW).toBe(200);
    expect(s.player.x).toBeLessThanOrEqual(200 - s.player.w);
  });
});
