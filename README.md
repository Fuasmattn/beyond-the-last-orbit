# Space Alliance

Neon arcade rhythm shooter with a procedurally synthesized 70s/80s heavy-metal soundtrack. Enemy formations fly in, sway on every beat and morph into new shapes every few bars. Shots fired on the beat build a score multiplier (up to x4); shots off the beat make the music go sour. The beat track along the bottom shows markers converging on the beat and grades every shot PERFECT / GOOD / OFF.

The playfield fills the whole window: height is fixed, width follows the screen (portrait phone to ultra-wide).

Three worlds (Near Earth Orbit, Moon, Mars) × 5 stages, a boss on every fifth stage, then an endless harder loop.

Two run types, each with its own highscore table:

- **Run** (START RUN, the main game) — hits and grazes (enemy bullets skimming the ship's core, shown as a dot) build the multiplier, misses drop it. After each stage pick the next node on a branching map (BATTLE, ELITE, CACHE, REPAIR); elites and bosses grant a pick-1-of-3 upgrade draft. Elites fire telegraphed per-world volleys (walls, rings, fans).
  - **Beat stages**: stage 3 of every world is a beat stage — only on-beat shots build the multiplier (up to x8), off-beat shots cost two levels, PERFECT shots fire power shots, and a beat rank S/A earns an upgrade draft (S also doubles the stage bonus).
- **Beat run** (secondary) — the original pure rhythm game: linear stages, multiplier from on-beat shots, no upgrades. Best with sound.

Credits earned per run buy cosmetic ship skins and laser styles (SHOP) and permanent upgrades for the main run (HANGAR).
Credits, upgrades and settings stay in the browser; high scores are also shared on a global leaderboard.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run dev:leaderboard  # http://localhost:5174 with a mock global leaderboard
npm test           # unit tests (Vitest)
npm run build      # typecheck + production build in dist/
```

## Deploy

`.github/workflows/deploy.yml` typechecks, tests and builds every push and pull request, and deploys `main` to GitHub Pages (the build's base path follows the Pages URL, e.g. `/<repo>/`).

One-time setup after pushing to GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

### Global leaderboard (Supabase)

Without configuration the game only keeps local high scores. To share them:

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste and run `supabase/leaderboard.sql`.
3. **Project Settings → API Keys**: copy the project URL and the **publishable** key (`sb_publishable_…`, safe to ship in the page; never use the secret key).
4. GitHub repo **Settings → Secrets and variables → Actions → Variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`, then re-run the deploy.

For local builds, put the same two values in `.env.local`. Remove bad rows in the Supabase **Table Editor**.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrows / WASD (up/down limited to the bottom zone) | Drag anywhere |
| Fire | Space | Fire button (bottom right, pulses on the beat) |
| Pause (resume / end run) | P / Esc | Switch away from the tab |
| Menus | Arrows + Space/Enter, Esc back | Tap |

Calibrate your audio/input latency under **Settings → Calibrate timing** (important with Bluetooth headphones). If the beat markers look early or late against the music, adjust **Settings → Visual offset** (moves visuals only).

## Layout

- `src/sim` — deterministic game simulation (fixed 60 Hz, seeded RNG, no DOM/Pixi)
- `src/audio` — Web Audio synth, sequencer, beat clock, rhythm judge
- `src/data` — tuning (`balance.ts`), worlds, songs, sprites, cosmetics
- `src/view`, `src/fx` — PixiJS rendering, particles, post-FX
- `src/scenes` — title, run, game over, shop, settings, calibration
- `src/leaderboard`, `supabase/` — global high score client and table
- `docs/superpowers` — design spec and per-milestone implementation plans
- `docs/research` — background research (roguelite structure, bullet-hell/rhythm hybrids, rhythm timing)

## Credits

- Drums: [DrumGizmo MuldjordKit](https://github.com/sfzinstruments/DrumGizmo.MuldjordKit) by Lars Muldjord, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — mixed down to stereo hits.
- Guitar DI notes: [FreePats Electric Guitar FSBS (direct)](https://github.com/freepats/electric-guitar-FSBS-direct), CC0 — played through the game's own amp model.
- Guitar cabinet impulse responses: [Jester's Brutal Pack](https://www.jester-dyne-productions.com/brutal-ir-pack/) by Jester Dyne Productions, CC0.

Details in `public/audio/CREDITS.md`.
