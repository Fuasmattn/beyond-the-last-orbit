import { PLAYER } from '../data/balance';
import { UPGRADE_EFFECT, UPGRADES, type UpgradeDef, type UpgradeId } from '../data/upgrades';
import type { SaveData } from '../persist/schema';
import { baseShip, defaultRunOptions, type RunOptions } from '../sim/ship';

export type UpgradeResult = 'bought' | 'maxed' | 'insufficient';

export function upgradeLevel(save: SaveData, id: UpgradeId): number {
  const def = UPGRADES.find((u) => u.id === id);
  return Math.min(save.upgrades[id] ?? 0, def?.costs.length ?? 0);
}

/** Price of the next level, or null when maxed. */
export function nextCost(save: SaveData, def: UpgradeDef): number | null {
  return def.costs[upgradeLevel(save, def.id)] ?? null;
}

/** Buys the next level. Mutates `save`. */
export function buyUpgrade(save: SaveData, def: UpgradeDef): UpgradeResult {
  const cost = nextCost(save, def);
  if (cost === null) return 'maxed';
  if (save.credits < cost) return 'insufficient';
  save.credits -= cost;
  save.upgrades[def.id] = upgradeLevel(save, def.id) + 1;
  return 'bought';
}

/** Run start from the hangar levels and settings. */
export function runOptionsFor(save: SaveData): RunOptions {
  const lv = (id: UpgradeId) => upgradeLevel(save, id);
  const ship = baseShip();
  ship.maxBullets += lv('cannon');
  ship.cooldown *= 1 - UPGRADE_EFFECT.coolantPerLevel * lv('coolant');
  ship.speed *= 1 + UPGRADE_EFFECT.thrustersPerLevel * lv('thrusters');
  ship.worldShield = lv('deflector');
  return {
    ...defaultRunOptions(),
    ship,
    lives: Math.min(PLAYER.maxLives, PLAYER.startLives + lv('hull')),
    rerolls: lv('insight'),
    beatLock: save.settings.beatLock,
    starterDraft: true,
  };
}

/** Credit multiplier for a finished run. */
export function creditMultiplier(save: SaveData): number {
  return 1 + UPGRADE_EFFECT.salvagePerLevel * upgradeLevel(save, 'salvage');
}
