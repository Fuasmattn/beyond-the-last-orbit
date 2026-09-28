import { ROUTE, STAGE } from '../data/balance';
import { nextRandom } from './rng';
import type { NodeKind, RogueState, RouteMap, RouteNode } from './types';

/** Map rows per world: every stage between the fixed opener and the boss. */
export const MAP_ROWS = STAGE.perWorld - 2;
/** Map row whose nodes are all beat stages (stage 3 of every world). */
export const BEAT_ROW = 1;
const LANE_SETS: readonly (readonly number[])[] = [
  [0, 1],
  [1, 2],
  [0, 2],
];
const MAX_ATTEMPTS = 30;

type Rng = { seed: number };

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(nextRandom(rng) * items.length)]!;
}

function weighted<T extends string>(rng: Rng, weights: Readonly<Record<T, number>>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let x = nextRandom(rng) * total;
  for (const [k, w] of entries) {
    x -= w;
    if (x < 0) return k;
  }
  return entries[entries.length - 1]![0];
}

const near = (a: number, b: number) => Math.abs(a - b) <= 1;

/** Every node reaches the next row and every next-row node is reached. */
function connected(a: readonly number[], b: readonly number[]): boolean {
  return a.every((x) => b.some((y) => near(x, y))) && b.every((y) => a.some((x) => near(x, y)));
}

function rowLanes(rng: Rng): number[] {
  return nextRandom(rng) < 0.5 ? [0, 1, 2] : [...pick(rng, LANE_SETS)];
}

/** Drops one of each pair of crossing edges (a→a+1 and a+1→a) when both ends keep a link. */
function uncross(rng: Rng, row: RouteNode[]): void {
  const inDegree = (lane: number) => row.filter((n) => n.next.includes(lane)).length;
  for (const a of row) {
    const b = row.find((n) => n.lane === a.lane + 1);
    if (!b || !a.next.includes(a.lane + 1) || !b.next.includes(a.lane)) continue;
    // Edge options: [source, target lane].
    const options: [RouteNode, number][] = [
      [a, a.lane + 1],
      [b, a.lane],
    ];
    if (nextRandom(rng) < 0.5) options.reverse();
    for (const [src, target] of options) {
      if (src.next.length > 1 && inDegree(target) > 1) {
        src.next = src.next.filter((l) => l !== target);
        break;
      }
    }
  }
}

function assignKinds(rng: Rng, row: RouteNode[], rowIdx: number, world: number): void {
  const battle = Math.floor(nextRandom(rng) * row.length);
  if (rowIdx === BEAT_ROW) {
    // Beat row: fights only (no way around the beat), one guaranteed battle, the rest elite or battle.
    const eliteChance = ROUTE.weights.elite / (ROUTE.weights.elite + ROUTE.weights.cache);
    row.forEach((n, i) => {
      n.beat = true;
      n.kind = i !== battle && nextRandom(rng) < eliteChance ? 'elite' : 'battle';
    });
    return;
  }
  const pool: Partial<Record<Exclude<NodeKind, 'battle'>, number>> = {
    elite: ROUTE.weights.elite + ROUTE.eliteWeightPerWorld * world,
    cache: ROUTE.weights.cache,
    shop: ROUTE.weights.shop,
    signal: ROUTE.weights.signal,
    // No repair before the player has had a chance to get hurt.
    ...(rowIdx > 0 ? { repair: ROUTE.weights.repair } : {}),
  };
  row.forEach((n, i) => {
    if (i === battle) {
      n.kind = 'battle';
      return;
    }
    const kind = weighted(rng, pool as Record<Exclude<NodeKind, 'battle'>, number>);
    delete pool[kind];
    n.kind = kind;
  });
}

/** Every world has a shop: when the roll had none, one non-battle node off the beat row becomes one. */
function ensureShop(rng: Rng, rows: RouteNode[][]): void {
  if (rows.some((row) => row.some((n) => n.kind === 'shop'))) return;
  const candidates = rows.flatMap((row, i) => (i === BEAT_ROW ? [] : row.filter((n) => n.kind !== 'battle')));
  if (candidates.length > 0) pick(rng, candidates).kind = 'shop';
}

/**
 * One world's map: `MAP_ROWS` rows of 2–3 nodes, adjacent-lane links, no crossings. Each row has one
 * battle and otherwise distinct kinds; the beat row holds only fights; at least one node is a shop.
 */
export function generateMap(rng: Rng, world: number): RouteMap {
  let lanes: number[][] = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    lanes = Array.from({ length: MAP_ROWS }, () => rowLanes(rng));
    if (lanes.every((row, i) => i === 0 || connected(lanes[i - 1]!, row))) break;
    lanes = [];
  }
  if (lanes.length === 0) lanes = Array.from({ length: MAP_ROWS }, () => [0, 1, 2]);

  const rows: RouteNode[][] = lanes.map((row) => row.map((lane) => ({ lane, kind: 'battle' as NodeKind, next: [] })));
  rows.forEach((row, i) => {
    const nextRow = rows[i + 1];
    if (nextRow) {
      for (const n of row) n.next = nextRow.filter((m) => near(n.lane, m.lane)).map((m) => m.lane);
      uncross(rng, row);
    }
    assignKinds(rng, row, i, world);
  });
  ensureShop(rng, rows);
  return { rows };
}

export function createRogueState(seed: number, rerolls: number, world: number): RogueState {
  const rng = { seed: (seed ^ 0x9e3779b9) >>> 0 };
  return {
    rng,
    map: generateMap(rng, world),
    path: [],
    node: 'battle',
    beat: false,
    boons: {},
    offer: [],
    draftsOwed: 0,
    draftRarity: null,
    ambush: false,
    beatNext: false,
    starter: false,
    rerolls,
    scrap: 0,
    shop: null,
    event: null,
    seenEvents: [],
  };
}

/** Lanes the player may pick next: the whole first row, then the links from the last pick. */
export function reachableLanes(r: RogueState): number[] {
  const row = r.map.rows[r.path.length];
  if (!row) return [];
  const last = r.path[r.path.length - 1];
  if (last === undefined) return row.map((n) => n.lane);
  const from = r.map.rows[r.path.length - 1]!.find((n) => n.lane === last);
  return from ? [...from.next] : [];
}

export function nodeAt(r: RogueState, row: number, lane: number): RouteNode | undefined {
  return r.map.rows[row]?.find((n) => n.lane === lane);
}
