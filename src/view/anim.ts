import { clamp } from '../sim/math';

/** Staggered pop-in scale for formation rows during the stage intro (progress 0..1). */
export function popInScale(progress: number, row: number): number {
  return clamp((progress - row * 0.1) / 0.5, 0, 1);
}

/** Square-wave on/off at `hz` full cycles per second. */
export function blink(time: number, hz: number): boolean {
  return Math.floor(time * hz * 2) % 2 === 0;
}
