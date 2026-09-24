import { Container, type Texture } from 'pixi.js';
import { FIELD_H, FIELD_W } from '../data/balance';
import type { SimState } from '../sim/types';
import { PixelText } from './pixelText';

export type AppMode = 'title' | 'run';

export class Hud extends Container {
  private readonly score: PixelText;
  private readonly stage: PixelText;
  private readonly lives: PixelText;
  private readonly banner: PixelText;
  private readonly sub: PixelText;

  constructor(glyphs: Map<string, Texture>) {
    super();
    this.score = new PixelText(glyphs);
    this.stage = new PixelText(glyphs);
    this.lives = new PixelText(glyphs, '', 0x4af2ff);
    this.banner = new PixelText(glyphs, '', 0xffe14a);
    this.banner.scale.set(2);
    this.sub = new PixelText(glyphs, '', 0xcccccc);
    this.score.position.set(4, 4);
    this.stage.y = 4;
    this.lives.position.set(4, FIELD_H - 9);
    this.addChild(this.score, this.stage, this.lives, this.banner, this.sub);
  }

  update(state: SimState, mode: AppMode, paused: boolean): void {
    this.score.setText(`SCORE ${state.score}`);
    this.stage.setText(`STAGE ${state.stage}`);
    this.stage.x = FIELD_W - 4 - this.stage.pixelWidth;
    this.lives.setText(`SHIPS ${Math.max(0, state.player.lives)}`);

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
}
