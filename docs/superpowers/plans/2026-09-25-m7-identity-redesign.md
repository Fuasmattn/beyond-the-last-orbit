# M7 Identity Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fullscreen adaptive playfield, beat-driven shape formations, neon vector visuals, and a rhythm-game beat track.

**Architecture:** Sim gains `fieldW` on `SimState` (adopted at stage start) and a new shape-based formation driven by `beatsCrossed`. View switches from pixel textures to shared white `GraphicsContext`s tinted per kind; a new `BeatTrack` view reads the audio beat and shot events. Layout fits the fixed 320 logical height to the viewport and derives the width.

**Tech Stack:** TypeScript, PixiJS v8 (`Graphics`, `GraphicsContext`), pixi-filters, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-25-m7-identity-redesign-design.md`

## Global Constraints

- Logical height `FIELD_H = 320`; width `clamp(round(320 × aspect), 140, 600)`.
- Sim stays pure (no DOM/Pixi); deterministic under seeded RNG.
- Hitboxes unchanged (`ENEMY.w/h`, `PLAYER.w/h`, boss boxes); cosmetics never touch sim.
- Beat track height 16 logical px at the bottom; PERFECT ≤ 35 ms, GOOD ≤ 70 ms.
- `npm test` and `npm run typecheck` green after every task; commit per task.

---

### Task 1: Adaptive layout + `fieldW` in sim (M7a)

**Files:**
- Modify: `src/data/balance.ts` (remove `FIELD_W`, add `FIELD_W_MIN = 140`, `FIELD_W_MAX = 600`, `FIELD_W_DEFAULT = 240`, `BEAT_TRACK = { h: 16 }`)
- Modify: `src/sim/types.ts` (`SimState.fieldW`, `SimState.nextFieldW`)
- Modify: `src/sim/state.ts` (`createInitialState(seed, fieldW = FIELD_W_DEFAULT)`)
- Modify: `src/sim/stageFlow.ts` (`startStage` adopts `nextFieldW`, clamps player)
- Modify: all sim `FIELD_W` users → `state.fieldW` (player, specials, bullets, dive, formation, boss/*)
- Modify: `src/sim/player.ts` bottom clamp → `FIELD_H - BEAT_TRACK.h - p.h - PLAYER.bottomMargin`
- Modify: `src/app/layout.ts`, `src/app/app.ts`; Create: `src/app/viewport.ts`
- Modify: view/scene `FIELD_W` users → `viewport.w`; delete `src/view/bezel.ts`
- Test: `tests/app/layout.test.ts`, `tests/sim/stageFlow.test.ts`, existing sim tests

**Interfaces:**
- Produces: `computeLayout(viewW, viewH): { fieldW, scale, offsetX, offsetY }`; `viewport: { w: number }` (mutable singleton, view-only); `SimState.fieldW`, `SimState.nextFieldW`; `createInitialState(seed: number, fieldW?: number)`.

- [ ] Step 1: failing layout tests
```ts
it('fits height and derives width on desktop', () => {
  const l = computeLayout(1280, 800);
  expect(l.fieldW).toBe(512);
  expect(l.scale).toBeCloseTo(2.5);
  expect(l.offsetX).toBe(0);
  expect(l.offsetY).toBe(0);
});
it('clamps ultra-wide to 600 and centers', () => {
  const l = computeLayout(3200, 800);
  expect(l.fieldW).toBe(600);
  expect(l.offsetX).toBe(Math.round((3200 - 600 * 2.5) / 2));
});
it('clamps tall phones to 180 and fits width', () => {
  const l = computeLayout(300, 900);
  expect(l.fieldW).toBe(180);
  expect(l.scale).toBeCloseTo(300 / 180);
  expect(l.offsetY).toBe(Math.round((900 - 320 * l.scale) / 2));
});
```
- [ ] Step 2: run `npx vitest run tests/app/layout.test.ts` → FAIL
- [ ] Step 3: implement
```ts
export function computeLayout(viewW: number, viewH: number): Layout {
  const fieldW = clamp(Math.round((FIELD_H * viewW) / viewH), FIELD_W_MIN, FIELD_W_MAX);
  const scale = Math.min(viewH / FIELD_H, viewW / fieldW);
  return {
    fieldW,
    scale,
    offsetX: Math.round((viewW - fieldW * scale) / 2),
    offsetY: Math.round((viewH - FIELD_H * scale) / 2),
  };
}
```
- [ ] Step 4: failing stageFlow test: `nextFieldW` adopted at `startStage`, player clamped inside.
```ts
it('adopts the pending field width at stage start', () => {
  const s = createInitialState(1, 400);
  s.player.x = 390;
  s.nextFieldW = 200;
  startStage(s, []);
  expect(s.fieldW).toBe(200);
  expect(s.player.x).toBeLessThanOrEqual(200 - s.player.w);
});
```
- [ ] Step 5: implement `fieldW` plumbing: replace every sim `FIELD_W` with `state.fieldW`; bosses: `tickBoss` sway center `state.fieldW / 2`, amplitude `m.swayAmp * Math.min(1.6, state.fieldW / 240)` clamped so the boss stays ≥ 4 px inside; Dreadnought gap `fieldW / 2 + sin(..) * Math.min(80, fieldW / 2 - 30)`; spawn x uses `state.fieldW`.
- [ ] Step 6: app: `viewport.w = layout.fieldW`, mask rect uses `viewport.w`, remove `Bezel`; RunScene calls `state.nextFieldW = viewport.w` every update. Menu scenes: app rebuilds non-run scenes on resize if width changed (`ctx.goto(factory())` for title/shop/settings).
- [ ] Step 7: update tests that import `FIELD_W` to use `s.fieldW`; `npm test && npm run typecheck` → PASS
- [ ] Step 8: commit `feat(layout): adaptive fullscreen field width`

### Task 2: Shape library (M7b)

**Files:** Create `src/sim/shapes.ts`, Test `tests/sim/shapes.test.ts`

**Interfaces:**
- Produces: `type ShapeKind = 'block' | 'chevron' | 'arch' | 'wave' | 'bowl' | 'twin'`; `slotOffset(kind, row, col, rows, cols, width): { dx: number; dy: number }` (dx relative to formation center, dy ≥ 0 relative to formation top); `shapeWidth(cols, fieldW): number`; `stageShapes(world, stage): readonly ShapeKind[]`.

Shape math (`u = cols > 1 ? (2 * col) / (cols - 1) - 1 : 0`, `half = width / 2`, `sy = ENEMY.spacingY`):
- block: `dx = u*half`, `dy = row*sy`
- chevron: `dy = row*sy + (1 - |u|) * 2*sy`
- arch: `dy = row*sy + |u| * 2*sy`
- wave: `dy = row*sy + (1 + sin(u*π)) * 1.2*sy`
- bowl: `θ = π*(0.9 - 0.8*(u+1)/2)`, `R = half*(1 - row*0.15)`, `dx = cos θ * R`, `dy = row*sy*0.6 + sin θ * R * 0.45`
- twin: `dx = u*half*0.8 + sign(u)*half*0.2`, `dy = row*sy`

`shapeWidth(cols, fieldW) = min((cols-1) * ENEMY.spacingX * clamp(fieldW/240, 1, 1.5), fieldW - 2*(FORMATION.edgeMargin + ENEMY.w))`.

- [ ] Step 1: tests — for each kind, widths 140/240/600, rows 5 × cols 8/9/10: all slots distinct with no overlapping boxes (`|Δx| ≥ ENEMY.w || |Δy| ≥ ENEMY.h`), `dy ≥ 0`, `|dx| + ENEMY.w/2 ≤ fieldW/2 - edgeMargin`; `stageShapes` returns ≥ 2 kinds for every (world 0–2, stage 1–4).
- [ ] Step 2: run → FAIL; Step 3: implement; Step 4: run → PASS (tune factors if overlaps fail)
- [ ] Step 5: commit `feat(sim): formation shape library`

### Task 3: Beat-driven formation (M7b)

**Files:** Modify `src/sim/types.ts`, `src/sim/formation.ts`, `src/sim/step.ts`, `src/sim/difficulty.ts`, `src/data/balance.ts`, `src/sim/enemyFire.ts`, `src/sim/dive.ts`; rewrite `tests/sim/formation.test.ts`; adjust `tests/sim/difficulty.test.ts`.

**Interfaces:**
- `Formation = { y; sway; swayDir: 1|-1; shapes: ShapeKind[]; shapeIdx; morph; beats; total; cols; rows }`
- `Enemy.entry: Entry | null` with `Entry = { t; delay; duration; x0; y0; cx; cy }` (quadratic bezier from (x0,y0) via (cx,cy) to live slot)
- `Difficulty`: `marchMin/marchMax` → `swayAmp`, `advanceStep`
- `updateFormation(state, dt, beats)`; `slotPosition(state, e)`; `inFormation(e)` also requires `entry === null`; `formationBottom` unchanged signature.
- balance: `FORMATION = { edgeMargin: 8, swayEase: 10, entryGroup: 8, entryBar: 4, advanceBars: [4, 2, 1], morphBeats: 1 }`, `DIFFICULTY.swayAmp: [8, 22]`, `DIFFICULTY.advanceStep: [6, 12]`.

Behavior:
- spawn: slots in (row, col) order, kinds by `kindForRow(row)`; enemy `i` gets `entry` with `delay = floor(i / entryGroup) * entryBar * 60 / bpm * 0.5`, `duration = 1.2`, start above the top edge at left or right side (alternate per group), control point mirrored across center.
- each step: `f.beats += beats`; on each crossed beat flip `swayDir`; `sway += (swayDir * amp - sway) * min(1, dt * swayEase)` where `amp = min(diff.swayAmp, fieldW/2 - shapeWidth/2 - edgeMargin - ENEMY.w/2)` (≥ 0).
- advance: `advanceBars` picked by alive/total (> 0.5 → 4, > 0.2 → 2, else 1); when `f.beats ≥ bars*4` → `f.beats -= bars*4`, `f.y += diff.advanceStep`, `shapeIdx = (shapeIdx+1) % shapes.length`, `morph = 0`. `morph += dt * bpm / 60 / morphBeats` capped at 1.
- slot = lerp(prevShape offset, curShape offset, smoothstep(morph)); `x = fieldW/2 + sway + dx - w/2`, `y = f.y + dy`.
- `step.ts`: pass `beats` to `updateFormation`; also run `updateFormation` during `stageIntro` when no boss (entries fly in during the intro).
- enemyFire shooters: bottom-most per x-bucket `Math.round((e.x + e.w/2) / ENEMY.spacingX)` plus all gunners.

- [ ] Step 1: tests — spawns rows×cols enemies all with `entry`; after 6 s of steps with beats every 0.43 s all entries done and enemies at slots; sway flips on beat; advance after 16 beats moves `y` by `advanceStep` and bumps `shapeIdx`; fewer survivors → advance after 8 beats; slots stay in bounds at fieldW 140 & 600; entering enemies do not shoot; formationBottom ignores entering enemies.
- [ ] Step 2: FAIL; Step 3: implement; Step 4: `npm test` PASS (update step/collision/specials tests that relied on march or `marchMin`)
- [ ] Step 5: commit `feat(sim): beat-driven shape formations with fly-in entries`

### Task 4: Neon vector art (M7c)

**Files:** Create `src/view/vectorArt.ts`; Modify `src/view/textures.ts` (drop pixel enemy/boss/skin textures, keep glyphs + orb), `src/view/renderer.ts`, `src/view/laserView.ts` if needed, `src/data/cosmetics.ts` (skin `hull: 'arrow' | 'swept'` instead of rows), `src/scenes/shopScene.ts` preview, `src/data/sprites.ts` (delete) + its test.

**Interfaces:**
- `ENEMY_ART: Record<EnemyKind, GraphicsContext>`, `SHIELD_CRACKED: GraphicsContext`, `BOSS_ART: Record<BossKind, GraphicsContext>`, `PART_ART: { turret, plate }`, `shipArt(hull): GraphicsContext`, `ENEMY_COLOR: Record<EnemyKind, number>`. All drawn in white, centered at (0,0) (bosses top-left like sim boxes), sized to match hitboxes ×1.3 visually.
- Style helper `neon(g, points, closed)`: stroke width 1 white + fill white alpha 0.15.
- Renderer: enemies = `new Graphics(ENEMY_ART[kind])`, tint `ENEMY_COLOR[kind]` blended with world tint, white on flash; downbeat scale pulse 1.12 → 1; slow rotation for phaser/mini. Shadows removed. Enemy bullets: orb texture tinted `0xff8a3d` with additive blend; bombs: rotating diamond.
- Shop preview + run player use `shipArt(skin.hull)` tinted `skin.palette['#']`.

- [ ] Step 1: implement art + renderer swap; `npm test` + typecheck PASS
- [ ] Step 2: preview at 1280×800: all enemy kinds visible (dev hook `__sa.run` to jump world/stage), boss stages 5 of each world render
- [ ] Step 3: commit `feat(view): neon vector enemies, bosses and ships`

### Task 5: Synthwave backdrop + sparks (M7c)

**Files:** Modify `src/view/backdrops.ts`, `src/view/starfield.ts`, `src/view/renderer.ts`, `src/fx/particles.ts` or `src/view/effects.ts` (spark stretch), `src/scenes/ui.ts`.

- Horizon at `y = 200`. Above: world "sun/planet" disc (radius 70) centered at `fieldW/2`, vertical gradient via horizontal bands, lower half cut by gaps (synthwave sun); Earth cyan→blue, Moon white→violet, Mars yellow→red. Below horizon: perspective grid — horizontal lines scrolling toward viewer (spacing grows geometrically), verticals converging to a vanishing point; world-tinted alpha 0.35, +0.25 on beat pulse. Starfield width `viewport.w`.
- Particles: draw as thin quads rotated along velocity, length ∝ speed.
- Rebuild backdrop when `viewport.w` changes.

- [ ] Step 1: implement; Step 2: preview each world (warp via dev hook); Step 3: commit `feat(view): synthwave backdrop and spark particles`

### Task 6: Beat track (M7d)

**Files:** Create `src/view/beatTrack.ts`, `src/view/beatJudge.ts`; Test `tests/view/beatJudge.test.ts`; Modify `src/view/hud.ts` (drop ring + top mult, lives to strip), `src/scenes/runScene.ts`.

**Interfaces:**
- `judgeLabel(deltaSec: number | null, onBeat: boolean): 'PERFECT' | 'GOOD' | 'OFF'` — delta null → `onBeat ? 'GOOD' : 'OFF'`; `|d| ≤ 0.035` PERFECT, `≤ 0.07` GOOD.
- `markerX(beatTarget, beat, halfW): number` — distance from gate = `(beatTarget - beat) / LOOKAHEAD * halfW`, `LOOKAHEAD = 2`.
- `class BeatTrack extends Container { constructor(glyphs); layout(fieldW); update(beat: number | null, mult: number, dt); judge(label) }`.
- RunScene: on `shot` event → `beatTrack.judge(judgeLabel(ctx.takePressDelta() adjusted by latency offset, e.onBeat))`.

- [ ] Step 1: tests for `judgeLabel` thresholds and `markerX` (0 at target, halfW at 2 beats ahead, negative after) → FAIL → implement → PASS
- [ ] Step 2: implement view: band `y = FIELD_H - 16`, gate at center (bracket 2 px lines), markers as tall thin diamonds, downbeat (beat % 4 === 0) 1.6× taller and yellow; gate flash color PERFECT `0xffe14a`, GOOD `0x4af2ff`, OFF `0xff3b5c`; label pops 1.4× → 1 above gate, fades in 0.5 s; mult text right of gate in `multColor`; hidden when beat null.
- [ ] Step 3: preview: markers meet gate on the kick; firing shows labels
- [ ] Step 4: commit `feat(hud): beat track with judgement labels`

### Task 7: Polish pass + verification

- [ ] Title/menus: neon title treatment (pixel font 3× with glow color cycle), backdrop grid behind menus.
- [ ] Portrait 375×812 + desktop 1280×800 + ultra-wide 2560×800 playthrough of stage 1 and a boss; console clean.
- [ ] Update README (drop "style of Space Invaders", describe beat track), spec status.
- [ ] `npm test`, `npm run build` green; commit `docs: M7 readme`.
