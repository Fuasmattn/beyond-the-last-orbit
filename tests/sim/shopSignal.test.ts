import { describe, expect, it } from 'vitest';
import { PLAYER, SCRAP, SHOP, SIGNAL } from '../../src/data/balance';
import { EVENTS } from '../../src/data/events';
import { boonDef } from '../../src/sim/boons';
import { resolveCollisions } from '../../src/sim/collision';
import { generateMap, reachableLanes } from '../../src/sim/route';
import {
  advanceStage,
  buyShopBoon,
  buyShopRepair,
  chooseEvent,
  chooseNode,
  finishStage,
  leaveShop,
  rerollShop,
  shopPrice,
} from '../../src/sim/stageFlow';
import { createInitialState } from '../../src/sim/state';
import type { Bullet, EventId, NodeKind, SimEvent, SimState } from '../../src/sim/types';
import { landFormation } from './helpers';

/** Clears stage 1 and lands on the route with the first row rewritten to `kind`. */
function atNode(kind: NodeKind, seed = 3): { s: SimState; events: SimEvent[] } {
  const s = createInitialState(seed);
  const events: SimEvent[] = [];
  finishStage(s, events);
  advanceStage(s, events);
  s.rogue.map.rows[0]!.forEach((n) => (n.kind = kind));
  chooseNode(s, reachableLanes(s.rogue)[0]!, events);
  return { s, events };
}

const bullet = (over: Partial<Bullet>): Bullet => ({
  id: 999, x: 0, y: 0, w: 2, h: 6, vx: 0, vy: 0, owner: 'player', onBeat: false, mult: 1, ...over,
});

describe('scrap', () => {
  it('drops from kills, double on elite stages, and from bosses', () => {
    const s = landFormation(createInitialState(1));
    s.phase = 'playing';
    const e = s.enemies.find((x) => x.row === 0)!;
    e.hp = 1;
    s.bullets = [bullet({ x: e.x + 2, y: e.y + 1 })];
    resolveCollisions(s, []);
    expect(s.rogue.scrap).toBe(SCRAP.kill);
    s.diff = { ...s.diff, elite: true };
    const f = s.enemies.find((x) => x.hp > 0)!;
    f.hp = 1;
    s.bullets = [bullet({ x: f.x + 2, y: f.y + 1 })];
    resolveCollisions(s, []);
    expect(s.rogue.scrap).toBe(SCRAP.kill + SCRAP.eliteKill);
    s.stage = 5;
    finishStage(s, []);
    expect(s.rogue.scrap).toBe(SCRAP.kill + SCRAP.eliteKill + SCRAP.boss);
  });
});

describe('shop node', () => {
  it('every world map has a shop', () => {
    for (let i = 0; i < 300; i++) {
      const m = generateMap({ seed: i * 7919 + 1 }, i % 3);
      expect(m.rows.some((row) => row.some((n) => n.kind === 'shop'))).toBe(true);
    }
  });

  it('opens with three priced offers and sells for scrap', () => {
    const { s, events } = atNode('shop');
    expect(s.phase).toBe('shop');
    expect(events.some((e) => e.type === 'shopOpen')).toBe(true);
    const shop = s.rogue.shop!;
    expect(shop.offer).toHaveLength(3);
    const id = shop.offer[0]!;
    const price = shopPrice(id);
    expect(price).toBe(SHOP.prices[boonDef(id).rarity]);
    s.rogue.scrap = price - 1;
    expect(buyShopBoon(s, 0, events)).toBe(false);
    s.rogue.scrap = price;
    expect(buyShopBoon(s, 0, events)).toBe(true);
    expect(s.rogue.scrap).toBe(0);
    expect(s.rogue.boons[id]).toBe(1);
    expect(shop.offer).toHaveLength(2);
    expect(s.phase).toBe('shop');
  });

  it('repairs, rerolls at a rising price and leaves to the route', () => {
    const { s, events } = atNode('shop');
    s.player.lives = 1;
    s.rogue.scrap = SHOP.repair + SHOP.reroll + SHOP.reroll + SHOP.rerollStep;
    expect(buyShopRepair(s, events)).toBe(true);
    expect(s.player.lives).toBe(2);
    s.player.lives = PLAYER.maxLives;
    expect(buyShopRepair(s, events)).toBe(false);
    const before = [...s.rogue.shop!.offer];
    expect(rerollShop(s)).toBe(true);
    expect(s.rogue.shop!.rerollPrice).toBe(SHOP.reroll + SHOP.rerollStep);
    expect(rerollShop(s)).toBe(true);
    expect(rerollShop(s)).toBe(false);
    expect(s.rogue.shop!.offer).not.toEqual(before);
    expect(leaveShop(s, events)).toBe(true);
    expect(s.rogue.shop).toBeNull();
    expect(s.phase).toBe('route');
    expect(s.stage).toBe(2);
  });
});

