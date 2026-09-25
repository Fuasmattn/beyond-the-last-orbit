import { Container } from 'pixi.js';
import type { Tap } from '../input/inputFrame';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function inRect(tap: Tap, r: Rect): boolean {
  return tap.x >= r.x && tap.x <= r.x + r.w && tap.y >= r.y && tap.y <= r.y + r.h;
}

/** Menus draw over the app's shared animated backdrop, so their own background is empty. */
export function sceneBackground(): Container {
  return new Container();
}
