import { ENEMY, FORMATION } from '../data/balance';
import { clamp } from './math';

export const SHAPE_KINDS = ['block', 'chevron', 'arch', 'wave', 'stagger', 'tilt'] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

export interface SlotOffset {
  /** Horizontal offset of the slot center from the formation center. */
  dx: number;
  /** Vertical offset of the slot top from the formation top (≥ 0). */
  dy: number;
}

/**
 * Horizontal span between the outermost slot centers. Wider fields spread the formation
 * (up to 1.5× spacing); narrow fields squeeze it so it still fits with room to sway.
 */
export function shapeWidth(cols: number, fieldW: number): number {
  const spread = (cols - 1) * ENEMY.spacingX * clamp(fieldW / 240, 1, 1.5);
  return Math.min(spread, fieldW - 2 * (FORMATION.edgeMargin + ENEMY.w));
}

/**
 * Slot of (row, col) in a formation shape. Every shape keeps columns evenly spaced and
 * rows `spacingY` apart, so slots never overlap as long as the column spacing ≥ ENEMY.w.
 */
export function slotOffset(kind: ShapeKind, row: number, col: number, cols: number, width: number): SlotOffset {
  const u = cols > 1 ? (2 * col) / (cols - 1) - 1 : 0;
  const half = width / 2;
  const sy = ENEMY.spacingY;
  const dx = u * half;
  const base = row * sy;
  switch (kind) {
    case 'block':
      return { dx, dy: base };
    case 'chevron':
      return { dx, dy: base + (1 - Math.abs(u)) * 2 * sy };
    case 'arch':
      return { dx, dy: base + Math.abs(u) * 2 * sy };
    case 'wave':
      return { dx, dy: base + (1 + Math.sin(u * Math.PI)) * 1.2 * sy };
    case 'stagger':
      return { dx, dy: base + (col % 2) * 0.5 * sy };
    case 'tilt':
      return { dx, dy: base + (1 + u) * 1.2 * sy };
  }
}

const SEQUENCES: readonly (readonly ShapeKind[])[] = [
  ['chevron', 'wave'],
  ['wave', 'arch', 'block'],
  ['chevron', 'stagger', 'tilt'],
  ['arch', 'wave', 'stagger', 'chevron'],
  ['stagger', 'chevron', 'wave'],
  ['tilt', 'arch', 'block', 'wave'],
];

/** Shape cycle for a formation stage; the formation morphs to the next shape on every advance. */
export function stageShapes(world: number, stage: number): readonly ShapeKind[] {
  return SEQUENCES[(world * 4 + stage - 1) % SEQUENCES.length]!;
}
