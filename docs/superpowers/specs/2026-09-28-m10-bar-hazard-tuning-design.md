# M10 — Bar hazard tuning (Earth elite walls, Warden laser)

Date: 2026-09-28 · Status: implemented · Builds on M9 (`2026-09-25-m9-beat-stages-design.md`)

## Owner input

"Currently the boss and elite fights are way too hard already in the first stage. The moving 'bars' are very hard to dodge."

## Diagnosis

The two "bars" in world 1 (Earth):

1. **Elite wall** — every bar (1.7 s at 140 BPM) a full-width row of bullets falls with a single 26 px gap at a
   *random* spot. The next gap can be a whole field width away, on top of gunner bursts and regular fire. On wide
   fields a wall is ~40 bullets.
2. **Warden laser** (phases 2–3) — an 8 px beam spawns on the player after a 0.8 s blinking 1 px line, then sweeps
   60 px in a *random, unshown* direction. Moving away the wrong way runs into the sweep. Phase 3 stacks a
   10-bullet ring on every beat on top of it.

## Changes

| | Before | After |
|---|---|---|
| Earth wall cadence | every bar | every other bar (shooter only charges before a wall bar) |
| Wall gap | 26 px, anywhere | 40 px, centered within ±60 px of the player |
| Wall bullet spacing | 10 px | 12 px |
| Laser warning | 0.8 s, 1 px line | 1.1 s, line plus a translucent band over the full sweep area |
| Laser sweep / width | 60 px / 8 px | 40 px / 6 px |
| Warden phase 3 ring | every beat | every other beat, none while the laser burns |

Moon and Mars elite volleys and the other bosses are unchanged; they come later in the run.

## Open for playtest

- Whether Moon/Mars elites and the Hive/Dreadnought need the same pass.
- Whether the wall should still aim near the player on later loops, or drift back to random for challenge.
