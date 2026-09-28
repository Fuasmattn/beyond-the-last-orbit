# M14 — Build identity: rarity, synergies and curses

## Why

Every draft in M8 offered flat stat bumps (twin, spread, pierce, heavy, bounty…). No two runs felt different and
no pick was a decision. Roguelites earn their replays from builds: boons that change *how* you play, boons that
get better together, and bargains with a downside.

## Design

### Rarity

Every boon has a rarity that sets its draft colour and how often it shows up:

| Rarity | Colour | Weight (world 1) | Notes |
|---|---|---|---|
| common | white | 60 | stat bumps |
| rare | cyan | 30 | new behaviours |
| epic | gold | 8 (+4 per world) | run-defining |
| curse | purple | one slot in 20 % of drafts | upside + downside |

Each draft slot rolls its rarity from the weights, then a distinct boon of that rarity (falling back to any rarity
when that pool is empty). At most one curse per draft. Rerolls roll fresh.

### Boons

Common (as before): TWIN CANNON, SPREAD SHOT, PIERCE ×2, OVERCLOCK ×2, AFTERBURNER ×2, BOUNTY ×3, NANO REPAIR.

Rare:
- **HEAVY ROUNDS** (+1 damage) and **DEFLECTOR** ×2 (moved up from common).
- **MAGNET** ×2: graze margin +6 px per level. *Synergy: GRAZE CHARGE, HOT ZONE.*
- **GRAZE CHARGE**: every 10 grazes the next shot is a power shot (wide, +1 damage, +1 pierce), in any stage.
  *Synergy: MAGNET.*
- **RICOCHET**: side bolts bounce off the field walls once. *Requires SPREAD SHOT* (never offered without it).
- **SHRAPNEL**: every kill throws two short-lived fragments diagonally upward that inherit bolt damage.
  *Synergy: HEAVY ROUNDS, PIERCE.*

Epic:
- **OVERDRIVE**: at x4 or higher, bolts get +1 damage. Keeps the streak valuable.
- **SECOND WIND**: once per run, the killing hit leaves you with one ship and a shield instead.

Curses:
- **GLASS CANNON**: +2 damage, lose a ship now (never below one).
- **BERSERK**: fire rate +40 %, but a hit resets the multiplier to x1 instead of dropping a level.
- **HOT ZONE**: grazes score ×3, the ship's core is 60 % larger.

### Draft screen

Cards grow to three lines: name in the rarity colour (LV n when stacking), effect, and a tag line —
`WITH <boon>` in green when the synergy partner is owned, dim otherwise; `CURSE` in purple.

### Sim changes

- `ShipStats` gains `grazeMargin`, `grazeMul`, `hurtScale`, `bounce`, `chargePerGraze`, `shrapnel`, `overdrive`,
  `revives`, `fragileStreak`. `SimState.charge` (0..1) accumulates grazes.
- `Bullet` gains `bounce` (wall bounces left) and `ttl` (seconds; shrapnel fragments expire).
- Events: `revived`, `shrapnel`.
- `BoonDef` gains `rarity`, `synergy?`, `requires?`; `rollOffer` rolls by rarity.

## Open for playtest

- Rarity weights and the 20 % curse slot.
- GRAZE CHARGE at 10 grazes; SHRAPNEL fragment range (0.35 s).
- Whether BERSERK is a real bargain or just a trap.
