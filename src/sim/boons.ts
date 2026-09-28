import { BOON, PLAYER, ROUTE } from '../data/balance';
import { nextRandom } from './rng';
import type { BoonId, BoonRarity, RogueState, SimState } from './types';

export interface BoonDef {
  id: BoonId;
  name: string;
  /** Fits the narrowest field (≤ 22 chars). */
  desc: string;
  rarity: BoonRarity;
  /** Max stacks; Infinity = always offerable. */
  max: number;
  /** Boons this one gets better with (shown on the card). */
  synergy?: readonly BoonId[];
  /** Only offered once this boon is owned. */
  requires?: BoonId;
  apply(state: SimState): void;
}

export const BOONS: readonly BoonDef[] = [
  // Common: stat bumps.
  { id: 'twin', name: 'TWIN CANNON', desc: 'TWO PARALLEL BOLTS', rarity: 'common', max: 1, apply: (s) => void (s.ship.twin = true) },
  { id: 'spread', name: 'SPREAD SHOT', desc: '+2 ANGLED SIDE BOLTS', rarity: 'common', max: 1, apply: (s) => void (s.ship.spread = true) },
  { id: 'pierce', name: 'PIERCE', desc: 'BOLTS PASS +1 ENEMY', rarity: 'common', max: 2, apply: (s) => void s.ship.pierce++ },
  {
    id: 'overclock',
    name: 'OVERCLOCK',
    desc: 'FIRE +25% +1 BOLT',
    rarity: 'common',
    max: 2,
    apply: (s) => {
      s.ship.cooldown *= 0.8;
      s.ship.maxBullets++;
    },
  },
  { id: 'afterburner', name: 'AFTERBURNER', desc: '+15% SPEED', rarity: 'common', max: 2, apply: (s) => void (s.ship.speed *= 1.15) },
  { id: 'bounty', name: 'BOUNTY', desc: '+25% SCORE', rarity: 'common', max: 3, apply: (s) => void (s.ship.scoreMul += 0.25) },
  {
    id: 'nanorepair',
    name: 'NANO REPAIR',
    desc: '+1 SHIP NOW',
    rarity: 'common',
    max: Infinity,
    apply: (s) => void (s.player.lives = Math.min(PLAYER.maxLives, s.player.lives + 1)),
  },
  // Rare: new behaviours.
  { id: 'heavy', name: 'HEAVY ROUNDS', desc: '+1 DAMAGE PER BOLT', rarity: 'rare', max: 1, apply: (s) => void s.ship.damage++ },
  {
    id: 'deflector',
    name: 'DEFLECTOR',
    desc: '+1 SHIELD EVERY STAGE',
    rarity: 'rare',
    max: 2,
    apply: (s) => {
      s.ship.shieldMax++;
      s.player.shield++;
    },
  },
  {
    id: 'magnet',
    name: 'MAGNET',
    desc: 'WIDER GRAZE ZONE',
    rarity: 'rare',
    max: 2,
    synergy: ['charge', 'hotzone'],
    apply: (s) => void (s.ship.grazeMargin += BOON.magnetMargin),
  },
  {
    id: 'charge',
    name: 'GRAZE CHARGE',
    desc: `${BOON.chargeGrazes} GRAZES: POWER SHOT`,
    rarity: 'rare',
    max: 1,
    synergy: ['magnet'],
    apply: (s) => void (s.ship.chargeGrazes = BOON.chargeGrazes),
  },
  {
    id: 'ricochet',
    name: 'RICOCHET',
    desc: 'SIDE BOLTS BOUNCE ONCE',
    rarity: 'rare',
    max: 1,
    requires: 'spread',
    synergy: ['spread'],
    apply: (s) => void (s.ship.bounce = 1),
  },
  {
    id: 'shrapnel',
    name: 'SHRAPNEL',
    desc: 'KILLS THROW 2 SHARDS',
    rarity: 'rare',
    max: 1,
    synergy: ['heavy', 'pierce'],
    apply: (s) => void (s.ship.shrapnel = true),
  },
  // Epic: run-defining.
  {
    id: 'overdrive',
    name: 'OVERDRIVE',
    desc: `X${BOON.overdriveMult}+: +1 DAMAGE`,
    rarity: 'epic',
    max: 1,
    synergy: ['deflector'],
    apply: (s) => void (s.ship.overdrive = true),
  },
  {
    id: 'secondwind',
    name: 'SECOND WIND',
    desc: 'SURVIVE DEATH ONCE',
    rarity: 'epic',
    max: 1,
    synergy: ['glasscannon'],
    apply: (s) => void s.ship.revives++,
  },
  // Curses: an upside with a price.
  {
    id: 'glasscannon',
    name: 'GLASS CANNON',
    desc: `+${BOON.glassDamage} DAMAGE, -1 SHIP`,
    rarity: 'curse',
    max: 1,
    apply: (s) => {
      s.ship.damage += BOON.glassDamage;
      s.player.lives = Math.max(1, s.player.lives - 1);
    },
  },
  {
    id: 'berserk',
    name: 'BERSERK',
    desc: 'FIRE +40%, HIT: X1',
    rarity: 'curse',
    max: 1,
    apply: (s) => {
      s.ship.cooldown *= BOON.berserkCooldown;
      s.ship.fragileStreak = true;
    },
  },
  {
    id: 'hotzone',
    name: 'HOT ZONE',
    desc: `GRAZE X${BOON.hotZoneGrazeMul}, BIGGER CORE`,
    rarity: 'curse',
    max: 1,
    synergy: ['magnet', 'charge'],
    apply: (s) => {
      s.ship.grazeMul *= BOON.hotZoneGrazeMul;
      s.ship.hurtScale *= BOON.hotZoneScale;
    },
  },
];

