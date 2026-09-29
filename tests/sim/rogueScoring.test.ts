import { describe, expect, it } from 'vitest';
import { GRAZE, PLAYER, RHYTHM, SIM_DT, STAGE } from '../../src/data/balance';
import { moveBullets } from '../../src/sim/bullets';
import { resolveCollisions } from '../../src/sim/collision';
import { hitPlayer, hurtbox, updatePlayer } from '../../src/sim/player';
import { defaultRunOptions } from '../../src/sim/ship';
import { computeStageResult } from '../../src/sim/stageFlow';
import { createInitialState } from '../../src/sim/state';
import { NO_INPUT, type Bullet, type SimEvent, type SimState } from '../../src/sim/types';
import { landFormation } from './helpers';

function rogue(): SimState {
  const s = landFormation(createInitialState(1, undefined, defaultRunOptions()));
  s.phase = 'playing';
  return s;
}

const bullet = (over: Partial<Bullet>): Bullet => ({
  id: 999, x: 0, y: 0, w: 2, h: 6, vx: 0, vy: 0, owner: 'player', onBeat: false, mult: 1, ...over,
});

describe('rogue streak', () => {
  it('ignores beat timing when firing', () => {
    const s = rogue();
    updatePlayer(s, { ...NO_INPUT, firePressed: true, fireOnBeat: true }, SIM_DT, []);
    expect(s.rhythm.streak).toBe(0);
    expect(s.bullets[0]!.onBeat).toBe(false);
  });

  it('hits build the streak and multiplier', () => {
    const s = rogue();
    s.enemies = s.enemies.filter((e) => e.row === 0);
    const targets = s.enemies.slice(0, RHYTHM.shotsPerStep);
    s.bullets = targets.map((e, i) => bullet({ id: 900 + i, x: e.x + 2, y: e.y + 1 }));
    for (let i = 0; i < targets.length; i++) resolveCollisions(s, []);
    expect(s.rhythm.streak).toBe(RHYTHM.shotsPerStep);
    expect(s.rhythm.mult).toBe(1 + RHYTHM.multStep);
  });

  it('a primary bolt leaving the field drops a level; side bolts do not', () => {
    const s = rogue();
    s.rhythm.streak = RHYTHM.shotsPerStep * 2 + 1;
    s.bullets = [bullet({ y: -20, extra: true }), bullet({ id: 2, y: -20 })];
    moveBullets(s, SIM_DT);
    expect(s.rhythm.streak).toBe(RHYTHM.shotsPerStep);
    expect(s.bullets).toHaveLength(0);
  });

  it('getting hit drops a level instead of resetting', () => {
    const s = rogue();
    s.rhythm.streak = RHYTHM.shotsPerStep * 3;
    hitPlayer(s, []);
    expect(s.rhythm.streak).toBe(RHYTHM.shotsPerStep * 2);
    expect(s.player.lives).toBe(PLAYER.startLives - 1);
  });

  it('beat stages keep beat scoring and do not grow the streak on hits', () => {
    const s = landFormation(createInitialState(1, undefined, { ...defaultRunOptions(), beatLock: true }));
    const e = s.enemies.find((x) => x.row === 0)!;
    s.bullets = [bullet({ x: e.x + 2, y: e.y + 1 })];
    resolveCollisions(s, []);
    expect(s.rhythm.streak).toBe(0);
  });
});

describe('graze', () => {
  it('scores once per enemy bullet that skims past the ship', () => {
    const s = rogue();
    const h = hurtbox(s);
    s.bullets = [bullet({ owner: 'enemy', x: h.x - GRAZE.margin + 1, y: h.y })];
    const events: SimEvent[] = [];
    resolveCollisions(s, events);
    expect(events.filter((e) => e.type === 'graze')).toHaveLength(0);
    s.bullets[0]!.y = h.y + h.h + GRAZE.margin + 2;
    resolveCollisions(s, events);
    resolveCollisions(s, events);
    expect(events.filter((e) => e.type === 'graze')).toHaveLength(1);
    expect(s.score).toBe(GRAZE.points);
    expect(s.rhythm.streak).toBe(1);
    expect(s.stageStats.grazes).toBe(1);
    expect(s.player.lives).toBe(PLAYER.startLives);
  });

  it('does not score a bullet that goes on to hit the ship', () => {
    const s = rogue();
    const h = hurtbox(s);
    s.bullets = [bullet({ owner: 'enemy', x: h.x - GRAZE.margin + 1, y: h.y })];
    const events: SimEvent[] = [];
    resolveCollisions(s, events);
    s.bullets[0]!.x = h.x + 1;
    resolveCollisions(s, events);
    expect(events.some((e) => e.type === 'playerHit')).toBe(true);
    expect(events.some((e) => e.type === 'graze')).toBe(false);
  });

  it('does not graze while invulnerable', () => {
    const events: SimEvent[] = [];
    const r = rogue();
    r.player.invuln = 1;
    r.bullets = [bullet({ owner: 'enemy', x: r.player.x - GRAZE.margin + 1, y: r.player.y })];
    resolveCollisions(r, events);
    expect(events.filter((e) => e.type === 'graze')).toHaveLength(0);
  });
});

describe('hurtbox', () => {
  it('only the small core takes bullets', () => {
    const s = rogue();
    const p = s.player;
    s.bullets = [bullet({ owner: 'enemy', x: p.x, y: p.y })];
    resolveCollisions(s, []);
    expect(p.lives).toBe(PLAYER.startLives);
    const h = hurtbox(s);
    s.bullets = [bullet({ owner: 'enemy', x: h.x, y: h.y })];
    resolveCollisions(s, []);
    expect(p.lives).toBe(PLAYER.startLives - 1);
  });
});

describe('rogue stage result', () => {
  it('weights accuracy only and judges perfect by accuracy', () => {
    const stats = { shots: 10, hits: 8, onBeatShots: 0, hitsTaken: 0, grazes: 0, time: STAGE.parTime, escaped: 0 };
    const r = computeStageResult(stats, false);
    expect(r.bonus).toBe(0.8 * STAGE.rogueAccuracyBonus + 2000);
    expect(r.perfect).toBe(true);
    expect(computeStageResult(stats, false, 'master').perfect).toBe(false);
  });
});
