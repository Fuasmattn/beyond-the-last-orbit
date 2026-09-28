import { describe, expect, it } from 'vitest';
import { BOSS_POINTS, PLAYER, SIM_DT, STAGE, WARDEN } from '../../src/data/balance';
import { hitWarden, laserZone, updateWarden, wardenCore } from '../../src/sim/boss/warden';
import { startStage } from '../../src/sim/stageFlow';
import { createInitialState } from '../../src/sim/state';
import type { Boss, Bullet, SimEvent, SimState } from '../../src/sim/types';

const bullet = (x: number, y: number): Bullet => ({
  id: 9999, x, y, w: 2, h: 6, vx: 0, vy: -1, owner: 'player', onBeat: false, mult: 1,
});

function bossStage(): SimState {
  const s = createInitialState(1);
  s.stage = STAGE.perWorld;
  startStage(s, []);
  return s;
}

function ready(): { s: SimState; b: Boss } {
  const s = bossStage();
  s.phase = 'playing';
  const b = s.boss!;
  b.entering = false;
  b.y = WARDEN.y;
  updateWarden(s, 0, 0, []);
  return { s, b };
}

function hitCore(s: SimState, b: Boss, times = 1): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < times; i++) {
    const c = wardenCore(b);
    hitWarden(s, bullet(c.x + c.w / 2, c.y + 4), events);
  }
  return events;
}

describe('ORBITAL WARDEN', () => {
  it('is the Earth boss and flies in from above', () => {
    const s = bossStage();
    expect(s.boss!.kind).toBe('warden');
    expect(s.boss!.y).toBeLessThan(0);
    for (let t = 0; t < WARDEN.enterTime + 0.1; t += SIM_DT) updateWarden(s, SIM_DT, 0, []);
    expect(s.boss!.entering).toBe(false);
    expect(s.boss!.y).toBe(WARDEN.y);
  });

  it('ignores bullets while entering', () => {
    const s = bossStage();
    const b = s.boss!;
    expect(hitWarden(s, bullet(b.x + b.w / 2, b.y + 2), [])).toBe(false);
  });

  it('takes damage on the core', () => {
    const { s, b } = ready();
    const hp = b.hp;
    const events = hitCore(s, b);
    expect(b.hp).toBe(hp - 1);
    expect(events[0]!.type).toBe('bossHit');
  });

  it('absorbs bullets on its armor', () => {
    const { s, b } = ready();
    const hp = b.hp;
    expect(hitWarden(s, bullet(b.x + 2, b.y + 2), [])).toBe(true);
    expect(b.hp).toBe(hp);
  });

  it('loses turrets after enough hits and pays points', () => {
    const { s, b } = ready();
    const t = b.parts[0]!;
    const events: SimEvent[] = [];
    for (let i = 0; i < WARDEN.turretHp; i++) hitWarden(s, bullet(t.x + 4, t.y + 2), events);
    expect(t.alive).toBe(false);
    expect(events.some((e) => e.type === 'partDestroyed')).toBe(true);
    expect(s.score).toBeGreaterThan(0);
  });

  it('enters phase 2 at two thirds hp, loses turrets and hit-stops', () => {
    const { s, b } = ready();
    b.hp = Math.floor((b.maxHp * 2) / 3) + 1;
    const events = hitCore(s, b);
    expect(b.phase).toBe(2);
    expect(b.parts.every((t) => !t.alive)).toBe(true);
    expect(s.hitStop).toBeGreaterThan(0);
    expect(events.map((e) => e.type)).toContain('bossPhase');
  });

  it('fires on beats in phase 1', () => {
    const { s } = ready();
    updateWarden(s, SIM_DT, 4, []);
    expect(s.bullets.filter((x) => x.owner === 'enemy')).toHaveLength(2 + 3);
  });

  it('telegraphs its phase 2 laser, then burns the player', () => {
    const { s, b } = ready();
    b.phase = 2;
    b.parts.forEach((t) => (t.alive = false));
    const events: SimEvent[] = [];
    updateWarden(s, SIM_DT, 8, events);
    expect(events.map((e) => e.type)).toContain('laserWarn');
    expect(s.player.lives).toBe(PLAYER.startLives);
    for (let t = 0; t < WARDEN.laserWarn + 0.1; t += SIM_DT) updateWarden(s, SIM_DT, 0, events);
    expect(events.map((e) => e.type)).toContain('laserFire');
    expect(s.player.lives).toBe(PLAYER.startLives - 1);
  });

  it('fires spiral rings on every other beat in phase 3', () => {
    const { s, b } = ready();
    b.phase = 3;
    updateWarden(s, SIM_DT, 1, []);
    expect(s.bullets).toHaveLength(0);
    updateWarden(s, SIM_DT, 1, []);
    expect(s.bullets).toHaveLength(WARDEN.ringCount);
  });

  it('holds its phase 3 rings while the laser burns', () => {
    const { s, b } = ready();
    b.phase = 3;
    b.laser = { state: 'fire', t: 0, x: 10, dir: 1 };
    s.player.invuln = 999;
    updateWarden(s, SIM_DT, 2, []);
    expect(s.bullets).toHaveLength(0);
  });

  it('warns over the whole area the beam will sweep', () => {
    const { s, b } = ready();
    const zone = laserZone(b, { state: 'warn', t: 0, x: 100, dir: -1 }, s.fieldW);
    expect(zone.x).toBe(100 - WARDEN.laserSweep - WARDEN.laserW / 2);
    expect(zone.w).toBe(WARDEN.laserSweep + WARDEN.laserW);
  });

  it('dies at zero hp and pays out', () => {
    const { s, b } = ready();
    b.parts.forEach((t) => (t.alive = false));
    b.hp = 1;
    const events = hitCore(s, b);
    expect(s.phase).toBe('bossDying');
    expect(s.score).toBe(BOSS_POINTS);
    expect(s.run.bossesKilled).toBe(1);
    expect(events.map((e) => e.type)).toContain('bossKilled');
  });
});
