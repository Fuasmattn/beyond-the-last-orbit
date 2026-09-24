import { FX } from '../data/balance';

/** Trauma-based screen shake: events add trauma, it decays; offset grows with trauma². */
export class Shake {
  trauma = 0;

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt: number): void {
    this.trauma = Math.max(0, this.trauma - FX.shake.decay * dt);
  }

  /** Offset in logical px for the given time; smooth pseudo-noise from mixed sines. */
  offset(time: number): { x: number; y: number } {
    const k = FX.shake.maxOffset * this.trauma * this.trauma;
    if (k === 0) return { x: 0, y: 0 };
    return {
      x: k * (Math.sin(time * 71.3) * 0.6 + Math.sin(time * 37.9) * 0.4),
      y: k * (Math.sin(time * 53.1 + 1.3) * 0.6 + Math.sin(time * 29.7) * 0.4),
    };
  }
}
