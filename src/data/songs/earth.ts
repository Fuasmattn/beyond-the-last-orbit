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

const C_MINOR = minorScale(0);

// Drop C. Verse chugs sit on the open low C with a phrygian Db stab; the kick doubles every chug.
const VERSE_A = 'C2p . C2p C2p . C2p . C2p C2p . C2p . Db2 - C2p .';
const VERSE_B = 'C2p . C2p C2p . C2p . C2p C2p . C2p . Eb2 - D2 -';
const VERSE_END = 'C2p . C2p C2p . C2p . C2p Ab2 - - - G2 - - -';
const VERSE = bars(VERSE_A, VERSE_B, VERSE_A, VERSE_END);

// Breakdown: 3+3+2 / 3+3 groupings against half-time snare and china.
const BREAK_A = 'C2p . . C2p . . C2p . . . C2p . . C2p . .';
const BREAK_B = 'C2p . . C2p . . C2p . Db2 - - - - - . .';
const BREAK_END = 'C2p . . C2p . . C2p . C2p C2p C2p C2p Gb2 - F2 -';
const BREAKDOWN = bars(BREAK_A, BREAK_B, BREAK_A, BREAK_END);

const INTRO_LEAD = bars(
  'C5 - - - - - - - Bb4 - - - C5 - Eb5 -',
  'Bb4 - - - - - - - G4 - - - - - - -',
  'F4 - - - G4 - - - Bb4 - - - D5 - - -',
  'C5 - - - - - - - . . . . . . . .',
);

// Chorus: Ab – Eb – Bb – Cm (VI–III–VII–i) with a twin lead a third apart.
const CHORUS_LEAD = bars(
  'C5 - - - Bb4 - C5 - Eb5 - - - D5 - C5 -',
  'Bb4 - - - - - G4 - Bb4 - C5 - D5 - - -',
  'D5 - - - C5 - Bb4 - F4 - - - G4 - Bb4 -',
  'C5 - - - - - - - - - - - . . . .',
);

const BOSS = bars(
  'C2p C2p Db2n C2p C2p C2p Eb2n C2p C2p C2p Db2n C2p Gb2 - F2 -',
  'C2p C2p Db2n C2p C2p C2p Eb2n C2p Ab2 - G2 - Gb2 - F2 -',
);

const FINAL_LEAD = bars('G5 - - - - - - - F5 - - - Eb5 - - -', 'D5 - - - - - - - Eb5 - - - F5 - - -');

/** World 1 — Near Earth Orbit. Drop C, C minor, 140 BPM: modern metalcore. */
export const EARTH_SONG: SongDef = {
  name: 'Low Orbit',
  bpm: 140,
  sections: {
    intro: {
      bars: 4,
      guitar: bars(
        'Ab2 - - - - - - - - - - - - - - -',
        'Eb2 - - - - - - - - - - - - - - -',
        'Bb2 - - - - - - - - - - - - - - -',
        'C3 - - - - - - - C2p C2p C2p C2p C2p C2p C2p C2p',
      ),
      lead: INTRO_LEAD,
      lead2: harmonize(INTRO_LEAD, C_MINOR),
      kick: bars('x...............', 'x.......x.......', 'x.......x...x...', 'x.......xxxxxxxx'),
      snare: bars(EMPTY, EMPTY, '............x...', '........x.x.xxxx'),
      hat: bars(EMPTY, QUARTERS, EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('X...............', EMPTY, 'x...............', EMPTY),
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
      bars: 4,
      guitar: bars(
        'Ab2 - - - Ab2p Ab2p Ab2p Ab2p Bb2 - - - Bb2p Bb2p Bb2p Bb2p',
        'C3 - - - C3p C3p C3p C3p G2 - - - G2p G2p G2p G2p',
        'Ab2 - - - Ab2p Ab2p Ab2p Ab2p Bb2 - - - Bb2p Bb2p Bb2p Bb2p',
        'Ab2 - - - - - - - Bb2 - - - Bb2p Bb2p Bb2p Bb2p',
      ),
      kick: bars(EIGHTH_KICK, EIGHTH_KICK, EIGHTH_KICK, DOUBLE_KICK),
      snare: bars(BACKBEAT, BACKBEAT, BACKBEAT, '....x...x.x.xxxx'),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT, EMPTY),
      crash: bars('x...............', EMPTY, 'x...............', EMPTY),
    },
    chorus: {
      bars: 4,
      guitar: bars(
        'Ab2 - - - - - - - Ab2 - - - Ab2 - Ab2 -',
        'Eb2 - - - - - - - Eb2 - - - Eb2 - Eb2 -',
        'Bb2 - - - - - - - Bb2 - - - Bb2 - Bb2 -',
        'C3 - - - - - - - C3 - - - Bb2 - G2 -',
      ),
      lead: CHORUS_LEAD,
      lead2: harmonize(CHORUS_LEAD, C_MINOR),
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
      china: bars(QUARTERS, EMPTY),
    },
    bossFinal: {
      bars: 2,
      guitar: bars(`${rep('C3', 8)} ${rep('Ab2', 8)}`, `${rep('Bb2', 8)} ${rep('G2', 8)}`),
      lead: FINAL_LEAD,
      lead2: harmonize(FINAL_LEAD, C_MINOR),
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
