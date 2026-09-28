import { Container, Graphics } from 'pixi.js';
import { viewport } from '../app/viewport';
import { INITIALS_LENGTH, InitialsPicker } from '../app/initialsPicker';
import type { Tap } from '../input/inputFrame';
import { findEntry } from '../leaderboard/leaderboard';
import { computeCredits } from '../meta/credits';
import { creditMultiplier } from '../meta/upgrades';
import { insertHighscore, qualifiesForHighscore } from '../persist/save';
import type { HighscoreEntry } from '../persist/schema';
import { blink } from '../view/anim';
import { formatHighscoreLine, highscoreTableX } from '../view/highscoreTable';
import { centerText, PixelText } from '../view/pixelText';
import type { FrameInput, RunSummary, Scene, SceneContext } from './scene';
import { centerX, inRect, sceneBackground, type Rect } from './ui';

const LETTER_SCALE = 3;
const LETTER_Y = 130;
const LETTER_H = 15;
const LETTER_SPACING = 24;
const OK_BOX = { y: 172, w: 32, h: 12 } as const;
const CONTINUE_DELAY = 0.5;
/** Ignore input briefly so fire-mashing at death doesn't skip letters. */
const INPUT_DELAY = 0.4;
const COUNT_UP_TIME = 1.5;
const COIN_TICK = 0.07;

function letterLeft(i: number): number {
  return Math.round(viewport.menuW / 2 + (i - 1) * LETTER_SPACING - 4.5);
}

export class GameOverScene implements Scene {
  readonly root = new Container();
  private readonly glyphs;
  private readonly picker: InitialsPicker | null;
  private readonly letters: PixelText[] = [];
  private readonly cursor = new Graphics();
  private readonly ok: PixelText;
  private readonly okBox = new Graphics();
  private readonly okRect: Rect = { ...OK_BOX, x: centerX(OK_BOX.w) };
  private readonly help: PixelText;
  private readonly heading: PixelText;
  private readonly prompt: PixelText;
  private readonly creditsLine: PixelText;
  private readonly status: PixelText;
  private readonly tableLayer = new Container();
  private readonly earned: number;
  private t = 0;
  private coinTimer = 0;
  private destroyed = false;

  constructor(
    private readonly ctx: SceneContext,
    private readonly summary: RunSummary,
  ) {
    const g = (this.glyphs = ctx.textures.glyphs);
    this.earned = Math.round(
      computeCredits(summary.score, summary.bossesKilled, summary.perfectStages) * creditMultiplier(ctx.save),
    );
    ctx.save.credits += this.earned;
    ctx.persist();

    const title = new PixelText(g, 'GAME OVER', 0xff3b5c);
    title.scale.set(2);
    centerText(title, 30);
    const score = new PixelText(g, `SCORE ${summary.score}`, 0xffe14a);
    centerText(score, 58);
    const loop = summary.loop > 0 ? `LOOP ${summary.loop + 1} ` : '';
    const reached = new PixelText(g, `REACHED ${loop}${summary.world + 1}-${summary.stage}`, 0xcccccc);
    centerText(reached, 70);
    this.creditsLine = new PixelText(g, '', 0x7dff6b);

    const global = this.globalTable;
    const qualifies =
      qualifiesForHighscore(this.table, summary.score) ||
      (global !== null && qualifiesForHighscore(global, summary.score));
    this.picker = qualifies ? new InitialsPicker() : null;
    this.heading = new PixelText(g, 'NEW HIGH SCORE! ENTER NAME', 0x7dff6b);
    centerText(this.heading, 108);
    for (let i = 0; i < INITIALS_LENGTH; i++) {
      const t = new PixelText(g, 'A');
      t.scale.set(LETTER_SCALE);
      t.position.set(letterLeft(i), LETTER_Y);
      this.letters.push(t);
    }
    this.ok = new PixelText(g, 'OK', 0x7dff6b);
    const ok = this.okRect;
    this.ok.position.set(ok.x + 13, ok.y + 4);
    this.okBox.rect(ok.x, ok.y, ok.w, ok.h).stroke({ color: 0x7dff6b, width: 1 });
    this.help = new PixelText(g, ctx.isTouch ? 'TAP TOP OR BOTTOM OF A LETTER' : 'UP/DOWN CHANGE  FIRE NEXT', 0x888888);
    centerText(this.help, 196);
    this.status = new PixelText(g, '', 0xff5a5a);
    this.prompt = new PixelText(g, ctx.isTouch ? 'TAP TO CONTINUE' : 'PRESS FIRE TO CONTINUE');
    centerText(this.prompt, 290);

    this.root.addChild(
      sceneBackground(),
      title,
      score,
      reached,
      this.creditsLine,
      this.heading,
      ...this.letters,
      this.cursor,
      this.okBox,
      this.ok,
      this.help,
      this.tableLayer,
      this.status,
      this.prompt,
    );
    if (!this.picker) this.showBestTable();
    this.refresh();
  }

  update(input: FrameInput, dt: number): void {
    this.t += dt;
    this.tickCoins(dt);
    if (this.t < INPUT_DELAY) return;
    const p = this.picker;
    if (p && !p.done) {
      for (const a of input.menu) {
        if (a === 'up') p.up();
        else if (a === 'down') p.down();
        else if (a === 'confirm' || a === 'right') p.confirm();
        else if (a === 'back' || a === 'left') p.back();
      }
      for (const tap of input.taps) this.handleTap(p, tap);
      if (p.done) this.submit(p);
      return;
    }
    if (this.t > CONTINUE_DELAY && (input.menu.includes('confirm') || input.taps.length > 0)) {
      this.ctx.goto(this.ctx.scenes.title());
    }
  }

