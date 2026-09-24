# Space Alliance — Design Spec

Date: 2026-09-24
Status: Approved design, pending implementation plan

## 1. Summary

Web-based, fast-paced Space Invaders-style shooter. Player strafes/dodges and shoots a marching enemy formation. Level-based with rising difficulty: 3 worlds (Near Earth Orbit, Moon Orbit, Mars Orbit) × 5 stages, stage 5 is a boss. After Mars the run loops endlessly with higher difficulty. Score is saved as local highscore; part of the score converts to credits spent on permanent cosmetic upgrades (visual only). A procedurally synthesized 70s/80s heavy-metal soundtrack drives a rhythm multiplier: shots fired on the beat score more.

Style: retro arcade pixel art, top-down 2.5D (parallax, shadows), with modern micro-animations and post-FX.

## 2. Decisions

| Topic | Decision |
|---|---|
| Stack | TypeScript + Vite + PixiJS (WebGL) + Vitest |
| Architecture | Pure deterministic sim core, Pixi view layer reads state, Web Audio engine owns beat clock |
| Music | Procedurally synthesized in Web Audio (no audio files); riffs hand-authored as note data |
| Movement | Free horizontal, vertical limited to bottom 25% of playfield |
| Run rules | 3 lives, endless loop after Mars; credits kept on death |
| Rhythm | Forgiving: ±70 ms window on quarter-note grid, streak-based multiplier up to x4, off-beat drops one step |
| Cosmetics | Ship skins, laser styles |
| Platform | Desktop keyboard + mobile touch |
| Aspect | Portrait 3:4 everywhere (logical 240×320), letterboxed |
| Touch input | Relative drag to move + big fire button bottom-right |
| Art | Pixel grids defined in TS, converted to textures at boot, palette swaps for skins/worlds |
| Persistence | localStorage, versioned JSON, no backend |

## 3. Architecture & Data Flow

```
main.ts → App (Pixi Application, 3:4 letterboxed, DPR-aware)
  SceneManager: Title | Shop | Settings | Run | GameOver
  Run scene:
    InputAdapter (keyboard | touch) → InputFrame {moveX, moveY, fire, fireTime}
    AudioEngine (sequencer, BeatClock) ── beat info ──┐
    Sim.step(dt = 1/60, input, beat) → SimState + events[]
    View.render(state, events, alpha) → sprites, particles, shake, filters
    Sfx reacts to events
  Persistence: highscores, credits, owned/equipped cosmetics, settings
```

- Sim runs on a fixed 60 Hz timestep with accumulator; render interpolates with `alpha`. Max 5 sim steps per frame (no spiral of death).
- Sim has no Pixi/DOM dependencies. It emits events (`hit`, `kill`, `playerHit`, `stageClear`, `bossPhase`, …) consumed by view and audio. One-way flow: view/audio never mutate sim.
- Fire input is timestamped with `audioCtx.currentTime` at keydown/touchstart (not frame time) and compared against the quarter-note grid.
- Sim uses a seeded RNG for determinism.

## 4. Gameplay

### Player
- Horizontal: full width. Vertical: bottom 25% zone. Fast acceleration, slight inertia.
- Fire cooldown 120 ms; max 3 player bullets on screen.
- 3 lives. On hit: 1.5 s invulnerability (blink), enemy bullets on screen cleared, 40 ms hit-stop.
- Extra life every 50,000 points, max 5 lives.
- Hitbox is identical for all skins; sim never reads cosmetic data.

### Formation
- Grid 5 rows × 8–10 columns. Marches sideways; drops one row when an edge enemy reaches a wall.
- March speed increases as enemy count decreases.
- Divers periodically leave the formation on curved swoop paths and return.
- If the formation reaches the player zone line: lose a life, stage restarts.

### Enemy types
| Type | Behavior | Points |
|---|---|---|
| Grunt | Rare straight-down shots | 10 |
| Gunner | Aimed shots at player | 20 |
| Diver | Swoops at player | 30 |
| Shield | 2 HP, shows crack after first hit | 40 |
| Splitter (Earth) | Splits into 2 small enemies on death | 50 |
| Phaser (Moon) | Blinks; invulnerable while phased | 50 |
| Bomber (Mars) | Slow shot that bursts into a spread | 50 |

Each world reskins the base types and adds its special type.

### Stages
- Stages 1–4: formation stages. Stage 5: boss.
- Stage clears when all enemies are destroyed → 2 s results panel (accuracy, beat %, bonus) → next stage.

### Difficulty
- Scalar `d = worldIndex * 5 + stage + loop * 15`.
- Drives march speed, enemy fire rate, bullet speed, dive frequency, enemy type mix, formation size.
- Curves are capped: `lerp(min, max, 1 - exp(-d / k))`.
- Loop ≥ 2 modifiers: enemies +1 HP, faster boss phases, more boss HP.
- All tuning values live in `data/balance.ts`.

## 5. Worlds & Bosses

