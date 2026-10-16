# Development

Scripts, deployment, the optional global leaderboard and the code layout. For how the game plays see [gameplay.md](gameplay.md).

## Scripts

```bash
npm install
npm run dev              # http://localhost:5173
npm run dev:leaderboard  # http://localhost:5174 with a mock global leaderboard
npm run dev:https        # https://<lan-ip>:5178, self-signed — needed for tilt steering on a phone (accept the certificate warning once)
npm test                 # unit tests (Vitest)
npm run build            # typecheck + production build in dist/
```

## Deploy

`.github/workflows/deploy.yml` typechecks, tests and builds every push and pull request, and deploys `main` to GitHub Pages (the build's base path follows the Pages URL, e.g. `/<repo>/`).

One-time setup after pushing to GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Global leaderboard (Supabase)

Without configuration the game only keeps local high scores. To share them:

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste and run `supabase/leaderboard.sql` (re-run it after upgrading to M16: it widens the `mode` check for daily boards).
3. **Project Settings → API Keys**: copy the project URL and the **publishable** key (`sb_publishable_…`, safe to ship in the page; never use the secret key).
4. GitHub repo **Settings → Secrets and variables → Actions → Variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`, then re-run the deploy.

For local builds, put the same two values in `.env.local`. Remove bad rows in the Supabase **Table Editor**.

## Code layout

- `src/sim` — deterministic game simulation (fixed 60 Hz, seeded RNG, no DOM/Pixi)
- `src/audio` — Web Audio synth, sequencer, beat clock, rhythm judge
- `src/data` — tuning (`balance.ts`), worlds, songs, sprites, cosmetics
- `src/view`, `src/fx` — PixiJS rendering, particles, post-FX
- `src/scenes` — title, run, game over, shop, settings, calibration
- `src/leaderboard`, `supabase/` — global high score client and table
- `docs/superpowers` — design spec and per-milestone implementation plans
- `docs/research` — background research (roguelite structure, bullet-hell/rhythm hybrids, rhythm timing)
- `docs/media` — README screenshot and GIF
