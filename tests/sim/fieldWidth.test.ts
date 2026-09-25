import { describe, expect, it } from 'vitest';
import { SIM_DT, STAGE } from '../../src/data/balance';
import { startStage } from '../../src/sim/stageFlow';
import { createInitialState } from '../../src/sim/state';
import { step } from '../../src/sim/step';
import { NO_INPUT } from '../../src/sim/types';

describe('bosses on any field width', () => {
  for (const fieldW of [140, 240, 600]) {
    for (const world of [0, 1, 2]) {
      it(`world ${world} boss stays inside a ${fieldW}px field`, () => {
        const s = createInitialState(7, fieldW);
        s.world = world;
        s.stage = STAGE.perWorld;
        s.player.invuln = 1e9;
        startStage(s, []);
        for (let t = 0; t < 20; t += SIM_DT) {
          s.player.invuln = 1e9;
          step(s, NO_INPUT);
          const b = s.boss!;
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.x + b.w).toBeLessThanOrEqual(fieldW);
        }
      });
    }
  }
});
