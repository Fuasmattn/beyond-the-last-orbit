import { Container, Graphics, type Texture } from 'pixi.js';
import { FIELD_H } from '../data/balance';
import { eventDef } from '../data/events';
import type { MenuAction, Tap } from '../input/inputFrame';
import { canChoose } from '../sim/signal';
import type { SimState } from '../sim/types';
import { blink } from './anim';
import { centerText, PixelText } from './pixelText';

const TOP = 150;
const ROW_H = 18;
const MAX_W = 150;
const ORANGE = 0xffb347;

/** SIGNAL node: a short story and two choices. */
export class EventOverlay extends Container {
  private readonly panel = new Graphics();
  private readonly title: PixelText;
  private readonly lines: [PixelText, PixelText];
  private readonly choices: [PixelText, PixelText];
  private readonly scrap: PixelText;
  private readonly hint: PixelText;
  private sel = 0;
  private tapped: number | null = null;

  constructor(glyphs: Map<string, Texture>, isTouch: boolean) {
    super();
    this.title = new PixelText(glyphs, '', ORANGE);
    this.lines = [new PixelText(glyphs, '', 0xcccccc), new PixelText(glyphs, '', 0xcccccc)];
    this.choices = [new PixelText(glyphs), new PixelText(glyphs)];
    this.scrap = new PixelText(glyphs, '', 0xffb347);
    this.hint = new PixelText(glyphs, isTouch ? 'TAP TWICE TO CHOOSE' : 'UP/DOWN  FIRE TO CHOOSE', 0x777777);
    this.addChild(this.panel, this.title, ...this.lines, ...this.choices, this.scrap, this.hint);
    this.visible = false;
  }

  open(): void {
    this.sel = 0;
    this.tapped = null;
  }

  /** Returns the chosen index, or null. A tap selects; a second tap on the same row chooses. */
  handle(menu: readonly MenuAction[], taps: readonly Tap[]): number | null {
    for (const a of menu) {
      if (a === 'up' || a === 'down' || a === 'left' || a === 'right') this.sel = 1 - this.sel;
      else if (a === 'confirm') return this.sel;
      this.tapped = null;
    }
    for (const t of taps) {
      const i = Math.floor((t.y - (TOP - 4)) / ROW_H);
      if (i < 0 || i > 1) continue;
      if (this.tapped === i) return i;
      this.sel = i;
      this.tapped = i;
    }
    return null;
  }

  update(state: SimState, fieldW: number, time: number): void {
    const id = state.rogue.event;
    if (id === null) return;
    const def = eventDef(id);
    const w = Math.min(MAX_W, fieldW - 8);
    const x0 = Math.round((fieldW - w) / 2);
    const g = this.panel.clear().rect(0, 0, fieldW, FIELD_H).fill({ color: 0x000000, alpha: 0.6 });
    this.title.setText(def.title);
    centerText(this.title, TOP - 60, fieldW);
    def.lines.forEach((line, i) => {
      this.lines[i]!.setText(line);
      centerText(this.lines[i]!, TOP - 40 + i * 10, fieldW);
    });
    def.choices.forEach((label, i) => {
      const y = TOP + i * ROW_H;
      const on = i === this.sel;
      const ok = canChoose(state, id, i);
      g.rect(x0, y - 4, w, ROW_H - 3).fill({ color: 0x05030f, alpha: 0.9 });
      g.rect(x0, y - 4, w, ROW_H - 3).stroke({ color: on ? 0xffe14a : 0x3a4060, width: 1, alpha: on && !blink(time, 3) ? 0.6 : 1 });
      const t = this.choices[i]!;
      t.setText(label);
      t.tint = !ok ? 0x555555 : on ? 0xffe14a : 0xffffff;
      centerText(t, y + 1, fieldW);
    });
    this.scrap.setText(`SCRAP ${state.rogue.scrap}`);
    centerText(this.scrap, TOP + ROW_H * 2 + 6, fieldW);
    centerText(this.hint, FIELD_H - 40, fieldW);
  }
}
