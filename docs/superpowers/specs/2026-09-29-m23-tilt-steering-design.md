# M23 — Tilt steering and a lighter vignette on phones

## Why

Playtest request (2026-09-29): steer the ship with the phone's gyroscope as a settings option, touch devices
only. And the CRT vignette ("fade to black on the edges") covers too much of the UI on a phone: the shader's
vignette is a circle sized by the screen width, so on a portrait screen the HUD row and the beat track sit in
its fully dark band (75% black at the top and bottom edges, ~45% a quarter of the way in).

## Design

### Tilt steering

Setting `tilt` (default off). The settings row `TILT STEERING` shows only on touch devices (`ctx.isTouch`),
values `OFF` / `ON` / `DENIED` (permission refused) / `NO SENSOR` (no `deviceorientation`).

`TiltInput` is a third `InputSource`, merged with keyboard and touch. It maps the device's tilt away from a
neutral pose to the analog `moveX`/`moveY` axes (same path as the keyboard, so the ship keeps its
acceleration feel); drag and tap keep working on top of it.

- Axes: `deviceorientation` `gamma` (roll, left/right) and `beta` (pitch, forward/back), rotated by
  `screen.orientation.angle` so landscape works.
- Neutral pose: captured when tilt is enabled, when a run starts and when a run is unpaused, so the player
  holds the phone however they like. Sensor readings before the first event count as neutral.
- Response: dead zone 2°, full deflection at 14°, linear in between. Constants in `src/data/balance.ts`
  (`TILT`).
- Permission: iOS needs `DeviceOrientationEvent.requestPermission()` from a user gesture. Enabling requests
  it at once (transient activation covers a tap that just landed); if that is refused for lack of a gesture
  the next `pointerup` retries. A real refusal shows `DENIED`; turning the row off and on asks again (iOS
  answers from its per-page decision until reload).
- Insecure origins (plain `http://` over LAN) get no sensor events at all; the row shows `NO SENSOR` there.
  `localhost` and the deployed `https` page are fine.

### Vignette on touch

`PostFx` takes a `soft` flag (touch): vignette radius 0.05 (from 0.32), alpha 0.4 (from 0.75), blur 0.6
(from 0.35). Top and bottom edges darken ~30% instead of 75%; the sides ~10%. Desktop is unchanged.

## Save

`Settings.tilt: boolean`; save version 5 (v5 adds `settings.tilt`, defaults false).

## Open for playtest

- Full deflection at 14°: too twitchy / too stiff? A LOW/MED/HIGH row is cheap if needed.
- Whether pitch (forward/back) should steer up/down at all, or tilt should be roll-only with drag for depth.
- Recenter on unpause vs a dedicated "hold still" calibrate step.
- Vignette numbers on the iPhone 15 Pro: alpha 0.4 may still be too dark behind the beat track.
