import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { STAGE } from '../data/balance';
import { worldAt } from '../data/worlds';
import { boonDef, RARITY_COLOR } from '../sim/boons';
import type { BoonId, SimEvent, SimState } from '../sim/types';
import { viewport } from '../app/viewport';
import type { JudgeLabel } from './beatJudge';
import { BeatTrack } from './beatTrack';
import { textWidth } from '../data/font';
import { centerText, PixelText } from './pixelText';

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

const RESULT_LINES = 5;
const RESULT_LINE_DELAY = 0.25;
const POPUP_TIME = 1.5;
/** Boss health: a thin line along the top edge, clear of the text rows on any width. */
const BOSS_BAR = { h: 2 } as const;
/** HUD text rows are this far apart (× text scale) for the 7 px font. */
const ROW = 10;
/** Build strip: owned boon pictograms under SCRAP, 1× icons with 2 px stack pips below. */
const STRIP = { advance: 11, h: 12 } as const;
const RESULTS_W = 96;
const MARGIN = 4;
/** Touch pause button, top-left: hit area in logical px (generous for thumbs) and the drawn icon. */
const PAUSE_HIT = { w: 30, h: 26 } as const;
const PAUSE_ICON = { w: 6, h: 7, bar: 2 } as const;

export function inPauseButton(t: { x: number; y: number }): boolean {
  return t.x >= 0 && t.x <= PAUSE_HIT.w && t.y >= 0 && t.y <= PAUSE_HIT.h;
}

/** Sets `t` to `scale`, shrunk (not below 1) so it fits `width` with margins; then centers it at `y`. */
function fitCenter(t: PixelText, scale: number, y: number, width: number): void {
  const w = textWidth(t.text);
  t.scale.set(w > 0 ? Math.max(1, Math.min(scale, (width - MARGIN * 2) / w)) : scale);
  centerText(t, Math.round(y), width);
}

export class Hud extends Container {
  private readonly score: PixelText;
  private readonly stage: PixelText;
  private readonly lives: PixelText;
  private readonly scrap: PixelText;
  private readonly track: BeatTrack;
  private readonly noAudio: PixelText;
  private readonly banner: PixelText;
  private readonly sub: PixelText;
  private readonly popup: PixelText;
  private readonly results: PixelText[] = [];
  private readonly bossBar = new Graphics();
  private readonly pauseIcon = new Graphics();
  private readonly strip = new Container();
  private readonly stripPips = new Graphics();
  private readonly stripIcons: Sprite[] = [];
  private readonly stripLeft: number;
  private popupTime = 0;

  /**
   * `textScale` enlarges the text (touch screens); layout rows grow with it.
   * `pauseButton` shows a tappable pause icon top-left (touch has no pause key); score and ships move right.
   */
  constructor(
    glyphs: Map<string, Texture>,
    private readonly iconTex: Map<BoonId, Texture>,
    private readonly textScale = 1,
    pauseButton = false,
  ) {
    super();
    const k = textScale;
    this.score = new PixelText(glyphs);
    this.stage = new PixelText(glyphs);
    this.lives = new PixelText(glyphs, '', 0x4af2ff);
    this.scrap = new PixelText(glyphs, '', 0xffb347);
    this.track = new BeatTrack(glyphs);
    this.noAudio = new PixelText(glyphs, 'NO AUDIO', 0x777777);
    this.banner = new PixelText(glyphs, '', 0xffe14a);
    this.banner.scale.set(2);
    this.sub = new PixelText(glyphs, '', 0xcccccc);
    this.popup = new PixelText(glyphs, '', 0x7dff6b);
    for (let i = 0; i < RESULT_LINES; i++) {
      const t = new PixelText(glyphs, '', i === RESULT_LINES - 1 ? 0xffe14a : 0xcccccc);
      t.scale.set(k);
      // Starts below the stage-clear sub line, which moves down with the text scale.
      t.y = Math.round(140 + 24 * (k - 1) + i * ROW * k);
      this.results.push(t);
    }
    for (const t of [this.score, this.stage, this.lives, this.scrap, this.noAudio]) t.scale.set(k);
    this.pauseIcon.visible = pauseButton;
    this.pauseIcon
      .rect(0, 0, PAUSE_ICON.bar, PAUSE_ICON.h)
      .rect(PAUSE_ICON.w - PAUSE_ICON.bar, 0, PAUSE_ICON.bar, PAUSE_ICON.h)
      .fill({ color: 0xffffff, alpha: 0.7 });
    this.pauseIcon.scale.set(k);
    this.pauseIcon.position.set(MARGIN, MARGIN);
    const left = pauseButton ? Math.round(MARGIN + PAUSE_ICON.w * k + 5) : MARGIN;
    this.score.position.set(left, MARGIN);
    this.stage.y = MARGIN;
    this.lives.position.set(left, Math.round(MARGIN + ROW * k));
    this.scrap.position.set(left, Math.round(MARGIN + ROW * 2 * k));
    this.noAudio.y = Math.round(MARGIN + ROW * 3 * k);
    this.stripLeft = left;
    this.strip.position.set(left, Math.round(MARGIN + ROW * 3 * k + 2));
    this.strip.scale.set(k);
    this.strip.addChild(this.stripPips);
    this.addChild(
      this.track,
      this.pauseIcon,
      this.score,
      this.stage,
      this.lives,
      this.scrap,
      this.noAudio,
      this.strip,
      this.bossBar,
      this.banner,
      this.sub,
      ...this.results,
      this.popup,
    );
  }

