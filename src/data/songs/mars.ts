import type { SongDef } from '../../audio/song';
import { BACKBEAT, bars, DOUBLE_KICK, EIGHTH_HAT, EMPTY, rep, SKANK_KICK, SKANK_SNARE } from './common';

const SKANK = {
  kick: bars(SKANK_KICK, SKANK_KICK, SKANK_KICK, SKANK_KICK),
  snare: bars(SKANK_SNARE, SKANK_SNARE, SKANK_SNARE, SKANK_SNARE),
  hat: bars(EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT),
};
const THRASH_1 = 'D2p D2p D2p D2p D2p D2p F2 - D2p D2p D2p D2p D2p D2p G#2 -';
const CHROMATIC_1 = 'D2p . D2p D2p D#2 - . D2p . D2p D2p . C3 - A#2 -';

/** World 3 — Mars Orbit. D minor, 160 BPM, thrash / speed metal. */
export const MARS_SONG: SongDef = {
  name: 'Red Planet Thrash',
  bpm: 160,
  sections: {
    intro: {
      bars: 2,
      guitar: bars('D2 - - - - - - - - - - - - - - -', rep('D2p', 16)),
      kick: bars('X...............', DOUBLE_KICK),
      snare: bars(EMPTY, '........x.x.xxxx'),
      hat: bars(EMPTY, EMPTY),
      crash: bars('X...............', EMPTY),
    },
    A: {
      bars: 4,
      guitar: bars(
        THRASH_1,
        'D2p D2p D2p D2p D2p D2p F2 - D2p D2p D2p D2p G2 - F2 -',
        THRASH_1,
        'D2p D2p D2p D2p D2p D2p F2 - E2 - F2 - G2 - A2 -',
      ),
      ...SKANK,
      crash: bars('X...............', EMPTY, EMPTY, EMPTY),
    },
    B: {
      bars: 4,
      guitar: bars(
        CHROMATIC_1,
        'D2p . D2p D2p D#2 - . D2p . D2p D2p . F2 - E2 -',
        CHROMATIC_1,
        'D2p . D2p D2p D#2 - . D2p A2 - - - A2 - G#2 -',
      ),
      kick: bars(DOUBLE_KICK, DOUBLE_KICK, DOUBLE_KICK, DOUBLE_KICK),
      snare: bars(BACKBEAT, BACKBEAT, BACKBEAT, '....x.......x.xx'),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('x...............', EMPTY, EMPTY, EMPTY),
    },
    chorus: {
      bars: 4,
      guitar: bars(
        'A#2 - - - - - - - C3 - - - - - - -',
        'D3 - - - - - - - D3 - - - C3 - A2 -',
        'A#2 - - - - - - - C3 - - - - - - -',
        'A2 - - - - - - - A2 - - - C#3 - E3 -',
      ),
      lead: bars(
        'D5 - - - F5 - - - E5 - - - C5 - - -',
        'D5 - - - - - - - A4 - C5 - D5 - - -',
        'D5 - - - F5 - - - G5 - - - A5 - - -',
        'G5 - F5 - E5 - - - C#5 - - - - - - -',
      ),
      ...SKANK,
      crash: bars('X...............', EMPTY, 'X...............', EMPTY),
    },
    breakdown: {
      bars: 2,
      guitar: bars('D2p . . D2p . . D2p . . . D2p . D2p . . .', 'D2p . . D2p . . D2p . D#2 - - - E2 - - -'),
      kick: bars('x..x..x...x.x...', 'x..x..x.x...x...'),
      snare: bars('........x.......', '........x...xxxx'),
      hat: bars(EMPTY, EMPTY),
    },
    bossRiff: {
      bars: 2,
      guitar: bars(
        'D2p D2p D2p D2p D#2 - D2p D2p D2p D2p D2p D2p G#2 - G2 -',
        'D2p D2p D2p D2p D#2 - D2p D2p F2 - E2 - D#2 - D2 -',
      ),
      kick: bars(DOUBLE_KICK, DOUBLE_KICK),
      snare: bars(SKANK_SNARE, '..x...x...x.xxxx'),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('X...............', EMPTY),
    },
    bossFinal: {
      bars: 2,
      guitar: bars(
        `${rep('D2p', 8)} ${rep('F2p', 4)} ${rep('E2p', 4)}`,
        `${rep('D2p', 8)} ${rep('G#2p', 4)} ${rep('G2p', 4)}`,
      ),
      lead: bars('D5 - - - - - - - C#5 - - - C5 - - -', 'B4 - - - A#4 - - - A4 - - - G#4 - - -'),
      kick: bars(DOUBLE_KICK, DOUBLE_KICK),
      snare: bars('x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.xxxx'),
      hat: bars(EMPTY, EMPTY),
      crash: bars('X...............', '........X.......'),
    },
  },
  arrangements: {
    main: { order: ['intro', 'A', 'A', 'B', 'chorus', 'A', 'B', 'chorus', 'breakdown'], loopFrom: 1 },
    boss: { order: ['bossRiff'], loopFrom: 0 },
    bossFinal: { order: ['bossFinal'], loopFrom: 0 },
  },
};
