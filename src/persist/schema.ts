export const SAVE_KEY = 'space-alliance:v1';
export const SAVE_VERSION = 2;
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
}

export interface SaveData {
  version: number;
  credits: number;
  /** Rhythm-run table. */
  highscores: HighscoreEntry[];
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
    highscores: [],
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
    },
  };
}
