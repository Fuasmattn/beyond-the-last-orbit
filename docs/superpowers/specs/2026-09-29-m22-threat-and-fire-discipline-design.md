# M22 — Threat scaling and fire discipline

## Why

Playtest (2026-09-29): "way too easy after upgrading the boons … some levels just take a second … we can just
spam it at an angle and then it's too easy." Two causes:

1. Enemy strength scales with world, stage and loop, never with the build. Six picks into world 1 the player has
   two or three times the damage output of a fresh ship and meets the same 1-HP grunts.
2. The on-screen bolt cap (`maxBullets`, 3) counts primary bolts only. TWIN, SPREAD, MIRROR bolts are `extra`
   and free, and a primary that hits vanishes at once, so the cap never binds against a formation: spam at a
   spread angle covers the whole grid at the fire-cooldown rate.

## Design

### Threat

`buildPower(boons)` sums rarity weights over the run's boon stacks: common 1, rare 2, epic 3, curse 1. The
difficulty scalar `d` gains `power × THREAT.perPower` (0.6), so eight power (a typical end of world 1) plays like
five stages later: faster fire, quicker dives, wider sway, an extra column at the thresholds. Enemy HP gains
`⌊power / THREAT.hpPer⌋` (8 → +1 HP at 8 power, +2 at 16). Boss HP scale gains `power × THREAT.bossHpPerPower`
(0.03). Elites inherit all of it. The daily run scales the same way from the same seed.

`difficultyFor(world, stage, loop, power)`; `startStage` passes the run's power. The HUD shows `THREAT n` under
the stage label with `n = ⌊power / THREAT.perLevel⌋` (3), so the player sees the ladder climb as they draft.
Permanent hangar upgrades do not count (they are small and paid for); revisit if maxed hangars still steamroll.

### Volley cap

Every shot is a volley; every bolt it spawns carries the volley id. The cap now counts volleys with any bolt
still in flight, not primary bolts. A fresh ship is unchanged (one bolt per volley). With SPREAD or MIRROR a
volley stays busy until its side bolts leave the field or hit something, so spraying at an angle throttles
itself to roughly three volleys a second, and accurate shots (which clear bolts) fire faster than sprayed ones.
SHIELD BURST rings and SHRAPNEL fragments carry no volley id and never block firing.

## Sim changes

- `Bullet.volley?: number`; `tryFire` counts distinct volleys.
- `Difficulty` computed with `power`; `buildPower` and `threatLevel` in `src/sim/boons.ts`.
- `THREAT` in `src/data/balance.ts`.

## Open for playtest

- `perPower` 0.6 and `hpPer` 8: world 2 grunts at 2 HP with a mid build may feel spongy; try 10.
- Whether TWIN should share the volley (it does) or stay free.
- Threat label wording (`THREAT 3` vs a bar).
