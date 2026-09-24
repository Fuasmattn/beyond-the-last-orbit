export interface PixelGrid {
  rows: readonly string[];
  /** Char → 0xRRGGBB. Chars not in the palette are transparent. */
  palette: Readonly<Record<string, number>>;
}

export function gridToRGBA(grid: PixelGrid): {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
} {
  const height = grid.rows.length;
  const width = Math.max(0, ...grid.rows.map((r) => r.length));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = grid.rows[y]!;
    for (let x = 0; x < row.length; x++) {
      const color = grid.palette[row[x]!];
      if (color === undefined) continue;
      const i = (y * width + x) * 4;
      data[i] = (color >> 16) & 0xff;
      data[i + 1] = (color >> 8) & 0xff;
      data[i + 2] = color & 0xff;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}
