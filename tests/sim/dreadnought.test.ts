import { describe, expect, it } from 'vitest';
import { BOSS_POINTS, DREAD, SIM_DT, STAGE } from '../../src/data/balance';
import { dreadCore, hitDreadnought, updateDreadnought } from '../../src/sim/boss/dreadnought';
import { startStage } from '../../src/sim/stageFlow';
import { createInitialState } from '../../src/sim/state';
import type { Boss, Bullet, SimEvent, SimState } from '../../src/sim/types';

const bullet = (x: number, y: number): Bullet => ({
  id: 9999, x, y, w: 2, h: 6, vx: 0, vy: -1, owner: 'player', onBeat: false, mult: 1,
});

function dreadStage(): SimState {
  const s = createInitialState(1);
  s.world = 2;
  s.stage = STAGE.perWorld;
  startStage(s, []);
  return s;
}

function ready(): { s: SimState; b: Boss } {
  const s = dreadStage();
  s.phase = 'playing';
  const b = s.boss!;
  b.entering = false;
  b.y = DREAD.y;
  updateDreadnought(s, 0, 0, []);
  return { s, b };
}

const coreBullet = (b: Boss) => {
  const c = dreadCore(b);
  return bullet(c.x + c.w / 2, c.y + 4);
};

describe('ARES DREADNOUGHT', () => {
  it('is the Mars boss with inactive armor plates', () => {
    const b = dreadStage().boss!;
    expect(b.kind).toBe('dreadnought');
    expect(b.parts.every((p) => !p.alive)).toBe(true);
  });

  it('drops bombs from both cannons in phase 1', () => {
    const { s } = ready();
    updateDreadnought(s, SIM_DT, 4, []);
    expect(s.bullets.filter((x) => x.fuse !== undefined)).toHaveLength(DREAD.cannons.length);
  });

  it('armors its core in phase 2 until the plates break', () => {
    const { s, b } = ready();
    b.hp = Math.floor((b.maxHp * 2) / 3) + 1;
    const events: SimEvent[] = [];
    hitDreadnought(s, coreBullet(b), events);
    expect(b.phase).toBe(2);
    expect(b.parts.every((p) => p.alive)).toBe(true);
    const hp = b.hp;
    expect(hitDreadnought(s, coreBullet(b), [])).toBe(true);
    expect(b.hp).toBe(hp);
    for (const p of b.parts) for (let i = 0; i < p.maxHp; i++) hitDreadnought(s, bullet(p.x + 4, p.y + 1), []);
    expect(b.parts.every((p) => !p.alive)).toBe(true);
    hitDreadnought(s, coreBullet(b), []);
    expect(b.hp).toBe(hp - 1);
  });

  it('fires bullet curtains with a gap in phase 3', () => {
    const { s, b } = ready();
    b.phase = 3;
    updateDreadnought(s, SIM_DT, 2, []);
    const xs = s.bullets.map((x) => x.x + x.w / 2).sort((a, c) => a - c);
    expect(xs.length).toBeGreaterThan(5);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]!);
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(2 * DREAD.gapNarrow);
  });

  it('dies and pays world-scaled points', () => {
    const { s, b } = ready();
    b.hp = 1;
    hitDreadnought(s, coreBullet(b), []);
    expect(s.phase).toBe('bossDying');
    expect(s.score).toBe(BOSS_POINTS * 3);
  });
});
