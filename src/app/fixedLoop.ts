/** Accumulator-based fixed timestep. Returns interpolation alpha in [0, 1). */
export class FixedLoop {
  private acc = 0;

  constructor(
    private readonly dt: number,
    private readonly maxSteps: number,
  ) {}

  advance(elapsed: number, stepFn: () => void): number {
    this.acc += elapsed;
    let steps = 0;
    while (this.acc >= this.dt && steps < this.maxSteps) {
      stepFn();
      this.acc -= this.dt;
      steps++;
    }
    if (this.acc >= this.dt) this.acc = 0; // drop backlog — no spiral of death
    return this.acc / this.dt;
  }
}
