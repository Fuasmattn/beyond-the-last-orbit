import { describe, expect, it } from 'vitest';
import { BOON, PLAYER, RHYTHM, SCRAP, SIM_DT } from '../../src/data/balance';
import { BOONS, boonDef, buildPower, offerable, rollOffer, takeBoon, threatLevel } from '../../src/sim/boons';
import { moveBullets } from '../../src/sim/bullets';
import { resolveCollisions } from '../../src/sim/collision';
import { hitPlayer, hurtbox, updatePlayer } from '../../src/sim/player';
import { multCap, registerGraze } from '../../src/sim/scoring';
import { defaultRunOptions } from '../../src/sim/ship';
import { finishStage, rerollDraft, startStage } from '../../src/sim/stageFlow';
import { createInitialState } from '../../src/sim/state';
import { NO_INPUT, type BoonId, type Bullet, type SimEvent, type SimState } from '../../src/sim/types';
import { landFormation } from './helpers';

function run(seed = 1): SimState {
  const s = landFormation(createInitialState(seed));
  s.phase = 'playing';
  return s;
}

const take = (s: SimState, ...ids: BoonId[]) => ids.forEach((id) => takeBoon(s, s.rogue, id));

const bullet = (over: Partial<Bullet>): Bullet => ({
  id: 999, x: 0, y: 0, w: 2, h: 6, vx: 0, vy: 0, owner: 'player', onBeat: false, mult: 1, ...over,
});

function fire(s: SimState): void {
  s.player.cooldown = 0;
  updatePlayer(s, { ...NO_INPUT, firePressed: true }, SIM_DT, []);
}

describe('draft offers', () => {
  it('every boon has a card that fits the narrow field', () => {
    for (const b of BOONS) {
      expect(b.name.length).toBeLessThanOrEqual(16);
      expect(b.desc.length).toBeLessThanOrEqual(22);
    }
  });

  it('rolls distinct offers with at most one curse', () => {
    let curses = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = createInitialState(seed);
      const offer = rollOffer(s, s.rogue);
      expect(offer).toHaveLength(3);
      expect(new Set(offer).size).toBe(3);
      const c = offer.filter((id) => boonDef(id).rarity === 'curse').length;
      expect(c).toBeLessThanOrEqual(1);
      curses += c;
    }
    expect(curses).toBeGreaterThan(10);
    expect(curses).toBeLessThan(80);
  });

  it('only offers RICOCHET once SPREAD SHOT is owned', () => {
    const s = createInitialState(1);
    expect(offerable(s, s.rogue)).not.toContain('ricochet');
    take(s, 'spread');
    expect(offerable(s, s.rogue)).toContain('ricochet');
  });

  it('epics show up more often in later worlds', () => {
    const count = (world: number) => {
      let n = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const s = createInitialState(seed);
        s.world = world;
        n += rollOffer(s, s.rogue).filter((id) => boonDef(id).rarity === 'epic').length;
      }
      return n;
    };
    expect(count(2)).toBeGreaterThan(count(0));
  });
});

describe('graze boons', () => {
  it('MAGNET widens the graze zone', () => {
    const s = run();
    take(s, 'magnet');
    const h = hurtbox(s);
    const far = -(BOON.magnetMargin + s.ship.grazeMargin - BOON.magnetMargin) + 1;
    s.bullets = [bullet({ owner: 'enemy', x: h.x + far, y: h.y })];
    const events: SimEvent[] = [];
    resolveCollisions(s, events);
    s.bullets[0]!.y = 400;
    resolveCollisions(s, events);
    expect(events.some((e) => e.type === 'graze')).toBe(true);
  });

  it('GRAZE CHARGE turns the shot after 10 grazes into a power shot', () => {
    const s = run();
    take(s, 'charge');
    for (let i = 0; i < BOON.chargeGrazes - 1; i++) registerGraze(s);
    fire(s);
    expect(s.bullets[0]!.power).toBeUndefined();
    registerGraze(s);
    expect(s.charge).toBe(BOON.chargeGrazes);
    s.bullets = [];
    fire(s);
    expect(s.bullets[0]!.power).toBe(true);
    expect(s.charge).toBe(0);
  });

  it('HOT ZONE triples graze points and grows the core', () => {
    const s = run();
    const before = hurtbox(s);
    take(s, 'hotzone');
    expect(hurtbox(s).w).toBeCloseTo(before.w * BOON.hotZoneScale);
    const pts = registerGraze(s);
    expect(pts).toBe(10 * BOON.hotZoneGrazeMul);
  });
});

