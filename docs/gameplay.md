# Gameplay

How a run of Beyond the Last Orbit works. For setup, deployment and code layout see [development.md](development.md).

## The basics

A neon arcade roguelite shooter with a procedurally synthesized heavy-metal soundtrack. Enemy formations fly in, sway on every beat and morph into new shapes every few bars.

The playfield fills the whole window: height is fixed, width follows the screen (portrait phone to ultra-wide).

## Structure

- **Three worlds** — Near Earth Orbit, Moon, Mars — with 5 stages each.
- A **boss** on every fifth stage, then an endless, harder loop.
- After each stage you pick the next node on a **branching map**:
  - **BATTLE** — a regular stage
  - **ELITE** — tougher stage; elites fire telegraphed per-world volleys (walls, rings, fans)
  - **CACHE**, **REPAIR**
  - **SHOP** — spend scrap on upgrades, repairs and rerolls
  - **SIGNAL** — random events with two choices (escort a freighter, board a derelict, deal with a smuggler, tune into a ghost beat)

## Scoring

- Hits and **grazes** (enemy bullets skimming the ship's core, shown as a dot) build the multiplier; misses drop it.
- Clearing a stage cancels every enemy bullet still on screen into points.
- Kills drop **scrap**, spent at SHOP nodes.

## Beat stages

The beat track along the bottom shows markers converging on the beat and grades every shot **PERFECT / GOOD / OFF**.

Stage 3 of every world is a beat stage:

- Only on-beat shots build the multiplier (up to x8); off-beat shots cost two levels and make the music go sour.
- PERFECT shots fire power shots.
- A beat rank of **S** or **A** earns an upgrade draft; **S** also doubles the stage bonus.

**Beat Lock** (Settings) makes every stage a beat stage — the pure rhythm game, best with sound.

## Upgrades

- Elites and bosses grant a **pick-1-of-3 draft**.
- Tiers: common, rare, epic, plus **curses** (an upside with a price).
- Cards name the upgrade they combine with — MAGNET feeds GRAZE CHARGE, SPREAD SHOT unlocks RICOCHET, HEAVY ROUNDS arm SHRAPNEL.

## Daily Run

One attempt per day on a seed shared by everyone (same map, drafts and enemy rolls), played with the base ship, with its own global table.

## Meta progression

Credits earned per run buy cosmetic ship skins and laser styles (**SHOP**) and permanent upgrades (**HANGAR**). Credits, upgrades and settings stay in the browser; high scores are also shared on a global leaderboard.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrows / WASD (up/down limited to the bottom zone) | Drag anywhere, or tilt the phone (**Settings → Tilt steering**) |
| Fire | Space | Tap anywhere |
| Pause (resume / end run) | P / Esc | Pause button (top left), or switch away from the tab |
| Menus | Arrows + Space/Enter, Esc back | Tap |

### Timing calibration

- **Settings → Calibrate timing** — audio/input latency (important with Bluetooth headphones).
- **Settings → Visual offset** — if the beat markers look early or late against the music (moves visuals only).
