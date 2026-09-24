import { describe, expect, it } from 'vitest';
import { gridToRGBA } from '../../src/view/pixelArt';

describe('gridToRGBA', () => {
  it('maps palette chars to opaque RGBA and others to transparent', () => {
    const img = gridToRGBA({ rows: ['#.', '.o'], palette: { '#': 0xff0000, o: 0x00ff80 } });
    expect(img.width).toBe(2);
    expect(img.height).toBe(2);
    expect([...img.data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    expect([...img.data.slice(4, 8)]).toEqual([0, 0, 0, 0]);
    expect([...img.data.slice(12, 16)]).toEqual([0, 255, 128, 255]);
  });

  it('pads ragged rows to the widest row', () => {
    const img = gridToRGBA({ rows: ['###', '#'], palette: { '#': 0xffffff } });
    expect(img.width).toBe(3);
    expect(img.data[(1 * 3 + 2) * 4 + 3]).toBe(0);
  });
});
