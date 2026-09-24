import { Texture } from 'pixi.js';
import { GLYPHS } from '../data/font';
import { SPRITES } from '../data/sprites';
import type { EnemyKind } from '../sim/types';
import { gridToRGBA, type PixelGrid } from './pixelArt';

export type TexturePair = readonly [Texture, Texture];

export interface GameTextures {
  player: Texture;
  enemies: Record<EnemyKind, TexturePair>;
  shieldCracked: TexturePair;
  wardenBody: Texture;
  turret: Texture;
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
  return {
    player: textureFromGrid(SPRITES.player),
    enemies: {
      grunt: pair(SPRITES.grunt),
      gunner: pair(SPRITES.gunner),
      diver: pair(SPRITES.diver),
      shield: pair(SPRITES.shield),
    },
    shieldCracked: pair(SPRITES.shieldCracked),
    wardenBody: textureFromGrid(SPRITES.wardenBody),
    turret: textureFromGrid(SPRITES.turret),
    glyphs,
  };
}
