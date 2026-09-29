import { Container, Sprite, type Texture } from 'pixi.js';
import { viewport } from '../app/viewport';
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

/** Characters that fit in `width` px at this font's advance. */
export function charsThatFit(width: number): number {
  return Math.max(1, Math.floor((width + 1) / GLYPH_ADVANCE));
}

/**
 * Splits `text` at spaces into at most `maxLines` lines of at most `maxChars` characters (the last line takes
 * whatever is left). Single-line text that already fits comes back unchanged.
 */
export function wrapText(text: string, maxChars: number, maxLines = 2): string[] {
  if (text.length <= maxChars) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line && lines.length < maxLines - 1 && (line + ' ' + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  lines.push(line);
  return lines;
}

/** Horizontally centers `t` at row `y` within `width` (defaults to the menu frame). */
export function centerText(t: PixelText, y: number, width: number = viewport.menuW): void {
  t.position.set(Math.round((width - t.pixelWidth) / 2), y);
}
