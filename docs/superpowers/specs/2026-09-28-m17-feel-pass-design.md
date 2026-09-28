# M17 — Feel pass

## Why

Runs end and stages clear without a payoff beat. Three small things bullet-hell and arcade games do that this one
did not: reward the clear, call out the climb, and tell the player what they did.

## Design

- **Bullet cancel on clear.** When the last enemy (or the boss) dies, every enemy bullet still on screen turns into
  points: 5 × current multiplier each. Each bullet sparks, one popup shows the total. Dodging a dense final wave
  becomes a reward rather than a leftover hazard.
- **Multiplier callouts.** Reaching a whole multiplier (x2, x3, x4; up to x8 in beat stages) pops `X4!` on the HUD
  with a short rising tone. Losing levels is silent.
- **End-of-run stat card.** GAME OVER adds two lines under REACHED: accuracy, kills and grazes; best beat rank and
  upgrades taken. The run tracks `kills`, `grazes` and `bestBeatRank`.

## Open for playtest

- Cancel points (5 × mult) against graze points (10 × mult); the cancel should feel like a bonus, not the main way
  to score a stage.
