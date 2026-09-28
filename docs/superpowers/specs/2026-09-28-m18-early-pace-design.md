# M18 — Early pace

## Why

Playtest feedback (2026-09-28): "the first 1, 2 levels are too boring and take too long… users might drop out
early." The numbers agree. Stage 1 fields 40 enemies, four rows of plain grunts under one gunner row, firing about
0.8 shots a second, with the first dive seven seconds in. Divers arrive at stage 2, shields at 3, the world's
special enemy at 4. Every stage also carries ~7 s of dead time (fly-in, intro card, clear card), and the first
meaningful choice (a draft) waits for the first elite or boss.

## Design

- **Steeper ramp.** `DIFFICULTY.k` 18 → 12; fire rate floor 0.7 → 1.1 shots/s; dive interval 7 → 4 s at the
  start; bullet speed floor 100 → 110. Late values unchanged.
- **Smaller early formations.** Four rows while `d < 3` (world 1, stages 1–2), five after. Fewer, livelier enemies.
- **Variety from the first stage.** Divers in row 2 from d ≥ 1, shields in row 1 from d ≥ 2, the world special
  in row 3 from d ≥ 3 (was 2 / 3 / 4).
- **Less dead time.** Intro card 1.5 → 1.0 s, clear card 3 → 2.2 s, fly-in 1.4 → 1.1 s with 0.3 s row / 0.05 s
  column stagger (was 0.45 / 0.07). About 2.5 s saved per stage.
- **Starter draft.** Every run opens with a pick-1-of-3 draft before stage 1 (also the daily, from its seed), so
  the build starts on the first screen. `RunOptions.starterDraft` (off for bare sim tests).

## Open for playtest

- Whether four rows should extend to d < 5 (all of world 1's map stages).
- Stage par time (35 s) may now be generous; lower to 28 s if time bonuses feel free.
