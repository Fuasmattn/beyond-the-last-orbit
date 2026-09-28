# M15 — Scrap, SHOP nodes and SIGNAL events

## Why

Route picks were shallow: BATTLE / ELITE / CACHE / REPAIR, all resolved the same way. The roguelite research (M8)
proposed an in-run currency, a shop and "?" rooms; M8 deferred them. This adds all three so a route is a plan,
not a coin flip.

## Design

### Scrap

In-run currency, lost at the end of the run. Every kill drops 1 scrap (2 on elite stages), a boss drops 30.
Shown under SHIPS on the HUD. SIGNAL events pay and charge scrap.

### SHOP node (`S`, green)

Three boons priced by rarity (common 25, rare 40, epic 70, curse 15), REPAIR +1 SHIP (30), REROLL (10, +10 each
use), LEAVE. Buy as many as you can afford; rows you cannot afford are dimmed. Every world map has at least one
SHOP (a non-battle node off the beat row is replaced if the roll had none).

### SIGNAL node (`?`, orange)

A random event from a pool of four, each with two choices; no event repeats within a run:

| Event | Choice A | Choice B |
|---|---|---|
| DISTRESS CALL | ESCORT: elite fight, then 2 upgrades | IGNORE: +40 scrap |
| DERELICT HULK | BOARD: 50 % +60 scrap, 50 % ambush (elite fight, no upgrade) | SCAN: +20 scrap |
| BLACK MARKET | TRADE A SHIP for a rare-or-better upgrade draft (needs 2+ ships) | 30 SCRAP for a shield |
| GHOST SIGNAL | TUNE IN: the next fight is a beat stage | STATIC: +25 scrap |

### Sim

- `NodeKind` gains `shop` and `signal`; route weights elite 30 / cache 25 / repair 30 / shop 25 / signal 30.
- `Phase` gains `shop` and `event`. `RogueState`: `scrap`, `draftsOwed` (replaces `draftPending`), `draftRarity`
  (minimum rarity for the next draft), `ambush` (this fight owes no draft), `beatNext`, `shop`, `event`,
  `seenEvents`.
- `rollOffer(state, r, minRarity?)`; shop offers reuse it.
- Events: `scrap` (amount, x, y for popups), `shopOpen`, `bought`, `eventOpen`, `eventResolved` (popup text).

### View

- Draft overlay gains a shop mode: cards show `<price> SCRAP` in green (affordable) or red; buying keeps the shop
  open. Event overlay: title, two description lines, two choice rows (dimmed when unaffordable).
- Route overlay: `S` and `?` nodes with descriptions. Font gains `?`.

## Open for playtest

- Scrap income (≈40–55 per battle) against shop prices; whether curses at 15 are too tempting.
- DERELICT ambush odds; whether BLACK MARKET should also accept a shield as payment.
