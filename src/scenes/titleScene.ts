import { Container } from 'pixi.js';
import { FIELD_W } from '../data/balance';
import { formatHighscoreLine } from '../view/highscoreTable';
import { MenuList } from '../view/menuList';
import { centerText, PixelText } from '../view/pixelText';
import { Starfield } from '../view/starfield';
import type { FrameInput, Scene, SceneContext } from './scene';
import { sceneBackground } from './ui';

const PAGE_TIME = 5;
const NOTICE_TIME = 3;
const TABLE_X = 82;
const ITEMS = ['START GAME', 'SHOP', 'SETTINGS'] as const;

export class TitleScene implements Scene {
  readonly root = new Container();
  private readonly starfield = new Starfield();
  private readonly tagline: PixelText;
  private readonly notice: PixelText;
  private readonly credits: PixelText;
  private readonly tableHeader: PixelText;
  private readonly table: PixelText[] = [];
  private readonly menu: MenuList;
  private t = 0;

  constructor(private readonly ctx: SceneContext) {
    const g = ctx.textures.glyphs;
    const logo = new PixelText(g, 'SPACE ALLIANCE', 0xffe14a);
    logo.scale.set(2);
    centerText(logo, 60);
    this.tagline = new PixelText(g, 'DEFEND THE ORBIT. KEEP THE BEAT.', 0x4af2ff);
    centerText(this.tagline, 86);
    this.credits = new PixelText(g, '', 0x7dff6b);
    this.notice = new PixelText(g, ctx.notice ?? '', 0xff5a5a);
    centerText(this.notice, 296);
    this.tableHeader = new PixelText(g, 'HIGH SCORES', 0xff5ad1);
    centerText(this.tableHeader, 104);
    ctx.save.highscores.forEach((e, i) => {
      const t = new PixelText(g, formatHighscoreLine(i + 1, e), i === 0 ? 0xffe14a : 0xcccccc);
      t.position.set(TABLE_X, 118 + i * 9);
      this.table.push(t);
    });
    this.menu = new MenuList(g, { x: 92, y: 228, lineH: 14, width: 64 });
    this.menu.setRows(ITEMS.map((label) => ({ label })));

    this.root.addChild(
      sceneBackground(),
      this.starfield,
      logo,
      this.tagline,
      this.tableHeader,
      ...this.table,
      this.menu,
      this.credits,
      this.notice,
    );
  }

  update(input: FrameInput, dt: number): void {
    this.t += dt;
    for (const a of input.menu) {
      if (a === 'up' || a === 'down') {
        this.menu.move(a === 'up' ? -1 : 1);
        this.ctx.audio?.sfx.menuMove();
      } else if (a === 'confirm') {
        this.activate(this.menu.selected);
        return;
      }
    }
    for (const tap of input.taps) {
      const i = this.menu.indexAt(tap);
      if (i !== null) {
        this.menu.selected = i;
        this.activate(i);
        return;
      }
    }
  }

  render(elapsed: number): void {
    this.starfield.update(elapsed);
    const showTable = this.table.length > 0 && Math.floor(this.t / PAGE_TIME) % 2 === 1;
    this.tableHeader.visible = showTable;
    for (const t of this.table) t.visible = showTable;
    this.tagline.visible = !showTable;
    this.credits.setText(`CREDITS ${this.ctx.save.credits}`);
    this.credits.position.set(FIELD_W - 4 - this.credits.pixelWidth, 4);
    this.menu.refresh(this.t);
    this.notice.visible = this.ctx.notice !== null && this.t < NOTICE_TIME;
    if (this.t >= NOTICE_TIME) this.ctx.notice = null;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }

  private activate(i: number): void {
    this.ctx.audio?.sfx.menuSelect();
    const s = this.ctx.scenes;
    this.ctx.goto(i === 0 ? s.run() : i === 1 ? s.shop() : s.settings());
  }
}
