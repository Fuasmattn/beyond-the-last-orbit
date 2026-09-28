import { Container } from 'pixi.js';
import { viewport } from '../app/viewport';
import type { Board } from '../leaderboard/leaderboard';
import { dailyBoard, dailyPlayed, dayKey } from '../meta/daily';
import { formatHighscoreLine, highscoreTableX } from '../view/highscoreTable';
import type { HighscoreEntry } from '../persist/schema';
import { MenuList } from '../view/menuList';
import { centerText, PixelText } from '../view/pixelText';
import type { FrameInput, Scene, SceneContext } from './scene';
import { centerX, sceneBackground } from './ui';

const PAGE_TIME = 5;
const NOTICE_TIME = 3;
/** Main menu, centered in the frame together with its cursor (8px left of the labels). */
const MENU = { y: 212, lineH: 14, width: 64 } as const;
const ITEMS = ['START RUN', 'DAILY RUN', 'HANGAR', 'SHOP', 'SETTINGS'] as const;
const DAILY_ITEM = 1;
/** Menu rows are 14px apart; five rows still clear the tables above and the notice below. */

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
  private readonly day = dayKey();
  /** Set when DAILY RUN was picked after today's attempt: the table page jumps to the daily board. */
  private showDaily = false;
  private readonly menu: MenuList;
  private readonly logo: Container[];
  private logoX = 0;
  private t = 0;

  constructor(private readonly ctx: SceneContext) {
    const g = ctx.textures.glyphs;
    // Chromatic-split neon logo: cyan and pink ghosts drift around a white core.
    // Two lines: the full title is too wide for the menu frame at the logo scale.
    this.logo = ([0x4af2ff, 0xff3d9a, 0xffffff] as const).map((color) => {
      const top = new PixelText(g, 'BEYOND THE', color);
      top.scale.set(2);
      centerText(top, 34);
      const bottom = new PixelText(g, 'LAST ORBIT', color);
      bottom.scale.set(3);
      centerText(bottom, 48);
      const logo = new Container();
      logo.addChild(top, bottom);
      return logo;
    });
    this.tagline = new PixelText(g, 'DEFEND THE ORBIT. KEEP THE BEAT.', 0x4af2ff);
    centerText(this.tagline, 86);
    this.credits = new PixelText(g, '', 0x7dff6b);
    this.notice = new PixelText(g, ctx.notice ?? '', 0xff5a5a);
    centerText(this.notice, 296);
    this.tableHeader = new PixelText(g, '', 0xff5ad1);
    this.buildTables();
    this.menu = new MenuList(g, { ...MENU, x: centerX(MENU.width) + 4 });
    this.refreshMenu();

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
    // Pages cycle: tagline, then each non-empty highscore table (or the daily board when asked for).
    const pages = [-1, ...this.tableBoards().map((_, i) => i).filter((i) => this.tables[i]!.length > 0)];
    const page = this.showDaily ? 1 : pages[Math.floor(this.t / PAGE_TIME) % pages.length]!;
    this.tables.forEach((rows, i) => rows.forEach((t) => (t.visible = i === page)));
    this.tableHeader.visible = page >= 0;
    if (page >= 0) {
      const empty = this.tables[page]!.length === 0;
      this.tableHeader.setText(empty ? `${this.tableTitles[page]!} - NONE YET` : this.tableTitles[page]!);
      centerText(this.tableHeader, 104);
    }
    this.tagline.visible = page < 0;
    this.credits.setText(`CREDITS ${this.ctx.save.credits}`);
    this.credits.position.set(viewport.menuW - 4 - this.credits.pixelWidth, 4);
    this.menu.refresh(this.t);
    this.notice.visible = this.ctx.notice !== null && this.t < NOTICE_TIME;
    if (this.t >= NOTICE_TIME) this.ctx.notice = null;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }

  private tableBoards(): { board: Board; local: () => HighscoreEntry[]; title: string }[] {
    const save = this.ctx.save;
    return [
      { board: 'rogue', local: () => save.rogueHighscores, title: 'HIGH SCORES' },
      { board: dailyBoard(this.day), local: () => save.dailyHighscores.filter((e) => e.date === this.day), title: 'DAILY HIGH SCORES' },
    ];
  }

  private refreshMenu(): void {
    this.menu.setRows(ITEMS.map((label, i) => (i === DAILY_ITEM && dailyPlayed(this.ctx.save, this.day) ? { label, value: 'DONE' } : { label })));
  }

  /** Global tables once loaded; until then (or offline) the local ones, marked LOCAL when a server is configured. */
  private buildTables(): void {
    const lb = this.ctx.leaderboard;
    this.tablesVersion = lb.version;
    this.tableLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.tables = [];
    this.tableTitles = [];
    for (const { board, local, title } of this.tableBoards()) {
      const global = lb.top(board);
      this.tableTitles.push(global || !lb.enabled ? title : `LOCAL ${title}`);
      const rows = (global ?? local()).map((e, i) => {
        const t = new PixelText(this.ctx.textures.glyphs, formatHighscoreLine(i + 1, e), i === 0 ? 0xffe14a : 0xcccccc);
        t.position.set(highscoreTableX(), 118 + i * 9);
        return t;
      });
      if (rows.length > 0) this.tableLayer.addChild(...rows);
      this.tables.push(rows);
    }
  }

  private activate(i: number): void {
    this.ctx.audio?.sfx.menuSelect();
    const s = this.ctx.scenes;
    if (i === DAILY_ITEM && dailyPlayed(this.ctx.save, this.day)) {
      // Already played today: show today's board instead.
      this.showDaily = true;
      return;
    }
    const next = [() => s.run('rogue'), () => s.run('daily'), () => s.hangar(), () => s.shop(), () => s.settings()];
    this.ctx.goto(next[i]!());
  }
}
