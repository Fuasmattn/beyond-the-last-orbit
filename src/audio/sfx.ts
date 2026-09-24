import { makeNoiseBuffer, midiToHz } from './synth';

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

  private burst(length: number, peak: number, f0: number, f1: number, delay = 0): void {
    const t = this.ctx.currentTime + delay;
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

  private arpeggio(midis: readonly number[], gap: number, peak: number): void {
    midis.forEach((midi, i) => {
      const f = midiToHz(midi);
      this.tone('square', f, f, 0.14, peak, i * gap);
    });
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
    this.arpeggio([64, 67, 71, 76], 0.09, 0.08);
  }

  extraLife(): void {
    this.arpeggio([72, 76, 79, 84, 88], 0.07, 0.07);
  }

  start(): void {
    this.tone('square', 440, 880, 0.12, 0.08);
  }

  dive(): void {
    this.tone('triangle', 900, 300, 0.4, 0.05);
  }

  bossHit(): void {
    this.tone('square', 180, 120, 0.04, 0.04);
  }

  bossPhase(): void {
    this.burst(1.0, 0.8, 1500, 60);
    this.tone('sawtooth', 120, 40, 0.8, 0.3);
  }

  bossKilled(): void {
    this.burst(1.6, 0.9, 4000, 50);
    this.burst(1.0, 0.6, 3000, 80, 0.4);
    this.tone('sine', 150, 30, 1.4, 0.4);
  }

  laserWarn(): void {
    this.tone('square', 300, 1200, 0.7, 0.05);
  }

  laserFire(): void {
    this.burst(1.2, 0.3, 6000, 1500);
    this.tone('sawtooth', 90, 80, 1.2, 0.15);
  }

  bombBurst(): void {
    this.burst(0.35, 0.35, 2500, 300);
  }

  phaseShift(): void {
    this.tone('sine', 1400, 200, 0.3, 0.06);
    this.tone('sine', 700, 1400, 0.3, 0.04);
  }

  warp(): void {
    this.tone('sawtooth', 80, 1600, 2.2, 0.08);
    this.burst(2.6, 0.25, 800, 8000);
  }
}
