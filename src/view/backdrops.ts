import { Container, Graphics } from 'pixi.js';
import { FIELD_H } from '../data/balance';
import type { WorldId } from '../data/worlds';
import { lerpColor } from './beatPulse';

export interface Backdrop {
  readonly root: Container;
  /** `pulse` 0..1 from the beat brightens the grid. */
  update(dt: number, pulse: number): void;
}

interface Theme {
  /** Planet disc gradient, top → horizon. */
  top: number;
  bottom: number;
  grid: number;
  floor: number;
}

const THEMES: Record<WorldId, Theme> = {
  earth: { top: 0x7ff8ff, bottom: 0x3d5aff, grid: 0x4af2ff, floor: 0x050a24 },
  moon: { top: 0xf2f4ff, bottom: 0x9b6bff, grid: 0xb46bff, floor: 0x0b0620 },
  mars: { top: 0xffe14a, bottom: 0xff3b5c, grid: 0xff3d9a, floor: 0x1a0414 },
};

export const HORIZON_Y = 196;
const PLANET_R = 62;
const GRID_LINES = 12;
const GRID_SPEED = 0.35;
const RAY_SPACING = 22;

/** Synthwave planet: gradient bands above the horizon, with widening slits toward the bottom. */
function planet(theme: Theme, cx: number): Graphics {
  const g = new Graphics();
  g.circle(cx, HORIZON_Y, PLANET_R * 1.6).fill({ color: theme.bottom, alpha: 0.06 });
  g.circle(cx, HORIZON_Y, PLANET_R * 1.2).fill({ color: theme.bottom, alpha: 0.08 });
  for (let y = HORIZON_Y - PLANET_R; y < HORIZON_Y; y++) {
    const dy = HORIZON_Y - y;
    const t = 1 - dy / PLANET_R;
    // Slits start 45 % down the disc and widen toward the horizon.
    if (t > 0.45) {
      const period = 7;
      const gap = 1 + Math.floor(((t - 0.45) / 0.55) * 4);
      if (dy % period < gap) continue;
    }
    const half = Math.sqrt(PLANET_R * PLANET_R - dy * dy);
    g.rect(cx - half, y, half * 2, 1).fill(lerpColor(theme.top, theme.bottom, t));
  }
  return g;
}

function synthwave(world: WorldId, width: number): Backdrop {
  const theme = THEMES[world];
  const root = new Container();
  const cx = width / 2;
  const floor = new Graphics().rect(0, HORIZON_Y, width, FIELD_H - HORIZON_Y).fill(theme.floor);
  const grid = new Graphics();
  const horizon = new Graphics()
    .rect(0, HORIZON_Y - 1, width, 3)
    .fill({ color: theme.grid, alpha: 0.12 })
    .rect(0, HORIZON_Y, width, 1)
    .fill({ color: theme.grid, alpha: 0.7 });
  const disc = planet(theme, cx);
  disc.alpha = 0.55;
  root.addChild(disc, floor, grid, horizon);

  const span = FIELD_H - HORIZON_Y;
  let phase = 0;
  return {
    root,
    update(dt, pulse) {
      phase = (phase + dt * GRID_SPEED) % 1;
      const alpha = 0.16 + 0.3 * pulse;
      grid.clear();
      // Rays fan out from the vanishing point on the horizon.
      const rays = Math.ceil(width / RAY_SPACING);
      for (let i = -rays * 2; i <= rays * 2; i++) {
        grid.moveTo(cx + i * 2, HORIZON_Y).lineTo(cx + i * RAY_SPACING * 3, FIELD_H);
      }
      grid.stroke({ color: theme.grid, width: 1, alpha: alpha * 0.8 });
      // Cross lines get denser toward the horizon, fade into it, and scroll toward the viewer.
      for (let i = 0; i < GRID_LINES; i++) {
        const d = (i + phase) / GRID_LINES;
        const y = HORIZON_Y + span * d * d;
        grid.moveTo(0, y).lineTo(width, y).stroke({ color: theme.grid, width: 1, alpha: alpha * (0.2 + 0.8 * d) });
      }
    },
  };
}

export function createBackdrop(world: WorldId, width: number): Backdrop {
  return synthwave(world, width);
}
