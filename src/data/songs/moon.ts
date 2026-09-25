import type { SongDef } from '../../audio/song';
import {
  BACKBEAT,
  bars,
  BLAST_KICK,
  BLAST_SNARE,
  DOUBLE_KICK,
  EIGHTH_HAT,
  EIGHTH_KICK,
  EMPTY,
  HALF_TIME,
  harmonize,
  hits,
  minorScale,
  QUARTERS,
  rep,
} from './common';

const D_MINOR = minorScale(2);

// Clean-sounding single-note arpeggio over a pedal A (melodic metalcore intro).
const INTRO = bars(
  'D4n - A3n - F4n - A3n - E4n - A3n - F4n - A3n -',
  'D4n - A3n - F4n - A3n - G4n - A3n - F4n - E4n -',
  'D4n - A3n - F4n - A3n - E4n - A3n - F4n - A3n -',
  'C4n - G3n - E4n - G3n - F4n - - - E4n - - -',
);

const HARMONY_RHYTHM = bars(
  'D2p D2p . D2p D2p . D2p . Bb2 - - - Bb2p Bb2p Bb2p Bb2p',
  'F2 - - - F2p F2p F2p F2p C2 - - - C2p C2p C2p C2p',
  'D2p D2p . D2p D2p . D2p . Bb2 - - - Bb2p Bb2p Bb2p Bb2p',
  'G2 - - - G2p G2p G2p G2p A2 - - - A2p A2p A2p A2p',
);
const HARMONY_LEAD = bars(
  'A4 - D5 - F5 - E5 - D5 - - - A4 - Bb4 -',
  'C5 - A4 - F4 - A4 - G4 - - - E4 - - -',
  'A4 - D5 - F5 - G5 - A5 - - - G5 - F5 -',
  'E5 - - - D5 - C#5 - D5 - - - - - - -',
);

const VERSE_A = 'D2p . D2p . . D2p D2p . D2p . . D2p F2 - E2 -';
const VERSE_B = 'D2p . D2p . . D2p D2p . D2p . . D2p C3 - Bb2 -';
const VERSE = bars(VERSE_A, VERSE_B, VERSE_A, 'D2p . D2p . . D2p D2p . Bb2 - - - A2 - - -');

// Chorus: Bb – F – C – Dm (VI–III–VII–i).
const CHORUS_LEAD = bars(
  'D5 - - - C5 - D5 - F5 - - - E5 - D5 -',
  'C5 - - - - - A4 - C5 - D5 - E5 - - -',
  'E5 - - - D5 - C5 - G4 - - - A4 - C5 -',
  'D5 - - - - - - - - - - - . . . .',
);

// Breakdown on the open low C: four groups of three, then a full stop before the loop.
const BREAK_A = 'C2p . . C2p . . C2p . . C2p . . C2p . C2p .';
const BREAKDOWN = bars(BREAK_A, 'C2p . . C2p . . C2p . . C2p . . Eb2 - D2 -', BREAK_A, 'C2p . . C2p . . C2p . . . . . . . . .');

const FINAL_LEAD = bars('A5 - - - - - - - G5 - - - F5 - - -', 'E5 - - - - - - - C#5 - - - - - - -');

/** World 2 — Lunar Orbit. Drop C, D minor, 150 BPM: melodic metalcore with twin leads. */
export const MOON_SONG: SongDef = {
  name: 'Tidal Lock',
  bpm: 150,
  sections: {
    intro: {
      bars: 4,
      guitar: INTRO,
      kick: bars('x...............', 'x.......x.......', 'x...x...x...x...', 'x.x.x.x.xxxxxxxx'),
      snare: bars(EMPTY, EMPTY, '............x...', '....x...x.x.xxxx'),
      hat: bars(EMPTY, QUARTERS, EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('x...............', EMPTY, EMPTY, EMPTY),
    },
    harmony: {
      bars: 4,
      guitar: HARMONY_RHYTHM,
      lead: HARMONY_LEAD,
      lead2: harmonize(HARMONY_LEAD, D_MINOR),
      kick: hits(HARMONY_RHYTHM),
      snare: bars(BACKBEAT, BACKBEAT, BACKBEAT, BACKBEAT),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('X...............', EMPTY, 'x...............', EMPTY),
    },
    verse: {
      bars: 4,
      guitar: VERSE,
      kick: hits(VERSE),
      snare: bars(BACKBEAT, BACKBEAT, BACKBEAT, BACKBEAT),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('x...............', EMPTY, EMPTY, EMPTY),
    },
    chorus: {
      bars: 4,
      guitar: bars(
        'Bb2 - - - - - - - Bb2 - - - Bb2 - Bb2 -',
        'F2 - - - - - - - F2 - - - F2 - F2 -',
        'C2 - - - - - - - C2 - - - C2 - C2 -',
        'D2 - - - - - - - D2 - - - F2 - E2 -',
      ),
      lead: CHORUS_LEAD,
      lead2: harmonize(CHORUS_LEAD, D_MINOR),
      kick: bars(EIGHTH_KICK, EIGHTH_KICK, EIGHTH_KICK, 'x.x.x.x.x.x.xxxx'),
      snare: bars(BACKBEAT, BACKBEAT, BACKBEAT, '....x.......x.x.'),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('X...............', 'X...............', 'X...............', 'X...............'),
    },
    breakdown: {
      bars: 4,
      guitar: BREAKDOWN,
      kick: hits(BREAKDOWN),
      snare: bars(HALF_TIME, HALF_TIME, HALF_TIME, HALF_TIME),
      hat: bars(EMPTY, EMPTY, EMPTY, EMPTY),
      crash: bars('X...............', EMPTY, EMPTY, EMPTY),
      china: bars(QUARTERS, QUARTERS, QUARTERS, 'x...x...x.......'),
    },
    bossRiff: {
      bars: 2,
      guitar: bars(
        'D2p D2p D2p D2p F2n E2n D2p D2p D2p D2p A2n G#2n D2p D2p Bb2 -',
        'D2p D2p D2p D2p F2n E2n D2p D2p C3 - Bb2 - A2 - G#2 -',
      ),
      kick: bars(DOUBLE_KICK, DOUBLE_KICK),
      snare: bars(BACKBEAT, '....x.......x.xx'),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('X...............', EMPTY),
    },
    bossFinal: {
      bars: 2,
      guitar: bars(`${rep('D3', 8)} ${rep('Bb2', 8)}`, `${rep('C3', 8)} ${rep('A2', 8)}`),
      lead: FINAL_LEAD,
      lead2: harmonize(FINAL_LEAD, D_MINOR),
      kick: bars(BLAST_KICK, BLAST_KICK),
      snare: bars(BLAST_SNARE, BLAST_SNARE),
      hat: bars(EMPTY, EMPTY),
      crash: bars('X.......x.......', 'X.......x.......'),
    },
  },
  arrangements: {
    main: { order: ['intro', 'harmony', 'verse', 'chorus', 'harmony', 'verse', 'chorus', 'breakdown'], loopFrom: 1 },
    boss: { order: ['bossRiff'], loopFrom: 0 },
    bossFinal: { order: ['bossFinal'], loopFrom: 0 },
  },
};
