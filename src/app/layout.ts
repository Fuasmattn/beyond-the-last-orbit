import { FIELD_H, FIELD_W } from '../data/balance';

export interface Layout {
  /** CSS px per logical px. */
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Fit the 3:4 field into the viewport; integer device-pixel scale when ≥ 2 for crisp pixels. */
export function computeLayout(viewW: number, viewH: number, dpr: number): Layout {
  const raw = Math.min((viewW * dpr) / FIELD_W, (viewH * dpr) / FIELD_H);
  const deviceScale = raw >= 2 ? Math.floor(raw) : raw;
  const scale = deviceScale / dpr;
  return {
    scale,
    offsetX: Math.round((viewW - FIELD_W * scale) / 2),
    offsetY: Math.round((viewH - FIELD_H * scale) / 2),
  };
}
