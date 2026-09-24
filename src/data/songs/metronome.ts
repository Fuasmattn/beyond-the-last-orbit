import type { SongDef } from '../../audio/song';
import { CALIBRATION } from '../balance';
import { rep } from './common';

/** One-bar click track for latency calibration (accent on the downbeat). */
export const METRONOME_SONG: SongDef = {
  name: 'Calibration Click',
  bpm: CALIBRATION.bpm,
  sections: {
    click: {
      bars: 1,
      guitar: rep('.', 16),
      kick: 'X...x...x...x...',
      snare: '................',
      hat: 'x...x...x...x...',
    },
  },
  arrangements: { main: { order: ['click'], loopFrom: 0 } },
};
