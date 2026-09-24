import { FIELD_H, FIELD_W, PLAYER } from '../data/balance';
import { spawnFormation } from './formation';
import type { SimState } from './types';

export function createInitialState(seed: number): SimState {
  const state: SimState = {
    time: 0,
    rng: { seed },
    nextId: 1,
    phase: 'playing',
    phaseTimer: 0,
    stage: 1,
    score: 0,
    player: {
      x: (FIELD_W - PLAYER.w) / 2,
      y: FIELD_H - PLAYER.h - PLAYER.bottomMargin,
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
    enemyFireTimer: 1.5,
    rhythm: { streak: 0, mult: 1 },
    combo: { chain: 0, timer: 0 },
    stats: { shots: 0, hits: 0, onBeatShots: 0 },
  };
  spawnFormation(state);
  return state;
}
