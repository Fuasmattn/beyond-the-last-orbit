import { DIFFICULTY, STAGE } from '../data/balance';
import type { Difficulty, EnemyKind } from './types';

export function difficultyScalar(world: number, stage: number, loop: number): number {
  return world * STAGE.perWorld + stage + loop * DIFFICULTY.loopWeight;
}

function curve(range: readonly [number, number], d: number): number {
  const [min, max] = range;
  return min + (max - min) * (1 - Math.exp(-d / DIFFICULTY.k));
}

export function difficultyFor(world: number, stage: number, loop: number): Difficulty {
  const d = difficultyScalar(world, stage, loop);
  return {
    d,
    marchMin: curve(DIFFICULTY.marchMin, d),
    marchMax: curve(DIFFICULTY.marchMax, d),
    fireRate: curve(DIFFICULTY.fireRate, d),
    bulletSpeed: curve(DIFFICULTY.bulletSpeed, d),
    diveInterval: curve(DIFFICULTY.diveInterval, d),
    cols: 8 + Math.min(2, Math.floor(d / 5)),
    hpBonus: loop >= 1 ? 1 : 0,
    bossHpScale: 1 + loop * 0.5,
  };
}

/** Enemy type per formation row; new types appear as difficulty rises. */
export function kindForRow(row: number, d: number): EnemyKind {
  if (row === 0) return 'gunner';
  if (row === 1) return d >= 3 ? 'shield' : 'grunt';
  if (row === 2) return d >= 2 ? 'diver' : 'grunt';
  return 'grunt';
}

export function enemyHp(kind: EnemyKind, diff: Difficulty): number {
  return (kind === 'shield' ? 2 : 1) + diff.hpBonus;
}
