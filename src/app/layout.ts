import { FIELD_H, FIELD_W_MAX, FIELD_W_MIN, TOUCH_VIEW } from '../data/balance';
import { clamp } from '../sim/math';

export interface Layout {
  /** Logical playfield width the sim runs on (height is always FIELD_H). */
  fieldW: number;
  /** Logical width visible on screen; HUD, overlays and menus lay out in it. Narrower than `fieldW` on touch. */
  viewW: number;
  /** CSS px per logical px. */
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Desktop: fit the fixed-height field to the viewport; the width follows the aspect ratio within limits.
 * Touch: fill the screen by height and make the field wider than the view, so a camera pans across it.
 */
export function computeLayout(viewW: number, viewH: number, touch = false): Layout {
  if (touch) {
    const visible = clamp((FIELD_H * viewW) / viewH, TOUCH_VIEW.minW, FIELD_W_MAX);
    const scale = Math.min(viewH / FIELD_H, viewW / visible);
    const fieldW = Math.max(Math.ceil(visible), clamp(Math.round(visible * TOUCH_VIEW.overscan), FIELD_W_MIN, FIELD_W_MAX));
    return {
      fieldW,
      viewW: visible,
      scale,
      offsetX: Math.round((viewW - visible * scale) / 2),
      offsetY: Math.round((viewH - FIELD_H * scale) / 2),
    };
  }
  const fieldW = clamp(Math.round((FIELD_H * viewW) / viewH), FIELD_W_MIN, FIELD_W_MAX);
  const scale = Math.min(viewH / FIELD_H, viewW / fieldW);
  return {
    fieldW,
    viewW: fieldW,
    scale,
    offsetX: Math.round((viewW - fieldW * scale) / 2),
    offsetY: Math.round((viewH - FIELD_H * scale) / 2),
  };
}
