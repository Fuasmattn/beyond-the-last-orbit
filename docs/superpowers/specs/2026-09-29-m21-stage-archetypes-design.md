# M21 — Stage archetypes

## Why

Playtest (2026-09-29): "the simple shooting at moving things is a little boring over time … break out the rather
static 'space invaders' loop." Every non-boss stage is one formation. Builds vary; fights do not. See
`docs/research/2026-09-29-breaking-the-formation-loop.md` for the option list this picks from.

## Design

### Fight kinds on the route

`RouteNode.fight?: FightKind` with `FightKind = 'formation' | 'swarm' | 'convoy' | 'miniboss'`. Only battle and
elite nodes carry one; the beat row and the world opener (stage 1) are always formations, the boss stage is the
boss. Off the beat row, each fight node rolls from weights `{ swarm: 35, convoy: 30, miniboss: 20, formation: 15 }`;
`miniboss` is dropped from the first map row of world 1 (too early) and the first row never repeats the kind of
the stage-1 formation more than the weights allow. Since the beat row (row 1) is always a formation, rows 0 and 2
rarely put the same kind twice in a row on any path. `RogueState.fight` holds the current node's kind; `chooseNode`
sets it (default `formation`), stage 1 and the boss reset it.

The route overlay names it: node name reads `SWARM BATTLE`, `CONVOY ELITE`, `MINIBOSS`; the description explains
the kind in ≤ 20 chars. The HUD intro banner shows the kind (`SWARM`, `CONVOY`, `MINIBOSS`) where a formation stage
shows `STAGE 1-2`.

### Swarm

No formation. Groups of 4–6 enemies fly a shared cubic Bézier path from off-screen, sweep through the field and
exit; members launch 0.15 s apart. A new group every `SWARM.groupEvery` seconds (2.4 s, elites 1.8 s) until the
stage's budget (`rows × cols` of the formation it replaces) is spent; the stage ends when the budget is spent and
no enemy is left. Four path templates (left swoop, right swoop, S-curve, wide loop) picked per group from the sim
RNG; group kinds cycle grunt → diver → gunner → world special. Each member fires one aimed shot as it passes
40 % of its path (gunners two). Enemies that exit the field are gone (no points, no penalty).

**Chain bonus.** Killing every member of a group scores `SWARM.chainPoints × size × multiplier` and pops
`FULL CHAIN +n`. `Enemy.group` and `Enemy.path` are new fields; `SimState.fight` holds per-stage counters
(`spawned`, `budget`, `groups`, `timer`).

### Convoy

Freighters (new `EnemyKind` `freighter`, 22×10, `CONVOY.hp` = 6 + world, 150 points, 5 scrap) cross the field
horizontally on one of three lanes, alternating direction, at `CONVOY.speed` (34 px/s). Each carries two escorts
(divers) that peel off toward the player one and three seconds after entry as free movers. Freighters drop a bomb
every `CONVOY.bombEvery` seconds while over the field. A new freighter every `CONVOY.every` seconds (3.2 s) up to
`CONVOY.count` (5 + ⌊d / 4⌋). A freighter that exits the far side counts as **escaped**: the stage bonus loses
`CONVOY.escapePenalty` (600) per escape and the stage-clear card shows `CONVOY LOST n` instead of the graze line.
The stage ends when all freighters have spawned and none remains.

### Miniboss: SENTINEL

`BossKind` gains `sentinel`: a 40×16 gun platform, `SENTINEL.hp` 45 × (1 + world × 0.5), elites × 1.4, one phase.
Two turret parts fire aimed shots on alternate beats; every bar the core fires a 3-way spread; every second bar a
ring. Sways like the Warden, enters from the top. Killing it scores `SENTINEL.points` (1500 × (world + 1)), pays
`SCRAP.miniboss` (12), owes a **full** draft, and does not count as a boss kill for credits. Renders with its own
art and core marker; the HUD boss bar works unchanged. The intro banner reads `MINIBOSS` / `SENTINEL`.

### Formation behaviours

- **Row dive.** From d ≥ 4, every fourth bar all divers still in the formation dive together, 0.12 s apart,
  instead of one diver on the timer.
- **Breakaway.** When at most `FORMATION.breakawayShare` (15 %, min 2) of the formation survives (d ≥ 2), the
  survivors leave the grid and charge the player as free movers at `FORMATION.breakawaySpeed` (70 px/s). Ends the
  last-enemy hunt that made stage tails drag.

### Sim changes

- `Enemy` gains `path?: Path` (cubic Bézier, `t`, `duration`) and `group?: number`; `inFormation` excludes path
  enemies; contact damage and fire selection treat them like divers.
- `SimState.fight: FightState` per stage; `StageStats.escaped`; `StageResult.escaped`.
- `step.playing` dispatches on `state.rogue.fight` and ends the stage when the kind's spawner is exhausted and
  `enemies` is empty.
- Events: `groupCleared`, `escaped`.

## Open for playtest

- Weights `{35, 30, 20, 15}` and whether world 1's first row should allow the miniboss.
- Swarm budget parity with formations (same enemy count) may make swarm stages long; cut to 75 % if so.
- Convoy escape penalty 600 vs the 2000 no-hit bonus.
