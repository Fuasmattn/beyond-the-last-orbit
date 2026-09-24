import { FIELD_H, FIELD_W } from '../data/balance';
import type { SimState } from './types';

export function moveBullets(state: SimState, dt: number): void {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  state.bullets = state.bullets.filter(
    (b) => b.y + b.h > 0 && b.y < FIELD_H && b.x + b.w > 0 && b.x < FIELD_W,
  );
}
