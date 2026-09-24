import { Container, Sprite, Texture } from 'pixi.js';
import { FIELD_H, FIELD_W } from '../data/balance';
import { blink } from '../view/anim';
import { formatHighscoreLine } from '../view/highscoreTable';
import { centerText, PixelText } from '../view/pixelText';
import { Starfield } from '../view/starfield';
import type { FrameInput, Scene, SceneContext } from './scene';

const PAGE_TIME = 5;
const NOTICE_TIME = 3;
const TABLE_X = 82;

export class TitleScene implements Scene {
  readonly root = new Container();
  private readonly starfield = new Starfield();
  private readonly tagline: PixelText;
  private readonly prompt: PixelText;
  private readonly notice: PixelText;
  private readonly tableHeader: PixelText;
  private readonly table: PixelText[] = [];
  private t = 0;

  constructor(private readonly ctx: SceneContext) {
    const g = ctx.textures.glyphs;
    const bg = new Sprite(Texture.WHITE);
    bg.width = FIELD_W;
    bg.height = FIELD_H;
    bg.tint = 0x05060d;

    const logo = new PixelText(g, 'SPACE ALLIANCE', 0xffe14a);
    logo.scale.set(2);
    centerText(logo, 70);
    this.tagline = new PixelText(g, 'DEFEND THE ORBIT. KEEP THE BEAT.', 0x4af2ff);
    centerText(this.tagline, 96);
    this.prompt = new PixelText(g, ctx.isTouch ? 'TAP TO START' : 'PRESS FIRE TO START');
    centerText(this.prompt, 250);
    this.notice = new PixelText(g, ctx.notice ?? '', 0xff5a5a);
    centerText(this.notice, 280);
    this.tableHeader = new PixelText(g, 'HIGH SCORES', 0xff5ad1);
    centerText(this.tableHeader, 120);
    ctx.save.highscores.forEach((e, i) => {
      const t = new PixelText(g, formatHighscoreLine(i + 1, e), i === 0 ? 0xffe14a : 0xcccccc);
      t.position.set(TABLE_X, 134 + i * 9);
      this.table.push(t);
    });

    this.root.addChild(bg, this.starfield, logo, this.tagline, this.tableHeader, ...this.table, this.prompt, this.notice);
  }

  update(input: FrameInput, dt: number): void {
    this.t += dt;
    if (input.menu.includes('confirm') || input.taps.length > 0) this.ctx.goto(this.ctx.scenes.run());
  }

  render(elapsed: number): void {
    this.starfield.update(elapsed);
    const showTable = this.table.length > 0 && Math.floor(this.t / PAGE_TIME) % 2 === 1;
    this.tableHeader.visible = showTable;
    for (const t of this.table) t.visible = showTable;
    this.tagline.visible = !showTable;
    this.prompt.visible = blink(this.t, 1);
    this.notice.visible = this.ctx.notice !== null && this.t < NOTICE_TIME;
    if (this.t >= NOTICE_TIME) this.ctx.notice = null;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
