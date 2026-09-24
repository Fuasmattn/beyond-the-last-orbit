/** Fully saturated color for hue `h` in [0, 1) as 0xRRGGBB. */
export function hueToRgb(h: number): number {
  const hh = (((h % 1) + 1) % 1) * 6;
  const i = Math.floor(hh);
  const f = hh - i;
  const up = Math.round(255 * f);
  const down = Math.round(255 * (1 - f));
  const table: readonly (readonly [number, number, number])[] = [
    [255, up, 0],
    [down, 255, 0],
    [0, 255, up],
    [0, down, 255],
    [up, 0, 255],
    [255, 0, down],
  ];
  const [r, g, b] = table[i] ?? [255, 0, 0];
  return (r << 16) | (g << 8) | b;
}
