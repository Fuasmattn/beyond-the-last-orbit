import { Container, Graphics, type Texture } from 'pixi.js';
import { FIELD_H } from '../data/balance';
import { eventDef } from '../data/events';
import type { MenuAction, Tap } from '../input/inputFrame';
import { canChoose } from '../sim/signal';
import type { SimState } from '../sim/types';
import { blink } from './anim';
import { centerText, charsThatFit, PixelText, wrapText } from './pixelText';

const TOP = 150;
const ROW_H = 18;
const MAX_W = 150;
const ORANGE = 0xffb347;

/** SIGNAL node: a short story and two choices. */
export class EventOverlay extends Container {
  private readonly panel = new Graphics();
  private readonly title: PixelText;
  private readonly lines: PixelText[];
  private readonly choices: PixelText[];
  private readonly scrap: PixelText;
  private readonly hint: PixelText;
  private sel = 0;
  private tapped: number | null = null;

  constructor(glyphs: Map<string, Texture>, isTouch: boolean) {
    super();
    this.title = new PixelText(glyphs, '', ORANGE);
    // Two story lines and two choices, each of which may wrap onto a second line on narrow views.
    this.lines = [0, 1, 2, 3].map(() => new PixelText(glyphs, '', 0xcccccc));
    this.choices = [0, 1, 2, 3].map(() => new PixelText(glyphs));
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
    const maxChars = charsThatFit(w - 4);
    this.title.setText(def.title);
    centerText(this.title, TOP - 64, fieldW);
    const story = def.lines.flatMap((line) => wrapText(line, maxChars));
    this.lines.forEach((t, i) => {
      t.visible = i < story.length;
      t.setText(story[i] ?? '');
      centerText(t, TOP - 50 + i * 10, fieldW);
    });
    let ci = 0;
    def.choices.forEach((label, i) => {
      const y = TOP + i * ROW_H;
      const on = i === this.sel;
      const ok = canChoose(state, id, i);
      g.rect(x0, y - 4, w, ROW_H - 3).fill({ color: 0x05030f, alpha: 0.9 });
      g.rect(x0, y - 4, w, ROW_H - 3).stroke({ color: on ? 0xffe14a : 0x3a4060, width: 1, alpha: on && !blink(time, 3) ? 0.6 : 1 });
      const lines = wrapText(label, maxChars);
      lines.forEach((line, k) => {
        const t = this.choices[ci++]!;
        t.visible = true;
        t.setText(line);
        t.tint = !ok ? 0x555555 : on ? 0xffe14a : 0xffffff;
        // One line sits centred in the row; two lines share it (7 px glyphs, 1 px apart).
        centerText(t, lines.length === 1 ? y + 1 : y - 2 + k * 8, fieldW);
      });
    });
    for (let i = ci; i < this.choices.length; i++) this.choices[i]!.visible = false;
    this.scrap.setText(`SCRAP ${state.rogue.scrap}`);
    centerText(this.scrap, TOP + ROW_H * 2 + 6, fieldW);
    centerText(this.hint, FIELD_H - 40, fieldW);
  }
}
