export const SAVE_KEY = 'beyond-the-last-orbit:v1';
export const SAVE_VERSION = 3;
export const MAX_HIGHSCORES = 10;

export interface HighscoreEntry {
  initials: string;
  score: number;
  world: number;
  stage: number;
  loop: number;
  /** ISO date (YYYY-MM-DD). */
  date: string;
}

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  crt: boolean;
  bloom: boolean;
  shake: boolean;
  latencyOffsetMs: number;
  /** Shifts beat visuals only (+ = earlier); judging is unaffected. */
  visualOffsetMs: number;
  /** Soundtrack guitars: modeled amp (default) or the original retro synth. */
  guitarTone: 'amp' | 'retro';
  /** Master mute (the speaker toggle on menu screens); volumes are kept. */
  muted: boolean;
  /** Every stage of a run is a beat stage. */
  beatLock: boolean;
}

export interface SaveData {
  version: number;
  credits: number;
  /** Local high score table (fallback for the global one). */
  rogueHighscores: HighscoreEntry[];
  /** Permanent upgrade levels by id (see data/upgrades.ts). */
  upgrades: Record<string, number>;
  owned: string[];
  equipped: { skin: string; laser: string };
  settings: Settings;
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    credits: 0,
    rogueHighscores: [],
    upgrades: {},
    owned: ['skin.classic', 'laser.classic'],
    equipped: { skin: 'skin.classic', laser: 'laser.classic' },
    settings: {
      musicVolume: 0.8,
      sfxVolume: 0.8,
      crt: true,
      bloom: true,
      shake: true,
      latencyOffsetMs: 0,
      visualOffsetMs: 0,
      guitarTone: 'amp',
      muted: false,
      beatLock: false,
    },
  };
}
