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

## Moon and Mars pass

Owner follow-up: "yes, give moon and mars the same pass".

The Mars bar is the **Dreadnought phase 3 curtain**: a full-width bullet row every 2 beats (0.75 s at 160 BPM,
~52 px apart when falling), gap 40 px (68 on the downbeat) and the gap center moving up to ~60 px per curtain.
Moon has no bars; the Hive and the Moon/Mars elites were thinned out the same way.

| | Before | After |
|---|---|---|
| Dreadnought curtain cadence | every 2 beats, wide on the downbeat | every 4 beats, wide every other curtain |
| Curtain gap (full width) | 40 / 68 px | 52 / 80 px |
| Curtain bullet step | 14 px | 16 px |
| Curtain gap drift | `sin(beat · 0.4)` | `sin(beat · 0.12)` — at most ~40 px between curtains |
| Hive phased ring | 12 bullets | 10 bullets |
| Hive phase 3 diver pair | every 4 beats | every 6 beats |
| Moon/Mars elite ring | 10 bullets | 8 bullets |
| Mars elite fan spread | 0.18 rad | 0.24 rad |

## Open for playtest

- Whether the wall should still aim near the player on later loops, or drift back to random for challenge.
