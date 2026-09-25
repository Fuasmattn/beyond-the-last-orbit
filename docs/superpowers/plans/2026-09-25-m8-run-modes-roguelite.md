# M8 plan — run modes, roguelite runs, permanent upgrades

Spec: `docs/superpowers/specs/2026-09-25-m8-run-modes-roguelite-design.md`. One commit per task; `npm test` + `npm run build` green before each.

## Task 1 — Ship stats + run mode in the sim
- `SimState.mode: 'rhythm' | 'rogue'`, `SimState.ship: ShipStats` (maxBullets, cooldown, speed, pierce, damage, twin, spread, scoreMul, shieldMax) seeded from `PLAYER`.
- `createInitialState(seed, fieldW, opts?: { mode, loadout })`.
- `player.ts` / `collision.ts` read `state.ship` instead of `PLAYER` constants; pierce, damage, side bolts (`extra` flag, not capped), shield charges (`player.shield`, `shieldHit` event).
- Tests: stats applied, side bolts uncapped, pierce, shield absorbs.

## Task 2 — Rogue scoring
- Rogue: no rhythm judgement; hit → streak+1; player bolt leaving the field unspent → drop a level; graze (6 px, once per bullet) → +10×mult and streak+1, `graze` event.
- Stage result: rogue bonus = accuracy×2000, perfect = noHit && accuracy ≥ 0.7.
- `scoreMul` applied in `registerKill`.
- Tests.

## Task 3 — Save v2 + modes in the UI
- Save v2: `upgrades`, `rogueHighscores`; migration from v1.
- Title menu: RHYTHM RUN, ROGUE RUN, HANGAR, SHOP, SETTINGS. Highscore pages per mode.
- RunScene takes mode; rogue hides beat track, no sourness, grades not shown. Game over writes the mode's table.

## Task 4 — Permanent upgrades (HANGAR)
- `data/upgrades.ts` defs + `meta/upgrades.ts` (buy, level, loadout). SALVAGE in credits.
- `HangarScene`: list, level pips, cost, description, buy.
- Loadout applied to rogue runs (HULL, CANNON, COOLANT, THRUSTERS, DEFLECTOR, INSIGHT rerolls).

## Task 5 — Route map + drafts
- `sim/route.ts`: map generation (rows 2–4, lanes, edges, rules), `chooseNode`, node effects.
- `sim/draft.ts` + `data/boons.ts`: pool, roll 3, apply, reroll.
- New phases `route` and `draft`; rogue `advanceStage` goes stage clear → (draft) → route → stage/skip. Elite modifies difficulty and enemy fire patterns (gunner 3-way bursts, bottom-row rings on downbeats).
- `RouteOverlay` + `DraftOverlay` views in RunScene; keyboard left/right/confirm, taps.
- Tests: generation invariants (reachability, row rules, determinism), choices, draft exclusions.

## Task 6 — Docs
- README modes/hangar, research links.