describe('bolt boons', () => {
  it('RICOCHET bounces side bolts off the walls once', () => {
    const s = run();
    take(s, 'spread', 'ricochet');
    fire(s);
    const side = s.bullets.find((b) => b.vx < 0)!;
    expect(side.bounce).toBe(1);
    side.x = -1;
    moveBullets(s, SIM_DT);
    expect(side.vx).toBeGreaterThan(0);
    expect(side.bounce).toBe(0);
    expect(s.bullets).toContain(side);
    side.x = s.fieldW + 5;
    moveBullets(s, SIM_DT);
    expect(s.bullets).not.toContain(side);
  });

  it('SHRAPNEL throws two expiring fragments on a kill, and fragments do not chain', () => {
    const s = run();
    take(s, 'shrapnel', 'heavy');
    const e = s.enemies.find((x) => x.row === 0)!;
    e.hp = 1;
    s.bullets = [bullet({ x: e.x + 2, y: e.y + 1 })];
    const events: SimEvent[] = [];
    resolveCollisions(s, events);
    const shards = s.bullets.filter((b) => b.ttl !== undefined);
    expect(shards).toHaveLength(2);
    expect(shards[0]!.damage).toBe(2);
    expect(events.some((ev) => ev.type === 'shrapnel')).toBe(true);
    const other = s.enemies.find((x) => x.hp > 0)!;
    other.hp = 1;
    shards[0]!.x = other.x + 2;
    shards[0]!.y = other.y + 1;
    resolveCollisions(s, []);
    expect(s.bullets.filter((b) => b.ttl !== undefined)).toHaveLength(1);
    for (let t = 0; t < BOON.shrapnelTtl + SIM_DT; t += SIM_DT) moveBullets(s, SIM_DT);
    expect(s.bullets.filter((b) => b.ttl !== undefined)).toHaveLength(0);
  });

  it('OVERDRIVE adds damage from x4 up', () => {
    const s = run();
    take(s, 'overdrive');
    fire(s);
    expect(s.bullets[0]!.damage).toBe(1);
    s.bullets = [];
    s.rhythm.mult = BOON.overdriveMult;
    fire(s);
    expect(s.bullets[0]!.damage).toBe(2);
  });
});

describe('curses and second wind', () => {
  it('GLASS CANNON trades a ship for damage and never kills', () => {
    const s = run();
    s.player.lives = 1;
    take(s, 'glasscannon');
    expect(s.player.lives).toBe(1);
    expect(s.ship.damage).toBe(1 + BOON.glassDamage);
  });

  it('BERSERK resets the multiplier on a hit', () => {
    const s = run();
    take(s, 'berserk');
    s.rhythm.streak = RHYTHM.shotsPerStep * 3;
    hitPlayer(s, []);
    expect(s.rhythm).toEqual({ streak: 0, mult: 1 });
    expect(s.ship.cooldown).toBeCloseTo(PLAYER.fireCooldown * BOON.berserkCooldown);
  });

  it('SECOND WIND survives the last hit once', () => {
    const s = run();
    take(s, 'secondwind');
    s.player.lives = 1;
    const events: SimEvent[] = [];
    hitPlayer(s, events);
    expect(s.phase).toBe('playing');
    expect(s.player.lives).toBe(1);
    expect(s.player.shield).toBe(1);
    expect(events.some((e) => e.type === 'revived')).toBe(true);
    s.player.shield = 0;
    s.player.invuln = 0;
    hitPlayer(s, events);
    expect(s.phase).toBe('gameOver');
  });
});

