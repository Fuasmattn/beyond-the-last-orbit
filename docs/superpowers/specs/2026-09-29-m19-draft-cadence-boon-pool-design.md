# M19 — Draft cadence and a bigger boon pool

## Why

Playtest (2026-09-29): "maybe we need more boons (also earlier)". With 18 boons and drafts only after elites,
bosses, beat S/A ranks, caches and two events, world 1 yields three or four picks and most of them are the same
stat bumps. Builds converge before they diverge.

## Design

### Draft tiers

`RogueState.draftsOwed` (a counter) and `draftRarity` become `drafts: DraftTier[]`, a queue consumed after every
stage clear. A tier sets what a draft may roll:

| Tier | Rolls | Curses | Source |
|---|---|---|---|
| `starter` | rare only | no | the pick before stage 1 (also the daily) |
| `basic` | common only | no | every cleared battle stage |
| `full` | rarity weights as before | 20 % slot | elite, boss, beat S/A, cache, DISTRESS |
| `rare` | rare or epic | no | BLACK MARKET |

The open draft's tier is kept in `draftTier` so REROLL rolls the same tier (before, rerolling a rare draft
returned commons).

**Cadence.** Every non-ambush stage clear owes a draft: `basic` for a plain battle, `full` when the stage was an
elite, a boss or ranked S/A on the beat. Beat S/A on an elite stage still owes one draft, not two. World 1 now
yields roughly six picks (starter, stage 1, three map stages, boss) instead of three or four.

**Starter identity.** The starter draft rolls three rares: MAGNET, HEAVY ROUNDS, DEFLECTOR, GRAZE CHARGE,
SHRAPNEL, or the new rares below. The build is decided on the first screen.

### New boons

Twelve boons; names ≤ 16 and descriptions ≤ 22 characters as before.

Common
- **SALVAGE** ×2: +1 scrap per kill.
- **LONG BARREL** ×2: bolt speed +30 %.
- **WIDE BOLTS** ×2: bolts 2 px wider (easier hits, same art centred).
- **HARDPOINT** (repeatable): +1 shield now. Offered while the ship holds fewer than two shields.

Rare
- **SNIPER**: +1 damage while the ship is (almost) still. *Synergy: HEAVY ROUNDS.*
- **ARC**: every kill zaps the nearest enemy within 60 px for 1 damage. *Synergy: SHRAPNEL, PIERCE.*
- **SHIELD BURST**: a shield absorbing a hit fires a ring of eight bolts. *Synergy: DEFLECTOR, HARDPOINT.*
- **GRAZE MEND**: every 25 grazes restore one shield. *Synergy: MAGNET.*

Epic
- **JACKPOT**: multiplier cap +2 (x4 → x6, beat stages x8 → x10).
- **MIRROR**: every primary shot also fires from the ship's mirror position across the field. A translucent
  ghost ship marks it.

Curse
- **LOANSHARK**: +80 scrap now, scrap income halved.
- **BLIND SPOT**: +2 damage, grazes score nothing (they still feed the streak, GRAZE CHARGE and GRAZE MEND).

### Sim changes

- `ShipStats` gains `boltSpeed`, `boltW`, `scrapBonus`, `scrapMul`, `sniper`, `arc`, `shieldBurst`,
  `mendGrazes`, `multBonus`, `mirror`. `SimState.mend` counts grazes toward the next shield.
- `multCap` adds `ship.multBonus`.
- Scrap per kill: `round((base + scrapBonus) * scrapMul)`.
- Events: `arc` (from → to), `shieldBurst`.
- `rollOffer(state, r, tier)` replaces the `minRarity` parameter.

## Open for playtest

- Six picks in world 1 may be too many screens; fallback is `basic` drafts on odd stages only.
- SNIPER stillness threshold (10 px/s) and ARC range (60 px).
- JACKPOT at +2 levels; MIRROR bolts count as extra (uncapped) shots.
