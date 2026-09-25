import { describe, expect, it } from 'vitest';
import { PLAYER, SIM_DT } from '../../src/data/balance';
import { resolveCollisions } from '../../src/sim/collision';
import { hitPlayer, updatePlayer } from '../../src/sim/player';
import { baseShip, defaultRunOptions } from '../../src/sim/ship';
import { startStage } from '../../src/sim/stageFlow';
import { createInitialState } from '../../src/sim/state';
import { landFormation } from './helpers';
import { NO_INPUT, type Bullet, type SimEvent, type SimState } from '../../src/sim/types';

const fire = { ...NO_INPUT, firePressed: true };

function withShip(over: Partial<ReturnType<typeof baseShip>>, lives: number = PLAYER.startLives): SimState {
  return createInitialState(1, undefined, { ...defaultRunOptions('rogue'), ship: { ...baseShip(), ...over }, lives });
}

const bolt = (over: Partial<Bullet>): Bullet => ({
  id: 999, x: 0, y: 0, w: 2, h: 6, vx: 0, vy: -1, owner: 'player', onBeat: false, mult: 1, ...over,
});

describe('run options', () => {
  it('seeds mode, lives and ship stats', () => {
    const s = withShip({ maxBullets: 5 }, 4);
    expect(s.mode).toBe('rogue');
    expect(s.player.lives).toBe(4);
    expect(s.ship.maxBullets).toBe(5);
    expect(createInitialState(1).mode).toBe('rhythm');
  });
});

describe('ship stats', () => {
  it('uses the ship cooldown and bolt cap', () => {
    const s = withShip({ cooldown: 0.05, maxBullets: 4 });
    updatePlayer(s, fire, SIM_DT, []);
    expect(s.player.cooldown).toBeCloseTo(0.05);
    for (let i = 0; i < 10; i++) {
      s.player.cooldown = 0;
      updatePlayer(s, fire, SIM_DT, []);
    }
    expect(s.bullets).toHaveLength(4);
  });

  it('twin and spread add side bolts that do not count toward the cap', () => {
    const s = withShip({ twin: true, spread: true, maxBullets: 1 });
    const events: SimEvent[] = [];
    updatePlayer(s, fire, SIM_DT, events);
    expect(s.bullets).toHaveLength(4);
    expect(s.bullets.filter((b) => !b.extra)).toHaveLength(1);
    expect(s.bullets.filter((b) => b.vx !== 0)).toHaveLength(2);
    expect(events.filter((e) => e.type === 'shot')).toHaveLength(1);
    expect(s.stats.shots).toBe(1);
  });

  it('pierce passes through enemies, hitting each once and counting accuracy once', () => {
    const s = landFormation(withShip({ pierce: 1 }));
    const a = s.enemies.find((e) => e.row === 0);
    s.bullets = [bolt({ x: a!.x + 2, y: a!.y + 1, pierce: 1 })];
    resolveCollisions(s, []);
    expect(s.bullets).toHaveLength(1);
    expect(s.bullets[0]!.pierce).toBe(0);
    resolveCollisions(s, []);
    expect(s.bullets).toHaveLength(1);
    expect(s.stats.hits).toBe(1);
  });

  it('damage above 1 kills a shielded enemy in one hit', () => {
    const s = withShip({});
    const e = s.enemies[0]!;
    e.hp = 2;
    s.bullets = [bolt({ x: e.x + 2, y: e.y + 1, damage: 2 })];
    resolveCollisions(s, []);
    expect(s.enemies.find((x) => x.id === e.id)).toBeUndefined();
  });

  it('scoreMul scales kill points', () => {
    const s = withShip({ scoreMul: 2 });
    const e = s.enemies[0]!;
    s.bullets = [bolt({ x: e.x + 2, y: e.y + 1 })];
    const events: SimEvent[] = [];
    resolveCollisions(s, events);
    const kill = events.find((x) => x.type === 'enemyKilled');
    expect(kill && kill.type === 'enemyKilled' && kill.points).toBeGreaterThan(0);
    expect(s.score % 2).toBe(0);
  });
});

describe('shield', () => {
  it('absorbs a hit instead of a life', () => {
    const s = withShip({});
    s.player.shield = 1;
    const events: SimEvent[] = [];
    hitPlayer(s, events);
    expect(s.player.lives).toBe(PLAYER.startLives);
    expect(s.player.shield).toBe(0);
    expect(events[0]).toMatchObject({ type: 'shieldHit', shieldLeft: 0 });
    expect(s.stageStats.hitsTaken).toBe(0);
    hitPlayer(s, events);
    expect(s.player.lives).toBe(PLAYER.startLives - 1);
  });

  it('refills shieldMax every stage and worldShield at stage 1', () => {
    const s = withShip({ shieldMax: 1, worldShield: 2 });
    expect(s.player.shield).toBe(2);
    s.player.shield = 0;
    s.stage = 2;
    startStage(s, []);
    expect(s.player.shield).toBe(1);
  });
});
