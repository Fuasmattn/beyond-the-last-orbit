import { Graphics } from 'pixi.js';
import type { Layout } from '../app/layout';
import { FIELD_H, FIELD_W } from '../data/balance';

const MIN_SIDE = 12;
const GRID = 24;

/** Arcade-cabinet side art in screen space around the letterboxed playfield. */
export class Bezel extends Graphics {
  draw(layout: Layout, viewW: number, viewH: number): void {
    this.clear();
    const x0 = layout.offsetX;
    const x1 = x0 + FIELD_W * layout.scale;
    if (x0 < MIN_SIDE) return;
    const top = layout.offsetY;
    const bottom = top + FIELD_H * layout.scale;
    this.rect(0, 0, viewW, viewH).fill(0x06071a);
    for (let y = 0; y < viewH; y += GRID) {
      this.rect(0, y, x0, 1).fill({ color: 0x1a2244, alpha: 0.7 });
      this.rect(x1, y, viewW - x1, 1).fill({ color: 0x1a2244, alpha: 0.7 });
    }
    for (let x = x0 - GRID; x > 0; x -= GRID) this.rect(x, 0, 1, viewH).fill({ color: 0x1a2244, alpha: 0.4 });
    for (let x = x1 + GRID; x < viewW; x += GRID) this.rect(x, 0, 1, viewH).fill({ color: 0x1a2244, alpha: 0.4 });
    this.rect(x0 - 4, top, 2, bottom - top).fill(0x4af2ff);
    this.rect(x1 + 2, top, 2, bottom - top).fill(0xff5ad1);
    if (top >= 4) {
      this.rect(x0 - 4, top - 4, x1 - x0 + 8, 2).fill({ color: 0x4af2ff, alpha: 0.5 });
      this.rect(x0 - 4, bottom + 2, x1 - x0 + 8, 2).fill({ color: 0xff5ad1, alpha: 0.5 });
    }
  }

  pulse(amount: number): void {
    this.alpha = 0.7 + 0.3 * amount;
  }
}
