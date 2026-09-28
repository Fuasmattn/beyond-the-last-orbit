# M11 — Shared global leaderboard

Date: 2026-09-28 · Status: implemented · Builds on M8 (`2026-09-25-m8-run-modes-roguelite-design.md`)

## Owner input

"Now that we have deployed it on GitHub pages, I'd like to have a shared high score leaderboard. The upgrades and
the credits however should stay in the browser session for now."

## Constraints

- GitHub Pages is static hosting, so the shared table needs a hosted backend.
- Credits, upgrades, cosmetics and settings stay in `localStorage` (unchanged).
- The game must keep working offline, in dev, and in forks with no backend configured.

## Backend choice: Supabase (Postgres + PostgREST)

| Option | Verdict |
|---|---|
| **Supabase** | Free tier, table + row-level security in one SQL file, REST over plain `fetch` (no SDK, no bundle cost). Publishable key is designed to be public. **Chosen.** |
| Firebase Firestore | Similar, but needs the Firebase SDK (~100 kB) or awkward REST. |
| Cloudflare Worker + D1 | Most control (rate limits, server-side checks) but more moving parts to deploy. Good upgrade path if cheating becomes a problem. |
| GitHub Issues / Gist as DB | Needs a write token in the client. Not viable. |

Keys: new-style publishable key (`sb_publishable_…`), sent only in the `apikey` header (it is not a JWT).
Source: <https://supabase.com/docs/guides/api/api-keys>.

## Data model (`supabase/leaderboard.sql`)

`public.scores`: `id`, `mode` (`rogue` | `rhythm`), `initials` (`^[A-Z0-9]{3}$`), `score` (1..100 000 000),
`world` (0..9), `stage` (1..20), `loop` (0..99), `created_at` (server time).

- RLS on. `anon` may `select` and `insert`; there are no update or delete policies.
- Table checks reject malformed rows; `created_at` is always server time (column default, not client-settable).
- Index on `(mode, score desc, created_at)` for the top-10 query.

## Client (`src/leaderboard/`)

- `readLeaderboardConfig(env)` → `{ url, key } | null` from `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY`.
  Missing config = leaderboard disabled; everything behaves as before M11.
- `Leaderboard` caches the global top 10 for each mode, and increments `version` on every change so scenes can
  redraw. `refresh(mode)` and `submit(mode, entry)` never throw; they time out after 6 s.
- Ties rank by the earlier `created_at`.

## Game flow

- **Boot:** fetch both global tables in the background.
- **Title:** each table page shows the global top 10 when loaded. Before the load (or if it failed) it shows the
  local table, and when a backend is configured the header is prefixed `LOCAL`. Pages redraw when data arrives.
- **Game over:** the picker opens if the score qualifies for the global table (when loaded) **or** the local
  table. On OK the score always goes into the local table. It is sent to the global table if it qualifies there
  or the global table is unknown. While sending, the screen shows `SENDING SCORE...`. On success it shows the
  refreshed global table with the new row highlighted. On failure it shows the local table under
  `LOCAL HIGH SCORES` with `COULD NOT REACH SERVER`.

## Out of scope / open questions

- **Cheating:** any client-submitted score is forgeable. The table checks only block garbage. If abuse shows up:
  move inserts behind a Cloudflare Worker or Supabase Edge Function with rate limiting, or add a moderation
  delete from the dashboard.
- **Offline queue:** scores made while offline are not retried later. Needs a `pendingScores` save field (v3).
- **Profanity in initials:** 3 letters from A–Z0–9; no filter yet.
- **Weekly / per-world boards:** possible later with a `created_at` filter; not built.
