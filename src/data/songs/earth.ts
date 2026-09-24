import type { SongDef } from '../../audio/song';

const bars = (...b: string[]) => b.join(' | ');

const GALLOP = 'E2p . E2p E2p E2p . E2p E2p E2p . E2p E2p E2p . E2p E2p';
const GALLOP_KICK = 'x.xxx.xxx.xxx.xx';
const DOUBLE_KICK = 'xxxxxxxxxxxxxxxx';
const BACKBEAT = '....x.......x...';
const EIGHTH_HAT = 'x.x.x.x.x.x.x.x.';
const EMPTY = '................';

/** World 1 — Near Earth Orbit. E minor, 140 BPM, galloping NWOBHM. */
export const EARTH_SONG: SongDef = {
  name: 'Earthbound Gallop',
  bpm: 140,
  sections: {
    intro: {
      bars: 2,
      guitar: bars('E2 - - - - - - - - - - - - - - -', 'G2 - - - - - - - A2 - - - B2 - - -'),
      kick: bars('X...............', 'x.......x...x...'),
      snare: bars(EMPTY, '........x.x.xxxx'),
      hat: bars(EMPTY, EMPTY),
      crash: bars('X...............', EMPTY),
    },
    A: {
      bars: 4,
      guitar: bars(
        GALLOP,
        'E2p . E2p E2p E2p . E2p E2p G2 - - . A2 - - .',
        GALLOP,
        'E2p . E2p E2p E2p . E2p E2p D3 - - . C3 - B2 -',
      ),
      kick: bars(GALLOP_KICK, GALLOP_KICK, GALLOP_KICK, GALLOP_KICK),
      snare: bars(BACKBEAT, BACKBEAT, BACKBEAT, BACKBEAT),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('x...............', EMPTY, EMPTY, EMPTY),
    },
    B: {
      bars: 4,
      guitar: bars(
        'E2p E2p . E2p . E2p E2p . G2 - . G2 - . F#2 -',
        'E2p E2p . E2p . E2p E2p . A2 - . A2 - . B2 -',
        'E2p E2p . E2p . E2p E2p . G2 - . G2 - . F#2 -',
        'E2p E2p . E2p . E2p E2p . C3 - - - B2 - - -',
      ),
      kick: bars('xx.x.xx.x..x..x.', 'xx.x.xx.x..x..x.', 'xx.x.xx.x..x..x.', 'xx.x.xx.x...x...'),
      snare: bars(BACKBEAT, BACKBEAT, BACKBEAT, '....x.......x.xx'),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('x...............', EMPTY, EMPTY, EMPTY),
    },
    chorus: {
      bars: 4,
      guitar: bars(
        'C3 - - - - - - - D3 - - - - - - -',
        'E2 - - - - - - - E2 - - - D3 - B2 -',
        'C3 - - - - - - - D3 - - - - - - -',
        'B2 - - - - - - - B2 - - - D3 - F#2 -',
      ),
      lead: bars(
        'E4 - - - G4 - - - F#4 - - - D4 - - -',
        'E4 - - - - - - - B3 - D4 - E4 - - -',
        'E4 - - - G4 - - - A4 - - - B4 - - -',
        'A4 - G4 - F#4 - - - D#4 - - - - - - -',
      ),
      kick: bars('x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.xxxx'),
      snare: bars(BACKBEAT, BACKBEAT, BACKBEAT, '....x.......x.x.'),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('X...............', EMPTY, 'X...............', EMPTY),
    },
    breakdown: {
      bars: 2,
      guitar: bars('E2p . . E2p . . E2p . . . E2p . E2p . . .', 'E2p . . E2p . . E2p . F2 - - - F#2 - - -'),
      kick: bars('x..x..x...x.x...', 'x..x..x.x...x...'),
      snare: bars('........x.......', '........x...xxxx'),
      hat: bars(EMPTY, EMPTY),
    },
    bossRiff: {
      bars: 2,
      guitar: bars(
        'E2p E2p E2p E2p F2 - E2p E2p E2p E2p E2p E2p A#2 - A2 -',
        'E2p E2p E2p E2p F2 - E2p E2p G2 - F#2 - F2 - E2 -',
      ),
      kick: bars(DOUBLE_KICK, DOUBLE_KICK),
      snare: bars(BACKBEAT, '....x.......x.xx'),
      hat: bars(EIGHTH_HAT, EIGHTH_HAT),
      crash: bars('X...............', EMPTY),
    },
    bossFinal: {
      bars: 2,
      guitar: bars(
        'E2p E2p E2p E2p E2p E2p E2p E2p G2p G2p G2p G2p F#2p F#2p F#2p F#2p',
        'E2p E2p E2p E2p E2p E2p E2p E2p A#2p A#2p A#2p A#2p A2p A2p A2p A2p',
      ),
      lead: bars('E5 - - - - - - - D#5 - - - D5 - - -', 'C#5 - - - C5 - - - B4 - - - A#4 - - -'),
      kick: bars(DOUBLE_KICK, DOUBLE_KICK),
      snare: bars('x...x...x...x...', 'x...x...x...xxxx'),
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
