import { describe, expect, it } from 'vitest';
import { DIVE, PLAYER_ZONE_TOP, SIM_DT } from '../../src/data/balance';
import { divePosition, updateDives } from '../../src/sim/dive';
import { formationBottom, slotPosition } from '../../src/sim/formation';
import { startStage } from '../../src/sim/stageFlow';
import { createInitialState } from '../../src/sim/state';
import { landFormation } from './helpers';
import type { Dive, SimEvent } from '../../src/sim/types';

const dive = (over: Partial<Dive> = {}): Dive => ({
  t: 0,
  duration: DIVE.duration,
  startX: 50,
  startY: 60,
  targetX: 150,
  dir: 1,
  fired: false,
  ...over,
});

function diverStage() {
  const s = createInitialState(1);
  s.stage = 2; // d = 2 → row 2 are divers
  startStage(s, []);
  landFormation(s);
  s.phase = 'playing';
  return s;
}

describe('divePosition', () => {
  it('starts at the start point', () => {
    expect(divePosition(dive(), 50, 60)).toEqual({ x: 50, y: 60 });
  });

  it('reaches the target at the bottom of the swoop', () => {
    const p = divePosition(dive({ t: DIVE.duration / 2 }), 50, 60);
    expect(p.x).toBeCloseTo(150);
    expect(p.y).toBeCloseTo(DIVE.bottomY);
  });

  it('ends in its formation slot', () => {
    const p = divePosition(dive({ t: DIVE.duration }), 70, 64);
    expect(p.x).toBeCloseTo(70);
    expect(p.y).toBeCloseTo(64);
  });
});

describe('updateDives', () => {
  it('launches a diver when the timer expires', () => {
    const s = diverStage();
    s.diveTimer = 0;
    const events: SimEvent[] = [];
    updateDives(s, SIM_DT, events);
    const diving = s.enemies.filter((e) => e.dive);
    expect(diving).toHaveLength(1);
    expect(diving[0]!.kind).toBe('diver');
    expect(events).toContainEqual({ type: 'dive', id: diving[0]!.id });
    expect(s.diveTimer).toBeGreaterThan(0);
  });

  it('fires exactly once and returns to its slot', () => {
    const s = diverStage();
    s.diveTimer = 0;
    const events: SimEvent[] = [];
    updateDives(s, SIM_DT, events);
    const e = s.enemies.find((x) => x.dive)!;
    s.diveTimer = 999;
    for (let t = 0; t < DIVE.duration + 0.1; t += SIM_DT) updateDives(s, SIM_DT, events);
    expect(e.dive).toBeNull();
    expect(events.filter((x) => x.type === 'enemyShot')).toHaveLength(1);
    const slot = slotPosition(s, e);
    expect(e.x).toBe(slot.x);
    expect(e.y).toBe(slot.y);
  });

  it('does not count diving enemies for the invasion line', () => {
    const s = diverStage();
    const e = s.enemies[0]!;
    e.dive = dive({ t: DIVE.duration / 2 });
    e.y = 300;
    expect(formationBottom(s)).toBeLessThan(PLAYER_ZONE_TOP);
  });
});
