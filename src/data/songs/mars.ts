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

const B_MINOR = minorScale(11);

// Drop B. Syncopated chugs with the phrygian C and a D stab.
const VERSE_A = 'B1p B1p . B1p . B1p B1p . C2 - B1p . B1p B1p . .';
const VERSE_B = 'B1p B1p . B1p . B1p B1p . D2 - B1p . C2 - B1p .';
const VERSE = bars(VERSE_A, VERSE_B, VERSE_A, 'B1p B1p . B1p . B1p B1p . G2 - - - F#2 - - -');

// Chorus: G – D – A – Bm (VI–III–VII–i).
const CHORUS_LEAD = bars(
  'B4 - - - A4 - B4 - D5 - - - C#5 - B4 -',
  'A4 - - - - - F#4 - A4 - B4 - C#5 - - -',
  'C#5 - - - B4 - A4 - E4 - - - F#4 - A4 -',
  'B4 - - - - - - - - - - - . . . .',
);

// Breakdown: half-time, phrygian C and a tritone F for weight.
const BREAK_A = 'B1p . . . B1p . . B1p . . B1p . C2 - - -';
const BREAKDOWN = bars(
  BREAK_A,
  'B1p . . . B1p . . B1p . . B1p . F2 - - -',
  BREAK_A,
  'B1p . . . B1p . . B1p B1p B1p B1p B1p C2 - B1 -',
);

const BOSS = bars(
  'B1p B1p C2n B1p B1p D2n B1p B1p C2n B1p F2 - E2 - D2 -',
  'B1p B1p C2n B1p B1p D2n B1p B1p G2 - F#2 - F2 - E2 -',
);

const FINAL_LEAD = bars('F#5 - - - - - - - E5 - - - D5 - - -', 'C#5 - - - - - - - D5 - - - E5 - - -');

/** World 3 — Mars Orbit. Drop B, B minor, 160 BPM: aggressive metalcore. */
export const MARS_SONG: SongDef = {
  name: 'Red Line',
  bpm: 160,
  sections: {
    intro: {
      bars: 2,
      guitar: bars('B1 - - - - - - - - - - - - - - -', 'C2 - - - - - - - B1p B1p B1p B1p B1p B1p B1p B1p'),
      kick: bars('x...............', 'x.......xxxxxxxx'),
      snare: bars(EMPTY, '........x.x.xxxx'),
      hat: bars(EMPTY, EMPTY),
      crash: bars('X...............', EMPTY),
    },
    verse: {
      bars: 4,
      guitar: VERSE,
      kick: hits(VERSE),
      snare: bars(BACKBEAT, BACKBEAT, BACKBEAT, BACKBEAT),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('X...............', EMPTY, EMPTY, EMPTY),
    },
    pre: {
      bars: 2,
      guitar: bars(
        'G2 - - - G2p G2p G2p G2p A2 - - - A2p A2p A2p A2p',
        'B2 - - - B2p B2p B2p B2p F#2 - - - F#2p F#2p F#2p F#2p',
      ),
      kick: bars(DOUBLE_KICK, DOUBLE_KICK),
      snare: bars(BACKBEAT, '....x.......x.xx'),
      hat: bars(EMPTY, EMPTY),
      crash: bars('x...............', EMPTY),
      china: bars(QUARTERS, QUARTERS),
    },
    chorus: {
      bars: 4,
      guitar: bars(
        'G2 - - - - - - - G2 - - - G2 - G2 -',
        'D2 - - - - - - - D2 - - - D2 - D2 -',
        'A2 - - - - - - - A2 - - - A2 - A2 -',
        'B1 - - - - - - - B1 - - - A2 - F#2 -',
      ),
      lead: CHORUS_LEAD,
      lead2: harmonize(CHORUS_LEAD, B_MINOR),
      kick: bars(EIGHTH_KICK, EIGHTH_KICK, EIGHTH_KICK, 'x.x.x.x.x.x.xxxx'),
      snare: bars(BACKBEAT, BACKBEAT, BACKBEAT, '....x.......x.x.'),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('X...............', 'X...............', 'X...............', 'X...............'),
    },
    breakdown: {
      bars: 4,
      guitar: BREAKDOWN,
      kick: hits(BREAKDOWN),
      snare: bars(HALF_TIME, HALF_TIME, HALF_TIME, '........x...xxxx'),
      hat: bars(EMPTY, EMPTY, EMPTY, EMPTY),
      crash: bars('X...............', EMPTY, EMPTY, EMPTY),
      china: bars(QUARTERS, QUARTERS, QUARTERS, 'x...x...........'),
    },
    bossRiff: {
      bars: 2,
      guitar: BOSS,
      kick: bars(DOUBLE_KICK, DOUBLE_KICK),
      snare: bars(BACKBEAT, '....x.......x.xx'),
      hat: bars(EMPTY, EMPTY),
      crash: bars('X...............', EMPTY),
      china: bars(QUARTERS, QUARTERS),
    },
    bossFinal: {
      bars: 2,
      guitar: bars(`${rep('B2', 8)} ${rep('G2', 8)}`, `${rep('A2', 8)} ${rep('F#2', 8)}`),
      lead: FINAL_LEAD,
      lead2: harmonize(FINAL_LEAD, B_MINOR),
      kick: bars(BLAST_KICK, BLAST_KICK),
      snare: bars(BLAST_SNARE, BLAST_SNARE),
      hat: bars(EMPTY, EMPTY),
      crash: bars('X.......x.......', 'X.......x.......'),
    },
  },
  arrangements: {
    main: { order: ['intro', 'verse', 'pre', 'chorus', 'verse', 'pre', 'chorus', 'breakdown'], loopFrom: 1 },
    boss: { order: ['bossRiff'], loopFrom: 0 },
    bossFinal: { order: ['bossFinal'], loopFrom: 0 },
  },
};
