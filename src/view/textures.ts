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
  /** Solid white silhouettes for hit flashes. */
  enemiesWhite: Record<EnemyKind, TexturePair>;
  shieldCracked: TexturePair;
  bosses: Record<BossKind, Texture>;
  bossesWhite: Record<BossKind, Texture>;
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

function white(grid: PixelGrid): PixelGrid {
  const palette: Record<string, number> = {};
  for (const k of Object.keys(grid.palette)) palette[k] = 0xffffff;
  return { rows: grid.rows, palette };
}

function pair(grids: readonly [PixelGrid, PixelGrid], silhouette = false): TexturePair {
  const f = (g: PixelGrid) => textureFromGrid(silhouette ? white(g) : g);
  return [f(grids[0]), f(grids[1])];
}

function enemySet(silhouette: boolean): Record<EnemyKind, TexturePair> {
  return {
    grunt: pair(SPRITES.grunt, silhouette),
    gunner: pair(SPRITES.gunner, silhouette),
    diver: pair(SPRITES.diver, silhouette),
    shield: pair(SPRITES.shield, silhouette),
    splitter: pair(SPRITES.splitter, silhouette),
    phaser: pair(SPRITES.phaser, silhouette),
    bomber: pair(SPRITES.bomber, silhouette),
    mini: pair(SPRITES.mini, silhouette),
  };
}

function bossSet(silhouette: boolean): Record<BossKind, Texture> {
  const f = (g: PixelGrid) => textureFromGrid(silhouette ? white(g) : g);
  return { warden: f(SPRITES.warden), hive: f(SPRITES.hive), dreadnought: f(SPRITES.dreadnought) };
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
    enemies: enemySet(false),
    enemiesWhite: enemySet(true),
    shieldCracked: pair(SPRITES.shieldCracked),
    bosses: bossSet(false),
    bossesWhite: bossSet(true),
    turret: textureFromGrid(SPRITES.turret),
    plate: textureFromGrid(SPRITES.plate),
    glyphs,
  };
}
