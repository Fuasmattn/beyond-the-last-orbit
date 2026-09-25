import { FIELD_H, FIELD_W_MAX, FIELD_W_MIN } from '../data/balance';
import { clamp } from '../sim/math';

export interface Layout {
  /** Logical playfield width for this viewport (height is always FIELD_H). */
  fieldW: number;
  /** CSS px per logical px. */
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Fit the fixed-height field to the viewport; the width follows the aspect ratio within limits. */
export function computeLayout(viewW: number, viewH: number): Layout {
  const fieldW = clamp(Math.round((FIELD_H * viewW) / viewH), FIELD_W_MIN, FIELD_W_MAX);
  const scale = Math.min(viewH / FIELD_H, viewW / fieldW);
  return {
    fieldW,
    scale,
    offsetX: Math.round((viewW - fieldW * scale) / 2),
    offsetY: Math.round((viewH - FIELD_H * scale) / 2),
  };
}
