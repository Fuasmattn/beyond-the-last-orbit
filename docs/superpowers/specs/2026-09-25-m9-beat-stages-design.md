# M9 — Beat stages in rogue runs, readability, per-world elite patterns

Date: 2026-09-25 · Builds on M8 (`2026-09-25-m8-run-modes-roguelite-design.md`)

## Owner input

"What if the beat runs are just part of the stages — every X stage is in beat mode. The modifier should have more impact, so it's clearly something special and something players should try to master." Also: go with the M8 recommendations (shield keeps NO HIT, tune balance after playtests, next = readability + per-world elite patterns).

## Beat stages

**Cadence.** In every world of a rogue run, map row 2 (stage 3) is the **BEAT row**: every node on it is a combat node (BATTLE or ELITE) played as a beat stage. The route map marks the row in pink with a BEAT label, so the player plans around it but cannot dodge it: one beat stage per world, three per loop.

**Rules inside a beat stage** (rogue scoring is suspended for the stage):

| | Normal rogue stage | Beat stage |
|---|---|---|
| Multiplier source | hits + grazes | on-beat shots only |
| Max multiplier | x4 | **x8** |
| Off-beat shot | — | drops **two** levels, music sours |
| Misses / grazes | drop / build streak | no effect on streak |
| PERFECT shot (±45 ms) | — | **power shot**: +1 damage, +1 pierce, bigger bolt |
| Beat track | hidden | shown, pink-tinted, stronger pulse |
| Streak | carries over | starts at 0; clamped back to x4 max afterwards |

**Beat rank** at stage clear, from the share of shots on the beat (minimum 10 shots, otherwise C):

| Rank | On-beat | Reward |
|---|---|---|
| S | ≥ 90 % | upgrade draft + stage bonus ×2 |
| A | ≥ 75 % | upgrade draft |
| B | ≥ 50 % | — |
| C | below | — |

Mastering the beat therefore pays in power (drafts, power shots) and score (x8, doubled bonus), not just score. A stage owes at most one draft: an elite beat stage drafts regardless of rank, and an S rank still doubles its bonus.

**Without audio** (no AudioContext) there is no judgement; the stage plays as a normal rogue stage. Muted volume still keeps the clock, and the beat track is visual, so beat stages stay playable muted by watching the track.

**Rhythm Run** stays unchanged (classic x4 rules). Folding it into rogue runs is an option once beat stages have been played.

## Readability (rogue runs)

- **Hurtbox**: enemy bullets hit a 5×4 core at the ship's center, not the whole 13×8 hull; a bright dot shows it. Graze margin is measured from the hurtbox (8 px). Enemy bodies (divers, free movers) still collide with the hull.
- **Telegraph**: elite volleys pick their shooter one beat early; it flashes white before firing.

## Per-world elite patterns

| World | Volley on each bar |
|---|---|
| Earth | **wall**: a row of slow bullets across the field with one 26 px gap near a random lane |
| Moon | **ring**: 10 bullets around the shooter, random rotation (M8 behavior) |
| Mars | **mixed**: aimed 5-way fan, alternating with a ring every other bar |

## Implementation notes

- Input: `FireJudge` returns `{ onBeat, perfect } | null`; `InputFrame.firePerfect`.
- Sim: `SimState.beatMode: 'off' | 'classic' | 'master'` replaces `mode === 'rhythm'` checks for judging; rhythm runs are `classic`, rogue beat stages `master`.
- `RouteNode.beat`, map row `BEAT_ROW = 1`.
- `StageResult.beatRank`.
