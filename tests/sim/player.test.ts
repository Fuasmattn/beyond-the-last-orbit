import { describe, expect, it } from 'vitest';
import { BEAT_TRACK, FIELD_H, PLAYER, PLAYER_ZONE_TOP, SIM_DT } from '../../src/data/balance';
import { hitPlayer, updatePlayer } from '../../src/sim/player';
import { defaultRunOptions } from '../../src/sim/ship';
import { createInitialState } from '../../src/sim/state';
import { NO_INPUT, type InputFrame, type SimEvent } from '../../src/sim/types';

const input = (over: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...over });

function run(frames: number, inp: InputFrame, s = createInitialState(1)) {
  const events: SimEvent[] = [];
  for (let i = 0; i < frames; i++) updatePlayer(s, inp, SIM_DT, events);
  return { s, events };
}

describe('player movement', () => {
  it('accelerates toward max speed', () => {
    const { s } = run(60, input({ moveX: 1 }));
    expect(s.player.vx).toBeCloseTo(PLAYER.maxSpeed, 0);
  });

  it('clamps to field horizontally', () => {
    const { s } = run(300, input({ moveX: -1 }));
    expect(s.player.x).toBe(0);
    const r = run(300, input({ moveX: 1 }));
    expect(r.s.player.x).toBe(r.s.fieldW - PLAYER.w);
  });

  it('limits vertical movement to the player zone', () => {
    const { s } = run(300, input({ moveY: -1 }));
    expect(s.player.y).toBe(PLAYER_ZONE_TOP);
    const r = run(300, input({ moveY: 1 }));
    expect(r.s.player.y).toBe(FIELD_H - BEAT_TRACK.h - PLAYER.h - PLAYER.bottomMargin);
  });

  it('applies drag displacement directly', () => {
    const s = createInitialState(1);
    const x0 = s.player.x;
    updatePlayer(s, input({ dragX: 10 }), SIM_DT, []);
    expect(s.player.x).toBeCloseTo(x0 + 10);
  });
});

describe('player firing', () => {
  it('spawns a bullet and a shot event on press', () => {
    const s = createInitialState(1, undefined, { ...defaultRunOptions(), beatLock: true });
    const events: SimEvent[] = [];
    updatePlayer(s, input({ firePressed: true, fireOnBeat: true }), SIM_DT, events);
    expect(s.bullets).toHaveLength(1);
    expect(s.bullets[0]!.owner).toBe('player');
    expect(s.bullets[0]!.onBeat).toBe(true);
    expect(s.bullets[0]!.vy).toBeLessThan(0);
    expect(events.map((e) => e.type)).toEqual(['shot']);
    expect(s.stats.shots).toBe(1);
  });

  it('respects the fire cooldown', () => {
    const s = createInitialState(1);
    updatePlayer(s, input({ firePressed: true }), SIM_DT, []);
    updatePlayer(s, input({ firePressed: true }), SIM_DT, []);
    expect(s.bullets).toHaveLength(1);
  });

  it('caps player bullets on screen', () => {
    const s = createInitialState(1);
    for (let i = 0; i < 10; i++) {
      s.player.cooldown = 0;
      updatePlayer(s, input({ firePressed: true }), SIM_DT, []);
    }
    expect(s.bullets).toHaveLength(PLAYER.maxBullets);
  });
});

describe('hitPlayer', () => {
  it('removes a life, grants invulnerability and clears enemy bullets', () => {
    const s = createInitialState(1);
    s.bullets.push(
      { id: 900, x: 0, y: 0, w: 2, h: 6, vx: 0, vy: 1, owner: 'enemy', onBeat: false, mult: 1 },
      { id: 901, x: 0, y: 0, w: 2, h: 6, vx: 0, vy: -1, owner: 'player', onBeat: false, mult: 1 },
    );
    const events: SimEvent[] = [];
    hitPlayer(s, events);
    expect(s.player.lives).toBe(PLAYER.startLives - 1);
    expect(s.player.invuln).toBe(PLAYER.invulnTime);
    expect(s.bullets.map((b) => b.id)).toEqual([901]);
    expect(events[0]!.type).toBe('playerHit');
  });

  it('ends the game at zero lives', () => {
    const s = createInitialState(1);
    s.player.lives = 1;
    const events: SimEvent[] = [];
    hitPlayer(s, events);
    expect(s.phase).toBe('gameOver');
    expect(events.map((e) => e.type)).toEqual(['playerHit', 'gameOver']);
  });
});
