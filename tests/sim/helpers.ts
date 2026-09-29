import { updateFormation } from '../../src/sim/formation';
import { advanceStage, chooseBoon, finishStage } from '../../src/sim/stageFlow';
import { createInitialState } from '../../src/sim/state';
import type { SimEvent, SimState } from '../../src/sim/types';

/** Skips the common-only draft every plain battle stage owes (M19), so tests land where they used to. */
export function skipBasicDraft(s: SimState, events: SimEvent[] = []): void {
  while (s.phase === 'draft' && s.rogue.draftTier === 'basic') chooseBoon(s, null, events);
}

/** Clears the current stage, runs through the stage-clear screen and past the basic draft. */
export function clearStage(s: SimState, events: SimEvent[] = []): SimEvent[] {
  finishStage(s, events);
  advanceStage(s, events);
  skipBasicDraft(s, events);
  return events;
}

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
