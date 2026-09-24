import { describe, expect, it } from 'vitest';
import { BOSS_POINTS, HIVE, SIM_DT, STAGE } from '../../src/data/balance';
import { hitHive, hiveCore, updateHive } from '../../src/sim/boss/hive';
import { startStage } from '../../src/sim/stageFlow';
import { createInitialState } from '../../src/sim/state';
import type { Boss, Bullet, SimEvent, SimState } from '../../src/sim/types';

const bullet = (x: number, y: number): Bullet => ({
  id: 9999, x, y, w: 2, h: 6, vx: 0, vy: -1, owner: 'player', onBeat: false, mult: 1,
});

function hiveStage(): SimState {
  const s = createInitialState(1);
  s.world = 1;
  s.stage = STAGE.perWorld;
  startStage(s, []);
  return s;
}

function ready(): { s: SimState; b: Boss } {
  const s = hiveStage();
  s.phase = 'playing';
  const b = s.boss!;
  b.entering = false;
  b.y = HIVE.y;
  updateHive(s, 0, 0, []);
  return { s, b };
}

const coreBullet = (b: Boss) => {
  const c = hiveCore(b);
  return bullet(c.x + c.w / 2, c.y + 4);
};

describe('LUNAR HIVE', () => {
  it('is the Moon boss', () => {
    expect(hiveStage().boss!.kind).toBe('hive');
  });

  it('launches escort waves in phase 1', () => {
    const { s } = ready();
    updateHive(s, SIM_DT, HIVE.escortEvery, []);
    expect(s.enemies.filter((e) => e.free)).toHaveLength(HIVE.escortCount);
  });

  it('takes core damage while solid', () => {
    const { s, b } = ready();
    const hp = b.hp;
    expect(hitHive(s, coreBullet(b), [])).toBe(true);
    expect(b.hp).toBe(hp - 1);
  });

  it('phases out in phase 2 and lets bullets pass while phased', () => {
    const { s, b } = ready();
    b.phase = 2;
    const events: SimEvent[] = [];
    updateHive(s, SIM_DT, HIVE.phaseEvery, events);
    expect(b.phased).toBe(true);
    expect(events).toContainEqual({ type: 'bossPhased', phased: true });
    const hp = b.hp;
    expect(hitHive(s, coreBullet(b), [])).toBe(false);
    expect(b.hp).toBe(hp);
  });

  it('sends a diving swarm in phase 3', () => {
    const { s, b } = ready();
    b.phase = 3;
    updateHive(s, SIM_DT, HIVE.swarmEvery, []);
    expect(s.enemies.filter((e) => e.kind === 'diver' && e.free)).toHaveLength(2);
  });

  it('clears its escorts and pays world-scaled points when destroyed', () => {
    const { s, b } = ready();
    updateHive(s, SIM_DT, HIVE.escortEvery, []);
    b.hp = 1;
    hitHive(s, coreBullet(b), []);
    expect(s.phase).toBe('bossDying');
    expect(s.enemies).toHaveLength(0);
    expect(s.score).toBe(BOSS_POINTS * 2);
  });
});
