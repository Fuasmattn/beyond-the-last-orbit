# Roguelite meta-progression and branching run maps: research for Space Alliance

Date: 2026-09-25. Scope: (a) permanent upgrades bought with credits that change gameplay, and (b) Slay-the-Spire-style branching path choices within a run. Every claim has a source link. **Confidence** notes mark where a source is a community wiki or reverse-engineering and not a first-party developer statement.

Current state in the repo, for context: credits = `floor(score/100) + 50·bosses + 25·perfectStages` (`src/meta/credits.ts`, `CREDITS` in `src/data/balance.ts`). Credits only buy cosmetics priced 0–2000 (`src/data/cosmetics.ts`). Difficulty is a scalar `world·5 + stage + loop·15` (`src/sim/difficulty.ts`).

---

## 1. Slay the Spire map generation

### Grid and paths
- The map is a 7-wide × 15-floor grid. The generator picks a room on floor 1 and connects it upward, each step going to one of the 3 nearest rooms on the next floor. It does this 6 times, and the first two starting rooms must differ. The boss room is then added above the top floor. Source: [Steam guide "Map Generation in Slay the Spire"](https://steamcommunity.com/sharedfiles/filedetails/?id=2830078257), which summarises a community reverse-engineering. A PICO-8 re-implementation describes the same rules: [Lexaloffle BBS](https://www.lexaloffle.com/bbs/?tid=143664). *Confidence: community reverse-engineering. MegaCrit has not published it.*
- Apart from the first and last floors, every room has 1–3 incoming paths and 1–3 outgoing paths. Source: [StS wiki: Map Generation](https://slaythespire.wiki.gg/wiki/Map_Generation).
- An open-source Unity clone exposes the generator's knobs (number of starting nodes, pre-boss nodes, extra paths). It is a good reference implementation: [silverua/slay-the-spire-map-in-unity](https://github.com/silverua/slay-the-spire-map-in-unity).

### Fixed floors and room weights (Act 1; Acts 2 and 3 follow the same pattern)
- Floor 1: easy-pool normal fights only. Floor 9: all Treasure. Floor 15: all Rest Sites. Floor 16: boss. Source: [StS wiki: Map Generation](https://slaythespire.wiki.gg/wiki/Map_Generation).
- Weights on the remaining floors: Normal 53%, Unknown (?) 22%, Rest 12%, Elite 8%, Merchant 5%. Source: [StS wiki: Map Generation](https://slaythespire.wiki.gg/wiki/Map_Generation).
- Placement constraints: no Elite or Rest on the early floors, no Rest on floor 14, Elite/Shop/Rest never twice in a row on one path, and sibling rooms that share a parent must be different types. Source: [Steam guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2830078257) and the [Lexaloffle re-implementation](https://www.lexaloffle.com/bbs/?tid=143664), which cites "no 2 rest sites in a row". *Confidence: medium. I could not fetch the full guide (HTTP 429), so treat the exact floor thresholds as approximate.*
- From Ascension 1, Elites are about 60% more common. Source: [StS wiki: Ascension](https://slaythespire.wiki.gg/wiki/Ascension).

### Unknown (?) rooms: "pity" odds
- A ? room starts with Monster 10%, Shop 3%, Treasure 2%, and Event for the rest. Each time a ? room is *not* a given type, that type's chance rises by its base value. It resets to base when that type is rolled, and all odds reset between acts. Source: [StS Fandom: Unknown Location](https://slay-the-spire.fandom.com/wiki/Unknown_Location). An analysis of the game's code confirms this: [Correlated Randomness in Slay the Spire](https://forgottenarbiter.github.io/Correlated-Randomness/).
- That same analysis shows StS reuses RNG streams in ways that correlate outcomes players are not supposed to be able to predict ([forgottenarbiter](https://forgottenarbiter.github.io/Correlated-Randomness/)). **Lesson for a deterministic sim:** give the map, rewards, and combat their own seeded streams.

### Node economics (what each node pays and costs)
| Node | Reward | Cost / risk | Source |
|---|---|---|---|
| Elite | random Relic + 25–35 gold + card reward | hard fight, HP loss | [StS wiki: Elite](https://slaythespire.wiki.gg/wiki/Elite) |
| Rest | heal 30% max HP **or** upgrade a card (a real either/or) | spends a floor without a reward | [StS wiki: Rest Site](https://slaythespire.wiki.gg/wiki/Rest_Site) |
| Merchant | 5 class cards (one at 50% off), 2 colorless, 3 potions, 3 relics. Card removal costs 75 gold, +25 each use | gold | [StS wiki: Merchant](https://slaythespire.wiki.gg/wiki/Merchant) |
| Treasure | guaranteed relic (floor 9) | none | [StS wiki: Map Generation](https://slaythespire.wiki.gg/wiki/Map_Generation) |

Design takeaway: the Rest node's "heal *or* upgrade" is the cleanest small risk/reward dial. Rest is valuable even at full health, so skipping healing is a real decision.

### What the designer said about balance (GDC 2019)
Slides from Anthony Giovannetti's talk ([GDC Vault PDF](https://media.gdcvault.com/gdc2019/presentations/Giovannetti_Anthony_SlayTheSpire.pdf), [video](https://www.youtube.com/watch?v=7rqfbvnO_H0)):
- The balance goal is "every card should have a place", and to "avoid anything too warping".
- Being single-player is an advantage: rare overpowered combos don't hurt anyone else.
- "Data is evidence, but not a conclusion." Don't rely on metrics alone.
- Ascension was framed as **"Player Skill Stratification"**: 20 levels, unlocked one after another.

### Ascension (the opt-in challenge knob)
- You unlock it by beating the Act 3 boss, and each level unlocks by winning at the previous one. The 20 levels stack small modifiers: more elites (A1), more damage from normal, elite, and boss enemies (A2–4), less post-boss healing (A5), a starting curse (A10), shop +10% (A16), harder movesets (A17–19), and a double boss (A20). Source: [StS wiki: Ascension](https://slaythespire.wiki.gg/wiki/Ascension).

---

## 2. Other map and path structures

- **Monster Train** gives two parallel paths (left or right) between each pair of battles, on every ring except the first and last. Each side shows its facilities: merchants, upgrade stations, artifact picks, pyre heals, coin stashes. Rules: one side can't have two merchants, and the same merchant type can't appear on both sides. Skipping an artifact pick pays 25 coins. Sources: [Neoseeker: Map and Facilities](https://www.neoseeker.com/monster-train/walkthrough/Map_and_Facilities), [Monster Train Fandom: Overworld Events](https://monster-train.fandom.com/wiki/Overworld_Events). *This binary per-stage choice suits short, fast runs better than a full StS grid.*
- **Hades** shows each chamber's reward on the door before you enter. A skull under the symbol marks a harder encounter with a bigger reward. Infernal (Erebus) Gates are optional high-risk rooms with improved rewards, and Heat gates who can enter them. Sources: [Hades Fandom: Chambers and Encounters](https://hades.fandom.com/wiki/Chambers_and_Encounters), [Hades Fandom: Infernal Gate](https://hades.fandom.com/wiki/Infernal_Gate). *Showing rewards upfront plus marking risky nodes is what makes path choice meaningful rather than a guess.*
- **FTL**: each sector has 19–24 beacons and an exit on the far side. Every jump advances the Rebel Fleet, which takes over beacons. A fleet-held beacon means a tough fight that pays only 1 fuel. This limits "XP farming" in a natural way: explore for scrap, but the clock pushes you on. Sources: [FTL Fandom: Sectors](https://ftl.fandom.com/wiki/Sectors), [FTL Fandom: Rebel Fleet](https://ftl.fandom.com/wiki/Rebel_Fleet), [FTL Fandom: Beacons](https://ftl.fandom.com/wiki/Beacons). Designer background: [GDC 2013 FTL postmortem](https://gdcvault.com/play/1018034/Designing-Without-a-Pitch-FTL).
- **Into the Breach**: an island is 5 missions, the last one a fixed boss mission. Completing every bonus objective ("Perfect Island") lets you choose a new item, a pilot, or +2 grid power. Reputation earned in missions is spent after the island. Sources: [ItB Fandom: Missions](https://intothebreach.fandom.com/wiki/Missions), [ItB Fandom: Tips](https://intothebreach.fandom.com/wiki/Tips_and_tricks). *This matches Space Alliance's 5-stages-then-boss world almost exactly.*

---

## 3. Permanent upgrades without trivialising the game

### Hades: Mirror of Night
- Purpose, per creative director Greg Kasavin: to make you "meaningfully more powerful from one playthrough to the next", combining player skill with character power. Supergiant chose "many channels of permanent progression" so there is no sense of "game over" ([Tom's Guide interview](https://www.tomsguide.com/features/hades-exclusive-interview-supergiant)). He described difficulty-mitigating systems as a response to story-blocking "difficulty walls" ([GDC Podcast ep. 16](https://gdconf.com/article/roguelikes-and-narrative-design-with-hades-creative-director-greg-kasavin-gdc-podcast-ep-16/)).
- Cost curves span two orders of magnitude. Cheap early ranks: Shadow Presence 10/15/20/25/30. Steep "insurance": Death Defiance 30 → 500 → 1000. Luck ranks cost a flat 50–100 each but are long. Rerolls are the costliest: Fated Authority 500 → 2250. Talents unlock in pairs behind a second currency (5/10/20/30 keys). Every talent has an alternate you can swap to, but only one can be active. Source: [Fextralife: Mirror of Night](https://hades.wiki.fextralife.com/Mirror_of_Night).
- Respec is cheap and refunds everything, which encourages experimenting ([TheGamer analysis](https://www.thegamer.com/hades-mirror-of-night-roguelite-progression/)). The March 2020 "Nighty Night" update doubled the talents to create "more choices to fit your playstyle" ([Supergiant patch notes](https://www.supergiantgames.com/blog/hades-the-nighty-night-update-patch-notes/)).
- **Heat / Pact of Punishment** unlocks after the first clear. Ranked conditions add Heat: Hard Labor adds +20% enemy damage per rank (5 ranks), Approval Process removes one boon choice per rank, Convenience Fee raises shop prices 40%. **Routine Inspection disables Mirror talents** 3 per rank, so the challenge knob can take away meta power. Bounties pay one-time currencies for clearing at a target Heat. Source: [Hades Fandom: Pact of Punishment](https://hades.fandom.com/wiki/Pact_of_Punishment).

### Vampire Survivors: PowerUps
- Price = `InitialPrice × (1 + ranksOwned) + floor(20 × 1.1^totalRanksBought)`. The base cost grows linearly per upgrade, plus a global fee that grows exponentially and applies to every purchase. Refunds are free and full. Maxed PowerUps can be toggled off. Examples: Might +5%/rank ×5 at 200, Armor ×3 at 600, Revival ×1 at 10,000. Source: [VS wiki: PowerUps](https://vampire.survivors.wiki/w/PowerUps), [cost calculator](https://vampire.survivors.wiki/w/Calculators/PowerUp_Cost).
- Level-ups offer 3 choices, with a Luck-based chance of a 4th. Reroll, Skip, and Banish are separate buyable resources. Source: [VS wiki: Level up](https://vampire.survivors.wiki/w/Level_up), [VS wiki: Skip](https://vampire.survivors.wiki/w/Skip).

### Rogue Legacy
- RL1: each purchase makes *every other* manor upgrade 10 gold dearer, and the same upgrade's next level costs more again. Stats cap at 75 levels, utilities at 5. Source: [Rogue Legacy wiki: Upgrades](https://roguelegacy.wiki.gg/wiki/Upgrades). RL2 turns on a similar global "Labor Cost" inflation from Manor level 30 ([RL2 Fandom: Upgrades](https://rogue-legacy-2.fandom.com/wiki/Upgrades)).
- Lesson: a global surcharge stops players maxing one stat cheaply and pushes them to spread purchases.

### Dead Cells
- Bénard's GDC 2019 postmortem frames it as "death as progression": each run counts, and the game-over-to-new-game loop is short ([slides](https://media.gdcvault.com/gdc2019/presentations/Benard-Sebastian-DeepCells.pdf)).
- Permanent Cell spending mostly **adds options** (new items in the drop pool, flask charges, keeping some gold), not raw stats ([Wikipedia summary](https://en.wikipedia.org/wiki/Dead_Cells); [Steam discussion](https://steamcommunity.com/app/588650/discussions/0/1760230682465933294/), *community*).
- **Boss Stem Cells** are the challenge knob. Each tier removes healing (fewer or no flask refills), buffs enemies, and *multiplies Cell drops ×2/×3*. Higher tiers also raise item levels and open new areas. Source: [Dead Cells wiki: Boss Stem Cells](https://deadcells.wiki.gg/wiki/Boss_Stem_Cells). *Pattern: pay higher meta-currency for opting into difficulty.*

### Risk of Rain 2 and Balatro: unlock-only meta
- In RoR2, permanent unlocks are survivors, alternate skills, items, and toggleable Artifacts. In-run power comes from stacking items ([Steam store page](https://store.steampowered.com/app/632360/Risk_of_Rain_2/), [RoR Fandom: Items](https://riskofrain.fandom.com/wiki/Item_(Risk_of_Rain_2))). *I found no first-party statement on "no stat meta", so this is inferred from the systems.*
- Balatro has 8 stacking Stakes, unlocked per deck by winning. They are small, legible rule changes, for example: no reward for the Small Blind, score targets rising faster, one fewer discard, Eternal/Perishable/Rental joker stickers ([Balatro wiki: Stakes](https://balatrowiki.org/w/Stakes)).
- Monster Train Covenant goes to rank 25. Every rank stacks, and a win at the current rank unlocks the next ([Monster Train Fandom: Covenant Ranks](https://monster-train.fandom.com/wiki/Covenant_Ranks)).

### Patterns that recur across these games
1. **Cap raw power and let it flatten out.** Stat ranks are few (VS Might is 5 ranks of +5%) or tiny per rank (Hades +5 HP). Big safety nets (revives) are priced 10–30× a basic rank (Hades Death Defiance, VS Revival).
2. **Sidegrades and pool unlocks over stats.** Hades alternate talents, Dead Cells blueprints, RoR2 skills.
3. **Cost curves**: linear per rank (VS, RL) plus a global surcharge (VS fee, RL +10 gold), so total cost is superlinear.
4. **Free respec or toggle** (Hades, VS) keeps experiments cheap and lets purists turn meta off.
5. **A challenge ladder that you unlock by winning, with small stacked rules** (StS 20, MT 25, Balatro 8). The best versions **pay more** (Dead Cells multipliers, Hades bounties) or **switch meta off** (Hades Routine Inspection).
6. **Pick 1 of 3** is the default draft, with rerolls, skips, or a 4th option as buyable meta (VS, Hades Fated Authority, StS card rewards).

---

## 4. Recommendations for Space Alliance

### 4.1 Run structure: a sector map per world
Keep "5 stages, boss at stage 5". Make **stages 2–4 a choice**, as a small DAG between the Monster Train two-way fork and a mini StS grid:

```
Row 5:            [BOSS]                 fixed
Row 4:    (A)      (B)      (C)          pre-boss row: at least one Dock/Shop reachable
Row 3:    (A)      (B)      (C)          mid row: at least one Elite and one Derelict
Row 2:    (A)      (B)      (C)
Row 1:            [FIGHT]                fixed normal stage (like StS floor 1)
```
- 3 lanes, and each node links to 1–2 nodes in the next row (StS "nearest 3" limited to adjacent lanes). Paths never cross. Show the whole map and preview each node's reward, like Hades doors. A skull marks the risky nodes.
- Generate from the run seed with a **dedicated `mapRng` stream**, separate from combat and reward RNG ([correlated-randomness lesson](https://forgottenarbiter.github.io/Correlated-Randomness/)). Replays and determinism tests stay stable.
- Rules adapted from StS: no Elite in row 2 of world 1. No two Docks in a row on a path. Sibling nodes differ in type. Every map guarantees ≥1 path with an Elite and ≥1 path with no Elite.
- The map screen replaces or extends the current WARP transition (`WARP` in `balance.ts`). Keep the decision under ~10 s and keep the song running, so the rhythm flow isn't broken.

### 4.2 Node set
Add one **in-run currency, "Scrap"**, earned from kills and grades and reset every run. It is separate from meta **credits** so the two economies don't mix.

| Node | What happens | Reward | Risk / trade-off |
|---|---|---|---|
| **Fight** | normal stage | score, Scrap, credits via score | lives |
| **Elite** (skull) | stage at +3 difficulty scalar, with a shielded/special row and one modifier (faster fire, armored row) | **pick 1 of 3 augments** + 2× Scrap | high chance to lose a life |
| **Dock** (rest) | no combat. Choose **+1 life** *or* **upgrade an augment** (StS rest "heal or smith") | – | skips a stage's score and Scrap, so you "don't farm" |
| **Shop** | spend Scrap on augments (3 offered), +1 life, reroll. Reroll cost rises +25 each use (StS removal pattern) | – | skips a stage's score |
| **Signal** (?) | text event with 2–3 options (e.g. "take 1 damage for an augment"). Use StS pity odds: 10% becomes an ambush fight, rising by 10% per miss | variable | variable |
| **Derelict** | guaranteed augment, no combat (StS floor-9 treasure) | 1 augment | none. Place at most one per world, on row 3 |
| **Boss** | fixed | pick 1 of 3 **rare** augments + 50 credits (existing) | – |

Starting weights for rows 2–4 (tune later): Fight 45%, Elite 15%, Signal 20%, Dock 10%, Shop 10%. From world 2 on, force row 4 to offer a Dock or Shop in at least one lane (StS floor-15 rest before the boss).
**Endless loops**: reuse the generator with a higher Elite weight (+5% per loop, echoing Ascension 1's ~60% more elites) and Elite rewards scaled up.

**Augments** (in-run, pick 1 of 3) should be rhythm-flavoured and map onto existing `PLAYER` fields: spread shot, +1 `maxBullets`, pierce on PERFECT, shield charge per 8 PERFECTs, a bomb on the downbeat, a slow-mo "fever" after streaks. Draft 3 and allow a skip for Scrap (Monster Train's 25-coin skip).

### 4.3 Permanent upgrades ("Hangar")
Principles: few ranks, small steps, expensive insurance, some slots are sidegrades/unlocks, and a free toggle/respec. Cost of rank *n* = `base × n` + **global surcharge** `10 × totalRanksOwned` (RL1 style, and gentler than VS's exponential fee). **Calibration target:** a full Hangar costs roughly 25–35 average runs of credits. Measure the real average credits/run first; the numbers below assume ~300 credits per run.

| Upgrade | Effect/rank | Ranks | Base (rank n = base×n) | Maps to |
|---|---|---|---|---|
| Thrusters | +5% max speed | 3 | 100 | `PLAYER.maxSpeed` |
| Capacitor | −5% fire cooldown | 3 | 150 | `PLAYER.fireCooldown` |
| Magazine | +1 max bullets on screen | 1 | 800 | `PLAYER.maxBullets` |
| Hull Plating | +1 starting life (cap stays `maxLives`) | 2 | 500 | `PLAYER.startLives` |
| Phase Coils | +0.25 s invulnerability after a hit | 2 | 200 | `PLAYER.invulnTime` |
| Salvage Rig | +10% Scrap | 3 | 150 | in-run economy |
| Deep Hold | start the run with +20 Scrap | 3 | 100 | shop access (Hades Deep Pockets) |
| Tactical Scan | reveals Signal outcomes on the map | 1 | 400 | map info |
| Draft Reroll | +1 augment reroll per run | 3 | 250 | draft (Hades Fated Authority) |
| Wide Draft | 4th augment choice, 25%/rank | 2 | 600 | draft (VS Luck) |
| Emergency Warp | once per run, revive with 1 life | 1 | 2500 | insurance (Death Defiance / VS Revival) |
| Blueprints (×N) | adds a new augment to the pool, no stat change | 1 each | 200–600 | variety (Dead Cells) |

Do **not** meta-upgrade the rhythm judgement windows. That is the game's skill core. At most, offer one small "Metronome" sidegrade that trades something for leniency. Summed stat effects stay around +15% speed, +15% fire rate, and +2 lives. That is meaningful, but it doesn't replace skill (Kasavin's "skill plus power" framing). Respec is free and each rank can be toggled off (Hades/VS).

**Highscores:** tag each score with its Threat level and a "Hangar power" flag. Alternatively, keep an extra leaderboard at Threat ≥ Lockdown, so meta power doesn't devalue old scores.

### 4.4 Challenge knob: "Threat Level" 0–10
Unlocked after the first win against the world-3 boss. Each level unlocks by winning at the one before (StS/Balatro/Monster Train). Levels stack. **Credit multiplier = 1 + 0.1 × Threat** (Dead Cells pays more for harder cells). A one-time credit bounty the first time you clear each level (Hades bounties).

| Lvl | Modifier |
|---|---|
| 1 | Elites ~50% more common on the map |
| 2 | Normal stages: +2 difficulty scalar |
| 3 | Elites: +1 enemy HP (like `hpBonus`) |
| 4 | Bosses: +25% HP (`bossHpScale`) |
| 5 | Docks give an upgrade *or* a life, but not a life if you're already at 3 |
| 6 | Start with one fewer life |
| 7 | Shop prices +25% (Hades Convenience Fee) |
| 8 | Augment drafts offer 2 instead of 3 (Hades Approval Process) |
| 9 | Songs start +5 BPM (reuses `LOOP_BPM_STEP`) |
| 10 | **Lockdown**: Hangar stat upgrades disabled, only Blueprints stay (Hades Routine Inspection) |

### 4.5 Suggested build order
1. Seeded map generator plus a map scene, with only Fight/Elite/Dock (pure sim, unit-testable).
2. Augment draft (pick 1 of 3) with 8–10 augments.
3. Scrap, Shop, and Signal.
4. Hangar (persisted in `SaveData` with a migration) plus respec.
5. Threat Level and tagging on the highscore table.
