import { PLAYER_ZONE_TOP, SIM_DT } from '../data/balance';
import { beatsCrossed } from './beat';
import { updateBoss } from './boss';
import { moveBullets } from './bullets';
import { resolveCollisions } from './collision';
import { updateDives } from './dive';
import { updateEnemyFire } from './enemyFire';
import { formationBottom, spawnFormation, updateFormation } from './formation';
import { hitPlayer, updatePlayer } from './player';
import { updateCombo } from './scoring';
import { advanceStage, checkExtraLife, finishStage } from './stageFlow';
import type { InputFrame, SimEvent, SimState } from './types';

export function step(state: SimState, input: InputFrame, dt: number = SIM_DT): SimEvent[] {
  const events: SimEvent[] = [];
  if (state.phase === 'gameOver') return events;
  if (state.hitStop > 0) {
    state.hitStop = Math.max(0, state.hitStop - dt);
    return events;
  }
  state.time += dt;
  const beats = beatsCrossed(state, input.beat);
  const noFire: InputFrame = { ...input, firePressed: false };

  switch (state.phase) {
    case 'stageIntro':
      updatePlayer(state, noFire, dt, events);
      updateBoss(state, dt, beats, events);
      moveBullets(state, dt);
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) {
        state.phase = 'playing';
        events.push({ type: 'stageStart', stage: state.stage });
      }
      return events;

    case 'stageClear':
      updatePlayer(state, noFire, dt, events);
      moveBullets(state, dt);
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) advanceStage(state, events);
      return events;

    case 'bossDying':
      updatePlayer(state, noFire, dt, events);
      updateBoss(state, dt, 0, events);
      moveBullets(state, dt);
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) {
        state.boss = null;
        finishStage(state, events);
      }
      return events;

    case 'playing':
      playing(state, input, dt, beats, events);
      return events;
  }
}

function playing(state: SimState, input: InputFrame, dt: number, beats: number, events: SimEvent[]): void {
  updatePlayer(state, input, dt, events);
  updateCombo(state, dt);
  state.stageStats.time += dt;
  if (state.boss) {
    updateBoss(state, dt, beats, events);
  } else {
    updateFormation(state, dt);
    updateDives(state, dt, events);
    updateEnemyFire(state, dt, events);
  }
  moveBullets(state, dt);
  resolveCollisions(state, events);
  checkExtraLife(state, events);
  if (state.phase !== 'playing' || state.boss) return;

  if (state.enemies.length === 0) {
    finishStage(state, events);
    return;
  }
  if (formationBottom(state) >= PLAYER_ZONE_TOP) {
    events.push({ type: 'formationInvaded' });
    hitPlayer(state, events);
    if (state.phase === 'playing') {
      state.bullets = [];
      spawnFormation(state);
    }
  }
}
