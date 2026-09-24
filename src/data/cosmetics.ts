import type { SaveData } from '../persist/schema';

export type CosmeticKind = 'skin' | 'laser';
export type LaserStyle = 'bolt' | 'orb' | 'twin' | 'wave' | 'trail' | 'pulse';

export interface SkinDef {
  id: string;
  kind: 'skin';
  name: string;
  price: number;
  rows: readonly string[];
  palette: Readonly<Record<string, number>>;
  /** Animated rainbow tint. */
  hueCycle?: boolean;
}

export interface LaserDef {
  id: string;
  kind: 'laser';
  name: string;
  price: number;
  style: LaserStyle;
  color: number;
}

export type CosmeticDef = SkinDef | LaserDef;

const CLASSIC_HULL = [
  '......o......',
  '.....###.....',
  '.....###.....',
  '.###########.',
  '#############',
  '#############',
  '#############',
  '#############',
];

const INTERCEPTOR_HULL = [
  '......o......',
  '.....#o#.....',
  '....##.##....',
  '#..#######..#',
  '##.#######.##',
  '#############',
  '.###.###.###.',
  '..#.......#..',
];

export const SKINS: readonly SkinDef[] = [
  { id: 'skin.classic', kind: 'skin', name: 'CLASSIC', price: 0, rows: CLASSIC_HULL, palette: { '#': 0x4af2ff, o: 0xffffff } },
  { id: 'skin.interceptor', kind: 'skin', name: 'INTERCEPTOR', price: 300, rows: INTERCEPTOR_HULL, palette: { '#': 0x7dff6b, o: 0xffffff } },
  { id: 'skin.chrome', kind: 'skin', name: 'RETRO CHROME', price: 500, rows: CLASSIC_HULL, palette: { '#': 0xc8ccd6, o: 0x4af2ff } },
  { id: 'skin.crimson', kind: 'skin', name: 'CRIMSON ACE', price: 800, rows: INTERCEPTOR_HULL, palette: { '#': 0xff3b5c, o: 0xffe14a } },
  { id: 'skin.gold', kind: 'skin', name: 'GOLD', price: 1200, rows: CLASSIC_HULL, palette: { '#': 0xffc93b, o: 0xffffff } },
  {
    id: 'skin.prismatic',
    kind: 'skin',
    name: 'PRISMATIC',
    price: 2000,
    rows: INTERCEPTOR_HULL,
    palette: { '#': 0xffffff, o: 0xffffff },
    hueCycle: true,
  },
];

export const LASERS: readonly LaserDef[] = [
  { id: 'laser.classic', kind: 'laser', name: 'CLASSIC BOLT', price: 0, style: 'bolt', color: 0x9ff6ff },
  { id: 'laser.plasma', kind: 'laser', name: 'PLASMA ORB', price: 250, style: 'orb', color: 0x7dff6b },
  { id: 'laser.twin', kind: 'laser', name: 'TWIN BEAM', price: 500, style: 'twin', color: 0xff5ad1 },
  { id: 'laser.wave', kind: 'laser', name: 'PIXEL WAVE', price: 800, style: 'wave', color: 0x4af2ff },
  { id: 'laser.neon', kind: 'laser', name: 'NEON TRAIL', price: 1200, style: 'trail', color: 0xff7a3d },
  { id: 'laser.pulse', kind: 'laser', name: 'BEAT PULSE', price: 2000, style: 'pulse', color: 0xffffff },
];

export function cosmeticsOf(kind: CosmeticKind): readonly CosmeticDef[] {
  return kind === 'skin' ? SKINS : LASERS;
}

export function equippedSkin(save: SaveData): SkinDef {
  return SKINS.find((s) => s.id === save.equipped.skin) ?? SKINS[0]!;
}

export function equippedLaser(save: SaveData): LaserDef {
  return LASERS.find((l) => l.id === save.equipped.laser) ?? LASERS[0]!;
}
