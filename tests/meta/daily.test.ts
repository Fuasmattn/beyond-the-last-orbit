import { describe, expect, it } from 'vitest';
import { dailyBoard, dailyPlayed, dailyRunOptions, dailySeed, dayKey } from '../../src/meta/daily';
import { defaultSave } from '../../src/persist/schema';
import { createInitialState } from '../../src/sim/state';

describe('daily run', () => {
  it('keys the day in UTC', () => {
    expect(dayKey(new Date('2026-09-28T23:59:00Z'))).toBe('2026-09-28');
    expect(dayKey(new Date('2026-09-28T23:59:00-05:00'))).toBe('2026-09-29');
  });

  it('seeds every device the same and every day differently', () => {
    expect(dailySeed('2026-09-28')).toBe(dailySeed('2026-09-28'));
    expect(dailySeed('2026-09-28')).not.toBe(dailySeed('2026-09-29'));
    expect(Number.isInteger(dailySeed('2026-09-28'))).toBe(true);
    const a = createInitialState(dailySeed('2026-09-28'), 240, dailyRunOptions());
    const b = createInitialState(dailySeed('2026-09-28'), 240, dailyRunOptions());
    expect(a.rogue.map).toEqual(b.rogue.map);
  });

  it('names the board by day and tracks one attempt per day', () => {
    expect(dailyBoard('2026-09-28')).toBe('daily:2026-09-28');
    const save = defaultSave();
    expect(dailyPlayed(save, '2026-09-28')).toBe(false);
    save.dailyPlayed = '2026-09-28';
    expect(dailyPlayed(save, '2026-09-28')).toBe(true);
    expect(dailyPlayed(save, '2026-09-29')).toBe(false);
  });

  it('uses the base ship regardless of hangar upgrades', () => {
    const o = dailyRunOptions();
    expect(o.rerolls).toBe(0);
    expect(o.beatLock).toBe(false);
    expect(o.ship.maxBullets).toBe(3);
  });
});
