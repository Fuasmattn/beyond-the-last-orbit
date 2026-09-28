import { describe, expect, it, vi } from 'vitest';
import {
  findEntry,
  Leaderboard,
  readLeaderboardConfig,
  rowToEntry,
  topUrl,
  type FetchFn,
} from '../../src/leaderboard/leaderboard';
import type { HighscoreEntry } from '../../src/persist/schema';

const config = { url: 'https://abc.supabase.co', key: 'sb_publishable_x' };
const row = { initials: 'ABC', score: 1200, world: 1, stage: 2, loop: 0, created_at: '2026-09-28T10:00:00+00:00' };
const entry: HighscoreEntry = { initials: 'ABC', score: 1200, world: 1, stage: 2, loop: 0, date: '2026-09-28' };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('readLeaderboardConfig', () => {
  it('is null without both values', () => {
    expect(readLeaderboardConfig({})).toBeNull();
    expect(readLeaderboardConfig({ VITE_SUPABASE_URL: 'https://a.co', VITE_SUPABASE_KEY: ' ' })).toBeNull();
  });

  it('trims and strips a trailing slash', () => {
    expect(readLeaderboardConfig({ VITE_SUPABASE_URL: ' https://a.co/ ', VITE_SUPABASE_KEY: 'k' })).toEqual({
      url: 'https://a.co',
      key: 'k',
    });
  });
});

describe('topUrl', () => {
  it('asks for the top 10 of one mode, ties to the earliest', () => {
    const u = new URL(topUrl(config, 'rogue'));
    expect(u.pathname).toBe('/rest/v1/scores');
    expect(u.searchParams.get('mode')).toBe('eq.rogue');
    expect(u.searchParams.get('order')).toBe('score.desc,created_at.asc');
    expect(u.searchParams.get('limit')).toBe('10');
  });
});

describe('rowToEntry', () => {
  it('maps a row and trims the timestamp to a date', () => {
    expect(rowToEntry(row)).toEqual(entry);
  });

  it('rejects malformed rows', () => {
    expect(rowToEntry(null)).toBeNull();
    expect(rowToEntry({ ...row, initials: 'ab' })).toBeNull();
    expect(rowToEntry({ ...row, score: '1200' })).toBeNull();
    expect(rowToEntry({ ...row, stage: 1.5 })).toBeNull();
  });
});

describe('Leaderboard', () => {
  it('is disabled and inert without config', async () => {
    const fetchFn = vi.fn<FetchFn>();
    const lb = new Leaderboard(null, fetchFn);
    expect(lb.enabled).toBe(false);
    expect(await lb.refresh('rogue')).toBe(false);
    expect(await lb.submit('rogue', entry)).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('loads a table, sends the key header and bumps the version', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(json([row, { junk: true }]));
    const lb = new Leaderboard(config, fetchFn);
    expect(lb.top('rogue')).toBeNull();
    expect(await lb.refresh('rogue')).toBe(true);
    expect(lb.top('rogue')).toEqual([entry]);
    expect(lb.top('rhythm')).toBeNull();
    expect(lb.version).toBe(1);
    const init = fetchFn.mock.calls[0]![1]!;
    expect((init.headers as Record<string, string>).apikey).toBe('sb_publishable_x');
  });

  it('keeps the last good table when a refresh fails', async () => {
    const fetchFn = vi
      .fn<FetchFn>()
      .mockResolvedValueOnce(json([row]))
      .mockResolvedValueOnce(json({ message: 'boom' }, 500))
      .mockRejectedValueOnce(new TypeError('offline'));
    const lb = new Leaderboard(config, fetchFn);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await lb.refresh('rogue');
    expect(await lb.refresh('rogue')).toBe(false);
    expect(await lb.refresh('rogue')).toBe(false);
    expect(lb.top('rogue')).toEqual([entry]);
    expect(lb.version).toBe(1);
  });

  it('posts only the columns the server accepts, then reloads', async () => {
    const fetchFn = vi
      .fn<FetchFn>()
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(json([row]));
    const lb = new Leaderboard(config, fetchFn);
    expect(await lb.submit('rhythm', entry)).toBe(true);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://abc.supabase.co/rest/v1/scores');
    expect(init!.method).toBe('POST');
    expect(JSON.parse(init!.body as string)).toEqual({
      mode: 'rhythm',
      initials: 'ABC',
      score: 1200,
      world: 1,
      stage: 2,
      loop: 0,
    });
    expect(lb.top('rhythm')).toEqual([entry]);
  });

  it('reports a rejected submit', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(json({ message: 'check violation' }, 400));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const lb = new Leaderboard(config, fetchFn);
    expect(await lb.submit('rogue', entry)).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('findEntry', () => {
  it('matches by value', () => {
    const other = { ...entry, initials: 'XYZ' };
    expect(findEntry([other, { ...entry }], entry)).toBe(1);
    expect(findEntry([other], entry)).toBe(-1);
  });
});
