// In-memory stand-in for the Supabase `scores` table (the subset of PostgREST the game uses).
// Used by `npm run dev:leaderboard`. Mirrors the checks in supabase/leaderboard.sql.
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 54321);
const FAIL = process.env.MOCK_FAIL === '1';
const rows = [
  { mode: 'rogue', initials: 'ACE', score: 42000, world: 2, stage: 3, loop: 0 },
  { mode: 'rogue', initials: 'BOB', score: 9000, world: 0, stage: 3, loop: 0 },
  { mode: `daily:${new Date().toISOString().slice(0, 10)}`, initials: 'DAY', score: 12000, world: 1, stage: 1, loop: 0 },
].map((r, i) => ({ ...r, created_at: new Date(Date.UTC(2026, 8, 20 + i)).toISOString() }));

const between = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const valid = (r) =>
  typeof r.mode === 'string' &&
  /^(rogue|rhythm|daily:\d{4}-\d{2}-\d{2})$/.test(r.mode) &&
  typeof r.initials === 'string' &&
  /^[A-Z0-9]{3}$/.test(r.initials) &&
  between(r.score, 1, 100_000_000) &&
  between(r.world, 0, 9) &&
  between(r.stage, 1, 20) &&
  between(r.loop, 0, 99);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, content-type, prefer, accept',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const send = (status, body) => {
    res.writeHead(status, { ...cors, 'Content-Type': 'application/json' });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  if (req.method === 'OPTIONS') return send(204);
  if (FAIL) return send(503, { message: 'mock outage' });
  if (url.pathname !== '/rest/v1/scores') return send(404, { message: 'not found' });
  if (!req.headers.apikey) return send(401, { message: 'no apikey' });

  if (req.method === 'GET') {
    const mode = (url.searchParams.get('mode') ?? '').replace(/^eq\./, '');
    const limit = Number(url.searchParams.get('limit') ?? 10);
    const top = rows
      .filter((r) => r.mode === mode)
      .sort((a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at))
      .slice(0, limit)
      .map(({ mode: _m, ...r }) => r);
    return send(200, top);
  }
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let r;
      try {
        r = JSON.parse(body);
      } catch {
        return send(400, { message: 'bad json' });
      }
      if (!valid(r)) return send(400, { message: 'check violation' });
      rows.push({ ...r, created_at: new Date().toISOString() });
      console.log('score', r);
      send(201);
    });
    return;
  }
  send(405, { message: 'method not allowed' });
}).listen(PORT, () => console.log(`mock leaderboard on http://localhost:${PORT}`));
