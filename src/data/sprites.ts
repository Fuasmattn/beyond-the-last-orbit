import type { PixelGrid } from '../view/pixelArt';

const PLAYER_PALETTE = { '#': 0x4af2ff, o: 0xffffff } as const;
const GRUNT_PALETTE = { '#': 0x7dff6b } as const;
const GUNNER_PALETTE = { '#': 0xff5ad1 } as const;

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
} satisfies {
  player: PixelGrid;
  grunt: readonly [PixelGrid, PixelGrid];
  gunner: readonly [PixelGrid, PixelGrid];
};
