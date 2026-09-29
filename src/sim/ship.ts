import { GRAZE, PLAYER } from '../data/balance';
import type { ShipStats } from './types';

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
    grazeMargin: GRAZE.margin,
    grazeMul: 1,
    hurtScale: 1,
    bounce: 0,
    chargeGrazes: 0,
    shrapnel: false,
    overdrive: false,
    revives: 0,
    fragileStreak: false,
    boltSpeed: PLAYER.bulletSpeed,
    boltW: PLAYER.bulletW,
    scrapBonus: 0,
    scrapMul: 1,
    sniper: false,
    arc: false,
    shieldBurst: false,
    mendGrazes: 0,
    multBonus: 0,
    mirror: false,
  };
}

/** How a run starts: everything permanent upgrades and settings change. */
export interface RunOptions {
  ship: ShipStats;
  lives: number;
  /** Draft rerolls for the whole run. */
  rerolls: number;
  /** Every stage is a beat stage. */
  beatLock: boolean;
  /** Open the run with a pick-1-of-3 draft before stage 1. */
  starterDraft: boolean;
}

export function defaultRunOptions(): RunOptions {
  return { ship: baseShip(), lives: PLAYER.startLives, rerolls: 0, beatLock: false, starterDraft: false };
}
