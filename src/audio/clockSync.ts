/**
 * A reset threshold: the audio clock fell this far behind the estimate (stall, glitch). Above the
 * largest render-buffer step seen in practice (~40 ms on big Android/Bluetooth buffers).
 */
const RESYNC_SEC = 0.1;
/** Per-sample pull toward the latest sample, so slow clock drift cannot accumulate. */
const DRIFT_DECAY_SEC = 0.00002;

/**
 * Maps `performance.now()` onto the AudioContext clock.
 *
 * `AudioContext.currentTime` advances in steps of one render buffer (3–20 ms depending on
 * browser and device), so reading it straight makes beat visuals stutter and press timing
 * jitter. Each sample of `currentTime − perfNow` undershoots the true offset by however long ago
 * the clock last stepped, so the running maximum is the best estimate. A sample far below the
 * estimate means the clock stalled (suspend, device change) and resets it.
 */
export class AudioClockSync {
  private offset: number | null = null;

  /** Feed a (currentTime s, performance.now() ms) pair; returns the smoothed audio time for `perfMs`. */
  sample(audioTime: number, perfMs: number): number {
    const s = audioTime - perfMs / 1000;
    if (this.offset === null || s > this.offset || this.offset - s > RESYNC_SEC) this.offset = s;
    else this.offset -= DRIFT_DECAY_SEC;
    return this.at(perfMs);
  }

  /** Audio-clock time corresponding to `perfMs`; requires at least one sample. */
  at(perfMs: number): number {
    return perfMs / 1000 + (this.offset ?? 0);
  }

  reset(): void {
    this.offset = null;
  }
}