| World | Backdrop | Palette | Music |
|---|---|---|---|
| 1. Near Earth Orbit | Earth curve at bottom, drifting satellites, 3-layer starfield | Blues/cyans, warm sunrise rim | E minor, 140 BPM, galloping NWOBHM |
| 2. Moon Orbit | Cratered surface scrolling below, small Earth in distance | Greys, cold white, violet | A minor, 150 BPM, twin-harmony leads |
| 3. Mars Orbit | Red planet with dust storms, Phobos passing | Rust, orange, deep purple | D minor, 160 BPM, thrash/speed metal |

World transition: 3 s warp (star streaks) + title card ("WORLD 2 — LUNAR ORBIT"), skippable.

Bosses: multi-part sprite (core + destroyable turrets), HP bar, 3 phases at 100/66/33 % HP. Phase change = flash + shake + hit-stop + music section change on next bar. Boss attack patterns fire on beats/bars from BeatClock.

1. **ORBITAL WARDEN** (Earth, satellite station)
   - P1: 2 side turrets, aimed shots.
   - P2: sweeping laser beam telegraphed 0.8 s ahead by a warning line.
   - P3: core exposed, spiral bullet rings.
2. **LUNAR HIVE** (Moon, mothership)
   - P1: spawns grunt waves.
   - P2: phases in/out, hittable only while solid.
   - P3: diving swarm + aimed bursts.
3. **ARES DREADNOUGHT** (Mars, wide battleship)
   - P1: bomber spreads.
   - P2: armor plates must break before core takes damage.
   - P3: light bullet curtain whose gaps open on downbeats.

Endless loop: after Mars, "LOOP 2" card, back to Earth with `loop + 1`, slightly darker palette shift.

## 6. Scoring, Credits, Shop

### Score
`points = basePoints × rhythmMult × comboMult`

- **Rhythm multiplier (x1–x4):** a shot within ±70 ms (+ user calibration offset) of the quarter-note grid is on-beat (±90 ms on 8ths was rejected: ~84 % of random shots would count at 140 BPM) and adds +1 streak. Every 4 streak steps = +x0.5 (cap x4). Off-beat shot: −x0.5 (floor x1). Player hit: reset to x1. Not shooting is neutral. The multiplier is captured when the shot is fired and applied to the kill it makes.
- **Kill combo (x1–x2):** kills within 1 s of each other chain; +x0.1 per chained kill, cap x2.
- **Stage clear bonus:** accuracy % × 1000 + beat % × 1000 + 2000 if no hit + time bonus under par.
- **Boss kill:** 5000 × world number × loop number.
- If audio is unavailable, rhythm multiplier is locked at x1.

### Credits
- `credits = floor(runScore / 100) + 50 per boss killed + 25 per perfect stage` (perfect = no hit and beat % ≥ 70).
- Awarded at run end, including death. Game-over screen shows animated count-up.

### Highscore
- Local top 10: 3-letter initials, score, world/stage reached, date.
- Arcade-style letter picker usable with keyboard and touch.

### Shop
- Accessed from title screen. Tabs: Ship Skins, Laser Styles. ~6 items each, prices 0–2000 credits.
- Buy once, then equip. Live preview box shows ship idling and firing.
- Skins: Classic (free), Interceptor, Retro Chrome, Crimson Ace, Gold, Prismatic (animated hue cycle).
- Lasers: Classic Bolt (free), Plasma Orb, Twin Beam, Pixel Wave, Neon Trail, Beat Pulse (brightens on beat).
- Cosmetic only. Laser visuals never change the bullet hitbox.

### Save format
`localStorage['space-alliance:v1']`:
```ts
{
  version: number;
  credits: number;
  highscores: { initials: string; score: number; world: number; stage: number; loop: number; date: string }[];
  owned: string[];
  equipped: { skin: string; laser: string };
  settings: { musicVolume: number; sfxVolume: number; crt: boolean; bloom: boolean; shake: boolean; latencyOffsetMs: number };
}
```
Migration function per version bump. Corrupt/unparseable save → defaults + "Save reset" toast + console warning.

## 7. Audio & Rhythm Engine

- **Scheduler:** lookahead pattern. A 25 ms `setInterval` schedules notes up to 100 ms ahead on `audioCtx.currentTime`. 16th-note resolution. Patterns are data arrays per instrument.
- **BeatClock:** derived from song start time + BPM. API: `beatAt(t)`, `nearestGridDelta(t, subdivision)`, `barPhase(t)`, `onBeat`, `onBar`. One clock drives the rhythm judge, boss timing and visual pulse.
- **Latency calibration:** settings screen tap-along test measures offset in ms, stored in `settings.latencyOffsetMs`, applied in the judge.
- **Instruments (all synthesized):**
  - Rhythm guitar: 2 detuned saws → waveshaper distortion → cab-sim EQ (lowpass + peaking). Palm mute = short envelope + lower cutoff. Power chords (root, 5th, octave).
  - Lead: square/saw + vibrato LFO through the same distortion chain.
  - Bass: triangle + saw, light drive.
  - Drums: kick (sine pitch drop + click), snare (noise + tone, bandpass), hi-hat (highpassed noise). Double-kick patterns on Mars.
  - Master bus: compressor + limiter.
