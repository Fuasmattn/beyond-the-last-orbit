import { Container, Graphics, type Texture } from 'pixi.js';
import { FIELD_H } from '../data/balance';
import type { Tap } from '../input/inputFrame';
import { blink } from './anim';
import { PixelText } from './pixelText';

const ON = 0x7dff6b;
const OFF = 0xff5a5a;
const HINT = 0xffe14a;
/** Icon box in logical px (before `scale`), anchored to the bottom-right corner of the screen. */
const ICON = { w: 11, h: 7, margin: 4 } as const;
/** Taps this far around the icon and label still hit. */
const SLOP = 6;

/** Speaker icon with a label, bottom-right on menu screens. Before audio starts it asks for a tap. */
export class SoundToggle extends Container {
  private readonly icon = new Graphics();
  private readonly status: PixelText;
  private readonly hint: PixelText;
  private box = { x: 0, y: 0, w: 0, h: 0 };

  constructor(
    glyphs: Map<string, Texture>,
    private readonly iconScale: number,
  ) {
    super();
    this.status = new PixelText(glyphs, '');
    this.hint = new PixelText(glyphs, 'TAP FOR SOUND', HINT);
    this.icon.scale.set(iconScale);
    this.addChild(this.icon, this.status, this.hint);
  }

  /** `unlocked`: audio has started (a gesture happened). `viewW`: visible logical width. */
  update(muted: boolean, unlocked: boolean, viewW: number, time: number): void {
    const s = this.iconScale;
    const x = viewW - ICON.margin - ICON.w * s;
    const y = FIELD_H - ICON.margin - ICON.h * s;
    const color = muted ? OFF : ON;
    this.icon.clear().position.set(x, y);
    this.icon
      .rect(0, 2, 2, 3)
      .fill(color)
      .poly([2, 2, 5, 0, 5, 7, 2, 5])
      .fill(color);
    if (muted) {
      this.icon.moveTo(7, 1.5).lineTo(11, 5.5).moveTo(11, 1.5).lineTo(7, 5.5).stroke({ color, width: 1 });
    } else {
      this.icon.moveTo(7, 2).lineTo(7, 5).moveTo(9.5, 0.5).lineTo(9.5, 6.5).stroke({ color, width: 1 });
    }
    this.hint.visible = !unlocked && blink(time, 1);
    this.status.visible = unlocked;
    this.status.setText(muted ? 'SOUND OFF' : 'SOUND ON');
    this.status.tint = color;
    const text = unlocked ? this.status : this.hint;
    const textY = Math.round(y + (ICON.h * s) / 2 - 2.5);
    this.status.position.set(Math.round(x - 4 - this.status.pixelWidth), textY);
    this.hint.position.set(Math.round(x - 4 - this.hint.pixelWidth), textY);
    this.box = { x: text.x, y, w: viewW - text.x, h: ICON.h * s + ICON.margin };
  }

  hit(t: Tap): boolean {
    const b = this.box;
    return t.x >= b.x - SLOP && t.x <= b.x + b.w + SLOP && t.y >= b.y - SLOP && t.y <= b.y + b.h + SLOP;
  }
}
