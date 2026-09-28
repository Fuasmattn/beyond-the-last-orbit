import { Container } from 'pixi.js';
import { MENU_W } from '../data/balance';
import { formatHighscoreLine } from '../view/highscoreTable';
import { MenuList } from '../view/menuList';
import { centerText, PixelText } from '../view/pixelText';
import type { FrameInput, Scene, SceneContext } from './scene';
import { sceneBackground } from './ui';

const PAGE_TIME = 5;
const NOTICE_TIME = 3;
const TABLE_X = 82;
/** The rogue run is the main game; the pure beat run is a secondary mode. */
const ITEMS = ['START RUN', 'HANGAR', 'SHOP', 'BEAT RUN', 'SETTINGS'] as const;
const TABLES = [
  { mode: 'rogue', key: 'rogueHighscores', title: 'HIGH SCORES' },
  { mode: 'rhythm', key: 'highscores', title: 'BEAT RUN HIGH SCORES' },
] as const;

export class TitleScene implements Scene {
  readonly root = new Container();
  private readonly tagline: PixelText;
  private readonly notice: PixelText;
  private readonly credits: PixelText;
  private readonly tableHeader: PixelText;
  private readonly tableLayer = new Container();
  private tables: PixelText[][] = [];
  private tableTitles: string[] = [];
  private tablesVersion = -1;
  private readonly menu: MenuList;
  private readonly logo: PixelText[];
  private logoX = 0;
  private t = 0;

  constructor(private readonly ctx: SceneContext) {
    const g = ctx.textures.glyphs;
    // Chromatic-split neon logo: cyan and pink ghosts drift around a white core.
    this.logo = ([0x4af2ff, 0xff3d9a, 0xffffff] as const).map((color) => {
      const t = new PixelText(g, 'SPACE ALLIANCE', color);
      t.scale.set(3);
      centerText(t, 48);
      return t;
    });
    this.logoX = this.logo[2]!.x;
    this.tagline = new PixelText(g, 'DEFEND THE ORBIT. KEEP THE BEAT.', 0x4af2ff);
    centerText(this.tagline, 86);
    this.credits = new PixelText(g, '', 0x7dff6b);
    this.notice = new PixelText(g, ctx.notice ?? '', 0xff5a5a);
    centerText(this.notice, 296);
    this.tableHeader = new PixelText(g, '', 0xff5ad1);
    this.buildTables();
    this.menu = new MenuList(g, { x: 92, y: 212, lineH: 14, width: 64 });
    this.menu.setRows(ITEMS.map((label) => ({ label })));

    this.root.addChild(
      sceneBackground(),
      ...this.logo,
      this.tagline,
      this.tableHeader,
      this.tableLayer,
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
    const [cyan, pink] = this.logo;
    const split = 1 + Math.sin(this.t * 2.2) * 0.6;
    cyan!.x = this.logoX - split;
    pink!.x = this.logoX + split;
    cyan!.alpha = pink!.alpha = 0.75;
    if (this.ctx.leaderboard.version !== this.tablesVersion) this.buildTables();
    // Pages cycle: tagline, then each non-empty highscore table.
    const pages = [-1, ...TABLES.map((_, i) => i).filter((i) => this.tables[i]!.length > 0)];
    const page = pages[Math.floor(this.t / PAGE_TIME) % pages.length]!;
    this.tables.forEach((rows, i) => rows.forEach((t) => (t.visible = i === page)));
    this.tableHeader.visible = page >= 0;
    if (page >= 0) {
      this.tableHeader.setText(this.tableTitles[page]!);
      centerText(this.tableHeader, 104);
    }
    this.tagline.visible = page < 0;
    this.credits.setText(`CREDITS ${this.ctx.save.credits}`);
    this.credits.position.set(MENU_W - 4 - this.credits.pixelWidth, 4);
    this.menu.refresh(this.t);
    this.notice.visible = this.ctx.notice !== null && this.t < NOTICE_TIME;
    if (this.t >= NOTICE_TIME) this.ctx.notice = null;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }

  /** Global tables once loaded; until then (or offline) the local ones, marked LOCAL when a server is configured. */
  private buildTables(): void {
    const lb = this.ctx.leaderboard;
    this.tablesVersion = lb.version;
    this.tableLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.tables = [];
    this.tableTitles = [];
    for (const { mode, key, title } of TABLES) {
      const global = lb.top(mode);
      this.tableTitles.push(global || !lb.enabled ? title : `LOCAL ${title}`);
      const rows = (global ?? this.ctx.save[key]).map((e, i) => {
        const t = new PixelText(this.ctx.textures.glyphs, formatHighscoreLine(i + 1, e), i === 0 ? 0xffe14a : 0xcccccc);
        t.position.set(TABLE_X, 118 + i * 9);
        return t;
      });
      if (rows.length > 0) this.tableLayer.addChild(...rows);
      this.tables.push(rows);
    }
  }

  private activate(i: number): void {
    this.ctx.audio?.sfx.menuSelect();
    const s = this.ctx.scenes;
    const next = [() => s.run('rogue'), () => s.hangar(), () => s.shop(), () => s.run('rhythm'), () => s.settings()];
    this.ctx.goto(next[i]!());
  }
}
