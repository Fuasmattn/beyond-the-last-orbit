import { describe, expect, it } from 'vitest';
import { BEAT_STAGE, RHYTHM, SIM_DT } from '../../src/data/balance';
import { hitPlayer, updatePlayer } from '../../src/sim/player';
import { BEAT_ROW, reachableLanes } from '../../src/sim/route';
import { resolveCollisions } from '../../src/sim/collision';
import { defaultRunOptions } from '../../src/sim/ship';
import { advanceStage, beatRankFor, chooseNode, computeStageResult, finishStage, startStage } from '../../src/sim/stageFlow';
import { createInitialState } from '../../src/sim/state';
import { NO_INPUT, type SimState } from '../../src/sim/types';
import { landFormation } from './helpers';

const stepsPerLevel = RHYTHM.shotsPerStep;

/** Rogue run advanced to the beat row's stage, playing. */
function beatStage(kind: 'battle' | 'elite' = 'battle'): SimState {
  const s = createInitialState(11, undefined, defaultRunOptions());
  const r = s.rogue!;
  for (let row = 0; row <= BEAT_ROW; row++) {
    finishStage(s, []);
    advanceStage(s, []);
    r.map.rows[row]!.forEach((n) => (n.kind = row === BEAT_ROW ? kind : 'battle'));
    chooseNode(s, reachableLanes(r)[0]!, []);
  }
  landFormation(s);
  s.phase = 'playing';
  return s;
}

function fire(s: SimState, onBeat: boolean, perfect = false): void {
  s.player.cooldown = 0;
  s.bullets = [];
  updatePlayer(s, { ...NO_INPUT, firePressed: true, fireOnBeat: onBeat, firePerfect: perfect }, SIM_DT, []);
}

describe('beat stages', () => {
  it('stage 3 of a rogue world is a master beat stage; others are not', () => {
    const s = beatStage();
    expect(s.stage).toBe(BEAT_ROW + 2);
    expect(s.beatMode).toBe('master');
    finishStage(s, []);
    advanceStage(s, []);
    s.rogue!.map.rows[BEAT_ROW + 1]!.forEach((n) => (n.kind = 'battle'));
    chooseNode(s, reachableLanes(s.rogue!)[0]!, []);
    expect(s.beatMode).toBe('off');
  });

  it('climbs to x8 on the beat, and loses two levels per off-beat shot', () => {
    const s = beatStage();
    for (let i = 0; i < 100; i++) fire(s, true);
    expect(s.rhythm.mult).toBe(BEAT_STAGE.maxMult);
    const before = Math.floor(s.rhythm.streak / stepsPerLevel);
    fire(s, false);
    expect(Math.floor(s.rhythm.streak / stepsPerLevel)).toBe(before - BEAT_STAGE.offBeatDrop);
  });

  it('hits and misses do not move the streak; the multiplier resets on entry and clamps on exit', () => {
    const s = beatStage();
    expect(s.rhythm.streak).toBe(0);
    const e = s.enemies.find((x) => x.row === 0)!;
    s.bullets = [{ id: 9000, x: e.x + 2, y: e.y + 1, w: 2, h: 6, vx: 0, vy: 0, owner: 'player', onBeat: false, mult: 1 }];
    resolveCollisions(s, []);
    expect(s.rhythm.streak).toBe(0);
    for (let i = 0; i < 100; i++) fire(s, true);
    finishStage(s, []);
    advanceStage(s, []);
    if (s.phase === 'draft') advanceStage(s, []);
    s.rogue!.map.rows[BEAT_ROW + 1]!.forEach((n) => (n.kind = 'battle'));
    if (s.phase === 'route') chooseNode(s, reachableLanes(s.rogue!)[0]!, []);
    expect(s.rhythm.mult).toBeLessThanOrEqual(RHYTHM.maxMult);
  });

  it('PERFECT presses fire power shots', () => {
    const s = beatStage();
    fire(s, true, true);
    const b = s.bullets[0]!;
    expect(b.power).toBe(true);
    expect(b.damage).toBe(1 + BEAT_STAGE.powerDamage);
    expect(b.pierce).toBe(BEAT_STAGE.powerPierce);
    fire(s, true, false);
    expect(s.bullets[0]!.power).toBeUndefined();
  });

  it('beat lock makes every stage a beat stage, bosses included', () => {
    const s = createInitialState(11, undefined, { ...defaultRunOptions(), beatLock: true });
    expect(s.beatMode).toBe('master');
    landFormation(s);
    s.phase = 'playing';
    for (let i = 0; i < 100; i++) fire(s, true, true);
    expect(s.rhythm.mult).toBe(BEAT_STAGE.maxMult);
    expect(s.bullets[0]!.power).toBe(true);
    s.stage = 5;
    startStage(s, []);
    expect(s.beatMode).toBe('master');
    expect(s.boss).not.toBeNull();
  });

  it('a stage without beat lock or the beat row is not judged', () => {
    const s = createInitialState(11);
    expect(s.beatMode).toBe('off');
    landFormation(s);
    s.phase = 'playing';
    for (let i = 0; i < 100; i++) fire(s, true, true);
    expect(s.rhythm.mult).toBe(1);
  });

  it('getting hit drops one level', () => {
    const s = beatStage();
    for (let i = 0; i < 100; i++) fire(s, true);
    const level = Math.floor(s.rhythm.streak / stepsPerLevel);
    hitPlayer(s, []);
    expect(Math.floor(s.rhythm.streak / stepsPerLevel)).toBe(level - 1);
  });
});

describe('beat rank', () => {
  const stats = (shots: number, onBeat: number) => ({ shots, hits: shots, onBeatShots: onBeat, hitsTaken: 1, grazes: 0, time: 99 });

  it('ranks by on-beat share with a minimum shot count', () => {
    expect(beatRankFor(stats(20, 18))).toBe('S');
    expect(beatRankFor(stats(20, 15))).toBe('A');
    expect(beatRankFor(stats(20, 10))).toBe('B');
    expect(beatRankFor(stats(20, 9))).toBe('C');
    expect(beatRankFor(stats(5, 5))).toBe('C');
  });

  it('S doubles the stage bonus; only master stages rank', () => {
    const s = computeStageResult(stats(20, 20), false, 'master');
    const a = computeStageResult(stats(20, 16), false, 'master');
    expect(s.beatRank).toBe('S');
    expect(s.bonus).toBe(2 * (1000 + 1000));
    expect(a.bonus).toBe(1000 + 800);
    expect(computeStageResult(stats(20, 20), false).beatRank).toBeNull();
  });

  it('S and A ranks owe a draft; B does not', () => {
    const s = beatStage();
    s.stageStats = stats(20, 16);
    finishStage(s, []);
    expect(s.rogue!.draftPending).toBe(true);
    const b = beatStage();
    b.stageStats = stats(20, 10);
    finishStage(b, []);
    expect(b.rogue!.draftPending).toBe(false);
  });
});
