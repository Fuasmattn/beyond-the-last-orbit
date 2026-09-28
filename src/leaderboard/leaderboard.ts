import { MAX_HIGHSCORES, type HighscoreEntry } from '../persist/schema';
import type { RunMode } from '../sim/types';

/** Supabase project URL and publishable key (`sb_publishable_…`, safe to ship). */
export interface LeaderboardConfig {
  url: string;
  key: string;
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 6000;
const COLUMNS = 'initials,score,world,stage,loop,created_at';
const INITIALS_RE = /^[A-Z0-9]{3}$/;

/** Missing or blank values disable the leaderboard (dev, forks, offline builds). */
export function readLeaderboardConfig(env: Record<string, unknown>): LeaderboardConfig | null {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_KEY;
  if (typeof url !== 'string' || typeof key !== 'string' || !url.trim() || !key.trim()) return null;
  return { url: url.trim().replace(/\/+$/, ''), key: key.trim() };
}

export function topUrl(config: LeaderboardConfig, mode: RunMode, limit = MAX_HIGHSCORES): string {
  const q = new URLSearchParams({
    select: COLUMNS,
    mode: `eq.${mode}`,
    order: 'score.desc,created_at.asc',
    limit: String(limit),
  });
  return `${config.url}/rest/v1/scores?${q.toString()}`;
}

const int = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** One PostgREST row → table entry; null for anything malformed. */
export function rowToEntry(row: unknown): HighscoreEntry | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.initials !== 'string' || !INITIALS_RE.test(r.initials)) return null;
  if (!int(r.score) || !int(r.world) || !int(r.stage) || !int(r.loop)) return null;
  const date = typeof r.created_at === 'string' ? r.created_at.slice(0, 10) : '';
  return { initials: r.initials, score: r.score, world: r.world, stage: r.stage, loop: r.loop, date };
}

/**
 * Shared global high score tables. Caches the top 10 per mode; `version` bumps on every change so scenes
 * know to redraw. Network calls never throw: failures resolve to `false` and keep the last good table.
 */
export class Leaderboard {
  version = 0;
  private readonly tables: Record<RunMode, HighscoreEntry[] | null> = { rogue: null, rhythm: null };

  constructor(
    private readonly config: LeaderboardConfig | null,
    private readonly fetchFn: FetchFn = (input, init) => fetch(input, init),
    private readonly timeoutMs = TIMEOUT_MS,
  ) {}

  get enabled(): boolean {
    return this.config !== null;
  }

  /** The global top 10, or null until it has loaded. */
  top(mode: RunMode): readonly HighscoreEntry[] | null {
    return this.tables[mode];
  }

  async refresh(mode: RunMode): Promise<boolean> {
    const c = this.config;
    if (!c) return false;
    try {
      const res = await this.fetchFn(topUrl(c, mode), {
        headers: { apikey: c.key, Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows: unknown = await res.json();
      if (!Array.isArray(rows)) throw new Error('unexpected response');
      this.tables[mode] = rows.map(rowToEntry).filter((e): e is HighscoreEntry => e !== null);
      this.version++;
      return true;
    } catch (err) {
      console.warn(`Leaderboard: could not load ${mode} scores`, err);
      return false;
    }
  }

  /** Sends a score, then reloads that table. True only if the score was stored. */
  async submit(mode: RunMode, entry: HighscoreEntry): Promise<boolean> {
    const c = this.config;
    if (!c) return false;
    try {
      const res = await this.fetchFn(`${c.url}/rest/v1/scores`, {
        method: 'POST',
        headers: { apikey: c.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          mode,
          initials: entry.initials,
          score: entry.score,
          world: entry.world,
          stage: entry.stage,
          loop: entry.loop,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.warn('Leaderboard: could not submit score', err);
      return false;
    }
    await this.refresh(mode);
    return true;
  }
}

/** Index of `entry` in a fetched table (matched by value, since rows come back as new objects), or -1. */
export function findEntry(list: readonly HighscoreEntry[], entry: HighscoreEntry): number {
  return list.findIndex(
    (e) =>
      e.initials === entry.initials &&
      e.score === entry.score &&
      e.world === entry.world &&
      e.stage === entry.stage &&
      e.loop === entry.loop,
  );
}