- **Song structure:** per world, sections intro / riff A / riff B / chorus / breakdown, looped. Bosses have their own section set; phase changes switch section on the next bar boundary. Riffs are hand-authored note data (synthesized, not randomly composed).
- **SFX (synthesized):** laser, enemy hit, explosion, player hit, UI blips, credit ticks. On-beat shots use a brighter laser sound with an extra harmonic layer.
- **Mobile:** AudioContext unlocked by "TAP TO START". Music and game pause on `visibilitychange`.

## 8. Visuals & FX

- Logical resolution 240×320, rendered to a low-res RenderTexture, integer-upscaled with nearest-neighbor. Letterboxed; desktop shows themed bezel art on the sides.
- Sprites: pixel grids (`'..XX..'` strings + palette map) → textures at boot. Enemies have 2 frames and flip on every beat (formation dances to the music).
- 2.5D: 3-layer parallax starfield + planet layer, soft offset drop shadows under ships, slight perspective tilt on planet surface, boss scale-in entrance.
- Micro-animations: 1-frame white hit flash, recoil squash on firing, enemy spawn pop-in, floating score popups, multiplier badge pulses on beat.
- Particles (pooled): explosion debris, sparks, engine exhaust.
- Screen shake: trauma-based with decay; toggleable.
- Hit-stop: 40 ms on player hit and boss phase change.
- Post-FX: bloom, CRT (scanlines, slight curvature, chromatic aberration during shake), vignette. CRT and bloom are toggleable.
- Beat pulse: background brightness and HUD ring throb on quarter notes, stronger on downbeat.
- HUD (bitmap pixel font): top = score, highscore, multiplier ring filling with streak; bottom = lives, world-stage.
- Touch UI: fire button bottom-right; drag zone covers the rest of the screen; pause button top-right.

## 9. Input

- Keyboard: Arrows/WASD move, Space fire, P/Esc pause, Enter confirm.
- Touch: relative drag (ship moves by finger delta × sensitivity, ship not under finger), fire button (multi-touch so move + fire simultaneously). Tap timestamps use `audioCtx.currentTime`.
- Both adapters produce the same `InputFrame`.

## 10. Project Layout

```
src/
  main.ts, app.ts
  sim/        state.ts, step.ts, player.ts, formation.ts, enemies/, boss/, collision.ts,
              scoring.ts, stageScript.ts, difficulty.ts, rng.ts
  data/       balance.ts, worlds/{earth,moon,mars}.ts, sprites/, cosmetics.ts, songs/
  audio/      engine.ts, sequencer.ts, beatClock.ts, rhythmJudge.ts, instruments/, sfx.ts
  view/       renderer.ts, layers/, fx/{particles,shake,postfx}.ts, hud.ts, spriteFactory.ts
  scenes/     title.ts, shop.ts, run.ts, gameOver.ts, settings.ts
  input/      keyboard.ts, touch.ts, inputFrame.ts
  persist/    save.ts, migrations.ts
tests/        mirrors sim/, audio/beatClock + rhythmJudge, persist/
```

## 11. Performance

- Object pools for bullets, particles, enemies; no per-frame allocations in hot paths.
- Target 60 fps on mid-range phones.
- Auto-degrade: if frame time > 20 ms sustained for 2 s, disable bloom then CRT.

## 12. Error Handling

| Failure | Behavior |
|---|---|
| Save corrupt/unparseable | Defaults, "Save reset" toast, console warning |
| AudioContext blocked/unsupported | Run silently, rhythm multiplier locked x1, HUD shows "NO AUDIO" |
| WebGL unavailable | Pixi canvas fallback, post-FX disabled |
| Tab hidden | Auto-pause game and music |
| Long frame gap | Clamp to max 5 sim steps |

## 13. Testing

- Vitest unit tests for pure logic: formation march/drop, collision, scoring & multiplier transitions, rhythm judge window edges (±70 ms, calibration offset), BeatClock math, difficulty curve, credit calculation, save migrations and corrupt-save recovery.
- Deterministic replay (golden) test: seeded RNG + recorded input sequence → assert final score and state.
- View/audio: manual browser verification plus a smoke test that the app boots without console errors.

## 14. Milestones

Each milestone ends in a playable build.

1. **Core loop:** player, one formation, shooting, collisions, lives, single stage, placeholder visuals.
2. **Audio + rhythm:** sequencer, one song, BeatClock, rhythm multiplier, beat-synced animation.
3. **Structure:** 5 stages, boss 1, stage flow, difficulty curve, game over, highscore.
4. **Worlds:** Moon and Mars content, bosses 2–3, warp transitions, endless loop.
5. **Meta:** credits, shop, cosmetics, settings, latency calibration.
6. **Polish:** post-FX, particles, touch tuning, performance pass, mobile testing.

## 15. Out of Scope

Online leaderboard, gameplay-affecting upgrades, achievements, recorded music files, localization.
