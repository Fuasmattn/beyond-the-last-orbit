import { Container, Graphics, type Texture } from 'pixi.js';
import { FIELD_H, FIELD_W, RHYTHM } from '../data/balance';
import type { SimState } from '../sim/types';
import { beatPulse } from './beatPulse';
import { PixelText } from './pixelText';

export type AppMode = 'title' | 'run';

const MULT_COLORS: readonly [number, number][] = [
  [4, 0xffe14a],
  [3, 0xff5ad1],
  [2, 0x4af2ff],
  [1.5, 0x7dff6b],
  [1, 0xffffff],
];

function multColor(mult: number): number {
  for (const [min, color] of MULT_COLORS) if (mult >= min) return color;
  return 0xffffff;
}

const RING_X = 104;
const MULT_X = 111;

export class Hud extends Container {
  private readonly score: PixelText;
  private readonly stage: PixelText;
  private readonly lives: PixelText;
  private readonly banner: PixelText;
  private readonly sub: PixelText;
  private readonly ring = new Graphics();
  private readonly mult: PixelText;

  constructor(glyphs: Map<string, Texture>) {
    super();
    this.score = new PixelText(glyphs);
    this.stage = new PixelText(glyphs);
    this.lives = new PixelText(glyphs, '', 0x4af2ff);
    this.banner = new PixelText(glyphs, '', 0xffe14a);
    this.banner.scale.set(2);
    this.sub = new PixelText(glyphs, '', 0xcccccc);
    this.mult = new PixelText(glyphs);
    this.score.position.set(4, 4);
    this.stage.y = 4;
    this.lives.position.set(4, FIELD_H - 9);
    this.ring.position.set(RING_X, 6);
    this.mult.position.set(MULT_X, 4);
    this.addChild(this.score, this.stage, this.lives, this.ring, this.mult, this.banner, this.sub);
  }

  update(state: SimState, mode: AppMode, paused: boolean, beat: number | null, audioOk: boolean): void {
    this.score.setText(`SCORE ${state.score}`);
    this.stage.setText(`STAGE ${state.stage}`);
    this.stage.x = FIELD_W - 4 - this.stage.pixelWidth;
    this.lives.setText(`SHIPS ${Math.max(0, state.player.lives)}`);
    this.updateRhythm(state, mode === 'run', beat, audioOk);

    let banner = '';
    let sub = '';
    if (mode === 'title') {
      banner = 'SPACE ALLIANCE';
      sub = 'PRESS FIRE TO START';
    } else if (paused) {
      banner = 'PAUSED';
      sub = 'PRESS P TO RESUME';
    } else if (state.phase === 'stageClear') {
      banner = 'STAGE CLEAR';
    } else if (state.phase === 'gameOver') {
      banner = 'GAME OVER';
      sub = 'PRESS FIRE';
    }
    this.banner.setText(banner);
    this.sub.setText(sub);
    this.banner.position.set(Math.round((FIELD_W - this.banner.pixelWidth) / 2), 140);
    this.sub.position.set(Math.round((FIELD_W - this.sub.pixelWidth) / 2), 160);
  }

  private updateRhythm(state: SimState, visible: boolean, beat: number | null, audioOk: boolean): void {
    this.ring.visible = visible && audioOk;
    this.mult.visible = visible;
    if (!visible) return;
    if (!audioOk) {
      this.mult.setText('NO AUDIO');
      this.mult.x = Math.round((FIELD_W - this.mult.pixelWidth) / 2);
      return;
    }
    const m = state.rhythm.mult;
    const color = multColor(m);
    this.mult.setText(`X${m.toFixed(1)}`);
    this.mult.x = MULT_X;
    this.mult.tint = color;
    const progress =
      m >= RHYTHM.maxMult ? 1 : (state.rhythm.streak % RHYTHM.shotsPerStep) / RHYTHM.shotsPerStep;
    this.ring.clear().circle(0, 0, 4).stroke({ color: 0x333a55, width: 1 });
    if (progress > 0) {
      this.ring.arc(0, 0, 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress).stroke({ color, width: 1 });
    }
    this.ring.scale.set(1 + 0.35 * beatPulse(beat));
  }
}
