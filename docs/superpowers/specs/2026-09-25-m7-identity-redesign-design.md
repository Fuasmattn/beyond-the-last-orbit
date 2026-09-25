# M7 — Identity Redesign (fullscreen, rhythm formations, neon vector, beat track)

Date: 2026-09-25
Status: Approved (in chat)

## Why

Player feedback: letterboxed 3:4 box wastes the screen; the game reads as a Space Invaders clone (invader sprites + march-and-drop grid); the beat is hard to see (tiny ring next to the multiplier); graphics should mix arcade nostalgia with a modern look.

## Decisions

| Topic | Decision |
|---|---|
| Field | Adaptive: logical height fixed 320, width = `clamp(round(320 × viewAspect), 140, 600)` |
| Width changes | Sim width locked at stage start; mid-stage resize rescales the view (thin bars) until next stage |
| Formation | Replace march-and-drop with beat-quantized shape formations + fly-in entries |
| Art | Neon vector line-art (Pixi `Graphics`) + bloom; pixel font kept for HUD/menus |
| Beat cue | Full-width beat track strip at bottom, markers converge into a center gate |
| Bezel | Removed |
| CRT setting | Kept |

## 1. Adaptive field

- `FIELD_W` const removed from sim. `SimState.fieldW` holds the width; `createInitialState(seed, fieldW)`.
- Pending width: app sets `state.pendingFieldW` on resize; `startStage` adopts it (formation respawns anyway). Player x clamped after adoption.
- `FIELD_H` stays 320. `PLAYER_ZONE_TOP` stays 240. Beat track occupies bottom `BEAT_TRACK.h = 16` px; player max y bottom = `FIELD_H - BEAT_TRACK.h - PLAYER.bottomMargin`.
- Boss x-positions/sway center on `fieldW / 2`; sway amplitude scales `min(1.6, fieldW / 240)`.
- Curtain (Dreadnought P3) spans full `fieldW`.
- Layout: `computeLayout(viewW, viewH, dpr)` → `{ fieldW, scale, offsetX, offsetY }` with `scale = viewH / FIELD_H` (height-fit, non-integer allowed); if clamped width is narrower than viewport, center horizontally; if the viewport is narrower than `140 × scale`, scale by width instead.
- Menus/scenes read `ctx.fieldW()` for centering; HUD right-aligned items anchor to `fieldW`.

## 2. Rhythm formations

Replaces `updateFormation` march logic. Divers, specials, splitters, phasers, bombers, bosses unchanged.

- **Shapes** (`sim/shapes.ts`): pure functions `shape(kind, count, width) → {dx, dy}[]` slot offsets relative to formation center. Library: `block`, `chevron`, `diamond`, `ring`, `twin` (two columns clusters), `wave`. Each stage has a shape sequence from a table keyed by `(world, stage)`.
- **Entry**: at stage start enemies are off-screen; groups of up to 8 enter on bar boundaries along cubic-bezier paths (from top corners or sides), each lands in its slot. Enemies are not hittable/firing until they enter the field (y ≥ 0). Group entry duration 1 bar at world BPM.
- **Beat motion**: on each beat crossed the formation's target sway offset toggles `±swayAmp` (smoothly eased over ~0.18 s); view pulses scale on downbeat.
- **Morph + advance**: every `advanceBars` bars (4 → 2 → 1 as alive/total drops below 0.5 / 0.2) the formation morphs to the next shape (slot tween 1 beat) and advances down `FORMATION.advanceStep` px.
- Enemy slot index replaces `row/col` layout usage; `row` kept for kind assignment (kind by rank), `col` becomes slot index.
- Loss rule unchanged: formation bottom ≥ `PLAYER_ZONE_TOP` → hit + respawn.
- Beat source: existing `beatsCrossed` (audio clock or sim-time fallback) — deterministic under tests.
- Difficulty: `marchMin/marchMax` → `swayAmp` and `advanceStep` scale; counts from `cols × rows` unchanged.

## 3. Neon vector look

- `view/vectorArt.ts`: draw functions per enemy kind / boss / ship into `Graphics`, rendered once to textures (`renderer.generateTexture`) at 4× logical resolution for crispness; white-flash variants via tint.
  - grunt: triangle drone w/ inner eye; gunner: diamond + barrel; diver: chevron dart; shield: double hexagon (cracked: broken outer edge, red); splitter: two linked squares; mini: small square; phaser: dashed ring + core; bomber: heavy pentagon + core.
  - Bosses: Warden = ring station with solar-panel lines; Hive = saucer ellipse + dome arcs; Dreadnought = long hull polygon + bridge. Same boxes as sim.
  - Ship skins: vector hull outlines (`classic` arrowhead, `interceptor` forward-swept), colors from existing palettes; shop preview uses same textures.
- Stroke style: 1 logical px bright line + faint fill (alpha 0.18) of same color; bloom supplies glow.
- Enemy bullets: glowing orbs (round) in orange, bombs pulsing diamonds; player lasers unchanged styles, redrawn thinner/brighter.
- Background (`view/backdrops.ts`): synthwave perspective grid floor below the horizon (lower third), scrolling toward the viewer, tinted per world, pulses brightness on beat; planet as vector disc outline + gradient bands; starfield spans `fieldW`.
- Shadows removed (vector look). Particles become short line sparks.

## 4. Beat track

- `view/beatTrack.ts`: strip at `y = FIELD_H - 16`, full width, dark translucent band with top neon line.
- Center gate (vertical bracket). For each upcoming beat within 2 beats, a marker pair slides from both edges toward the gate, meeting exactly on the beat; downbeat markers taller and brighter. Markers fade out after passing.
- On `shot` event: judge label above gate — `PERFECT` (|Δ| ≤ 35 ms), `GOOD` (≤ 70 ms), `OFF` otherwise; gate flashes in label color. Δ from `ctx.takePressDelta()` minus latency offset; if null, label from `onBeat` only.
- Multiplier (`x2.5`) drawn right of the gate; old HUD ring and mult removed from the top bar. Lives move to the strip's left.
- No audio: track hidden.
- Scoring unchanged.

## Testing

- Unit: `computeLayout` widths/clamps; shapes return `count` distinct in-bounds slots for widths 140/240/600; formation morph/advance cadence vs beats; entry completes; width adoption at stage start; bosses in-bounds for widths 180/600; existing tests updated for `fieldW`.
- Manual (preview): portrait 375×812, desktop 1280×800; play stage 1, boss.

## Milestones

M7a field → M7b formations → M7c vector visuals → M7d beat track. Each leaves the game playable.
