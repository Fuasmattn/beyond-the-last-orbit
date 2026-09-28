import { describe, expect, it } from 'vitest';
import { DIFFICULTY, ENEMY } from '../../src/data/balance';
import { difficultyFor, difficultyScalar, enemyHp, kindForRow } from '../../src/sim/difficulty';

describe('difficulty', () => {
  it('computes the scalar from world, stage and loop', () => {
    expect(difficultyScalar(0, 1, 0)).toBe(1);
    expect(difficultyScalar(2, 5, 0)).toBe(15);
    expect(difficultyScalar(0, 1, 1)).toBe(16);
  });

  it('ramps monotonically and stays under the caps', () => {
    const easy = difficultyFor(0, 1, 0);
    const hard = difficultyFor(2, 5, 3);
    expect(hard.fireRate).toBeGreaterThan(easy.fireRate);
    expect(hard.advanceStep).toBeGreaterThan(easy.advanceStep);
    expect(hard.diveInterval).toBeLessThan(easy.diveInterval);
    expect(hard.fireRate).toBeLessThanOrEqual(DIFFICULTY.fireRate[1]);
    expect(hard.bulletSpeed).toBeLessThanOrEqual(DIFFICULTY.bulletSpeed[1]);
  });

  it('widens the formation and toughens enemies on later loops', () => {
    expect(difficultyFor(0, 1, 0).cols).toBe(8);
    expect(difficultyFor(2, 5, 0).cols).toBe(10);
    expect(difficultyFor(0, 1, 0).hpBonus).toBe(0);
    expect(difficultyFor(0, 1, 1).hpBonus).toBe(1);
    expect(difficultyFor(0, 1, 2).bossHpScale).toBe(2);
  });

  it('introduces enemy types as difficulty rises', () => {
    expect(kindForRow(0, 1, 'phaser')).toBe('gunner');
    expect(kindForRow(2, 0, 'phaser')).toBe('grunt');
    expect(kindForRow(2, 1, 'phaser')).toBe('diver');
    expect(kindForRow(1, 1, 'phaser')).toBe('grunt');
    expect(kindForRow(1, 2, 'phaser')).toBe('shield');
    expect(kindForRow(3, 2, 'phaser')).toBe('grunt');
    expect(kindForRow(3, 3, 'phaser')).toBe('phaser');
    expect(kindForRow(4, 99, 'phaser')).toBe('grunt');
  });

  it('fields four rows on the first two stages and five after', () => {
    expect(difficultyFor(0, 1, 0).rows).toBe(DIFFICULTY.earlyRows);
    expect(difficultyFor(0, 2, 0).rows).toBe(DIFFICULTY.earlyRows);
    expect(difficultyFor(0, 3, 0).rows).toBe(ENEMY.rows);
    expect(difficultyFor(1, 1, 0).rows).toBe(ENEMY.rows);
  });

  it('gives shields and later loops extra hp', () => {
    expect(enemyHp('shield', difficultyFor(0, 1, 0))).toBe(2);
    expect(enemyHp('grunt', difficultyFor(0, 1, 0))).toBe(1);
    expect(enemyHp('grunt', difficultyFor(0, 1, 1))).toBe(2);
  });
});