describe('draft tiers (M19)', () => {
  const rarities = (s: SimState, tier: Parameters<typeof rollOffer>[2]) => rollOffer(s, s.rogue, tier).map((id) => boonDef(id).rarity);

  it('starter drafts are three rares, basic drafts three commons, rare drafts rare or better', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = createInitialState(seed);
      expect(rarities(s, 'starter')).toEqual(['rare', 'rare', 'rare']);
      expect(rarities(s, 'basic')).toEqual(['common', 'common', 'common']);
      for (const r of rarities(s, 'rare')) expect(['rare', 'epic']).toContain(r);
    }
  });

  it('every plain battle clear owes a basic draft; an elite clear a full one', () => {
    const s = run();
    finishStage(s, []);
    expect(s.rogue.drafts).toEqual(['basic']);
    const e = run();
    e.diff = { ...e.diff, elite: true };
    finishStage(e, []);
    expect(e.rogue.drafts).toEqual(['full']);
  });

  it('a starter run opens on rares and a reroll keeps the tier', () => {
    const s = createInitialState(5, undefined, { ...defaultRunOptions(), starterDraft: true, rerolls: 1 });
    expect(s.rogue.draftTier).toBe('starter');
    expect(rerollDraft(s)).toBe(true);
    for (const id of s.rogue.offer) expect(boonDef(id).rarity).toBe('rare');
  });
});

describe('M19 boons', () => {
  const kill = (s: SimState, events: SimEvent[] = []) => {
    const e = s.enemies.find((x) => x.hp > 0 && x.row === 0)!;
    e.hp = 1;
    s.bullets = [bullet({ x: e.x + 2, y: e.y + 1 })];
    resolveCollisions(s, events);
    return e;
  };

  it('SALVAGE adds scrap per kill and LOANSHARK halves income after a payout', () => {
    const s = run();
    take(s, 'salvage');
    kill(s);
    expect(s.rogue.scrap).toBe(SCRAP.kill + 1);
    take(s, 'loanshark');
    expect(s.rogue.scrap).toBe(SCRAP.kill + 1 + BOON.loanScrap);
    kill(s);
    expect(s.rogue.scrap).toBe(SCRAP.kill + 1 + BOON.loanScrap + Math.round((SCRAP.kill + 1) * BOON.loanMul));
  });

  it('LONG BARREL and WIDE BOLTS change the bolt', () => {
    const s = run();
    take(s, 'longbarrel', 'widebolts');
    fire(s);
    expect(s.bullets[0]!.vy).toBeCloseTo(-PLAYER.bulletSpeed * BOON.longBarrel);
    expect(s.bullets[0]!.w).toBe(PLAYER.bulletW + BOON.wideBolts);
  });

  it('HARDPOINT adds a shield and stops being offered at the ceiling', () => {
    const s = run();
    expect(offerable(s, s.rogue)).toContain('hardpoint');
    for (let i = 0; i < BOON.hardpointMax; i++) take(s, 'hardpoint');
    expect(s.player.shield).toBe(BOON.hardpointMax);
    expect(offerable(s, s.rogue)).not.toContain('hardpoint');
  });

  it('SNIPER adds damage only while still', () => {
    const s = run();
    take(s, 'sniper');
    fire(s);
    expect(s.bullets[0]!.damage).toBe(2);
    s.bullets = [];
    s.player.vx = 50;
    fire(s);
    expect(s.bullets[0]!.damage).toBe(1);
  });

  it('ARC zaps the nearest neighbour on a kill', () => {
    const s = run();
    take(s, 'arc');
    for (const x of s.enemies) x.hp = x.maxHp = 5;
    const events: SimEvent[] = [];
    const e = kill(s, events);
    const zapped = events.find((ev) => ev.type === 'arc');
    expect(zapped).toBeDefined();
    const hit = s.enemies.find((x) => x.hp < x.maxHp && x.id !== e.id);
    expect(hit).toBeDefined();
    expect(events.some((ev) => ev.type === 'enemyHit' && ev.id === hit!.id)).toBe(true);
  });

  it('SHIELD BURST fires a ring of bolts when a shield absorbs a hit', () => {
    const s = run();
    take(s, 'shieldburst', 'hardpoint');
    const events: SimEvent[] = [];
    hitPlayer(s, events);
    expect(s.player.shield).toBe(0);
    expect(s.bullets.filter((b) => b.owner === 'player' && b.extra)).toHaveLength(BOON.burstCount);
    expect(events.some((e) => e.type === 'shieldBurst')).toBe(true);
  });

  it('GRAZE MEND restores a shield every 25 grazes', () => {
    const s = run();
    take(s, 'mend');
    for (let i = 0; i < BOON.mendGrazes - 1; i++) registerGraze(s);
    expect(s.player.shield).toBe(0);
    registerGraze(s);
    expect(s.player.shield).toBe(1);
    expect(s.mend).toBe(0);
  });

  it('JACKPOT lifts the multiplier cap', () => {
    const s = run();
    expect(multCap(s)).toBe(RHYTHM.maxMult);
    take(s, 'jackpot');
    expect(multCap(s)).toBe(RHYTHM.maxMult + BOON.jackpotLevels);
  });

  it('MIRROR fires an extra bolt from the mirrored position', () => {
    const s = run();
    take(s, 'mirror');
    s.player.x = 20;
    fire(s);
    const cx = s.player.x + s.player.w / 2;
    const ghost = s.bullets.find((b) => b.extra);
    expect(ghost).toBeDefined();
    expect(ghost!.x + ghost!.w / 2).toBeCloseTo(s.fieldW - cx);
  });

  it('BLIND SPOT adds damage and zeroes graze points but still feeds GRAZE CHARGE', () => {
    const s = run();
    take(s, 'blindspot', 'charge');
    expect(s.ship.damage).toBe(1 + BOON.blindDamage);
    expect(registerGraze(s)).toBe(0);
    expect(s.charge).toBe(1);
  });
});

