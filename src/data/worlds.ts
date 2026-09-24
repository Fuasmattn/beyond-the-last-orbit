import type { BossKind, EnemyKind } from '../sim/types';

export type WorldId = 'earth' | 'moon' | 'mars';

export interface WorldDef {
  id: WorldId;
  name: string;
  bpm: number;
  boss: BossKind;
  bossName: string;
  /** World-specific enemy type (formation row 3 once d ≥ 4). */
  special: EnemyKind;
}

export const WORLDS: readonly WorldDef[] = [
  { id: 'earth', name: 'NEAR EARTH ORBIT', bpm: 140, boss: 'warden', bossName: 'ORBITAL WARDEN', special: 'splitter' },
  { id: 'moon', name: 'LUNAR ORBIT', bpm: 150, boss: 'hive', bossName: 'LUNAR HIVE', special: 'phaser' },
  { id: 'mars', name: 'MARS ORBIT', bpm: 160, boss: 'dreadnought', bossName: 'ARES DREADNOUGHT', special: 'bomber' },
];

export function worldAt(index: number): WorldDef {
  const n = WORLDS.length;
  const w = WORLDS[((index % n) + n) % n];
  if (!w) throw new Error(`no world at index ${index}`);
  return w;
}
