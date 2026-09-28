import { BEAT_TRACK, FIELD_H, FIELD_W_DEFAULT, PLAYER } from '../data/balance';
import { difficultyFor } from './difficulty';
import { createRogueState } from './route';
import { defaultRunOptions, type RunOptions } from './ship';
import { emptyStageStats, startStage } from './stageFlow';
import type { SimState } from './types';

/** New run at world 1, stage 1, in the stage intro. */
export function createInitialState(
  seed: number,
  fieldW: number = FIELD_W_DEFAULT,
  opts: RunOptions = defaultRunOptions(),
): SimState {
  const state: SimState = {
    beatMode: 'off',
    beatLock: opts.beatLock,
    ship: { ...opts.ship },
    time: 0,
    fieldW,
    nextFieldW: fieldW,
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
      x: (fieldW - PLAYER.w) / 2,
      y: FIELD_H - BEAT_TRACK.h - PLAYER.h - PLAYER.bottomMargin,
      w: PLAYER.w,
      h: PLAYER.h,
      vx: 0,
      vy: 0,
      cooldown: 0,
      invuln: 0,
      lives: opts.lives,
      shield: 0,
    },
    enemies: [],
    bullets: [],
    formation: { y: 0, sway: 0, swayDir: 1, shapes: ['block'], shapeIdx: 0, morph: 1, beats: 0, total: 0, rows: 0, cols: 0 },
    boss: null,
    diff: difficultyFor(0, 1, 0),
    enemyFireTimer: 1.5,
    diveTimer: 0,
    hitStop: 0,
    beat: { last: null, count: 0 },
    rhythm: { streak: 0, mult: 1 },
    charge: 0,
    combo: { chain: 0, timer: 0 },
    stats: { shots: 0, hits: 0, onBeatShots: 0 },
    stageStats: emptyStageStats(),
    result: null,
    run: { bossesKilled: 0, perfectStages: 0, stagesCleared: 0, kills: 0, grazes: 0, bestBeatRank: null },
    rogue: createRogueState(seed, opts.rerolls, 0),
  };
  startStage(state, []);
  return state;
}
