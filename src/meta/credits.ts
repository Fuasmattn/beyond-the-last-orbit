import { CREDITS } from '../data/balance';

export function computeCredits(score: number, bossesKilled: number, perfectStages: number): number {
  return (
    Math.floor(score / CREDITS.scoreDivisor) + CREDITS.perBoss * bossesKilled + CREDITS.perPerfect * perfectStages
  );
}
