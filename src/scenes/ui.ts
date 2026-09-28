import { Container } from 'pixi.js';
import { viewport } from '../app/viewport';
import { MENU_W } from '../data/balance';
import type { Tap } from '../input/inputFrame';
import type { MenuLayout } from '../view/menuList';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Narrow frame: 8px side margins for the list marker and right-aligned values. */
const NARROW_LIST = { x: 16, margin: 8 } as const;

export function inRect(tap: Tap, r: Rect): boolean {
  return tap.x >= r.x && tap.x <= r.x + r.w && tap.y >= r.y && tap.y <= r.y + r.h;
}

/** Menus draw over the app's shared animated backdrop, so their own background is empty. */
export function sceneBackground(): Container {
  return new Container();
}

/** True when menus lay out in the narrow touch frame (`viewport.menuW < MENU_W`). */
export function narrowMenu(): boolean {
  return viewport.menuW < MENU_W;
}

/** Left edge that centers a `w`-wide box in the menu frame. */
export function centerX(w: number): number {
  return Math.round((viewport.menuW - w) / 2);
}

/** `desktop` list geometry on the full frame; on the narrow frame the list spans it with small margins. */
export function menuListLayout(desktop: MenuLayout): MenuLayout {
  if (!narrowMenu()) return { ...desktop };
  const { x, margin } = NARROW_LIST;
  return { ...desktop, x, width: viewport.menuW - x - margin };
}
