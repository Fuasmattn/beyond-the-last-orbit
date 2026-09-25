import { noteToMidi } from '../../audio/pattern';

/** Join bar strings with visual bar separators (ignored by the parser). */
export const bars = (...b: string[]): string => b.join(' | ');

/** `n` copies of a token, space separated. */
export const rep = (token: string, n: number): string => new Array<string>(n).fill(token).join(' ');

export const EMPTY = '................';
export const BACKBEAT = '....x.......x...';
/** Half-time: snare on beat 3 only (breakdowns). */
export const HALF_TIME = '........x.......';
export const EIGHTH_HAT = 'x.x.x.x.x.x.x.x.';
export const QUARTERS = 'x...x...x...x...';
export const EIGHTH_KICK = 'x.x.x.x.x.x.x.x.';
export const GALLOP_KICK = 'x.xxx.xxx.xxx.xx';
export const DOUBLE_KICK = 'xxxxxxxxxxxxxxxx';
export const SKANK_KICK = 'x...x...x...x...';
export const SKANK_SNARE = '..x...x...x...x.';
/** Blast beat halves: kick and snare alternate on 16ths. */
export const BLAST_KICK = 'x.x.x.x.x.x.x.x.';
export const BLAST_SNARE = '.x.x.x.x.x.x.x.x';

function tokens(src: string): string[] {
  return src.split(/\s+/).filter((t) => t !== '' && t !== '|');
}

/**
 * Drum lane that hits wherever the guitar pattern starts a note, so the kick locks to the chugs
 * (the core of a metalcore riff). Separators and bar layout carry over.
 */
export function hits(guitar: string): string {
  return tokens(guitar)
    .map((t) => (t === '.' || t === '-' ? '.' : 'x'))
    .join('');
}

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

function midiToName(midi: number): string {
  return `${SHARP_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Natural minor pitch classes above `root` (0 = C). */
export function minorScale(root: number): number[] {
  return [0, 2, 3, 5, 7, 8, 10].map((i) => (root + i) % 12);
}

/**
 * Twin-guitar harmony: moves every note `degrees` scale steps (−2 = a diatonic third below) within
 * `scale`. Notes outside the scale (leading tones, chromatic passing notes) drop a major third. Rests, sustains and flags are kept.
 */
export function harmonize(src: string, scale: readonly number[], degrees = -2): string {
  return src
    .split(/(\s+)/)
    .map((tok) => {
      const m = /^([A-G](?:#|b)?-?\d)([pno]*)$/.exec(tok);
      if (!m) return tok;
      const midi = noteToMidi(m[1]!);
      const idx = scale.indexOf(((midi % 12) + 12) % 12);
      if (idx < 0) return midiToName(midi - 4) + m[2];
      let target = midi;
      let i = idx;
      const dir = Math.sign(degrees);
      for (let k = 0; k < Math.abs(degrees); k++) {
        const next = (i + dir + scale.length) % scale.length;
        target += (((scale[next]! - scale[i]!) * dir + 12) % 12) * dir;
        i = next;
      }
      return midiToName(target) + m[2];
    })
    .join('');
}