describe('signal node', () => {
  function withEvent(id: EventId, seed = 3): { s: SimState; events: SimEvent[] } {
    const r = atNode('signal', seed);
    r.s.rogue.event = id;
    return r;
  }

  it('opens an unseen event and never repeats one within a run', () => {
    const { s, events } = atNode('signal');
    expect(s.phase).toBe('event');
    expect(s.rogue.event).not.toBeNull();
    expect(events.some((e) => e.type === 'eventOpen')).toBe(true);
    const seen = new Set<EventId>([s.rogue.event!]);
    for (let i = 0; i < EVENTS.length - 1; i++) {
      chooseEvent(s, 1, events);
      s.phase = 'route';
      s.rogue.map.rows[s.rogue.path.length]?.forEach((n) => (n.kind = 'signal'));
      const lane = reachableLanes(s.rogue)[0];
      if (lane === undefined) break;
      chooseNode(s, lane, events);
      expect(seen.has(s.rogue.event!)).toBe(false);
      seen.add(s.rogue.event!);
    }
  });

  it('DISTRESS CALL: escort is an elite fight worth two drafts; ignoring pays scrap', () => {
    const a = withEvent('distress');
    expect(chooseEvent(a.s, 0, a.events)).toBe(true);
    expect(a.s.phase).toBe('stageIntro');
    expect(a.s.diff.elite).toBe(true);
    finishStage(a.s, a.events);
    expect(a.s.rogue.draftsOwed).toBe(2);
    const b = withEvent('distress');
    chooseEvent(b.s, 1, b.events);
    expect(b.s.rogue.scrap).toBe(SIGNAL.distressScrap);
    expect(b.s.phase).toBe('route');
    expect(b.events.some((e) => e.type === 'eventResolved')).toBe(true);
  });

  it('DERELICT: boarding pays or ambushes (an elite fight with no draft)', () => {
    let paid = 0;
    let ambushed = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { s, events } = withEvent('derelict', seed);
      chooseEvent(s, 0, events);
      if (s.phase === 'route') {
        paid++;
        expect(s.rogue.scrap).toBe(SIGNAL.derelictScrap);
      } else {
        ambushed++;
        expect(s.diff.elite).toBe(true);
        finishStage(s, events);
        expect(s.rogue.draftsOwed).toBe(0);
        expect(s.rogue.ambush).toBe(false);
      }
    }
    expect(paid).toBeGreaterThan(5);
    expect(ambushed).toBeGreaterThan(5);
  });

  it('BLACK MARKET: a ship buys a rare-or-better draft; scrap buys a shield; both gated', () => {
    const a = withEvent('market');
    a.s.player.lives = 1;
    expect(chooseEvent(a.s, 0, a.events)).toBe(false);
    a.s.player.lives = 3;
    expect(chooseEvent(a.s, 0, a.events)).toBe(true);
    expect(a.s.player.lives).toBe(2);
    expect(a.s.phase).toBe('draft');
    for (const id of a.s.rogue.offer) expect(['rare', 'epic']).toContain(boonDef(id).rarity);
    const b = withEvent('market');
    expect(chooseEvent(b.s, 1, b.events)).toBe(false);
    b.s.rogue.scrap = SIGNAL.shieldPrice;
    expect(chooseEvent(b.s, 1, b.events)).toBe(true);
    expect(b.s.player.shield).toBe(1);
    expect(b.s.rogue.scrap).toBe(0);
  });

  it('GHOST SIGNAL: the next fight becomes a beat stage', () => {
    const { s, events } = withEvent('ghost');
    chooseEvent(s, 0, events);
    expect(s.rogue.beatNext).toBe(true);
    // Row 1 is normally the beat row; strip that so only the event can make this a beat stage.
    s.rogue.map.rows[1]!.forEach((n) => {
      n.kind = 'battle';
      n.beat = false;
    });
    chooseNode(s, reachableLanes(s.rogue)[0]!, events);
    expect(s.beatMode).toBe('master');
    expect(s.rogue.beatNext).toBe(false);
  });
});