/** Rarity order for "at least this rare" offers; curses sit outside it. */
const RARITY_RANK: Readonly<Record<BoonRarity, number>> = { common: 0, rare: 1, epic: 2, curse: -1 };

export const RARITY_COLOR: Readonly<Record<BoonRarity, number>> = {
  common: 0xffffff,
  rare: 0x4af2ff,
  epic: 0xffe14a,
  curse: 0xc36bff,
};

export function boonDef(id: BoonId): BoonDef {
  return BOONS.find((b) => b.id === id)!;
}

/** Boons that can still be offered (not maxed, prerequisites owned; nano repair only when a ship is missing). */
export function offerable(state: SimState, r: RogueState): BoonId[] {
  return BOONS.filter((b) => {
    if ((r.boons[b.id] ?? 0) >= b.max) return false;
    if (b.requires && !(r.boons[b.requires] ?? 0)) return false;
    if (b.id === 'nanorepair') return state.player.lives < PLAYER.maxLives;
    return true;
  }).map((b) => b.id);
}

function rollRarity(rng: { seed: number }, world: number): Exclude<BoonRarity, 'curse'> {
  const w = BOON.rarityWeights;
  const epic = w.epic + BOON.epicWeightPerWorld * world;
  let x = nextRandom(rng) * (w.common + w.rare + epic);
  if ((x -= w.common) < 0) return 'common';
  if ((x -= w.rare) < 0) return 'rare';
  return 'epic';
}

/**
 * Rolls `ROUTE.draftSize` distinct offers from the rogue RNG stream: each slot rolls a rarity, then a boon of that
 * rarity (any rarity when that pool is empty). At most one slot is a curse. `minRarity` drops commons (and
 * curses) from the pool and bumps every slot's roll to at least that rarity.
 */
export function rollOffer(state: SimState, r: RogueState, minRarity: BoonRarity | null = null): BoonId[] {
  const minRank = minRarity ? RARITY_RANK[minRarity] : 0;
  const pool = offerable(state, r).filter((id) => minRank === 0 || RARITY_RANK[boonDef(id).rarity] >= minRank);
  const offer: BoonId[] = [];
  const take = (rarity: BoonRarity | null): void => {
    let candidates = rarity ? pool.filter((id) => boonDef(id).rarity === rarity) : pool;
    if (candidates.length === 0) candidates = pool.filter((id) => boonDef(id).rarity !== 'curse');
    if (candidates.length === 0) candidates = pool;
    if (candidates.length === 0) return;
    const id = candidates[Math.floor(nextRandom(r.rng) * candidates.length)]!;
    pool.splice(pool.indexOf(id), 1);
    offer.push(id);
  };
  const curseSlot =
    minRank === 0 && nextRandom(r.rng) < BOON.curseChance ? Math.floor(nextRandom(r.rng) * ROUTE.draftSize) : -1;
  for (let i = 0; i < ROUTE.draftSize; i++) {
    const rarity = rollRarity(r.rng, state.world);
    take(i === curseSlot ? 'curse' : RARITY_RANK[rarity] < minRank ? minRarity : rarity);
  }
  // Curses never fill in for a missing rarity unless the curse slot asked for one.
  return offer;
}

export function takeBoon(state: SimState, r: RogueState, id: BoonId): void {
  boonDef(id).apply(state);
  r.boons[id] = (r.boons[id] ?? 0) + 1;
}
