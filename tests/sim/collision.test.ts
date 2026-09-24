import { describe, expect, it } from 'vitest';
import { PLAYER, POINTS } from '../../src/data/balance';
import { overlaps, resolveCollisions } from '../../src/sim/collision';
import { createInitialState } from '../../src/sim/state';
import type { Bullet, SimEvent } from '../../src/sim/types';

const bullet = (over: Partial<Bullet>): Bullet => ({
  id: 999, x: 0, y: 0, w: 2, h: 6, vx: 0, vy: 0, owner: 'player', onBeat: false, mult: 1, ...over,
});

describe('overlaps', () => {
  it('detects intersection and separation', () => {
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
  });
});

describe('resolveCollisions', () => {
  it('kills an enemy hit by a player bullet and scores it', () => {
    const s = createInitialState(1);
    const target = s.enemies[0]!;
    s.bullets = [bullet({ x: target.x + 2, y: target.y + 1 })];
    const events: SimEvent[] = [];
    resolveCollisions(s, events);
    expect(s.enemies.find((e) => e.id === target.id)).toBeUndefined();
    expect(s.bullets).toHaveLength(0);
    expect(s.score).toBe(POINTS[target.kind]);
    expect(s.stats.hits).toBe(1);
    expect(events[0]).toMatchObject({ type: 'enemyKilled', id: target.id, points: POINTS[target.kind] });
  });

  it('a bullet hits at most one enemy', () => {
    const s = createInitialState(1);
    const a = s.enemies[0]!;
    s.bullets = [bullet({ x: a.x, y: a.y, w: 40, h: 40 })];
    resolveCollisions(s, []);
    expect(s.enemies).toHaveLength(39);
  });

  it('damages multi-hp enemies without killing them', () => {
    const s = createInitialState(1);
    const a = s.enemies[0]!;
    a.hp = 2;
    s.bullets = [bullet({ x: a.x + 2, y: a.y + 1 })];
    const events: SimEvent[] = [];
    resolveCollisions(s, events);
    expect(a.hp).toBe(1);
    expect(a.flash).toBeGreaterThan(0);
    expect(events[0]!.type).toBe('enemyHit');
  });

  it('enemy bullet hits the player', () => {
    const s = createInitialState(1);
    const p = s.player;
    s.bullets = [bullet({ owner: 'enemy', x: p.x + 2, y: p.y + 1 })];
    const events: SimEvent[] = [];
    resolveCollisions(s, events);
    expect(p.lives).toBe(PLAYER.startLives - 1);
    expect(s.bullets).toHaveLength(0);
    expect(events.map((e) => e.type)).toContain('playerHit');
  });

  it('invulnerable player ignores enemy bullets', () => {
    const s = createInitialState(1);
    const p = s.player;
    p.invuln = 1;
    s.bullets = [bullet({ owner: 'enemy', x: p.x + 2, y: p.y + 1 })];
    resolveCollisions(s, []);
    expect(p.lives).toBe(PLAYER.startLives);
    expect(s.bullets).toHaveLength(1);
  });
});
