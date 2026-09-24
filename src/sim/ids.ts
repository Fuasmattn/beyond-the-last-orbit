import type { SimState } from './types';

export function allocId(state: SimState): number {
  return state.nextId++;
}
