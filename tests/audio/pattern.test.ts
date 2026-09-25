import { describe, expect, it } from 'vitest';
import { noteToMidi, parseDrumPattern, parseNotePattern } from '../../src/audio/pattern';

describe('noteToMidi', () => {
  it('converts scientific pitch names', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('E2')).toBe(40);
    expect(noteToMidi('F#2')).toBe(42);
    expect(noteToMidi('C-1')).toBe(0);
    expect(noteToMidi('Bb1')).toBe(34);
    expect(noteToMidi('Db2')).toBe(37);
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
      { step: 0, midi: 40, len: 1, mute: true, voicing: 'power' },
      { step: 2, midi: 40, len: 3, mute: false, voicing: 'power' },
      { step: 5, midi: 43, len: 2, mute: false, voicing: 'power' },
    ]);
  });

  it('parses voicing flags', () => {
    const p = parseNotePattern('C2pn G3o Eb4n');
    expect(p.events.map((e) => [e.midi, e.mute, e.voicing])).toEqual([
      [36, true, 'single'],
      [55, false, 'octave'],
      [63, false, 'single'],
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
