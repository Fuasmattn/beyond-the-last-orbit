# M8 — Run modes, roguelite runs, permanent upgrades

Date: 2026-09-25 · Status: implemented (hands-off iteration; owner reviews afterwards)

Research backing this spec: `docs/research/2026-09-25-*.md` (roguelite meta and branching maps, bullet-hell and rhythm hybrids, rhythm timing and latency).

## Problem

1. The game still plays like classic Space Invaders: one linear stage track, no decisions between stages, and credits only buy cosmetics.
2. The beat mechanic is the identity of the game, but it needs sound. Muted it plays and feels differently, and a lot of play happens muted (phones, commutes, office).
3. Adding roguelite choices, bullet-hell pressure and beat timing to the *same* run stacks three skill axes and makes every one of them shallower.

## Decision: two run types

| | **RHYTHM RUN** (existing game) | **ROGUE RUN** (new) |
|---|---|---|
| Stage flow | Linear: 3 worlds × 5 stages, boss at 5, endless loop | Branching route map per world; boss at 5 |
| Multiplier | On-beat shots (x1 → x4), off-beat sours the music | Hit streak + grazes (x1 → x4); misses drop a level |
| Sound | Required for full play | Optional; music is ambience, nothing is judged |
| Beat track | Shown | Hidden (enemies still sway to the beat) |
| Permanent upgrades | Not applied (pure skill, fair highscores) | Applied |
| In-run upgrades | None | Drafted: pick 1 of 3 |
| Bullet-hell elements | Bosses only (as today) | Elite stages, graze scoring |
| Highscores | Own table | Own table |

Credits are earned in both run types. The Rhythm run stays the "arcade score attack" mode; the Rogue run carries the new systems. This keeps the beat mechanic intact without forcing it on muted play, and keeps rhythm highscores untouched by upgrades.

Rejected alternatives:
- *One mode, beat optional via setting*: highscores become incomparable, and the design has to balance both sources inside one mode.
- *Rhythm + roguelite in one run (à la BPM: Bullets Per Minute)*: possible later as an "Ascension"-style modifier ("Beat Lock"), but not as the default; see Future.

## Rogue run

### Route map (Slay-the-Spire style, scaled down)

Per world: stage 1 is a fixed battle, stages 2–4 are picked from a map, stage 5 is the boss.

- Map rows 2, 3, 4 hold 2–3 nodes each (lanes 0..2). Each node connects to the node(s) in the next row whose lane differs by at most 1; every node is reachable and has at least one exit.
- The map is generated from the sim RNG at world start (deterministic per seed) and shown after every stage clear; the player picks among the reachable next nodes. The chosen path is highlighted.
- Node types:

| Node | Fight | Reward | Trade-off |
|---|---|---|---|
| BATTLE | normal stage | score only | safe score and credit farming |
| ELITE | harder stage: +3 difficulty, +1 enemy HP, denser fire, spread/ring patterns | ×1.5 score in the stage, then draft 1 of 3 upgrades | risk of losing ships |
| CACHE | none | draft 1 of 3 upgrades | skips a stage's score (fewer credits) |
| REPAIR | none | +1 ship (or +1 shield charge at max ships) | skips a stage's score |

- Generation rules: each row has at least one BATTLE; at most one CACHE and one REPAIR per row; no REPAIR in row 2; ELITE weight rises with world.
- Boss kill also grants a draft.

### In-run upgrades (draft pick 1 of 3)

Drafted from a pool, excluding maxed entries, seeded by the sim RNG. First set:

| Upgrade | Effect | Max |
|---|---|---|
| TWIN CANNON | fires two parallel bolts | 1 |
| SPREAD SHOT | adds two angled side bolts | 1 |
| PIERCE | bolts pass through +1 enemy | 2 |
| OVERCLOCK | fire cooldown ×0.8, +1 bolt on screen | 2 |
| HEAVY ROUNDS | +1 damage per bolt | 1 |
| DEFLECTOR | +1 shield charge, refilled every stage | 2 |
| BOUNTY | +25 % score | 3 |
| AFTERBURNER | +15 % move speed | 2 |
| NANO REPAIR | +1 ship now | ∞ |