  render(): void {
    this.refresh();
  }

  destroy(): void {
    this.destroyed = true;
    this.root.destroy({ children: true });
  }

  private get daily(): boolean {
    return this.summary.board !== 'rogue';
  }

  private get tableTitle(): string {
    return this.daily ? 'DAILY HIGH SCORES' : 'HIGH SCORES';
  }

  /** The shared global table, or null when disabled or not loaded. */
  private get globalTable(): readonly HighscoreEntry[] | null {
    return this.ctx.leaderboard.top(this.summary.board);
  }

  /** Local fallback: the main table, or today's daily results. */
  private get table(): HighscoreEntry[] {
    if (!this.daily) return this.ctx.save.rogueHighscores;
    const day = this.summary.board.slice('daily:'.length);
    return this.ctx.save.dailyHighscores.filter((e) => e.date === day);
  }

  private set table(list: HighscoreEntry[]) {
    if (this.daily) this.ctx.save.dailyHighscores = list;
    else this.ctx.save.rogueHighscores = list;
  }

  /** Credits count up from 0 with a coin tick. */
  private tickCoins(dt: number): void {
    const shown = Math.floor(this.earned * Math.min(1, this.t / COUNT_UP_TIME));
    this.creditsLine.setText(`CREDITS +${shown}  TOTAL ${this.ctx.save.credits - this.earned + shown}`);
    centerText(this.creditsLine, 84);
    if (shown >= this.earned) return;
    this.coinTimer -= dt;
    if (this.coinTimer <= 0) {
      this.coinTimer = COIN_TICK;
      this.ctx.audio?.sfx.coin();
    }
  }

  private handleTap(p: InitialsPicker, tap: Tap): void {
    if (inRect(tap, this.okRect)) {
      p.finish();
      return;
    }
    for (let i = 0; i < INITIALS_LENGTH; i++) {
      const cx = letterLeft(i) + 4.5;
      if (Math.abs(tap.x - cx) > 10 || tap.y < LETTER_Y - 12 || tap.y > LETTER_Y + LETTER_H + 12) continue;
      p.select(i);
      if (tap.y < LETTER_Y + LETTER_H / 2) p.up();
      else p.down();
    }
  }

  private submit(p: InitialsPicker): void {
    const entry: HighscoreEntry = {
      initials: p.text,
      score: this.summary.score,
      world: this.summary.world,
      stage: this.summary.stage,
      loop: this.summary.loop,
      date: new Date().toISOString().slice(0, 10),
    };
    this.table = insertHighscore(this.table, entry);
    this.ctx.persist();
    const lb = this.ctx.leaderboard;
    const global = this.globalTable;
    if (!lb.enabled || (global !== null && !qualifiesForHighscore(global, entry.score))) {
      this.showLocalTable(entry);
      return;
    }
    this.setHeading('SENDING SCORE...');
    this.tableLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    void lb.submit(this.summary.board, entry).then((ok) => {
      if (this.destroyed) return;
      const fresh = this.globalTable;
      if (ok && fresh) {
        this.setHeading(this.tableTitle);
        this.showTable(fresh, entry);
      } else {
        this.showLocalTable(entry);
        this.status.setText('COULD NOT REACH SERVER');
        centerText(this.status, 220);
      }
    });
  }

  /** No new entry: the global table when loaded, else the local one. */
  private showBestTable(): void {
    const global = this.globalTable;
    if (global) {
      this.setHeading(this.tableTitle);
      this.showTable(global, null);
    } else this.showLocalTable(null);
  }

  private showLocalTable(highlight: HighscoreEntry | null): void {
    this.setHeading(this.ctx.leaderboard.enabled ? `LOCAL ${this.tableTitle}` : this.tableTitle);
    this.showTable(this.table, highlight);
  }

  private setHeading(text: string): void {
    this.heading.setText(text);
    centerText(this.heading, 108);
  }

  private showTable(list: readonly HighscoreEntry[], highlight: HighscoreEntry | null): void {
    this.tableLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    const mine = highlight ? findEntry(list, highlight) : -1;
    list.forEach((e, i) => {
      const color = i === mine ? 0xffe14a : 0xcccccc;
      const t = new PixelText(this.glyphs, formatHighscoreLine(i + 1, e), color);
      t.position.set(highscoreTableX(), 122 + i * 9);
      this.tableLayer.addChild(t);
    });
  }

  private refresh(): void {
    const p = this.picker;
    const editing = p !== null && !p.done;
    for (const [i, t] of this.letters.entries()) {
      t.visible = editing;
      if (p) {
        t.setText(p.charAt(i));
        t.tint = i === p.index ? 0xffe14a : 0xffffff;
      }
    }
    this.cursor.clear();
    if (editing && p) {
      const x = letterLeft(p.index);
      const top = LETTER_Y - 4;
      const bottom = LETTER_Y + LETTER_H + 4;
      this.cursor
        .poly([x + 4.5, top - 5, x, top, x + 9, top])
        .fill(0xffe14a)
        .poly([x + 4.5, bottom + 5, x, bottom, x + 9, bottom])
        .fill(0xffe14a);
    }
    this.ok.visible = editing;
    this.okBox.visible = editing;
    this.help.visible = editing;
    this.tableLayer.visible = !editing;
    this.status.visible = !editing;
    this.prompt.visible = !editing && blink(this.t, 1);
  }
}
