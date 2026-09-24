import type { PixelGrid } from '../view/pixelArt';

const PLAYER_PALETTE = { '#': 0x4af2ff, o: 0xffffff } as const;
const GRUNT_PALETTE = { '#': 0x7dff6b } as const;
const GUNNER_PALETTE = { '#': 0xff5ad1 } as const;
const DIVER_PALETTE = { '#': 0xffb341 } as const;
const SHIELD_PALETTE = { '#': 0x9aa7ff, o: 0xe6ebff } as const;
const SHIELD_CRACKED_PALETTE = { '#': 0x5a6099, o: 0xff5a5a } as const;
const TURRET_PALETTE = { '#': 0x9aa0aa, o: 0xff5a5a } as const;
const WARDEN_PALETTE = {
  '#': 0x2b4a9e,
  l: 0x7fa8ff,
  '=': 0x9aa0aa,
  h: 0xc8ccd6,
  e: 0x6b7080,
  c: 0xff3b5c,
  a: 0xffe14a,
} as const;

const SHIELD_ROWS_A = [
  '..#######..',
  '.#ooooooo#.',
  '##o#####o##',
  '##o#.#.#o##',
  '###########',
  '.#.#...#.#.',
  '#.........#',
  '.#.......#.',
];
const SHIELD_ROWS_B = [
  '..#######..',
  '.#ooooooo#.',
  '##o#####o##',
  '##o#.#.#o##',
  '###########',
  '..#.#.#.#..',
  '.#.......#.',
  '#.........#',
];

/** 56×20 satellite station: solar panels, struts, hub with a red core window, antenna. */
function wardenPixel(x: number, y: number): string {
  const r = Math.hypot(x - 27.5, y - 9.5);
  if (r <= 3.2) return 'c';
  if (r <= 8.5) return r > 7.4 ? 'e' : 'h';
  if (y >= 5 && y <= 14 && (x <= 16 || x >= 39)) return x % 4 === 0 || y === 5 || y === 14 ? 'l' : '#';
  if ((y === 9 || y === 10) && x > 16 && x < 39) return '=';
  if ((x === 27 || x === 28) && y <= 1) return 'a';
  return '.';
}

function generate(w: number, h: number, pixel: (x: number, y: number) => string): string[] {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) row += pixel(x, y);
    rows.push(row);
  }
  return rows;
}

export const SPRITES = {
  player: {
    palette: PLAYER_PALETTE,
    rows: [
      '......o......',
      '.....###.....',
      '.....###.....',
      '.###########.',
      '#############',
      '#############',
      '#############',
      '#############',
    ],
  },
  grunt: [
    {
      palette: GRUNT_PALETTE,
      rows: [
        '..#.....#..',
        '...#...#...',
        '..#######..',
        '.##.###.##.',
        '###########',
        '#.#######.#',
        '#.#.....#.#',
        '...##.##...',
      ],
    },
    {
      palette: GRUNT_PALETTE,
      rows: [
        '..#.....#..',
        '#..#...#..#',
        '#.#######.#',
        '###.###.###',
        '###########',
        '.#########.',
        '..#.....#..',
        '.#.......#.',
      ],
    },
  ],
  gunner: [
    {
      palette: GUNNER_PALETTE,
      rows: [
        '....###....',
        '..#######..',
        '.#########.',
        '.##..#..##.',
        '.#########.',
        '...##.##...',
        '..##.#.##..',
        '.##.....##.',
      ],
    },
    {
      palette: GUNNER_PALETTE,
      rows: [
        '....###....',
        '..#######..',
        '.#########.',
        '.##..#..##.',
        '.#########.',
        '..##...##..',
        '.##.###.##.',
        '..##...##..',
      ],
    },
  ],
  diver: [
    {
      palette: DIVER_PALETTE,
      rows: [
        '...#...#...',
        '...#####...',
        '..##.#.##..',
        '.#########.',
        '##.#####.##',
        '#..#...#..#',
        '...#...#...',
        '..#.....#..',
      ],
    },
    {
      palette: DIVER_PALETTE,
      rows: [
        '...#...#...',
        '...#####...',
        '..##.#.##..',
        '.#########.',
        '##.#####.##',
        '...#...#...',
        '..#.....#..',
        '.#.......#.',
      ],
    },
  ],
  shield: [
    { palette: SHIELD_PALETTE, rows: SHIELD_ROWS_A },
    { palette: SHIELD_PALETTE, rows: SHIELD_ROWS_B },
  ],
  shieldCracked: [
    { palette: SHIELD_CRACKED_PALETTE, rows: SHIELD_ROWS_A },
    { palette: SHIELD_CRACKED_PALETTE, rows: SHIELD_ROWS_B },
  ],
  turret: {
    palette: TURRET_PALETTE,
    rows: [
      '...####...',
      '..#oooo#..',
      '.########.',
      '##########',
      '#.######.#',
      '...#..#...',
      '...#..#...',
      '...####...',
    ],
  },
  wardenBody: { palette: WARDEN_PALETTE, rows: generate(56, 20, wardenPixel) },
} satisfies {
  player: PixelGrid;
  grunt: readonly [PixelGrid, PixelGrid];
  gunner: readonly [PixelGrid, PixelGrid];
  diver: readonly [PixelGrid, PixelGrid];
  shield: readonly [PixelGrid, PixelGrid];
  shieldCracked: readonly [PixelGrid, PixelGrid];
  turret: PixelGrid;
  wardenBody: PixelGrid;
};
