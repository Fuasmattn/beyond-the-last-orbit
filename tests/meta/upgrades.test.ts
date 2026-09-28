import { describe, expect, it } from 'vitest';
import { PLAYER } from '../../src/data/balance';
import { UPGRADES } from '../../src/data/upgrades';
import { buyUpgrade, creditMultiplier, nextCost, runOptionsFor, upgradeLevel } from '../../src/meta/upgrades';
import { defaultSave } from '../../src/persist/schema';

const def = (id: string) => UPGRADES.find((u) => u.id === id)!;

describe('buyUpgrade', () => {
  it('buys levels in order until maxed', () => {
    const save = defaultSave();
    save.credits = 10_000;
    const hull = def('hull');
    expect(buyUpgrade(save, hull)).toBe('bought');
    expect(save.credits).toBe(10_000 - hull.costs[0]!);
    expect(buyUpgrade(save, hull)).toBe('bought');
    expect(upgradeLevel(save, 'hull')).toBe(2);
    expect(nextCost(save, hull)).toBeNull();
    expect(buyUpgrade(save, hull)).toBe('maxed');
  });

  it('refuses without enough credits', () => {
    const save = defaultSave();
    save.credits = 10;
    expect(buyUpgrade(save, def('cannon'))).toBe('insufficient');
    expect(save.credits).toBe(10);
    expect(upgradeLevel(save, 'cannon')).toBe(0);
  });

  it('costs rise with each level', () => {
    for (const u of UPGRADES) for (let i = 1; i < u.costs.length; i++) expect(u.costs[i]!).toBeGreaterThan(u.costs[i - 1]!);
  });
});

describe('runOptionsFor', () => {
  it('is the base ship with no upgrades', () => {
    const o = runOptionsFor(defaultSave());
    expect(o.beatLock).toBe(false);
    expect(o.lives).toBe(PLAYER.startLives);
    expect(o.ship.maxBullets).toBe(PLAYER.maxBullets);
    expect(o.rerolls).toBe(0);
  });

  it('applies every hangar upgrade', () => {
    const save = defaultSave();
    save.upgrades = { hull: 2, cannon: 1, coolant: 3, thrusters: 2, deflector: 1, insight: 2, salvage: 3 };
    const o = runOptionsFor(save);
    expect(o.lives).toBe(PLAYER.startLives + 2);
    expect(o.ship.maxBullets).toBe(PLAYER.maxBullets + 1);
    expect(o.ship.cooldown).toBeCloseTo(PLAYER.fireCooldown * 0.7);
    expect(o.ship.speed).toBeCloseTo(PLAYER.maxSpeed * 1.16);
    expect(o.ship.worldShield).toBe(1);
    expect(o.rerolls).toBe(2);
    expect(creditMultiplier(save)).toBeCloseTo(1.45);
    expect(creditMultiplier(defaultSave())).toBe(1);
  });

  it('clamps levels above the definition', () => {
    const save = defaultSave();
    save.upgrades = { hull: 9 };
    expect(upgradeLevel(save, 'hull')).toBe(2);
  });
});
