import { Texture } from 'pixi.js';
import { SKINS } from '../data/cosmetics';
import { GLYPHS } from '../data/font';
import { SPRITES } from '../data/sprites';
import type { BossKind, EnemyKind } from '../sim/types';
import { gridToRGBA, type PixelGrid } from './pixelArt';

export type TexturePair = readonly [Texture, Texture];

export interface GameTextures {
  /** Ship texture per skin id. */
  skins: Map<string, Texture>;
  orb: Texture;
  enemies: Record<EnemyKind, TexturePair>;
  shieldCracked: TexturePair;
  bosses: Record<BossKind, Texture>;
  turret: Texture;
  plate: Texture;
  glyphs: Map<string, Texture>;
}

export function textureFromGrid(grid: PixelGrid): Texture {
  const { width, height, data } = gridToRGBA(grid);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.putImageData(new ImageData(data, width, height), 0, 0);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'nearest';
  return texture;
}

function pair(grids: readonly [PixelGrid, PixelGrid]): TexturePair {
  return [textureFromGrid(grids[0]), textureFromGrid(grids[1])];
}

export function loadTextures(): GameTextures {
  const glyphs = new Map<string, Texture>();
  for (const [ch, rows] of Object.entries(GLYPHS)) {
    glyphs.set(ch, textureFromGrid({ rows, palette: { '#': 0xffffff } }));
  }
  const skins = new Map<string, Texture>();
  for (const s of SKINS) skins.set(s.id, textureFromGrid({ rows: s.rows, palette: s.palette }));
  return {
    skins,
    orb: textureFromGrid({ rows: ['.##.', '####', '####', '.##.'], palette: { '#': 0xffffff } }),
    enemies: {
      grunt: pair(SPRITES.grunt),
      gunner: pair(SPRITES.gunner),
      diver: pair(SPRITES.diver),
      shield: pair(SPRITES.shield),
      splitter: pair(SPRITES.splitter),
      phaser: pair(SPRITES.phaser),
      bomber: pair(SPRITES.bomber),
      mini: pair(SPRITES.mini),
    },
    shieldCracked: pair(SPRITES.shieldCracked),
    bosses: {
      warden: textureFromGrid(SPRITES.warden),
      hive: textureFromGrid(SPRITES.hive),
      dreadnought: textureFromGrid(SPRITES.dreadnought),
    },
    turret: textureFromGrid(SPRITES.turret),
    plate: textureFromGrid(SPRITES.plate),
    glyphs,
  };
}