describe('threat and the volley cap (M22)', () => {
  it('sums rarity weights into build power and a HUD level', () => {
    expect(buildPower({})).toBe(0);
    expect(buildPower({ twin: 1, magnet: 2, jackpot: 1, berserk: 1 })).toBe(1 + 4 + 3 + 1);
    expect(threatLevel({ twin: 1, magnet: 2, jackpot: 1, berserk: 1 })).toBe(3);
  });

  it('a stage started with boons is harder than the same stage without them', () => {
    const plain = run();
    const built = run();
    take(built, 'twin', 'spread', 'heavy', 'magnet', 'overdrive');
    built.stage = plain.stage;
    startStage(built, []);
    startStage(plain, []);
    expect(built.diff.d).toBeGreaterThan(plain.diff.d);
    expect(built.diff.fireRate).toBeGreaterThan(plain.diff.fireRate);
  });

  it('side bolts hold the volley slot until they leave, so spread fire is capped', () => {
    const s = run();
    take(s, 'spread');
    for (let i = 0; i < 6; i++) fire(s);
    const volleys = new Set(s.bullets.filter((b) => b.owner === 'player').map((b) => b.volley));
    expect(volleys.size).toBe(s.ship.maxBullets);
    // The primary bolts vanish (hit something) but the side bolts remain: still capped.
    s.bullets = s.bullets.filter((b) => b.extra);
    fire(s);
    expect(new Set(s.bullets.map((b) => b.volley)).size).toBe(s.ship.maxBullets);
    // Once a whole volley is gone, a new shot fits.
    const first = s.bullets[0]!.volley;
    s.bullets = s.bullets.filter((b) => b.volley !== first);
    fire(s);
    expect(new Set(s.bullets.map((b) => b.volley)).size).toBe(s.ship.maxBullets);
    expect(s.bullets.some((b) => b.volley !== first && !b.extra)).toBe(true);
  });
});
