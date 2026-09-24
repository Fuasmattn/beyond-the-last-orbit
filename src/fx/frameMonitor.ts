/** Signals when the rolling average frame time over a full window exceeds a budget. */
export class FrameMonitor {
  private samples: number[] = [];
  private sum = 0;

  constructor(
    private readonly windowMs: number,
    private readonly maxAvgMs: number,
    private readonly stallMs: number,
  ) {}

  /** Returns true once when performance is too low; the window then restarts. */
  push(frameMs: number): boolean {
    if (frameMs > this.stallMs) return false;
    this.samples.push(frameMs);
    this.sum += frameMs;
    while (this.samples.length > 1 && this.sum - this.samples[0]! >= this.windowMs) {
      this.sum -= this.samples.shift()!;
    }
    if (this.sum >= this.windowMs && this.sum / this.samples.length > this.maxAvgMs) {
      this.samples = [];
      this.sum = 0;
      return true;
    }
    return false;
  }
}
