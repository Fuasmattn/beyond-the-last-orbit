import { GraphicsContext } from 'pixi.js';
import type { ShipHull } from '../data/cosmetics';
import type { BossKind, EnemyKind } from '../sim/types';

/**
 * Neon line-art. Everything is drawn in white so one shared context serves every
 * color: views tint it per kind/world, and tint white for hit flashes. Bloom adds the glow.
 */

const LINE = 1;
const FILL_ALPHA = 0.16;

type Pts = readonly number[];

function neon(ctx: GraphicsContext, pts: Pts, width = LINE): GraphicsContext {
  return ctx.poly([...pts], true).fill({ color: 0xffffff, alpha: FILL_ALPHA }).stroke({ color: 0xffffff, width, join: 'miter' });
}

function line(ctx: GraphicsContext, pts: Pts, width = LINE): GraphicsContext {
  return ctx.poly([...pts], false).stroke({ color: 0xffffff, width, cap: 'round', join: 'round' });
}

function dot(ctx: GraphicsContext, x: number, y: number, r: number): GraphicsContext {
  return ctx.circle(x, y, r).fill(0xffffff);
}

function regular(sides: number, r: number, rot = 0, cx = 0, cy = 0): number[] {
  const pts: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return pts;
}

/** Enemies are centered on (0, 0); hitboxes are 11×8 (mini 7×6). */
function enemy(kind: EnemyKind): GraphicsContext {
  const c = new GraphicsContext();
  switch (kind) {
    case 'grunt':
      // Downward drone: triangle with a sensor eye.
      neon(c, [-7, -4, 7, -4, 0, 6]);
      line(c, [-3, -4, 0, 1, 3, -4]);
      return dot(c, 0, -1.5, 1.1);
    case 'gunner':
      // Diamond turret with a barrel.
      neon(c, [0, -6, 8, 0, 0, 5, -8, 0]);
      neon(c, [0, -2.5, 3, 0, 0, 2, -3, 0]);
      return line(c, [0, 5, 0, 9], 1.4);
    case 'diver':
      // Swept dart pointing down.
      neon(c, [-8, -5, 0, -1, 8, -5, 0, 7]);
      return line(c, [0, -1, 0, 4]);
    case 'shield':
      neon(c, regular(6, 7.5, Math.PI / 6));
      return neon(c, regular(6, 4, Math.PI / 6));
    case 'splitter':
      neon(c, [-8, -4, -2, -4, -2, 3, -8, 3]);
      neon(c, [2, -4, 8, -4, 8, 3, 2, 3]);
      line(c, [-2, 0, 2, 0]);
      return dot(c, 0, 0, 1);
    case 'mini':
      neon(c, [0, -4, 4, 0, 0, 4, -4, 0]);
      return dot(c, 0, 0, 0.9);
    case 'phaser': {
      // Dashed ring around a core.
      const r = 7;
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * Math.PI * 2;
        c.arc(0, 0, r, a0, a0 + Math.PI / 6).stroke({ color: 0xffffff, width: LINE });
      }
      c.circle(0, 0, 3).fill({ color: 0xffffff, alpha: FILL_ALPHA }).stroke({ color: 0xffffff, width: LINE });
      return dot(c, 0, 0, 1.2);
    }
    case 'bomber':
      neon(c, regular(5, 8, Math.PI / 2));
      c.circle(0, 1, 2.8).fill({ color: 0xffffff, alpha: 0.5 }).stroke({ color: 0xffffff, width: LINE });
      return c;
  }
}

function crackedShield(): GraphicsContext {
  const c = new GraphicsContext();
  const outer = regular(6, 7.5, Math.PI / 6);
  // Outer hex with one edge knocked out, plus a fracture line.
  line(c, [...outer.slice(0, 10)]);
  neon(c, regular(6, 4, Math.PI / 6));
  return line(c, [4, -5, 1, -2, 3, 0, -1, 3]);
}

export const ENEMY_ART: Record<EnemyKind, GraphicsContext> = {
  grunt: enemy('grunt'),
  gunner: enemy('gunner'),
  diver: enemy('diver'),
  shield: enemy('shield'),
  splitter: enemy('splitter'),
  mini: enemy('mini'),
  phaser: enemy('phaser'),
  bomber: enemy('bomber'),
};

export const SHIELD_CRACKED_ART = crackedShield();

/** Synthwave palette: the player owns cyan, enemies take the warm/purple side. */
export const ENEMY_COLOR: Record<EnemyKind, number> = {
  grunt: 0xff3d9a,
  gunner: 0xb46bff,
  diver: 0xff9a3d,
  shield: 0x5a8cff,
  splitter: 0x3dffc0,
  mini: 0x9affd6,
  phaser: 0xd98bff,
  bomber: 0xff5a3d,
};

