/** Constant-tempo clock anchored at an AudioContext time. Pure math. */
export class BeatClock {
  readonly beatDur: number;

  constructor(
    readonly bpm: number,
    readonly startTime: number,
  ) {
    this.beatDur = 60 / bpm;
  }

  beatAt(t: number): number {
    return (t - this.startTime) / this.beatDur;
  }

  timeOfBeat(beat: number): number {
    return this.startTime + beat * this.beatDur;
  }

  /** Signed seconds from the nearest grid line (`subdivision` lines per beat) to t. */
  gridDelta(t: number, subdivision: number): number {
    const g = this.beatDur / subdivision;
    const x = (t - this.startTime) / g;
    return (x - Math.round(x)) * g;
  }

  beatPhase(t: number): number {
    const b = this.beatAt(t);
    return b - Math.floor(b);
  }
}
