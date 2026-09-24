import type { PixelGrid } from '../view/pixelArt';

type Pair = readonly [PixelGrid, PixelGrid];

const PLAYER_PALETTE = { '#': 0x4af2ff, o: 0xffffff } as const;
const GRUNT_PALETTE = { '#': 0x7dff6b } as const;
const GUNNER_PALETTE = { '#': 0xff5ad1 } as const;
const DIVER_PALETTE = { '#': 0xffb341 } as const;
const SHIELD_PALETTE = { '#': 0x9aa7ff, o: 0xe6ebff } as const;
const SHIELD_CRACKED_PALETTE = { '#': 0x5a6099, o: 0xff5a5a } as const;
const SPLITTER_PALETTE = { '#': 0x4af2a0 } as const;
const MINI_PALETTE = { '#': 0x9affd6 } as const;
const PHASER_PALETTE = { '#': 0xc58bff } as const;
const BOMBER_PALETTE = { '#': 0xff7a3d } as const;
const TURRET_PALETTE = { '#': 0x9aa0aa, o: 0xff5a5a } as const;
const PLATE_PALETTE = { '#': 0x9aa0aa, o: 0x5a6070 } as const;
const WARDEN_PALETTE = {
  '#': 0x2b4a9e,
  l: 0x7fa8ff,
  '=': 0x9aa0aa,
  h: 0xc8ccd6,
  e: 0x6b7080,
  c: 0xff3b5c,
  a: 0xffe14a,
} as const;
const HIVE_PALETTE = { h: 0x8a7fb5, e: 0x4b4470, l: 0xffe14a, c: 0x7dff6b, d: 0xb7c9ff } as const;
const DREAD_PALETTE = { '#': 0x7a3b2e, l: 0xb85a3a, b: 0xcfcfcf, c: 0xffe14a, g: 0x555a66 } as const;

function pair(palette: Readonly<Record<string, number>>, a: string[], b: string[]): Pair {
  return [
    { palette, rows: a },
    { palette, rows: b },
  ];
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

/** 60×22 mothership saucer: glass dome, rim lights, green core. */
function hivePixel(x: number, y: number): string {
  if (Math.hypot(x - 29.5, y - 12) <= 4) return 'c';
  const dx = (x - 29.5) / 29.5;
  const dy = (y - 12) / 10;
  const r = dx * dx + dy * dy;
  if (r > 1) return '.';
  if (y === 12 && x % 6 === 3) return 'l';
  if (y < 6) return 'd';
  if (y > 15) return 'e';
  return r > 0.8 ? 'e' : 'h';
}

/** 96×24 battleship: tapered hull with plating, bridge tower, cannons, core window. */
function dreadPixel(x: number, y: number): string {
  if (Math.hypot(x - 47.5, y - 12) <= 4) return 'c';
  if (((x >= 8 && x <= 12) || (x >= 83 && x <= 87)) && y >= 17 && y <= 23) return 'g';
  if (x >= 40 && x <= 55 && y <= 5) return y === 0 ? 'l' : 'b';
  const halfWidth = 46 - Math.abs(y - 12) * 2.2;
  if (y >= 4 && y <= 20 && Math.abs(x - 47.5) <= halfWidth) return x % 8 === 0 || y === 4 || y === 20 ? 'l' : '#';
  return '.';
}

const SHIELD_A = [
  '..#######..',
  '.#ooooooo#.',
  '##o#####o##',
  '##o#.#.#o##',
  '###########',
  '.#.#...#.#.',
  '#.........#',
  '.#.......#.',
];
const SHIELD_B = [
  '..#######..',
  '.#ooooooo#.',
  '##o#####o##',
  '##o#.#.#o##',
  '###########',
  '..#.#.#.#..',
  '.#.......#.',
  '#.........#',
];

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
  grunt: pair(
    GRUNT_PALETTE,
    ['..#.....#..', '...#...#...', '..#######..', '.##.###.##.', '###########', '#.#######.#', '#.#.....#.#', '...##.##...'],
    ['..#.....#..', '#..#...#..#', '#.#######.#', '###.###.###', '###########', '.#########.', '..#.....#..', '.#.......#.'],
  ),
  gunner: pair(
    GUNNER_PALETTE,
    ['....###....', '..#######..', '.#########.', '.##..#..##.', '.#########.', '...##.##...', '..##.#.##..', '.##.....##.'],
    ['....###....', '..#######..', '.#########.', '.##..#..##.', '.#########.', '..##...##..', '.##.###.##.', '..##...##..'],
  ),
  diver: pair(
    DIVER_PALETTE,
    ['...#...#...', '...#####...', '..##.#.##..', '.#########.', '##.#####.##', '#..#...#..#', '...#...#...', '..#.....#..'],
    ['...#...#...', '...#####...', '..##.#.##..', '.#########.', '##.#####.##', '...#...#...', '..#.....#..', '.#.......#.'],
  ),
  shield: pair(SHIELD_PALETTE, SHIELD_A, SHIELD_B),
  shieldCracked: pair(SHIELD_CRACKED_PALETTE, SHIELD_A, SHIELD_B),
  splitter: pair(
    SPLITTER_PALETTE,
    ['..##...##..', '.####.####.', '##.##.##.##', '###########', '.#########.', '..#.#.#.#..', '.#.#...#.#.', '#.........#'],
    ['..##...##..', '.####.####.', '##.##.##.##', '###########', '.#########.', '..#.#.#.#..', '..#.#.#.#..', '.#.......#.'],
  ),
  phaser: pair(
    PHASER_PALETTE,
    ['...#####...', '..#.....#..', '.#.##.##.#.', '#.........#', '#.#######.#', '.#.......#.', '..#.#.#.#..', '...#...#...'],
    ['...#####...', '..#.....#..', '.#.##.##.#.', '#.........#', '#.#######.#', '.#.......#.', '...#.#.#...', '..#.....#..'],
  ),
  bomber: pair(
    BOMBER_PALETTE,
    ['....###....', '...#####...', '..##.#.##..', '.#########.', '###########', '#.#.###.#.#', '...##.##...', '..##...##..'],
    ['....###....', '...#####...', '..##.#.##..', '.#########.', '###########', '#.#.###.#.#', '...##.##...', '.##.....##.'],
  ),
  mini: pair(
    MINI_PALETTE,
    ['.#...#.', '..###..', '.#####.', '##.#.##', '.#####.', '#.....#'],
    ['.#...#.', '..###..', '.#####.', '##.#.##', '.#####.', '..#.#..'],
  ),
  turret: {
    palette: TURRET_PALETTE,
    rows: ['...####...', '..#oooo#..', '.########.', '##########', '#.######.#', '...#..#...', '...#..#...', '...####...'],
  },
  plate: {
    palette: PLATE_PALETTE,
    rows: ['##########', '#oooooooo#', '#o######o#', '#o######o#', '#oooooooo#', '##########'],
  },
  warden: { palette: WARDEN_PALETTE, rows: generate(56, 20, wardenPixel) },
  hive: { palette: HIVE_PALETTE, rows: generate(60, 22, hivePixel) },
  dreadnought: { palette: DREAD_PALETTE, rows: generate(96, 24, dreadPixel) },
} satisfies {
  player: PixelGrid;
  grunt: Pair;
  gunner: Pair;
  diver: Pair;
  shield: Pair;
  shieldCracked: Pair;
  splitter: Pair;
  phaser: Pair;
  bomber: Pair;
  mini: Pair;
  turret: PixelGrid;
  plate: PixelGrid;
  warden: PixelGrid;
  hive: PixelGrid;
  dreadnought: PixelGrid;
};
