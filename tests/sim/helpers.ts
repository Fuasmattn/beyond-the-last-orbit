import { updateFormation } from '../../src/sim/formation';
import { createInitialState } from '../../src/sim/state';
import type { SimState } from '../../src/sim/types';

/** Lands every flying-in enemy in its formation slot. */
export function landFormation(s: SimState): SimState {
  for (const e of s.enemies) e.entry = null;
  updateFormation(s, 0, 0);
  return s;
}

/** New run with the stage-1 formation already in place. */
export function landedState(seed: number, fieldW?: number): SimState {
  return landFormation(createInitialState(seed, fieldW));
}
