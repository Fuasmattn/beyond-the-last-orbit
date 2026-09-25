const NOTE_RE = /^([A-G])(#|b)?(-?\d)$/;
/** A note token: pitch, then optional flags — `p` palm mute, `n` single note, `o` octave. */
const TOKEN_RE = /^([A-G](?:#|b)?-?\d)([pno]*)$/;
const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteToMidi(name: string): number {
  const m = NOTE_RE.exec(name);
  if (!m) throw new Error(`bad note "${name}"`);
  const [, letter, accidental, octave] = m;
  return (Number(octave) + 1) * 12 + SEMITONES[letter!]! + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
}

/** Rhythm guitar voicing: power chord (root, fifth, octave), a single string, or root + octave. */
export type Voicing = 'power' | 'single' | 'octave';

export interface NoteEvent {
  step: number;
  midi: number;
  /** Length in 16th steps. */
  len: number;
  mute: boolean;
  voicing: Voicing;
}

function tokens(src: string): string[] {
  return src.split(/\s+/).filter((t) => t !== '' && t !== '|');
}

export function parseNotePattern(src: string): { events: NoteEvent[]; steps: number } {
  const toks = tokens(src);
  const events: NoteEvent[] = [];
  let current: NoteEvent | null = null;
  toks.forEach((tok, step) => {
    if (tok === '.') {
      current = null;
    } else if (tok === '-') {
      if (!current) throw new Error(`sustain without note at step ${step}`);
      current.len++;
    } else {
      const m = TOKEN_RE.exec(tok);
      if (!m) throw new Error(`bad note "${tok}" at step ${step}`);
      const flags = m[2]!;
      const voicing: Voicing = flags.includes('n') ? 'single' : flags.includes('o') ? 'octave' : 'power';
      current = { step, midi: noteToMidi(m[1]!), len: 1, mute: flags.includes('p'), voicing };
      events.push(current);
    }
  });
  return { events, steps: toks.length };
}

const DRUM_LEVELS: Record<string, number> = { '.': 0, x: 1, X: 2, o: 2 };

export function parseDrumPattern(src: string): number[] {
  const out: number[] = [];
  for (const ch of src) {
    if (ch === '|' || /\s/.test(ch)) continue;
    const level = DRUM_LEVELS[ch];
    if (level === undefined) throw new Error(`bad drum char "${ch}"`);
    out.push(level);
  }
  return out;
}
