# Space Alliance

Retro arcade shooter in the style of Space Invaders with a procedurally synthesized 70s/80s heavy-metal soundtrack. Shots fired on the beat build a score multiplier (up to x4); shots off the beat make the music go sour.

Three worlds (Near Earth Orbit, Moon, Mars) × 5 stages, a boss on every fifth stage, then an endless harder loop. Credits earned per run buy cosmetic ship skins and laser styles.

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

Calibrate your audio/input latency under **Settings → Calibrate timing** (important with Bluetooth headphones).

## Layout

- `src/sim` — deterministic game simulation (fixed 60 Hz, seeded RNG, no DOM/Pixi)
- `src/audio` — Web Audio synth, sequencer, beat clock, rhythm judge
- `src/data` — tuning (`balance.ts`), worlds, songs, sprites, cosmetics
- `src/view`, `src/fx` — PixiJS rendering, particles, post-FX
- `src/scenes` — title, run, game over, shop, settings, calibration
- `docs/superpowers` — design spec and per-milestone implementation plans
