# Breaking the formation loop — options (2026-09-29)

Playtest note: "the simple shooting at moving things is a little boring over time. maybe we can improve and break
out the rather static 'space invaders' loop." Also: "the retro arcade graphics might reach its limit here. or not?"

## What the loop is today

Every non-boss stage: a formation flies in, sways to the beat, morphs shapes, advances by bars; gunners fire, divers
swoop, world specials add one trick, elites add volleys/walls; beat stages change the scoring, not the enemies.
Five stages per world, boss on the fifth. The route, drafts and boons vary the *build*; the *fight* is always the
same shape. That is the sameness the note describes.

## On the graphics question

The retro look is not the limit. Flat vector ships at 240×320 read fine; what makes a stage feel static is that
nothing in it *does* anything new. Motion, reactions and variety are where the budget should go: enemies that bank,
flinch, break formation, and stage types that move differently. Two cheap art upgrades that would still help:
two-frame idle/thrust animation per enemy kind, and a hit flash that deforms (squash) rather than tints. Neither
needs a new art pipeline. Higher-fidelity sprites would cost a pipeline and would not fix the loop.

## Options, ranked

1. **Stage archetypes (biggest lever).** Give every route node a fight kind; no two consecutive stages share one.
   - `swarm`: no formation. Streams of enemies fly Galaga-style paths (bezier lanes) across the field, in groups of
     4–6 on the bar; kill a whole group for a chain bonus. `spawnFree` in `src/sim/specials.ts` already flies
     free-moving enemies; dive paths exist in `src/sim/dive.ts`.
   - `convoy`: slow freighters cross horizontally with diving escorts; each freighter that exits costs the stage
     bonus, each one killed drops scrap. Time pressure without a timer.
   - `miniboss`: one large enemy with destructible parts on stage 2 or 4, built from the boss part code
     (`src/sim/boss/common.ts`), one phase, 30 s. Bridges the gap between formations and the world boss.
   - `formation` stays as the default and the beat row.
   Cost: medium. New `FightKind` on `RouteNode`, a spawner per kind in `stageFlow`, two enemy movers.
2. **One more player verb.** Movement, fire and graze are the whole vocabulary. Add one active: a **beat slam**
   (hold fire, release on a downbeat: cancels every bullet on screen for points, 1 charge per stage, recharged by
   grazes) or a **dash** (double-tap direction: 12 px blink with i-frames, 2 s cooldown). Boons then upgrade the
   verb (SLAM also damages, DASH leaves a trail of bolts). Changes every second of play; cheapest per minute of
   novelty. Cost: small in sim, needs a touch gesture.
3. **Formation behaviours.** Keep formations but let them act: a synchronized row dive on the fourth bar,
   a split into two half-formations that sway against each other, a retreat-and-charge, a column that drops into
   the player zone as a wall. Cost: small each, reuses `formation.ts` morphs. Good filler between archetypes.
4. **Mid-stage hazards on the beat.** A meteor shower crossing the field, a side laser sweep (warden laser code),
   a supply pod to catch for scrap or a shield, a "drop" bar where every enemy fires a ring (the elite volley code).
   Cost: small each; adds texture rather than structure.
5. **Cover.** Slow-scrolling pillars from the top that block bolts and bullets both. Positioning starts to matter.
   Cost: medium (static box collisions, art).
6. **Roster.** Carriers that spawn minis, linked shields (kill both within a beat), teleporters, reflectors.
   Cost: small per enemy; least structural.

## Recommendation

M21: stage archetypes `swarm` + `convoy` + `miniboss` rotated across the route (option 1), with two formation
behaviours from option 3 for the formation stages that remain. M22: the beat slam (option 2), touch gesture
included, and boons that build on it. Options 4–6 afterwards as filler by playtest feedback.
