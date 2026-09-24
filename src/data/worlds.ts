import type { BossKind } from '../sim/types';

export type WorldId = 'earth' | 'moon' | 'mars';

export interface WorldDef {
  id: WorldId;
  name: string;
  bpm: number;
  boss: BossKind;
  bossName: string;
}

export const WORLDS: readonly WorldDef[] = [
  { id: 'earth', name: 'NEAR EARTH ORBIT', bpm: 140, boss: 'warden', bossName: 'ORBITAL WARDEN' },
];

export function worldAt(index: number): WorldDef {
  const n = WORLDS.length;
  const w = WORLDS[((index % n) + n) % n];
  if (!w) throw new Error(`no world at index ${index}`);
  return w;
}