  /** Grades the latest shot on the beat track. */
  judge(label: JudgeLabel): void {
    this.track.judge(label);
  }

  /** Short centered callout (upgrade taken, extra ship, multiplier step). */
  say(text: string): void {
    this.popup.setText(text);
    this.popupTime = POPUP_TIME;
  }

  notify(events: readonly SimEvent[]): void {
    for (const e of events) {
      const text =
        e.type === 'extraLife'
          ? 'EXTRA SHIP!'
          : e.type === 'repaired'
            ? 'REPAIRED!'
            : e.type === 'revived'
              ? 'SECOND WIND!'
              : e.type === 'eventResolved'
                ? e.text
            : e.type === 'boonTaken' && e.id
              ? `${boonDef(e.id).name}!`
              : null;
      if (text) this.say(text);
    }
  }

  update(state: SimState, paused: boolean, beat: number | null, audioOk: boolean, dt: number): void {
    this.score.setText(`SCORE ${state.score}`);
    const label = `${state.world + 1}-${state.stage}`;
    // Enlarged touch text: "SCORE 12345" and "STAGE 1-1" no longer share the top row of a phone view.
    const compact = this.textScale > 1;
    this.stage.setText(state.loop > 0 ? `L${state.loop + 1} ${label}` : compact ? label : `STAGE ${label}`);
    this.stage.x = Math.round(viewport.w - MARGIN - this.stage.pixelWidth);
    const rhythm = state.beatMode !== 'off';
    const master = state.beatMode === 'master';
    this.track.update(viewport.w, audioOk ? beat : null, state.rhythm.mult, state.rhythm.streak, dt, rhythm, master);
    const shield = state.player.shield > 0 ? `  SHIELD ${state.player.shield}` : '';
    this.lives.setText(`SHIPS ${Math.max(0, state.player.lives)}${shield}`);
    this.scrap.setText(`SCRAP ${state.rogue.scrap}`);
    this.noAudio.visible = !audioOk && rhythm;
    centerText(this.noAudio, 4, viewport.w);
    this.updateStrip(state);
    this.updateBossBar(state);
    this.updateBanner(state, paused);
    this.updateResults(state, paused);
    this.popupTime = Math.max(0, this.popupTime - dt);
    this.popup.visible = this.popupTime > 0;
    fitCenter(this.popup, this.textScale, 200, viewport.w);
  }

  private updateBossBar(state: SimState): void {
    const b = state.boss;
    this.bossBar.visible = b !== null && !b.entering && b.dying === 0;
    if (!b || !this.bossBar.visible) return;
    const ratio = Math.max(0, b.hp / b.maxHp);
    const w = viewport.w;
    this.bossBar
      .clear()
      .rect(0, 0, w, BOSS_BAR.h)
      .fill(0x331018)
      .rect(0, 0, w * ratio, BOSS_BAR.h)
      .fill(b.phased ? 0x8a7fb5 : 0xff3b5c);
  }

