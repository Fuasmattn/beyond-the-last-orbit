import { initConvoy, updateConvoy } from './convoy';
import { spawnFormation } from './formation';
import { spawnSentinel } from './boss/sentinel';
import { initSwarm, updateSwarm } from './swarm';
import type { FightState, SimEvent, SimState } from './types';

export function emptyFight(): FightState {
  return { budget: 0, timer: 0, launched: 0, groups: {} };
}

/** Spawns the stage's fight for `state.rogue.fight` (formation by default). */
export function spawnFight(state: SimState): void {
  state.fight = emptyFight();
  switch (state.rogue.fight) {
    case 'swarm':
      state.fight = initSwarm(state);
      return;
    case 'convoy':
      state.fight = initConvoy(state);
      return;
    case 'miniboss':
      spawnSentinel(state);
      return;
    case 'formation':
      spawnFormation(state);
      return;
  }
}

/** Per-tick update of the non-formation, non-boss fights. */
export function updateFight(state: SimState, dt: number, events: SimEvent[]): void {
  switch (state.rogue.fight) {
    case 'swarm':
      updateSwarm(state, dt, events);
      return;
    case 'convoy':
      updateConvoy(state, dt, events);
      return;
    default:
      return;
  }
}

/** True once the fight has nothing left to spawn, so an empty field ends the stage. */
export function fightExhausted(state: SimState): boolean {
  return state.fight.budget <= 0;
}
