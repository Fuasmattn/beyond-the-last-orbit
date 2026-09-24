import { describe, expect, it } from 'vitest';
import {
  BOSS_DYING_TIME,
  ENEMY,
  FIELD_W,
  PLAYER,
  PLAYER_ZONE_TOP,
  SIM_DT,
  STAGE,
  WARDEN,
} from '../../src/data/balance';
import { WORLDS } from '../../src/data/worlds';
import { startStage } from '../../src/sim/stageFlow';
import { createInitialState } from '../../src/sim/state';
import { step } from '../../src/sim/step';
import { NO_INPUT, type InputFrame, type SimEvent } from '../../src/sim/types';

function playing(seed = 1) {
  const s = createInitialState(seed);
  s.phase = 'playing';
  return s;
}

describe('step', () => {
  it('starts in the stage intro and then plays', () => {
    const s = createInitialState(1);
    expect(s.phase).toBe('stageIntro');
    let started = false;
    for (let t = 0; t < STAGE.introTime + 0.1; t += SIM_DT) {
      if (step(s, NO_INPUT).some((e) => e.type === 'stageStart')) started = true;
    }
    expect(started).toBe(true);
    expect(s.phase).toBe('playing');
  });

  it('does not fire during the intro', () => {
    const s = createInitialState(1);
    step(s, { ...NO_INPUT, firePressed: true });
    expect(s.bullets).toHaveLength(0);
  });

  it('clears the stage with a bonus, then intros the next stage', () => {
    const s = playing();
    s.enemies = [];
    const events = step(s, NO_INPUT);
    const clear = events.find((e) => e.type === 'stageClear');
    expect(s.phase).toBe('stageClear');
    expect(clear?.type === 'stageClear' ? clear.result.bonus : -1).toBe(s.score);
    for (let t = 0; t < STAGE.clearTime + 0.1; t += SIM_DT) step(s, NO_INPUT);
    expect(s.stage).toBe(2);
    expect(s.phase).toBe('stageIntro');
    expect(s.enemies).toHaveLength(ENEMY.rows * s.diff.cols);
  });

  it('does not fire during stageClear', () => {
    const s = playing();
    s.enemies = [];
    step(s, NO_INPUT);
    step(s, { ...NO_INPUT, firePressed: true });
    expect(s.bullets).toHaveLength(0);
  });

  it('formation invading the player zone costs a life and respawns it', () => {
    const s = playing();
    s.formation.y = PLAYER_ZONE_TOP;
    const events = step(s, NO_INPUT);
    expect(events.map((e) => e.type)).toContain('formationInvaded');
    expect(s.player.lives).toBe(PLAYER.startLives - 1);
    expect(s.formation.y).toBe(ENEMY.startY);
  });

  it('freezes everything during hit-stop', () => {
    const s = playing();
    s.hitStop = 0.04;
    const t = s.time;
    step(s, NO_INPUT);
    expect(s.time).toBe(t);
    expect(s.hitStop).toBeCloseTo(0.04 - SIM_DT);
  });

  it('awards an extra ship at the score threshold', () => {
    const s = playing();
    s.score = PLAYER.extraLifeEvery;
    const events = step(s, NO_INPUT);
    expect(s.player.lives).toBe(PLAYER.startLives + 1);
    expect(events.map((e) => e.type)).toContain('extraLife');
  });

  it('stops simulating after game over', () => {
    const s = playing();
    s.player.lives = 1;
    s.formation.y = PLAYER_ZONE_TOP;
    step(s, NO_INPUT);
    expect(s.phase).toBe('gameOver');
    const t = s.time;
    expect(step(s, NO_INPUT)).toEqual([]);
    expect(s.time).toBe(t);
  });

  it('boss kill leads to the next world (or loop)', () => {
    const s = createInitialState(1);
    s.stage = STAGE.perWorld;
    startStage(s, []);
    s.phase = 'playing';
    const b = s.boss!;
    b.entering = false;
    b.y = WARDEN.y;
    b.parts.forEach((t) => (t.alive = false));
    b.hp = 1;
    s.bullets.push({
      id: 5000, x: 0, y: WARDEN.y, w: FIELD_W, h: WARDEN.h, vx: 0, vy: 0, owner: 'player', onBeat: false, mult: 1,
    });
    const events: SimEvent[] = [];
    for (let t = 0; t < BOSS_DYING_TIME + STAGE.clearTime + 0.5; t += SIM_DT) events.push(...step(s, NO_INPUT));
    const types = events.map((e) => e.type);
    expect(types).toContain('bossKilled');
    expect(types).toContain('worldClear');
    expect(s.stage).toBe(1);
    expect(s.world).toBe(1 % WORLDS.length);
    expect(s.loop).toBe(WORLDS.length === 1 ? 1 : 0);
  });

  it('is deterministic for same seed and inputs', () => {
    const script = (i: number): InputFrame => ({
      ...NO_INPUT,
      moveX: Math.sin(i / 20),
      firePressed: i % 9 === 0,
    });
    const a = createInitialState(1234);
    const b = createInitialState(1234);
    for (let i = 0; i < 3600; i++) {
      step(a, script(i));
      step(b, script(i));
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.stats.shots).toBeGreaterThan(0);
  });
});
