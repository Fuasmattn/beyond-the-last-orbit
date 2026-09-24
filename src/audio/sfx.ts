import { makeNoiseBuffer } from './synth';

export class Sfx {
  private readonly noise: AudioBuffer;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly out: AudioNode,
  ) {
    this.noise = makeNoiseBuffer(ctx);
  }

  private tone(type: OscillatorType, f0: number, f1: number, length: number, peak: number, delay = 0): void {
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + length);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + length);
    osc.connect(g).connect(this.out);
    osc.start(t);
    osc.stop(t + length + 0.01);
  }

  private burst(length: number, peak: number, f0: number, f1: number): void {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f0, t);
    lp.frequency.exponentialRampToValueAtTime(f1, t + length);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + length);
    src.connect(lp).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + length + 0.01);
  }

  laser(onBeat: boolean): void {
    if (onBeat) {
      this.tone('square', 1800, 400, 0.09, 0.12);
      this.tone('sawtooth', 3600, 800, 0.07, 0.05);
      this.tone('sine', 2400, 2400, 0.12, 0.08);
    } else {
      this.tone('square', 1200, 300, 0.08, 0.1);
    }
  }

  explosion(): void {
    this.burst(0.28, 0.5, 3000, 200);
    this.tone('sine', 200, 60, 0.2, 0.3);
  }

  playerHit(): void {
    this.burst(0.7, 0.7, 2000, 80);
    this.tone('sawtooth', 400, 40, 0.6, 0.25);
  }

  enemyShot(): void {
    this.tone('square', 420, 240, 0.06, 0.03);
  }

  stageClear(): void {
    [64, 67, 71, 76].forEach((midi, i) => {
      const f = 440 * 2 ** ((midi - 69) / 12);
      this.tone('square', f, f, 0.14, 0.08, i * 0.09);
    });
  }

  start(): void {
    this.tone('square', 440, 880, 0.12, 0.08);
  }
}
