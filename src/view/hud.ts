import { Container, Graphics, type Texture } from 'pixi.js';
import { STAGE } from '../data/balance';
import { worldAt } from '../data/worlds';
import type { SimEvent, SimState } from '../sim/types';
import { viewport } from '../app/viewport';
import type { JudgeLabel } from './beatJudge';
import { BeatTrack } from './beatTrack';
import { centerText, PixelText } from './pixelText';

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

const RESULT_LINES = 5;
const RESULT_LINE_DELAY = 0.25;
const POPUP_TIME = 1.5;
const BOSS_BAR = { y: 13, h: 3, margin: 40, maxW: 240 } as const;
const RESULTS_W = 96;

export class Hud extends Container {
  private readonly score: PixelText;
  private readonly stage: PixelText;
  private readonly lives: PixelText;
  private readonly track: BeatTrack;
  private readonly noAudio: PixelText;
  private readonly banner: PixelText;
  private readonly sub: PixelText;
  private readonly popup: PixelText;
  private readonly results: PixelText[] = [];
  private readonly bossBar = new Graphics();
  private popupTime = 0;

  constructor(glyphs: Map<string, Texture>) {
    super();
    this.score = new PixelText(glyphs);
    this.stage = new PixelText(glyphs);
    this.lives = new PixelText(glyphs, '', 0x4af2ff);
    this.track = new BeatTrack(glyphs);
    this.noAudio = new PixelText(glyphs, 'NO AUDIO', 0x777777);
    this.banner = new PixelText(glyphs, '', 0xffe14a);
    this.banner.scale.set(2);
    this.sub = new PixelText(glyphs, '', 0xcccccc);
    this.popup = new PixelText(glyphs, '', 0x7dff6b);
    for (let i = 0; i < RESULT_LINES; i++) {
      const t = new PixelText(glyphs, '', i === RESULT_LINES - 1 ? 0xffe14a : 0xcccccc);
      t.y = 138 + i * 9;
      this.results.push(t);
    }
    this.score.position.set(4, 4);
    this.stage.y = 4;
    this.lives.position.set(4, 12);
    this.noAudio.y = 4;
    this.addChild(
      this.track,
      this.score,
      this.stage,
      this.lives,
      this.noAudio,
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

  notify(events: readonly SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'extraLife') {
        this.popup.setText('EXTRA SHIP!');
        this.popupTime = POPUP_TIME;
      }
    }
  }

  update(state: SimState, paused: boolean, beat: number | null, audioOk: boolean, dt: number): void {
    this.score.setText(`SCORE ${state.score}`);
    const label = `${state.world + 1}-${state.stage}`;
    this.stage.setText(state.loop > 0 ? `L${state.loop + 1} ${label}` : `STAGE ${label}`);
    this.stage.x = viewport.w - 4 - this.stage.pixelWidth;
    this.track.update(viewport.w, audioOk ? beat : null, state.rhythm.mult, state.rhythm.streak, dt);
    this.lives.setText(`SHIPS ${Math.max(0, state.player.lives)}`);
    this.noAudio.visible = !audioOk;
    centerText(this.noAudio, 4, viewport.w);
    this.updateBossBar(state);
    this.updateBanner(state, paused);
    this.updateResults(state);
    this.popupTime = Math.max(0, this.popupTime - dt);
    this.popup.visible = this.popupTime > 0;
    centerText(this.popup, 200, viewport.w);
  }

  private updateBossBar(state: SimState): void {
    const b = state.boss;
    this.bossBar.visible = b !== null && !b.entering && b.dying === 0;
    if (!b || !this.bossBar.visible) return;
    const ratio = Math.max(0, b.hp / b.maxHp);
    const w = Math.min(BOSS_BAR.maxW, viewport.w - BOSS_BAR.margin * 2);
    const x = (viewport.w - w) / 2;
    this.bossBar
      .clear()
      .rect(x, BOSS_BAR.y, w, BOSS_BAR.h)
      .fill(0x331018)
      .rect(x, BOSS_BAR.y, w * ratio, BOSS_BAR.h)
      .fill(b.phased ? 0x8a7fb5 : 0xff3b5c);
  }

  private updateBanner(state: SimState, paused: boolean): void {
    let banner = '';
    let sub = '';
    let y = 140;
    const world = worldAt(state.world);
    if (paused) {
      banner = 'PAUSED';
      sub = 'PRESS P TO RESUME';
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
        banner = `STAGE ${state.world + 1}-${state.stage}`;
        if (state.stage === 1) sub = world.name;
      }
    } else if (state.phase === 'stageClear') {
      banner = state.stage === STAGE.perWorld ? 'WORLD CLEAR' : 'STAGE CLEAR';
      y = 110;
    }
    this.banner.setText(banner);
    this.sub.setText(sub);
    centerText(this.banner, y, viewport.w);
    centerText(this.sub, y + 20, viewport.w);
  }

  private updateResults(state: SimState): void {
    const r = state.phase === 'stageClear' ? state.result : null;
    const lines = r
      ? [
          `ACCURACY  ${pct(r.accuracy)}`,
          `ON BEAT   ${pct(r.beatPct)}`,
          r.noHit ? 'NO HIT    +2000' : 'HIT TAKEN',
          r.perfect ? 'PERFECT!' : '',
          `BONUS     +${r.bonus}`,
        ]
      : [];
    const shown = r ? Math.floor((STAGE.clearTime - state.phaseTimer) / RESULT_LINE_DELAY) : 0;
    this.results.forEach((t, i) => {
      t.setText(lines[i] ?? '');
      t.visible = i < shown;
      t.x = Math.round((viewport.w - RESULTS_W) / 2);
    });
  }
}
