import { describe, expect, it } from 'vitest';
import { ENEMY, PLAYER, PLAYER_ZONE_TOP, SIM_DT, STAGE_CLEAR_TIME } from '../../src/data/balance';
import { createInitialState } from '../../src/sim/state';
import { step } from '../../src/sim/step';
import { NO_INPUT, type InputFrame } from '../../src/sim/types';

describe('step', () => {
  it('advances time while playing', () => {
    const s = createInitialState(1);
    step(s, NO_INPUT);
    expect(s.time).toBeCloseTo(SIM_DT);
  });

  it('enters stageClear when all enemies are dead, then starts next stage', () => {
    const s = createInitialState(1);
    s.enemies = [];
    const events = step(s, NO_INPUT);
    expect(s.phase).toBe('stageClear');
    expect(events).toContainEqual({ type: 'stageClear', stage: 1 });

    let started = false;
    for (let t = 0; t < STAGE_CLEAR_TIME + 0.1; t += SIM_DT) {
      if (step(s, NO_INPUT).some((e) => e.type === 'stageStart')) started = true;
    }
    expect(started).toBe(true);
    expect(s.phase).toBe('playing');
    expect(s.stage).toBe(2);
    expect(s.enemies).toHaveLength(ENEMY.rows * ENEMY.cols);
  });

  it('does not fire during stageClear', () => {
    const s = createInitialState(1);
    s.enemies = [];
    step(s, NO_INPUT);
    step(s, { ...NO_INPUT, firePressed: true });
    expect(s.bullets).toHaveLength(0);
  });

  it('formation invading the player zone costs a life and respawns it', () => {
    const s = createInitialState(1);
    s.formation.y = PLAYER_ZONE_TOP;
    const events = step(s, NO_INPUT);
    expect(events.map((e) => e.type)).toContain('formationInvaded');
    expect(s.player.lives).toBe(PLAYER.startLives - 1);
    expect(s.formation.y).toBe(ENEMY.startY);
  });

  it('stops simulating after game over', () => {
    const s = createInitialState(1);
    s.player.lives = 1;
    s.formation.y = PLAYER_ZONE_TOP;
    step(s, NO_INPUT);
    expect(s.phase).toBe('gameOver');
    const t = s.time;
    expect(step(s, NO_INPUT)).toEqual([]);
    expect(s.time).toBe(t);
  });

  it('is deterministic for same seed and inputs', () => {
    const script = (i: number): InputFrame => ({
      ...NO_INPUT,
      moveX: Math.sin(i / 20),
      firePressed: i % 9 === 0,
    });
    const a = createInitialState(1234);
    const b = createInitialState(1234);
    for (let i = 0; i < 1800; i++) {
      step(a, script(i));
      step(b, script(i));
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.stats.shots).toBeGreaterThan(0);
  });
});
