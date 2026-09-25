# Space Alliance

Neon arcade rhythm shooter with a procedurally synthesized 70s/80s heavy-metal soundtrack. Enemy formations fly in, sway on every beat and morph into new shapes every few bars. Shots fired on the beat build a score multiplier (up to x4); shots off the beat make the music go sour. The beat track along the bottom shows markers converging on the beat and grades every shot PERFECT / GOOD / OFF.

The playfield fills the whole window: height is fixed, width follows the screen (portrait phone to ultra-wide).

Three worlds (Near Earth Orbit, Moon, Mars) × 5 stages, a boss on every fifth stage, then an endless harder loop.

Two run types, each with its own highscore table:

- **Rhythm run** — the beat game above: linear stages, multiplier from on-beat shots. Best with sound.
- **Rogue run** — plays fine muted. Nothing is judged on the beat; hits and grazes (enemy bullets skimming the ship) build the multiplier, misses drop it. After each stage pick the next node on a branching map (BATTLE, ELITE, CACHE, REPAIR); elites and bosses grant a pick-1-of-3 upgrade draft.

Credits earned per run buy cosmetic ship skins and laser styles (SHOP) and permanent rogue-run upgrades (HANGAR).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # typecheck + production build in dist/
```

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrows / WASD (up/down limited to the bottom zone) | Drag anywhere |
| Fire | Space | Fire button (bottom right, pulses on the beat) |
| Pause | P / Esc | Switch away from the tab |
| Menus | Arrows + Space/Enter, Esc back | Tap |

Calibrate your audio/input latency under **Settings → Calibrate timing** (important with Bluetooth headphones). If the beat markers look early or late against the music, adjust **Settings → Visual offset** (moves visuals only).

## Layout

- `src/sim` — deterministic game simulation (fixed 60 Hz, seeded RNG, no DOM/Pixi)
- `src/audio` — Web Audio synth, sequencer, beat clock, rhythm judge
- `src/data` — tuning (`balance.ts`), worlds, songs, sprites, cosmetics
- `src/view`, `src/fx` — PixiJS rendering, particles, post-FX
- `src/scenes` — title, run, game over, shop, settings, calibration
- `docs/superpowers` — design spec and per-milestone implementation plans
- `docs/research` — background research (roguelite structure, bullet-hell/rhythm hybrids, rhythm timing)
