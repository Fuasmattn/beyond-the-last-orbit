# M12 — Mobile full screen, camera pan, gesture controls

## Problem

On phones the game is framed like the desktop build: the field is fitted inside the screen
("contain"), the ship moves inside a tiny playfield, and firing needs a small on-screen button in the
bottom-right corner. It does not feel like a mobile game.

## Goals

- The run fills the whole screen on touch devices. No letterbox in portrait.
- The field is **wider than the screen** and a camera follows the ship horizontally. Background
  layers move slower than the playfield (parallax), so steering reveals the edges of the field.
- Controls are gestures over the whole screen, no touch zones:
  - **drag anywhere** moves the ship (relative, both axes),
  - **tap anywhere** fires,
  - multi-touch: hold one finger to steer, tap with another to fire.
- Desktop is unchanged.

## Design

### Layout (`src/app/layout.ts`)

`computeLayout(viewW, viewH, touch)` now returns two widths:

- `viewW` — the logical width that is visible on screen. HUD, overlays and menus lay out in it.
- `fieldW` — the simulation field width.

Desktop: unchanged (`viewW === fieldW`, contain-fit, width follows the aspect in 140..600).

Touch ("cover" by height): `scale = screenH / FIELD_H`, so the full field height always fits and the
screen is filled edge to edge. `viewW = screenW / scale`, clamped to 120..600 (only extreme aspects
letterbox). `fieldW = viewW × TOUCH_OVERSCAN (1.3)`, clamped to 140..600 and never narrower than the
view. A 390×844 phone sees ~148 logical px of a ~192 px field.

`viewport` carries both widths (`viewport.w` visible, `viewport.fieldW` sim).

### Camera (`src/view/camera.ts`)

Target camera x maps the ship's position linearly onto the pan range:
`camX = (ship.x / (fieldW − ship.w)) × (fieldW − viewW)`. With the ship at the left wall the view
shows the left edge, at the right wall the right edge. The ship still moves on screen (at
`viewW/fieldW` of its field speed) while the world slides under it. The camera eases toward the
target (rate 12/s) and snaps on the first frame. If the field is narrower than the view (landscape
with a capped field) the field is centered.

### Parallax (`renderer.ts`, `starfield.ts`)

Layers are shifted so their on-screen motion is a fraction of the camera's:

| layer        | screen motion |
| ------------ | ------------- |
| far stars    | 0.2           |
| mid stars    | 0.4           |
| near stars   | 0.65          |
| planet/grid  | 0.35          |
| entities/fx  | 1.0           |

The base colour fill always covers the visible rect. Every layer stays covered because its offset
never exceeds `fieldW − viewW`.

### Touch input (`src/input/touch.ts`)

- The first finger down becomes the **steer** pointer. Moves are applied as relative drag.
- If the steer pointer lifts within 250 ms having moved < 10 css px, it was a **tap** → fire. The
  rhythm verdict uses the *down* timestamp, so beat timing is not penalised by the release delay.
- Any finger that lands while a steer pointer is held fires **immediately** on down.
- When the steer finger lifts and another finger is still down, that finger takes over steering.
- Every down is still a menu tap (menus, route map, drafts unchanged).
- The fire button and its view are removed.

### Installable (PWA)

`public/manifest.webmanifest` (standalone, fullscreen override, portrait, black) plus icons rendered by
`scripts/make-icons.mjs`. iOS meta tags make "Add to Home Screen" launch full screen; the status bar
is opaque (`black`) so the HUD never sits under the Dynamic Island. No service worker yet (no offline
play; Chrome no longer requires one to install).

Offline: `scripts/service-worker-plugin.mjs` emits `sw.js` at build time with the bundle and public
files (~5 MB, mostly audio) precached. Navigations are network first (new deploys show up), all
other same-origin GETs are cache first. The cache name hashes the build, so a deploy replaces it.
Leaderboard calls (other origin) are never cached. Only production builds register it.

### Pause on touch

A pause icon sits top-left in the run HUD on touch (score and ships move right). Tapping it toggles
pause; the touch input treats that corner as a button, so it neither steers nor fires.

### Landscape

Touch views may be wider than the widest field (up to 1000 logical px). The 600 px field is centered;
stars, planet and grid fill the whole view, and the area past the walls is dimmed with a faint wall
line. Only aspects wider than ~3:1 letterbox.

### Readable text on phones

- Menus lay out in `viewport.menuW`: 240 on desktop, 160 on touch (`MENU_W_TOUCH`). On a portrait
  phone the frame is drawn ~1.5× larger than before. Long touch hints are shortened or wrapped.
- In-run HUD text is 1.5× on touch; banners shrink to fit the visible width when needed.

### Sound hint and toggle

- A speaker toggle sits top-left on the title and settings screens. Before audio has started it
  blinks "TAP FOR SOUND"; afterwards it reads SOUND ON / SOUND OFF and a tap toggles mute
  (`settings.muted`, volumes are kept). The tap that starts audio never toggles.
- Audio unlock sets `navigator.audioSession.type = 'playback'` so iPhones in silent mode still play,
  and resumes a context that iOS interrupted (calls, backgrounding) on the next touch.

## Non-goals / not changed

- Vertical camera pan (the full height is always visible; enemies arrive from the top).

## Open questions

- Is 1.3× overscan the right amount of pan? Wider = more room, but more of the field off-screen.
- Single-finger tap fires on release (~80 ms later on screen, verdict uses press time). If that feels
  laggy, alternative: fire on every press, including the one that starts a drag.
- Should the ship's drag sensitivity (1.25×) change now that the camera also moves?
- The pause menu itself still uses 1× text on touch.
