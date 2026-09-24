import type { SongDef } from '../../audio/song';
import { BACKBEAT, bars, DOUBLE_KICK, EIGHTH_HAT, EIGHTH_KICK, EMPTY, GALLOP_KICK, rep } from './common';

const GALLOP = 'A2p . A2p A2p A2p . A2p A2p A2p . A2p A2p A2p . A2p A2p';
const RIFF_A = bars(
  GALLOP,
  'A2p . A2p A2p A2p . A2p A2p F2 - - . G2 - - .',
  GALLOP,
  'A2p . A2p A2p A2p . A2p A2p C3 - - . D3 - E3 -',
);
const DRUMS_A = {
  kick: bars(GALLOP_KICK, GALLOP_KICK, GALLOP_KICK, GALLOP_KICK),
  snare: bars(BACKBEAT, BACKBEAT, BACKBEAT, BACKBEAT),
  hat: bars(EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT),
};

/** World 2 — Lunar Orbit. A minor, 150 BPM, galloping riffs with twin harmony leads. */
export const MOON_SONG: SongDef = {
  name: 'Harmony of the Tides',
  bpm: 150,
  sections: {
    intro: {
      bars: 2,
      guitar: bars('A2 - - - - - - - - - - - - - - -', 'F2 - - - - - - - G2 - - - - - - -'),
      kick: bars('X...............', 'x.......x.......'),
      snare: bars(EMPTY, '............xxxx'),
      hat: bars(EMPTY, EMPTY),
      crash: bars('X...............', EMPTY),
    },
    A: { bars: 4, guitar: RIFF_A, ...DRUMS_A, crash: bars('x...............', EMPTY, EMPTY, EMPTY) },
    harmony: {
      bars: 4,
      guitar: RIFF_A,
      lead: bars(
        'A4 - - - C5 - - - B4 - - - A4 - - -',
        'G4 - - - A4 - - - B4 - - - - - - -',
        'A4 - - - C5 - - - D5 - - - E5 - - -',
        'D5 - C5 - B4 - - - C5 - B4 - G4 - - -',
      ),
      lead2: bars(
        'F4 - - - A4 - - - G4 - - - F4 - - -',
        'E4 - - - F4 - - - G4 - - - - - - -',
        'F4 - - - A4 - - - B4 - - - C5 - - -',
        'B4 - A4 - G4 - - - A4 - G4 - E4 - - -',
      ),
      ...DRUMS_A,
    },
    B: {
      bars: 4,
      guitar: bars(
        'A2p A2p . A2p . A2p A2p . C3 - . C3 - . B2 -',
        'A2p A2p . A2p . A2p A2p . D3 - . D3 - . E3 -',
        'A2p A2p . A2p . A2p A2p . C3 - . C3 - . B2 -',
        'A2p A2p . A2p . A2p A2p . F2 - - - E2 - - -',
      ),
      kick: bars('xx.x.xx.x..x..x.', 'xx.x.xx.x..x..x.', 'xx.x.xx.x..x..x.', 'xx.x.xx.x...x...'),
      snare: bars(BACKBEAT, BACKBEAT, BACKBEAT, '....x.......x.xx'),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('x...............', EMPTY, EMPTY, EMPTY),
    },
    chorus: {
      bars: 4,
      guitar: bars(
        'F2 - - - - - - - G2 - - - - - - -',
        'A2 - - - - - - - A2 - - - G2 - E2 -',
        'F2 - - - - - - - G2 - - - - - - -',
        'E2 - - - - - - - E2 - - - G2 - G#2 -',
      ),
      lead: bars(
        'A4 - - - - - - - B4 - - - C5 - - -',
        'E5 - - - - - - - D5 - C5 - B4 - - -',
        'A4 - - - - - - - B4 - - - C5 - - -',
        'B4 - - - - - - - G#4 - - - - - - -',
      ),
      lead2: bars(
        'F4 - - - - - - - G4 - - - A4 - - -',
        'C5 - - - - - - - B4 - A4 - G4 - - -',
        'F4 - - - - - - - G4 - - - A4 - - -',
        'G#4 - - - - - - - E4 - - - - - - -',
      ),
      kick: bars(EIGHTH_KICK, EIGHTH_KICK, EIGHTH_KICK, 'x.x.x.x.x.x.xxxx'),
      snare: bars(BACKBEAT, BACKBEAT, BACKBEAT, '....x.......x.x.'),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('X...............', EMPTY, 'X...............', EMPTY),
    },
    breakdown: {
      bars: 2,
      guitar: bars('A2p . . A2p . . A2p . . . A2p . A2p . . .', 'A2p . . A2p . . A2p . F2 - - - E2 - - -'),
      kick: bars('x..x..x...x.x...', 'x..x..x.x...x...'),
      snare: bars('........x.......', '........x...xxxx'),
      hat: bars(EMPTY, EMPTY),
    },
    bossRiff: {
      bars: 2,
      guitar: bars(
        'A2p A2p A2p A2p A#2 - A2p A2p A2p A2p A2p A2p D#3 - D3 -',
        'A2p A2p A2p A2p A#2 - A2p A2p C3 - B2 - A#2 - A2 -',
      ),
      kick: bars(DOUBLE_KICK, DOUBLE_KICK),
      snare: bars(BACKBEAT, '....x.......x.xx'),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('X...............', EMPTY),
    },
    bossFinal: {
      bars: 2,
      guitar: bars(
        `${rep('A2p', 8)} ${rep('C3p', 4)} ${rep('B2p', 4)}`,
        `${rep('A2p', 8)} ${rep('D#3p', 4)} ${rep('D3p', 4)}`,
      ),
      lead: bars('A5 - - - - - - - G#5 - - - G5 - - -', 'F#5 - - - F5 - - - E5 - - - D#5 - - -'),
      lead2: bars('F5 - - - - - - - E5 - - - D#5 - - -', 'D5 - - - C#5 - - - C5 - - - B4 - - -'),
      kick: bars(DOUBLE_KICK, DOUBLE_KICK),
      snare: bars('x...x...x...x...', 'x...x...x...xxxx'),
      hat: bars(EMPTY, EMPTY),
      crash: bars('X...............', '........X.......'),
    },
  },
  arrangements: {
    main: { order: ['intro', 'A', 'harmony', 'B', 'chorus', 'A', 'harmony', 'chorus', 'breakdown'], loopFrom: 1 },
    boss: { order: ['bossRiff'], loopFrom: 0 },
    bossFinal: { order: ['bossFinal'], loopFrom: 0 },
  },
};
