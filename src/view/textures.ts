import { Texture } from 'pixi.js';
import { BOON_ICONS } from '../data/boonIcons';
import { GLYPHS } from '../data/font';
import type { BoonId } from '../sim/types';
import { gridToRGBA, type PixelGrid } from './pixelArt';

export interface GameTextures {
  orb: Texture;
  glyphs: Map<string, Texture>;
  /** 8×8 boon pictograms, white (tinted per rarity where drawn). */
  icons: Map<BoonId, Texture>;
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

/** Pixel textures: the font, the boon pictograms and the plasma orb. Ships, enemies and bosses are vector art. */
export function loadTextures(): GameTextures {
  const glyphs = new Map<string, Texture>();
  for (const [ch, rows] of Object.entries(GLYPHS)) {
    glyphs.set(ch, textureFromGrid({ rows, palette: { '#': 0xffffff } }));
  }
  const icons = new Map<BoonId, Texture>();
  for (const [id, rows] of Object.entries(BOON_ICONS) as [BoonId, readonly string[]][]) {
    icons.set(id, textureFromGrid({ rows, palette: { '#': 0xffffff } }));
  }
  return {
    orb: textureFromGrid({ rows: ['.##.', '####', '####', '.##.'], palette: { '#': 0xffffff } }),
    glyphs,
    icons,
  };
}
