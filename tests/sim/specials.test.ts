import { describe, expect, it } from 'vitest';
import { BOMB, FIELD_H } from '../../src/data/balance';
import { spawnBomb } from '../../src/sim/bullets';
import { resolveCollisions } from '../../src/sim/collision';
import { updateEnemyFire } from '../../src/sim/enemyFire';
import { phaserPhased, spawnMini, updateSpecials } from '../../src/sim/specials';
import { createInitialState } from '../../src/sim/state';
import type { Bullet, Enemy, SimEvent } from '../../src/sim/types';

const bulletAt = (e: Enemy): Bullet => ({
  id: 999, x: e.x + 2, y: e.y + 1, w: 2, h: 6, vx: 0, vy: 0, owner: 'player', onBeat: false, mult: 1,
});

describe('phaserPhased', () => {
  it('alternates every two beats with a per-column offset', () => {
    expect([0, 1, 2, 3, 4].map((c) => phaserPhased(c, 0))).toEqual([false, false, true, true, false]);
    expect(phaserPhased(0, 2)).toBe(true);
  });
});

describe('free enemies', () => {
  it('move, bounce off walls and leave at the bottom', () => {
    const s = createInitialState(1);
    s.enemies = [];
    spawnMini(s, 2, 100, -1);
    const m = s.enemies[0]!;
    updateSpecials(s, 0.1, []);
    expect(m.x).toBe(0);
    expect(m.free!.vx).toBeGreaterThan(0);
    m.y = FIELD_H + 1;
    updateSpecials(s, 0.01, []);
    expect(s.enemies).toHaveLength(0);
  });
});

describe('splitters', () => {
  it('split into two minis heading apart when killed', () => {
    const s = createInitialState(1);
    const e = s.enemies[0]!;
    e.kind = 'splitter';
    s.bullets = [bulletAt(e)];
    const events: SimEvent[] = [];
    resolveCollisions(s, events);
    const minis = s.enemies.filter((x) => x.kind === 'mini');
    expect(minis).toHaveLength(2);
    expect(minis.map((m) => Math.sign(m.free!.vx)).sort()).toEqual([-1, 1]);
    expect(events.map((x) => x.type)).toContain('split');
  });
});

describe('phasers', () => {
  it('let bullets pass while phased', () => {
    const s = createInitialState(1);
    const e = s.enemies[0]!;
    e.kind = 'phaser';
    e.phased = true;
    s.bullets = [bulletAt(e)];
    resolveCollisions(s, []);
    expect(e.hp).toBe(1);
    expect(s.bullets).toHaveLength(1);
  });

  it('toggle with the beat count', () => {
    const s = createInitialState(1);
    const e = s.enemies[0]!;
    e.kind = 'phaser';
    e.col = 0;
    s.beat.count = 2;
    updateSpecials(s, 0, []);
    expect(e.phased).toBe(true);
    s.beat.count = 4;
    updateSpecials(s, 0, []);
    expect(e.phased).toBe(false);
  });
});

describe('bombs', () => {
  it('bombers drop bombs', () => {
    const s = createInitialState(1);
    s.enemies.forEach((e) => (e.kind = 'bomber'));
    s.enemyFireTimer = 0;
    updateEnemyFire(s, 0.01, []);
    const b = s.bullets[0]!;
    expect(b.fuse).toBe(BOMB.fuse);
    expect(b.vy).toBe(BOMB.speed);
    expect(b.w).toBe(BOMB.w);
  });

  it('burst into a ring when the fuse runs out', () => {
    const s = createInitialState(1);
    s.bullets = [];
    spawnBomb(s, 100, 100);
    const events: SimEvent[] = [];
    updateSpecials(s, BOMB.fuse + 0.01, events);
    expect(s.bullets).toHaveLength(BOMB.ringCount);
    expect(events).toContainEqual({ type: 'bombBurst', x: 100, y: 100 + BOMB.h / 2 });
  });
});
