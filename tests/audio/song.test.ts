import { describe, expect, it } from 'vitest';
import { BeatClock } from '../../src/audio/beatClock';
import {
  compileSong,
  nextBarStep,
  resolveStep,
  STEPS_PER_BAR,
  stepsInWindow,
  type SongDef,
} from '../../src/audio/song';
import { EARTH_SONG } from '../../src/data/songs/earth';

const tiny: SongDef = {
  name: 'tiny',
  bpm: 120,
  sections: {
    a: {
      bars: 1,
      guitar: 'E2 - - - . . . . . . . . . . . .',
      kick: 'x...............',
      snare: '................',
      hat: '................',
    },
    b: {
      bars: 1,
      guitar: 'G2 . . . . . . . . . . . . . . .',
      kick: '....x...........',
      snare: '................',
      hat: '................',
    },
  },
  arrangements: {
    main: { order: ['a', 'b'], loopFrom: 1 },
    alt: { order: ['b'], loopFrom: 0 },
  },
};

describe('compileSong', () => {
  it('lays out each arrangement with offsets', () => {
    const song = compileSong(tiny);
    const main = song.arrangements.main!;
    expect(main.totalSteps).toBe(32);
    expect(main.loopStartStep).toBe(16);
    expect(main.entries.map((e) => [e.section.name, e.offset])).toEqual([
      ['a', 0],
      ['b', 16],
    ]);
    expect(main.entries[0]!.section.guitar[0]).toMatchObject({ midi: 40, len: 4 });
    expect(main.entries[0]!.section.crash).toHaveLength(16);
    expect(song.arrangements.alt!.totalSteps).toBe(16);
  });

  it('rejects tracks with the wrong length', () => {
    const bad: SongDef = {
      ...tiny,
      sections: { ...tiny.sections, a: { ...tiny.sections.a!, kick: 'x...' } },
    };
    expect(() => compileSong(bad)).toThrow(/a\.kick/);
  });

  it('rejects unknown sections in an arrangement', () => {
    expect(() =>
      compileSong({ ...tiny, arrangements: { main: { order: ['a', 'zzz'], loopFrom: 0 } } }),
    ).toThrow(/zzz/);
  });
});

describe('resolveStep', () => {
  const main = compileSong(tiny).arrangements.main!;

  it('finds section and local step', () => {
    expect(resolveStep(main, 3)).toMatchObject({ step: 3, section: { name: 'a' } });
    expect(resolveStep(main, 20)).toMatchObject({ step: 4, section: { name: 'b' } });
  });

  it('loops from loopFrom after the end', () => {
    expect(resolveStep(main, 32)).toMatchObject({ step: 0, section: { name: 'b' } });
    expect(resolveStep(main, 49)).toMatchObject({ step: 1, section: { name: 'b' } });
  });

  it('returns null before the start', () => {
    expect(resolveStep(main, -1)).toBeNull();
  });
});

describe('nextBarStep', () => {
  const clock = new BeatClock(120, 0); // 16th = 0.125 s, bar = 2 s

  it('rounds up to the next bar line', () => {
    expect(nextBarStep(clock, 0)).toBe(0);
    expect(nextBarStep(clock, 0.01)).toBe(16);
    expect(nextBarStep(clock, 2)).toBe(16);
    expect(nextBarStep(clock, 2.01)).toBe(32);
  });
});

describe('stepsInWindow', () => {
  const clock = new BeatClock(120, 0);

  it('lists 16th steps inside a half-open window', () => {
    expect(stepsInWindow(clock, 0, 1).map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('partitions contiguous windows without gaps or duplicates', () => {
    const a = stepsInWindow(clock, 0, 0.3).map((s) => s.index);
    const b = stepsInWindow(clock, 0.3, 1).map((s) => s.index);
    expect([...a, ...b]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('skips negative steps before the start', () => {
    expect(stepsInWindow(new BeatClock(120, 1), 0.8, 1.1).map((s) => s.index)).toEqual([0]);
  });
});

describe('EARTH_SONG', () => {
  it('compiles main and boss arrangements at 140 BPM', () => {
    const song = compileSong(EARTH_SONG);
    expect(song.bpm).toBe(140);
    for (const name of ['main', 'boss', 'bossFinal']) {
      const arr = song.arrangements[name];
      expect(arr, name).toBeDefined();
      expect(arr!.totalSteps % STEPS_PER_BAR).toBe(0);
    }
    expect(song.arrangements.main!.totalSteps).toBeGreaterThan(STEPS_PER_BAR * 16);
  });
});
