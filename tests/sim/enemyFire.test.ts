import { describe, expect, it } from 'vitest';
import { ENEMY } from '../../src/data/balance';
import { updateEnemyFire } from '../../src/sim/enemyFire';
import { landedState } from './helpers';
import type { SimEvent } from '../../src/sim/types';

describe('updateEnemyFire', () => {
  it('fires when the timer expires and resets it', () => {
    const s = landedState(3);
    s.enemyFireTimer = 0.01;
    const events: SimEvent[] = [];
    updateEnemyFire(s, 0.02, events);
    expect(s.bullets).toHaveLength(1);
    expect(s.bullets[0]!.owner).toBe('enemy');
    expect(s.bullets[0]!.vy).toBeGreaterThan(0);
    expect(events[0]!.type).toBe('enemyShot');
    expect(s.enemyFireTimer).toBeGreaterThan(0);
  });

  it('does not fire before the timer expires', () => {
    const s = landedState(3);
    s.enemyFireTimer = 1;
    updateEnemyFire(s, 0.1, []);
    expect(s.bullets).toHaveLength(0);
  });

  it('only fires from bottom-most enemies or gunners', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = landedState(seed);
      s.enemyFireTimer = 0;
      updateEnemyFire(s, 0.01, []);
      const b = s.bullets[0]!;
      const cx = b.x + b.w / 2;
      const shooter = s.enemies.find((e) => Math.abs(e.x + e.w / 2 - cx) < 1e-6 && Math.abs(e.y + e.h - b.y) < 1e-6)!;
      expect(shooter).toBeDefined();
      const lane = (e: { x: number; w: number }) => Math.round((e.x + e.w / 2) / ENEMY.spacingX);
      const below = s.enemies.some((e) => e !== shooter && lane(e) === lane(shooter) && e.y > shooter.y);
      expect(shooter.kind === 'gunner' || !below).toBe(true);
    }
  });

  it('gunners aim at the player', () => {
    const s = landedState(3);
    s.enemies = s.enemies.filter((e) => e.kind === 'gunner' && e.col === 0);
    s.player.x = 200;
    s.enemyFireTimer = 0;
    updateEnemyFire(s, 0.01, []);
    const b = s.bullets[0]!;
    expect(b.vx).toBeGreaterThan(0);
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(s.diff.bulletSpeed);
  });
});
