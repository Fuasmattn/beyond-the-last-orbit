import { SOUR } from '../data/balance';

/** How "out of tune" the soundtrack is, 0 (clean) … 1 (fully sour). */
export class Sourness {
  value = 0;

  onShot(onBeat: boolean): void {
    this.value = onBeat
      ? Math.max(0, this.value - SOUR.onBeatRelief)
      : Math.min(1, this.value + SOUR.offBeatHit);
  }

  update(dt: number): void {
    this.value = Math.max(0, this.value - SOUR.decayPerSec * dt);
  }
}
