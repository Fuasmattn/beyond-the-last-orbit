import { describe, expect, it } from 'vitest';
import { moveBullets } from '../../src/sim/bullets';
import { createInitialState } from '../../src/sim/state';

describe('moveBullets', () => {
  it('moves bullets by velocity and culls off-field ones', () => {
    const s = createInitialState(1);
    s.bullets = [
      { id: 1, x: 100, y: 100, w: 2, h: 6, vx: 0, vy: -100, owner: 'player', onBeat: false },
      { id: 2, x: 100, y: 2, w: 2, h: 6, vx: 0, vy: -1000, owner: 'player', onBeat: false },
      { id: 3, x: 100, y: 318, w: 2, h: 6, vx: 0, vy: 1000, owner: 'enemy', onBeat: false },
    ];
    moveBullets(s, 0.1);
    expect(s.bullets.map((b) => b.id)).toEqual([1]);
    expect(s.bullets[0]!.y).toBeCloseTo(90);
  });
});
