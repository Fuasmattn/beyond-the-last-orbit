import { describe, expect, it } from 'vitest';
import { noteToMidi, parseDrumPattern, parseNotePattern } from '../../src/audio/pattern';

describe('noteToMidi', () => {
  it('converts scientific pitch names', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('E2')).toBe(40);
    expect(noteToMidi('F#2')).toBe(42);
    expect(noteToMidi('C-1')).toBe(0);
  });

  it('rejects garbage', () => {
    expect(() => noteToMidi('H2')).toThrow();
  });
});

describe('parseNotePattern', () => {
  it('parses notes, sustains, rests and palm mutes', () => {
    const p = parseNotePattern('E2p . E2 - - | G2 -');
    expect(p.steps).toBe(7);
    expect(p.events).toEqual([
      { step: 0, midi: 40, len: 1, mute: true },
      { step: 2, midi: 40, len: 3, mute: false },
      { step: 5, midi: 43, len: 2, mute: false },
    ]);
  });

  it('rejects a sustain with nothing to sustain', () => {
    expect(() => parseNotePattern('. -')).toThrow(/step 1/);
  });
});

describe('parseDrumPattern', () => {
  it('maps hits and accents', () => {
    expect(parseDrumPattern('x.X. o|x')).toEqual([1, 0, 2, 0, 2, 1]);
  });

  it('rejects unknown chars', () => {
    expect(() => parseDrumPattern('x?')).toThrow();
  });
});
