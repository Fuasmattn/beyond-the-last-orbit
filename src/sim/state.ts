import { BEAT_TRACK, FIELD_H, FIELD_W_DEFAULT, PLAYER } from '../data/balance';
import { difficultyFor } from './difficulty';
import { emptyStageStats, startStage } from './stageFlow';
import type { SimState } from './types';

/** New run at world 1, stage 1, in the stage intro. */
export function createInitialState(seed: number, fieldW: number = FIELD_W_DEFAULT): SimState {
  const state: SimState = {
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
    beat: { last: null, count: 0 },
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
