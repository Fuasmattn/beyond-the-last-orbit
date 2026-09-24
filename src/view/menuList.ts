import { Container, type Texture } from 'pixi.js';
import type { Tap } from '../input/inputFrame';
import { blink } from './anim';
import { PixelText } from './pixelText';

export interface MenuLayout {
  x: number;
  y: number;
  lineH: number;
  width: number;
}

export interface MenuRow {
  label: string;
  value?: string;
}

/** Row index under a tap, or null. Rows are `lineH` tall starting a few px above each baseline. */
export function menuIndexAt(tap: Tap, layout: MenuLayout, count: number): number | null {
  if (tap.x < layout.x - 10 || tap.x > layout.x + layout.width + 10) return null;
  const i = Math.floor((tap.y - layout.y + 4) / layout.lineH);
  return i >= 0 && i < count ? i : null;
}

const SELECTED = 0xffe14a;
const NORMAL = 0xbbbbbb;

/** Vertical menu with a blinking cursor; values are right-aligned. */
export class MenuList extends Container {
  selected = 0;
  private rows: { label: PixelText; value: PixelText }[] = [];
  private readonly marker: PixelText;

  constructor(
    private readonly glyphs: Map<string, Texture>,
    readonly layout: MenuLayout,
  ) {
    super();
    this.marker = new PixelText(glyphs, '>', SELECTED);
    this.addChild(this.marker);
  }

  get count(): number {
    return this.rows.length;
  }

  setRows(rows: readonly MenuRow[]): void {
    while (this.rows.length < rows.length) {
      const label = new PixelText(this.glyphs);
      const value = new PixelText(this.glyphs);
      this.addChild(label, value);
      this.rows.push({ label, value });
    }
    while (this.rows.length > rows.length) {
      const r = this.rows.pop()!;
      r.label.destroy({ children: true });
      r.value.destroy({ children: true });
    }
    const { x, y, lineH, width } = this.layout;
    rows.forEach((row, i) => {
      const r = this.rows[i]!;
      r.label.setText(row.label);
      r.value.setText(row.value ?? '');
      r.label.position.set(x, y + i * lineH);
      r.value.position.set(x + width - r.value.pixelWidth, y + i * lineH);
    });
    this.selected = Math.min(this.selected, Math.max(0, rows.length - 1));
  }

  move(delta: number): void {
    const n = this.rows.length;
    if (n > 0) this.selected = (this.selected + delta + n) % n;
  }

  indexAt(tap: Tap): number | null {
    return menuIndexAt(tap, this.layout, this.rows.length);
  }

  refresh(time: number): void {
    this.rows.forEach((r, i) => {
      const color = i === this.selected ? SELECTED : NORMAL;
      r.label.tint = color;
      r.value.tint = color;
    });
    this.marker.position.set(this.layout.x - 8, this.layout.y + this.selected * this.layout.lineH);
    this.marker.visible = this.rows.length > 0 && blink(time, 2);
  }
}
