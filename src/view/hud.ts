import { Container, Graphics, type Texture } from 'pixi.js';
import { FIELD_H, FIELD_W, RHYTHM, STAGE } from '../data/balance';
import { worldAt } from '../data/worlds';
import type { SimEvent, SimState } from '../sim/types';
import { beatPulse } from './beatPulse';
import { centerText, PixelText } from './pixelText';

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

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

const RING_X = 104;
const MULT_X = 111;
const RESULT_LINES = 5;
const RESULT_LINE_DELAY = 0.25;
const POPUP_TIME = 1.5;
const BOSS_BAR = { x: 40, y: 13, w: 160, h: 3 } as const;

export class Hud extends Container {
  private readonly score: PixelText;
  private readonly stage: PixelText;
  private readonly lives: PixelText;
  private readonly banner: PixelText;
  private readonly sub: PixelText;
  private readonly mult: PixelText;
  private readonly popup: PixelText;
  private readonly results: PixelText[] = [];
  private readonly ring = new Graphics();
  private readonly bossBar = new Graphics();
  private popupTime = 0;

  constructor(glyphs: Map<string, Texture>) {
    super();
    this.score = new PixelText(glyphs);
    this.stage = new PixelText(glyphs);
    this.lives = new PixelText(glyphs, '', 0x4af2ff);
    this.banner = new PixelText(glyphs, '', 0xffe14a);
    this.banner.scale.set(2);
    this.sub = new PixelText(glyphs, '', 0xcccccc);
    this.mult = new PixelText(glyphs);
    this.popup = new PixelText(glyphs, '', 0x7dff6b);
    for (let i = 0; i < RESULT_LINES; i++) {
      const t = new PixelText(glyphs, '', i === RESULT_LINES - 1 ? 0xffe14a : 0xcccccc);
      t.position.set(72, 138 + i * 9);
      this.results.push(t);
    }
    this.score.position.set(4, 4);
    this.stage.y = 4;
    this.lives.position.set(4, FIELD_H - 9);
    this.ring.position.set(RING_X, 6);
    this.mult.position.set(MULT_X, 4);
    this.addChild(
      this.score,
      this.stage,
      this.lives,
      this.ring,
      this.mult,
      this.bossBar,
      this.banner,
      this.sub,
      ...this.results,
      this.popup,
    );
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
    this.stage.x = FIELD_W - 4 - this.stage.pixelWidth;
    this.lives.setText(`SHIPS ${Math.max(0, state.player.lives)}`);
    this.updateRhythm(state, beat, audioOk);
    this.updateBossBar(state);
    this.updateBanner(state, paused);
    this.updateResults(state);
    this.popupTime = Math.max(0, this.popupTime - dt);
    this.popup.visible = this.popupTime > 0;
    centerText(this.popup, 200);
  }

  private updateRhythm(state: SimState, beat: number | null, audioOk: boolean): void {
    this.ring.visible = audioOk;
    if (!audioOk) {
      this.mult.setText('NO AUDIO');
      centerText(this.mult, 4);
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

  private updateBossBar(state: SimState): void {
    const b = state.boss;
    this.bossBar.visible = b !== null && !b.entering && b.dying === 0;
    if (!b || !this.bossBar.visible) return;
    const ratio = Math.max(0, b.hp / b.maxHp);
    this.bossBar
      .clear()
      .rect(BOSS_BAR.x, BOSS_BAR.y, BOSS_BAR.w, BOSS_BAR.h)
      .fill(0x331018)
      .rect(BOSS_BAR.x, BOSS_BAR.y, BOSS_BAR.w * ratio, BOSS_BAR.h)
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
    centerText(this.banner, y);
    centerText(this.sub, y + 20);
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
    });
  }
}