/** Bosses are drawn in their sim box coordinates (top-left origin). */
function warden(): GraphicsContext {
  const c = new GraphicsContext();
  // Solar panels with cell lines.
  for (const x0 of [0, 39]) {
    neon(c, [x0, 5, x0 + 17, 5, x0 + 17, 14, x0, 14]);
    for (let x = x0 + 4; x < x0 + 17; x += 4) line(c, [x, 5, x, 14]);
    line(c, [x0, 9.5, x0 + 17, 9.5]);
  }
  line(c, [17, 9.5, 20, 9.5]);
  line(c, [36, 9.5, 39, 9.5]);
  // Hub rings + antenna.
  c.circle(28, 9.5, 8.5).fill({ color: 0xffffff, alpha: FILL_ALPHA }).stroke({ color: 0xffffff, width: LINE });
  c.circle(28, 9.5, 5.5).stroke({ color: 0xffffff, width: LINE });
  return line(c, [28, 1, 28, -3]);
}

function hive(): GraphicsContext {
  const c = new GraphicsContext();
  c.ellipse(30, 14, 29.5, 7.5).fill({ color: 0xffffff, alpha: FILL_ALPHA }).stroke({ color: 0xffffff, width: LINE });
  c.ellipse(30, 14, 20, 3.5).stroke({ color: 0xffffff, width: LINE, alpha: 0.6 });
  // Glass dome.
  c.moveTo(16, 11).arc(30, 11, 14, Math.PI, 0).stroke({ color: 0xffffff, width: LINE });
  c.moveTo(22, 11).arc(30, 11, 8, Math.PI, 0).stroke({ color: 0xffffff, width: LINE, alpha: 0.5 });
  for (let x = 6; x < 60; x += 8) dot(c, x, 14, 0.9);
  return c;
}

function dreadnought(): GraphicsContext {
  const c = new GraphicsContext();
  neon(c, [0, 12, 10, 5, 38, 4, 40, 0, 56, 0, 58, 4, 86, 5, 96, 12, 86, 20, 10, 20]);
  // Hull plating and bridge windows.
  for (const x of [18, 28, 68, 78]) line(c, [x, 6, x, 18]);
  line(c, [10, 12, 36, 12]);
  line(c, [60, 12, 86, 12]);
  for (let x = 43; x <= 53; x += 3) dot(c, x, 2, 0.7);
  // Cannons.
  for (const x of [10, 85]) neon(c, [x - 2, 17, x + 2, 17, x + 1.5, 24, x - 1.5, 24]);
  return c;
}

export const BOSS_ART: Record<BossKind, GraphicsContext> = {
  warden: warden(),
  hive: hive(),
  dreadnought: dreadnought(),
};

/** Glowing weak point drawn over each boss core (sim `coreX`/`coreW`, box coords). */
export const BOSS_CORE: Record<BossKind, { x: number; y: number; r: number; color: number }> = {
  warden: { x: 28, y: 9.5, r: 3, color: 0xff3b5c },
  hive: { x: 30, y: 12, r: 4, color: 0x7dff6b },
  dreadnought: { x: 48, y: 12, r: 4, color: 0xffe14a },
};

export const BOSS_COLOR: Record<BossKind, number> = {
  warden: 0x7fa8ff,
  hive: 0xb9a8ff,
  dreadnought: 0xff8a5a,
};

/** Turret 10×8 and armor plate 10×6, top-left origin. */
export const TURRET_ART = neon(new GraphicsContext(), [1, 0, 9, 0, 10, 5, 0, 5]).rect(4, 5, 2, 3).fill(0xffffff);
export const PLATE_ART = line(neon(new GraphicsContext(), [0, 0, 10, 0, 10, 6, 0, 6]), [0, 0, 10, 6]);

/** Ships are drawn with the bottom-center of the hitbox at (0, 0). */
function ship(hull: ShipHull): GraphicsContext {
  const c = new GraphicsContext();
  if (hull === 'arrow') {
    neon(c, [0, -12, 3, -6, 8, -1, 8, 1, 3, -1, 1.5, 1, -1.5, 1, -3, -1, -8, 1, -8, -1, -3, -6]);
    line(c, [0, -9, 0, -3]);
  } else {
    neon(c, [0, -12, 2.5, -5, 8, -9, 7, 1, 2.5, -1.5, 0, 1, -2.5, -1.5, -7, 1, -8, -9, -2.5, -5]);
    line(c, [-2.5, -5, 0, -3, 2.5, -5]);
  }
  return c;
}

export const SHIP_ART: Record<ShipHull, GraphicsContext> = { arrow: ship('arrow'), swept: ship('swept') };

/** Engine flame under the ship, scaled on the y axis to flicker. */
export const FLAME_ART = new GraphicsContext().poly([-2, 0, 2, 0, 0, 5]).fill(0xffffff);

/** Enemy shot: bright core with a soft halo. */
export const ENEMY_SHOT_ART = new GraphicsContext()
  .circle(0, 0, 3.2)
  .fill({ color: 0xffffff, alpha: 0.25 })
  .circle(0, 0, 1.7)
  .fill(0xffffff);

export const BOMB_ART = new GraphicsContext()
  .poly([0, -4, 4, 0, 0, 4, -4, 0])
  .fill({ color: 0xffffff, alpha: 0.3 })
  .stroke({ color: 0xffffff, width: LINE })
  .circle(0, 0, 1.2)
  .fill(0xffffff);
