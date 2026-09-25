import { describe, expect, it } from 'vitest';
import { compileSong, STEPS_PER_BAR, type SongDef } from '../../src/audio/song';
import { EARTH_SONG } from '../../src/data/songs/earth';
import { MARS_SONG } from '../../src/data/songs/mars';
import { MOON_SONG } from '../../src/data/songs/moon';
import { WORLDS } from '../../src/data/worlds';

const SONGS: Record<string, SongDef> = { earth: EARTH_SONG, moon: MOON_SONG, mars: MARS_SONG };

describe('world songs', () => {
  it('exist for every world at the world BPM', () => {
    for (const w of WORLDS) {
      const song = SONGS[w.id];
      expect(song, w.id).toBeDefined();
      expect(song!.bpm).toBe(w.bpm);
    }
  });

  it('compile with main, boss and bossFinal arrangements', () => {
    for (const [id, def] of Object.entries(SONGS)) {
      const song = compileSong(def);
      for (const name of ['main', 'boss', 'bossFinal']) {
        const arr = song.arrangements[name];
        expect(arr, `${id}.${name}`).toBeDefined();
        expect(arr!.totalSteps % STEPS_PER_BAR).toBe(0);
      }
    }
  });

  it('gives Earth and the Moon twin harmony leads and a single-note intro', () => {
    for (const def of [EARTH_SONG, MOON_SONG]) {
      const song = compileSong(def);
      const section = (name: string) => song.arrangements.main!.entries.find((e) => e.section.name === name)!.section;
      expect(section('harmony').lead.some(Boolean), def.name).toBe(true);
      expect(section('harmony').lead2.some(Boolean), def.name).toBe(true);
      expect(section('intro').guitar.filter(Boolean).every((n) => n!.voicing === 'single'), def.name).toBe(true);
    }
  });

  it('rejects a harmony track with the wrong length', () => {
    const bad: SongDef = {
      ...MOON_SONG,
      sections: { ...MOON_SONG.sections, intro: { ...MOON_SONG.sections.intro!, lead2: 'A4 - -' } },
    };
    expect(() => compileSong(bad)).toThrow(/intro\.lead2/);
  });
});
