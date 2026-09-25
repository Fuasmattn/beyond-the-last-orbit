import { Container, Graphics } from 'pixi.js';
import { CALIBRATION } from '../data/balance';
import { computeLatencyOffset } from '../meta/calibration';
import { beatPulse } from '../view/beatPulse';
import { centerText, PixelText } from '../view/pixelText';
import type { FrameInput, Scene, SceneContext } from './scene';
import { sceneBackground } from './ui';
import { viewport } from '../app/viewport';

const RESULT_TIME = 2.5;

export class CalibrationScene implements Scene {
  readonly root = new Container();
  private readonly ring = new Graphics();
  private readonly dots = new Graphics();
  private readonly status: PixelText;
  private deltas: number[] = [];
  private doneTime = -1;

  constructor(private readonly ctx: SceneContext) {
    const g = ctx.textures.glyphs;
    const title = new PixelText(g, 'CALIBRATE TIMING', 0xffe14a);
    centerText(title, 40);
    const how = new PixelText(
      g,
      ctx.isTouch ? 'TAP FIRE ON EVERY CLICK' : 'PRESS FIRE ON EVERY CLICK',
      0xcccccc,
    );
    centerText(how, 60);
    const esc = new PixelText(g, ctx.isTouch ? '' : 'ESC TO CANCEL', 0x777777);
    centerText(esc, 290);
    this.status = new PixelText(g, ctx.audio ? '' : 'NO AUDIO', 0xff3b5c);
    this.ring.position.set(viewport.w / 2, 150);
    this.root.addChild(sceneBackground(), title, how, this.ring, this.dots, this.status, esc);
    ctx.audio?.startSong(ctx.metronome);
  }

  update(input: FrameInput, dt: number): void {
    if (input.menu.includes('back') || (!this.ctx.audio && (input.menu.length > 0 || input.taps.length > 0))) {
      return this.exit();
    }
    if (this.doneTime >= 0) {
      this.doneTime += dt;
      if (this.doneTime > RESULT_TIME) this.exit();
      return;
    }
    if (!input.sim.firePressed) return;
    const d = this.ctx.takePressDelta();
    if (d === null) return;
    this.deltas.push(d);
    if (this.deltas.length < CALIBRATION.taps) return;
    const offset = computeLatencyOffset(this.deltas);
    this.deltas = [];
    if (offset === null) {
      this.status.setText('TOO UNEVEN - TRY AGAIN');
      this.status.tint = 0xff3b5c;
      return;
    }
    this.ctx.save.settings = { ...this.ctx.save.settings, latencyOffsetMs: offset };
    this.ctx.persist();
    this.status.setText(`OFFSET ${offset >= 0 ? '+' : ''}${offset} MS SAVED`);
    this.status.tint = 0x7dff6b;
    this.doneTime = 0;
  }

  render(): void {
    const pulse = beatPulse(this.ctx.audio?.currentBeat() ?? null);
    this.ring
      .clear()
      .circle(0, 0, 18 + pulse * 10)
      .stroke({ color: 0x4af2ff, width: 2, alpha: 0.4 + pulse * 0.6 });
    this.dots.clear();
    for (let i = 0; i < CALIBRATION.taps; i++) {
      const x = viewport.w / 2 - (CALIBRATION.taps - 1) * 6 + i * 12;
      this.dots.circle(x, 200, 3).fill(i < this.deltas.length ? 0xffe14a : 0x333a55);
    }
    centerText(this.status, 230);
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }

  private exit(): void {
    this.ctx.audio?.stopSong();
    this.ctx.goto(this.ctx.scenes.settings());
  }
}
