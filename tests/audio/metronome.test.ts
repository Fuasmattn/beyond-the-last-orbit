import { describe, expect, it } from 'vitest';
import { compileSong } from '../../src/audio/song';
import { CALIBRATION } from '../../src/data/balance';
import { METRONOME_SONG } from '../../src/data/songs/metronome';

describe('METRONOME_SONG', () => {
  it('compiles to a one-bar click on every beat', () => {
    const song = compileSong(METRONOME_SONG);
    expect(song.bpm).toBe(CALIBRATION.bpm);
    const bar = song.arrangements.main!.entries[0]!.section;
    expect(bar.kick.filter(Boolean)).toHaveLength(4);
  });
});
