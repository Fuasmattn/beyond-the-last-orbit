import { PLAYER_ZONE_TOP, SIM_DT, STAGE_CLEAR_TIME } from '../data/balance';
import { moveBullets } from './bullets';
import { resolveCollisions } from './collision';
import { updateEnemyFire } from './enemyFire';
import { formationBottom, spawnFormation, updateFormation } from './formation';
import { hitPlayer, updatePlayer } from './player';
import type { InputFrame, SimEvent, SimState } from './types';

export function step(state: SimState, input: InputFrame, dt: number = SIM_DT): SimEvent[] {
  const events: SimEvent[] = [];
  if (state.phase === 'gameOver') return events;
  state.time += dt;

  if (state.phase === 'stageClear') {
    updatePlayer(state, { ...input, firePressed: false }, dt, events);
    moveBullets(state, dt);
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) {
      state.stage++;
      state.bullets = [];
      spawnFormation(state);
      state.phase = 'playing';
      events.push({ type: 'stageStart', stage: state.stage });
    }
    return events;
  }

  updatePlayer(state, input, dt, events);
  updateFormation(state, dt);
  updateEnemyFire(state, dt, events);
  moveBullets(state, dt);
  resolveCollisions(state, events);
  if (state.phase !== 'playing') return events;

  if (state.enemies.length === 0) {
    state.phase = 'stageClear';
    state.phaseTimer = STAGE_CLEAR_TIME;
    events.push({ type: 'stageClear', stage: state.stage });
    return events;
  }

  if (formationBottom(state) >= PLAYER_ZONE_TOP) {
    events.push({ type: 'formationInvaded' });
    hitPlayer(state, events);
    if (state.phase === 'playing') {
      state.bullets = [];
      spawnFormation(state);
    }
  }
  return events;
}
