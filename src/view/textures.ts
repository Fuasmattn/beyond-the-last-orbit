import { Texture } from 'pixi.js';
import { GLYPHS } from '../data/font';
import { SPRITES } from '../data/sprites';
import type { EnemyKind } from '../sim/types';
import { gridToRGBA, type PixelGrid } from './pixelArt';

export interface GameTextures {
  player: Texture;
  enemies: Record<EnemyKind, readonly [Texture, Texture]>;
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

export function loadTextures(): GameTextures {
  const glyphs = new Map<string, Texture>();
  for (const [ch, rows] of Object.entries(GLYPHS)) {
    glyphs.set(ch, textureFromGrid({ rows, palette: { '#': 0xffffff } }));
  }
  return {
    player: textureFromGrid(SPRITES.player),
    enemies: {
      grunt: [textureFromGrid(SPRITES.grunt[0]), textureFromGrid(SPRITES.grunt[1])],
      gunner: [textureFromGrid(SPRITES.gunner[0]), textureFromGrid(SPRITES.gunner[1])],
    },
    glyphs,
  };
}
