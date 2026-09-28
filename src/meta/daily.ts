import type { Board } from '../leaderboard/leaderboard';
import type { SaveData } from '../persist/schema';
import { defaultRunOptions, type RunOptions } from '../sim/ship';

/** UTC calendar day, `YYYY-MM-DD`. */
export function dayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** FNV-1a of the day key: the same seed for everyone, every device. */
export function dailySeed(day: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function dailyBoard(day: string): Board {
  return `daily:${day}`;
}

/** Everyone plays the same ship: no hangar upgrades, no rerolls, no Beat Lock. */
export function dailyRunOptions(): RunOptions {
  return defaultRunOptions();
}

export function dailyPlayed(save: SaveData, day: string): boolean {
  return save.dailyPlayed === day;
}