  /**
   * Owned boons as pictograms in pick order, wrapping before the middle of the screen; pips mark stacks.
   * Hidden under the route, draft, shop and event overlays, whose titles sit where the strip would be.
   */
  private updateStrip(state: SimState): void {
    const overlay = state.phase === 'route' || state.phase === 'draft' || state.phase === 'shop' || state.phase === 'event';
    this.strip.visible = !overlay;
    if (overlay) return;
    const owned = Object.entries(state.rogue.boons) as [BoonId, number][];
    const perRow = Math.max(1, Math.floor((viewport.w / 2 - this.stripLeft) / (STRIP.advance * this.textScale)));
    this.stripPips.clear();
    owned.forEach(([id, lv], i) => {
      let s = this.stripIcons[i];
      if (!s) {
        s = new Sprite();
        this.stripIcons.push(s);
        this.strip.addChild(s);
      }
      s.visible = lv > 0;
      s.texture = this.iconTex.get(id) ?? s.texture;
      s.tint = RARITY_COLOR[boonDef(id).rarity];
      const x = (i % perRow) * STRIP.advance;
      const y = Math.floor(i / perRow) * STRIP.h;
      s.position.set(x, y);
      for (let k = 1; k < lv; k++) this.stripPips.rect(x + (k - 1) * 3, y + 9, 2, 2).fill(s.tint);
    });
    for (let i = owned.length; i < this.stripIcons.length; i++) this.stripIcons[i]!.visible = false;
  }

  private updateBanner(state: SimState, paused: boolean): void {
    let banner = '';
    let sub = '';
    let y = 140;
    const world = worldAt(state.world);
    if (paused) {
      banner = 'PAUSED';
    } else if (state.phase === 'gameOver') {
      banner = 'GAME OVER';
      sub = 'PRESS FIRE';
    } else if (state.phase === 'warp') {
      banner = state.world === 0 && state.loop > 0 ? `LOOP ${state.loop + 1}` : `WORLD ${state.world + 1}`;
      sub = world.name;
      y = 130;
    } else if (state.phase === 'stageIntro') {
      if (state.boss) {
        banner = Math.floor(state.time * 6) % 2 === 0 ? 'WARNING' : '';
        sub = world.bossName;
      } else {
        banner = state.beatMode === 'master' ? 'BEAT STAGE' : `STAGE ${state.world + 1}-${state.stage}`;
        if (state.beatMode === 'master') sub = state.diff.elite ? 'ELITE - ON BEAT X8' : 'PERFECT = POWER SHOT';
        else if (state.stage === 1) sub = world.name;
        else if (state.diff.elite) sub = 'ELITE - STAY SHARP';
      }
    } else if (state.phase === 'stageClear') {
      banner = state.stage === STAGE.perWorld ? 'WORLD CLEAR' : 'STAGE CLEAR';
      const rank = state.result?.beatRank;
      if (rank) sub = rank === 'S' ? 'RANK S: BONUS X2' : `BEAT RANK ${rank}`;
      y = 110;
    }
    this.banner.setText(banner);
    this.sub.setText(sub);
    this.sub.tint = state.beatMode === 'master' && !paused ? 0xff5ad1 : 0xcccccc;
    const k = this.textScale;
    fitCenter(this.banner, 2 * k, y, viewport.w);
    fitCenter(this.sub, k, y + 20 * k, viewport.w);
  }

  private updateResults(state: SimState, paused: boolean): void {
    // The stage-clear card sits where the pause menu opens; PAUSED replaces it.
    const r = state.phase === 'stageClear' && !paused ? state.result : null;
    const lines = r
      ? [
          `ACCURACY  ${pct(r.accuracy)}`,
          state.beatMode === 'off' ? `GRAZES    ${state.stageStats.grazes}` : `ON BEAT   ${pct(r.beatPct)}`,
          r.noHit ? 'NO HIT    +2000' : 'HIT TAKEN',
          r.perfect ? 'PERFECT!' : '',
          `BONUS     +${r.bonus}`,
        ]
      : [];
    const shown = r ? Math.floor((STAGE.clearTime - state.phaseTimer) / RESULT_LINE_DELAY) : 0;
    this.results.forEach((t, i) => {
      t.setText(lines[i] ?? '');
      t.visible = i < shown;
      t.x = Math.max(MARGIN, Math.round((viewport.w - RESULTS_W * this.textScale) / 2));
    });
  }
}
