import { PLAYER } from '../data/balance';
import type { RunMode, ShipStats } from './types';

export function baseShip(): ShipStats {
  return {
    maxBullets: PLAYER.maxBullets,
    cooldown: PLAYER.fireCooldown,
    speed: PLAYER.maxSpeed,
    damage: 1,
    pierce: 0,
    twin: false,
    spread: false,
    scoreMul: 1,
    shieldMax: 0,
    worldShield: 0,
  };
}

/** How a run starts: mode plus everything permanent upgrades change. */
export interface RunOptions {
  mode: RunMode;
  ship: ShipStats;
  lives: number;
  /** Draft rerolls for the whole run. */
  rerolls: number;
}

export function defaultRunOptions(mode: RunMode = 'rhythm'): RunOptions {
  return { mode, ship: baseShip(), lives: PLAYER.startLives, rerolls: 0 };
}
