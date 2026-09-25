import { VISUAL_OFFSET_MAX_MS } from '../meta/settings';
import {
  defaultSave,
  MAX_HIGHSCORES,
  SAVE_VERSION,
  type HighscoreEntry,
  type SaveData,
  type Settings,
} from './schema';

type Rec = Record<string, unknown>;

const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

const str = (v: unknown, fallback: string): string => (typeof v === 'string' && v.length > 0 ? v : fallback);

function isHighscore(v: unknown): v is HighscoreEntry {
  return (
    isRecord(v) &&
    typeof v.initials === 'string' &&
    typeof v.score === 'number' &&
    Number.isFinite(v.score) &&
    typeof v.world === 'number' &&
    typeof v.stage === 'number' &&
    typeof v.loop === 'number' &&
    typeof v.date === 'string'
  );
}

function sanitizeSettings(v: unknown): Settings {
  const d = defaultSave().settings;
  if (!isRecord(v)) return d;
  return {
    musicVolume: num(v.musicVolume, d.musicVolume, 0, 1),
    sfxVolume: num(v.sfxVolume, d.sfxVolume, 0, 1),
    crt: bool(v.crt, d.crt),
    bloom: bool(v.bloom, d.bloom),
    shake: bool(v.shake, d.shake),
    latencyOffsetMs: num(v.latencyOffsetMs, d.latencyOffsetMs, -300, 300),
    visualOffsetMs: num(v.visualOffsetMs, d.visualOffsetMs, -VISUAL_OFFSET_MAX_MS, VISUAL_OFFSET_MAX_MS),
  };
}

function sanitizeHighscores(v: unknown): HighscoreEntry[] {
  return Array.isArray(v)
    ? v
        .filter(isHighscore)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_HIGHSCORES)
    : [];
}

function sanitizeUpgrades(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(v)) return out;
  for (const [id, level] of Object.entries(v)) {
    const n = Math.floor(num(level, 0, 0, 99));
    if (n > 0) out[id] = n;
  }
  return out;
}

/** v1 and v2 share a layout; v2 adds `rogueHighscores` and `upgrades` (empty when missing). */
function sanitize(o: Rec): SaveData {
  const d = defaultSave();
  const owned = Array.isArray(o.owned) ? o.owned.filter((x): x is string => typeof x === 'string') : [];
  const equipped: Rec = isRecord(o.equipped) ? o.equipped : {};
  return {
    version: SAVE_VERSION,
    credits: Math.floor(num(o.credits, d.credits, 0)),
    highscores: sanitizeHighscores(o.highscores),
    rogueHighscores: sanitizeHighscores(o.rogueHighscores),
    upgrades: sanitizeUpgrades(o.upgrades),
    owned: [...new Set([...d.owned, ...owned])],
    equipped: {
      skin: str(equipped.skin, d.equipped.skin),
      laser: str(equipped.laser, d.equipped.laser),
    },
    settings: sanitizeSettings(o.settings),
  };
}

/** Upgrades any known save version to the current `SaveData`; throws on unknown data. */
export function migrate(raw: unknown): SaveData {
  if (!isRecord(raw)) throw new Error('save is not an object');
  switch (raw.version) {
    case 1:
    case 2:
      return sanitize(raw);
    default:
      throw new Error(`unsupported save version ${String(raw.version)}`);
  }
}