Side bolts (twin/spread) do not count toward the on-screen bolt cap.

### Scoring in the Rogue run

- **Streak multiplier**: every hit adds 1 to the streak, same steps as rhythm (4 per +0.5, max x4). A bolt that leaves the screen without hitting drops one level; so does getting hit (a reset felt too punishing next to denser elite fire — Danmaku Unlimited model, see research).
- **Graze**: an enemy bullet that enters the 6 px margin around the ship and leaves it without hitting scores 10 × mult and adds 1 to the streak (once per bullet). This is the bullet-hell reward for playing close.
- **Shield hits** cost no ship and keep NO HIT, but drop one multiplier level.
- Stage bonus: accuracy × 2000 instead of accuracy + on-beat; PERFECT = no hit and accuracy ≥ 70 %.

## Permanent upgrades (HANGAR)

New title-menu entry. Credits buy levels; applied only to Rogue runs.

| Upgrade | Per level | Costs |
|---|---|---|
| HULL | +1 starting ship | 600, 1800 |
| CANNON | +1 bolt on screen | 400, 1200 |
| COOLANT | fire cooldown −10 % | 300, 900, 2000 |
| THRUSTERS | move speed +8 % | 250, 750 |
| DEFLECTOR | start every world with 1 shield charge | 1500 |
| SALVAGE | +15 % credits from Rogue runs | 500, 1500, 3000 |
| INSIGHT | +1 draft reroll per run | 1000, 2500 |

Costs grow ~3× per level so early levels are cheap onboarding and late levels are long-term goals. Total ≈ 20 k credits (a solid run pays 300–800).

## Save data v2

- `upgrades: Record<string, number>` (levels, clamped to the definition's max).
- `rogueHighscores: HighscoreEntry[]` alongside the existing (rhythm) table.
- Migration v1 → v2 adds empty defaults.

## Rhythm timing fix (shipped with M8)

Hit window ±70 ms → ±100 ms (PERFECT ±45 ms), capped at ¼ beat for fast endless tempos; grades follow the scoring verdict; presses judged at the input event's timestamp; `currentTime` smoothed against `performance.now()`; beat visuals drawn ~20 ms ahead for display latency, plus a user **Visual offset** setting (±100 ms) separate from the input calibration.

## Deviations from research recommendations

- *Bullet-hell research* recommends cosmetic-only meta progression. The owner explicitly asked for gameplay upgrades, so the HANGAR changes stats — but only in Rogue runs, keeping Rhythm highscores clean. Revisit if Rogue feels solved.
- *Roguelite research* proposes a second in-run currency (Scrap), Shop/Signal nodes and a Threat ladder. Deferred to keep M8 shippable; see Future.

## Future (not in M8) — suggested order

1. **Readability for denser fire** (bullet-hell research): small visible hitbox dot, enemy bullets with a bright core + dark rim in a color the player never uses, wind-up telegraph before elite rings.
2. **Per-world elite patterns**: walls with gaps (Earth), rings/spirals (Moon), aimed + static mixes (Mars) — data-driven emitters (angle, count, speed, spin, beat-lock flag) that beat-lock in Rhythm runs.
3. **Threat ladder** (Ascension/Heat): unlocked by the first Rogue world-3 clear, 0–10 stacking modifiers, credits ×(1 + 0.1 × threat), level 10 disables hangar stats. Tag rogue highscores with threat level.
4. **Scrap + SHOP node + SIGNAL (“?”) node**: in-run currency, shop with rising reroll price, random events with ambush risk.
5. **Upgrade synergies / downsides** (Nova Drift-style mods), node reward previews beyond the node type, a draft "4th choice" hangar upgrade, one-per-run revive.
6. **Beat Assist / Beat Lock**: rhythm run assist (all shots on-beat, unranked) and a rogue modifier that re-enables the beat multiplier.
7. **Calibration upgrades**: visual sync test (nudge a flash onto the click), warn when `outputLatency` > 100 ms (Bluetooth), early/late hints next to grades.
