import { describe, expect, it } from 'vitest';
import { harmonize, hits, minorScale } from '../../src/data/songs/common';

describe('song helpers', () => {
  it('hits marks note onsets only', () => {
    expect(hits('C2p . C2 - | Eb2 -')).toBe('x.x.x.');
  });

  it('harmonizes a diatonic third below in C minor', () => {
    const cMinor = minorScale(0);
    expect(harmonize('C5 - Bb4 . Eb5n D5', cMinor)).toBe('G#4 - G4 . C5n A#4');
  });

  it('harmonizes a third above', () => {
    expect(harmonize('C5 G4', minorScale(0), 2)).toBe('D#5 A#4');
  });
});
