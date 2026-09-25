import { PLAYER, ROUTE } from '../data/balance';
import { nextRandom } from './rng';
import type { BoonId, RogueState, SimState } from './types';

export interface BoonDef {
  id: BoonId;
  name: string;
  /** Fits the narrowest field (≤ 22 chars). */
  desc: string;
  /** Max stacks; Infinity = always offerable. */
  max: number;
  apply(state: SimState): void;
}

export const BOONS: readonly BoonDef[] = [
  { id: 'twin', name: 'TWIN CANNON', desc: 'TWO PARALLEL BOLTS', max: 1, apply: (s) => void (s.ship.twin = true) },
  { id: 'spread', name: 'SPREAD SHOT', desc: '+2 ANGLED SIDE BOLTS', max: 1, apply: (s) => void (s.ship.spread = true) },
  { id: 'pierce', name: 'PIERCE', desc: 'BOLTS PASS +1 ENEMY', max: 2, apply: (s) => void s.ship.pierce++ },
  {
    id: 'overclock',
    name: 'OVERCLOCK',
    desc: 'FIRE +25% +1 BOLT',
    max: 2,
    apply: (s) => {
      s.ship.cooldown *= 0.8;
      s.ship.maxBullets++;
    },
  },
  { id: 'heavy', name: 'HEAVY ROUNDS', desc: '+1 DAMAGE PER BOLT', max: 1, apply: (s) => void s.ship.damage++ },
  {
    id: 'deflector',
    name: 'DEFLECTOR',
    desc: '+1 SHIELD EVERY STAGE',
    max: 2,
    apply: (s) => {
      s.ship.shieldMax++;
      s.player.shield++;
    },
  },
  { id: 'bounty', name: 'BOUNTY', desc: '+25% SCORE', max: 3, apply: (s) => void (s.ship.scoreMul += 0.25) },
  { id: 'afterburner', name: 'AFTERBURNER', desc: '+15% SPEED', max: 2, apply: (s) => void (s.ship.speed *= 1.15) },
  {
    id: 'nanorepair',
    name: 'NANO REPAIR',
    desc: '+1 SHIP NOW',
    max: Infinity,
    apply: (s) => void (s.player.lives = Math.min(PLAYER.maxLives, s.player.lives + 1)),
  },
];

export function boonDef(id: BoonId): BoonDef {
  return BOONS.find((b) => b.id === id)!;
}

/** Boons that can still be offered (not maxed; nano repair only when a ship is missing). */
export function offerable(state: SimState, r: RogueState): BoonId[] {
  return BOONS.filter((b) => {
    if ((r.boons[b.id] ?? 0) >= b.max) return false;
    if (b.id === 'nanorepair') return state.player.lives < PLAYER.maxLives;
    return true;
  }).map((b) => b.id);
}

/** Rolls `ROUTE.draftSize` distinct offers from the rogue RNG stream. */
export function rollOffer(state: SimState, r: RogueState): BoonId[] {
  const pool = offerable(state, r);
  const offer: BoonId[] = [];
  while (offer.length < ROUTE.draftSize && pool.length > 0) {
    const i = Math.floor(nextRandom(r.rng) * pool.length);
    offer.push(pool.splice(i, 1)[0]!);
  }
  return offer;
}

export function takeBoon(state: SimState, r: RogueState, id: BoonId): void {
  boonDef(id).apply(state);
  r.boons[id] = (r.boons[id] ?? 0) + 1;
}
