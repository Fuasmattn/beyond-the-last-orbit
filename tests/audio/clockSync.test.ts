import { describe, expect, it } from 'vitest';
import { AudioClockSync } from '../../src/audio/clockSync';

describe('AudioClockSync', () => {
  it('interpolates between coarse audio clock steps', () => {
    const sync = new AudioClockSync();
    // Audio clock steps every 10 ms; perf time reads in between.
    sync.sample(1.0, 5000);
    expect(sync.sample(1.0, 5004)).toBeCloseTo(1.004, 4);
    expect(sync.sample(1.0, 5008)).toBeCloseTo(1.008, 4);
    expect(sync.sample(1.01, 5010)).toBeCloseTo(1.01, 4);
  });

  it('adopts the latest step when a sample was taken late in a buffer', () => {
    const sync = new AudioClockSync();
    // First read happened 8 ms after the clock stepped → estimate lags until a fresh step is seen.
    sync.sample(1.0, 5008);
    expect(sync.sample(1.01, 5010)).toBeCloseTo(1.01, 4);
    expect(sync.at(5015)).toBeCloseTo(1.015, 4);
  });

  it('maps earlier event timestamps back onto the audio clock', () => {
    const sync = new AudioClockSync();
    sync.sample(2.0, 1000);
    expect(sync.at(990)).toBeCloseTo(1.99, 4);
  });

  it('resyncs when the audio clock stalls (suspend)', () => {
    const sync = new AudioClockSync();
    sync.sample(3.0, 1000);
    // Suspended for 500 ms: clock frozen.
    expect(sync.sample(3.0, 1500)).toBeCloseTo(3.0, 4);
  });
});
