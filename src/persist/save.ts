import { migrate } from './migrations';
import { defaultSave, MAX_HIGHSCORES, SAVE_KEY, type HighscoreEntry, type SaveData } from './schema';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function parseSave(raw: string | null): { data: SaveData; reset: boolean } {
  if (raw === null) return { data: defaultSave(), reset: false };
  try {
    return { data: migrate(JSON.parse(raw)), reset: false };
  } catch {
    return { data: defaultSave(), reset: true };
  }
}

export function loadSave(store: KeyValueStore): { data: SaveData; reset: boolean } {
  let raw: string | null = null;
  try {
    raw = store.getItem(SAVE_KEY);
  } catch (err) {
    console.warn('Save storage unavailable', err);
  }
  const result = parseSave(raw);
  if (result.reset) console.warn('Save data was corrupt and has been reset');
  return result;
}

export function writeSave(store: KeyValueStore, data: SaveData): boolean {
  try {
    store.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.warn('Could not write save', err);
    return false;
  }
}

/** In-memory fallback when localStorage is unavailable (private mode, sandboxed iframes). */
export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

export function qualifiesForHighscore(list: readonly HighscoreEntry[], score: number): boolean {
  if (score <= 0) return false;
  if (list.length < MAX_HIGHSCORES) return true;
  const last = list[list.length - 1];
  return last === undefined || score > last.score;
}

export function insertHighscore(list: readonly HighscoreEntry[], entry: HighscoreEntry): HighscoreEntry[] {
  return [...list, entry].sort((a, b) => b.score - a.score).slice(0, MAX_HIGHSCORES);
}
