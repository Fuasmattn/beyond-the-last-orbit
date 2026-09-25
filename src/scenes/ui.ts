import { Sprite, Texture } from 'pixi.js';
import { FIELD_H } from '../data/balance';
import type { Tap } from '../input/inputFrame';
import { viewport } from '../app/viewport';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function inRect(tap: Tap, r: Rect): boolean {
  return tap.x >= r.x && tap.x <= r.x + r.w && tap.y >= r.y && tap.y <= r.y + r.h;
}

export function sceneBackground(): Sprite {
  const bg = new Sprite(Texture.WHITE);
  bg.width = viewport.w;
  bg.height = FIELD_H;
  bg.tint = 0x05060d;
  return bg;
}
