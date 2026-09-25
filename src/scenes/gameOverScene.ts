import { Container, Graphics } from 'pixi.js';
import { MENU_W } from '../data/balance';
import { INITIALS_LENGTH, InitialsPicker } from '../app/initialsPicker';
import type { Tap } from '../input/inputFrame';
import { computeCredits } from '../meta/credits';
import { insertHighscore, qualifiesForHighscore } from '../persist/save';
import type { HighscoreEntry } from '../persist/schema';
import { blink } from '../view/anim';
import { formatHighscoreLine } from '../view/highscoreTable';
import { centerText, PixelText } from '../view/pixelText';
import type { FrameInput, RunSummary, Scene, SceneContext } from './scene';
import { sceneBackground } from './ui';

const LETTER_SCALE = 3;
const LETTER_Y = 130;
const LETTER_H = 15;
const LETTER_SPACING = 24;
const OK_BOX = { x: 104, y: 172, w: 32, h: 12 } as const;
const TABLE_X = 82;
const CONTINUE_DELAY = 0.5;
/** Ignore input briefly so fire-mashing at death doesn't skip letters. */
const INPUT_DELAY = 0.4;
const COUNT_UP_TIME = 1.5;
const COIN_TICK = 0.07;

function letterLeft(i: number): number {
  return Math.round(MENU_W / 2 + (i - 1) * LETTER_SPACING - 4.5);
}

export class GameOverScene implements Scene {
  readonly root = new Container();
  private readonly glyphs;
  private readonly picker: InitialsPicker | null;
  private readonly letters: PixelText[] = [];
  private readonly cursor = new Graphics();
  private readonly ok: PixelText;
  private readonly okBox = new Graphics();
  private readonly help: PixelText;
  private readonly heading: PixelText;
  private readonly prompt: PixelText;
  private readonly creditsLine: PixelText;
  private readonly tableLayer = new Container();
  private readonly earned: number;
  private t = 0;
  private coinTimer = 0;

  constructor(
    private readonly ctx: SceneContext,
    private readonly summary: RunSummary,
  ) {
    const g = (this.glyphs = ctx.textures.glyphs);
    this.earned = computeCredits(summary.score, summary.bossesKilled, summary.perfectStages);
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

    this.picker = qualifiesForHighscore(ctx.save.highscores, summary.score) ? new InitialsPicker() : null;
    this.heading = new PixelText(g, this.picker ? 'NEW HIGH SCORE! ENTER NAME' : 'HIGH SCORES', 0x7dff6b);
    centerText(this.heading, 108);
    for (let i = 0; i < INITIALS_LENGTH; i++) {
      const t = new PixelText(g, 'A');
      t.scale.set(LETTER_SCALE);
      t.position.set(letterLeft(i), LETTER_Y);
      this.letters.push(t);
    }
    this.ok = new PixelText(g, 'OK', 0x7dff6b);
    this.ok.position.set(OK_BOX.x + 13, OK_BOX.y + 4);
    this.okBox.rect(OK_BOX.x, OK_BOX.y, OK_BOX.w, OK_BOX.h).stroke({ color: 0x7dff6b, width: 1 });
    this.help = new PixelText(g, ctx.isTouch ? 'TAP TOP OR BOTTOM OF A LETTER' : 'UP/DOWN CHANGE  FIRE NEXT', 0x888888);
    centerText(this.help, 196);
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
      this.prompt,
    );
    if (!this.picker) this.showTable(null);
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
    this.root.destroy({ children: true });
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
    if (tap.x >= OK_BOX.x && tap.x <= OK_BOX.x + OK_BOX.w && tap.y >= OK_BOX.y && tap.y <= OK_BOX.y + OK_BOX.h) {
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
    this.ctx.save.highscores = insertHighscore(this.ctx.save.highscores, entry);
    this.ctx.persist();
    this.heading.setText('HIGH SCORES');
    centerText(this.heading, 108);
    this.showTable(entry);
  }

  private showTable(highlight: HighscoreEntry | null): void {
    this.tableLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.ctx.save.highscores.forEach((e, i) => {
      const color = e === highlight ? 0xffe14a : 0xcccccc;
      const t = new PixelText(this.glyphs, formatHighscoreLine(i + 1, e), color);
      t.position.set(TABLE_X, 122 + i * 9);
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
    this.prompt.visible = !editing && blink(this.t, 1);
  }
}
