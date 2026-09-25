import { describe, expect, it } from 'vitest';
import {
  insertHighscore,
  loadSave,
  memoryStore,
  parseSave,
  qualifiesForHighscore,
  writeSave,
} from '../../src/persist/save';
import { defaultSave, MAX_HIGHSCORES, type HighscoreEntry } from '../../src/persist/schema';

const entry = (score: number): HighscoreEntry => ({
  initials: 'ABC',
  score,
  world: 0,
  stage: 1,
  loop: 0,
  date: '2026-09-24',
});

describe('parseSave', () => {
  it('returns defaults for a fresh install', () => {
    expect(parseSave(null)).toEqual({ data: defaultSave(), reset: false });
  });

  it('resets on garbage JSON', () => {
    expect(parseSave('{nope').reset).toBe(true);
  });

  it('resets on unknown versions', () => {
    expect(parseSave(JSON.stringify({ version: 99 })).reset).toBe(true);
  });

  it('round-trips a valid save', () => {
    const d = defaultSave();
    d.credits = 123;
    d.highscores = [entry(500)];
    expect(parseSave(JSON.stringify(d))).toEqual({ data: d, reset: false });
  });

  it('sanitizes bad fields instead of failing', () => {
    const r = parseSave(
      JSON.stringify({
        version: 1,
        credits: -5,
        highscores: [{ bogus: true }, entry(10)],
        owned: ['skin.gold', 7],
        equipped: { skin: 42 },
        settings: { musicVolume: 3, crt: 'yes' },
      }),
    );
    expect(r.reset).toBe(false);
    expect(r.data.credits).toBe(0);
    expect(r.data.highscores).toEqual([entry(10)]);
    expect(r.data.owned).toContain('skin.gold');
    expect(r.data.owned).toContain('skin.classic');
    expect(r.data.equipped.skin).toBe('skin.classic');
    expect(r.data.settings.musicVolume).toBe(1);
    expect(r.data.settings.crt).toBe(true);
  });
});

describe('v1 → v2 migration', () => {
  it('keeps v1 data and adds empty rogue table and upgrades', () => {
    const v1 = { version: 1, credits: 50, highscores: [entry(10)], owned: [], equipped: {}, settings: {} };
    const r = parseSave(JSON.stringify(v1));
    expect(r.reset).toBe(false);
    expect(r.data.version).toBe(2);
    expect(r.data.credits).toBe(50);
    expect(r.data.highscores).toEqual([entry(10)]);
    expect(r.data.rogueHighscores).toEqual([]);
    expect(r.data.upgrades).toEqual({});
  });

  it('sanitizes upgrade levels', () => {
    const r = parseSave(JSON.stringify({ ...defaultSave(), upgrades: { hull: 2.7, cannon: -1, bad: 'x' } }));
    expect(r.data.upgrades).toEqual({ hull: 2 });
  });
});

describe('loadSave / writeSave', () => {
  it('round-trips through a store', () => {
    const store = memoryStore();
    const d = defaultSave();
    d.credits = 9;
    expect(writeSave(store, d)).toBe(true);
    expect(loadSave(store).data.credits).toBe(9);
  });

  it('survives a throwing store', () => {
    const bad = {
      getItem(): string | null {
        throw new Error('denied');
      },
      setItem(): void {
        throw new Error('denied');
      },
    };
    expect(loadSave(bad).data).toEqual(defaultSave());
    expect(writeSave(bad, defaultSave())).toBe(false);
  });
});

describe('highscores', () => {
  it('qualifies any positive score while there is room', () => {
    expect(qualifiesForHighscore([], 1)).toBe(true);
    expect(qualifiesForHighscore([], 0)).toBe(false);
  });

  it('requires beating the last entry when full', () => {
    const full = Array.from({ length: MAX_HIGHSCORES }, (_, i) => entry(1000 - i * 10));
    expect(qualifiesForHighscore(full, 910)).toBe(false);
    expect(qualifiesForHighscore(full, 911)).toBe(true);
  });

  it('inserts sorted and keeps the top ten', () => {
    let list: HighscoreEntry[] = [];
    for (let i = 0; i < 12; i++) list = insertHighscore(list, entry(i * 100));
    expect(list).toHaveLength(MAX_HIGHSCORES);
    expect(list[0]!.score).toBe(1100);
    expect(list[list.length - 1]!.score).toBe(200);
  });
});
