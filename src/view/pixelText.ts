import { Container, Sprite, type Texture } from 'pixi.js';
import { GLYPH_ADVANCE, textWidth } from '../data/font';

export class PixelText extends Container {
  private current = '';

  constructor(
    private readonly glyphs: Map<string, Texture>,
    text = '',
    private readonly color = 0xffffff,
  ) {
    super();
    this.setText(text);
  }

  get text(): string {
    return this.current;
  }

  /** Width in logical px including this container's scale. */
  get pixelWidth(): number {
    return textWidth(this.current) * this.scale.x;
  }

  setText(text: string): void {
    const upper = text.toUpperCase();
    if (upper === this.current) return;
    this.current = upper;
    for (const child of this.removeChildren()) child.destroy();
    let x = 0;
    for (const ch of upper) {
      const tex = this.glyphs.get(ch);
      if (tex) {
        const s = new Sprite(tex);
        s.x = x;
        s.tint = this.color;
        this.addChild(s);
      }
      x += GLYPH_ADVANCE;
    }
  }
}
