import { Container } from 'pixi.js';
import { viewport } from '../app/viewport';
import { Sourness } from '../audio/sourness';
import { equippedLaser, equippedSkin } from '../data/cosmetics';
import { rogueRunOptions } from '../meta/upgrades';
import { defaultRunOptions } from '../sim/ship';
import { createInitialState } from '../sim/state';
import { step } from '../sim/step';
import type { RunMode, SimEvent, SimState } from '../sim/types';
import { judgeLabel } from '../view/beatJudge';
import { Hud } from '../view/hud';
import { GameRenderer } from '../view/renderer';
import type { FrameInput, Scene, SceneContext } from './scene';

const GAME_OVER_DELAY = 1;

function newSeed(): number {
  return (Math.random() * 2 ** 32) >>> 0;
}

export class RunScene implements Scene {
  readonly root = new Container();
  readonly state: SimState;
  private readonly renderer: GameRenderer;
  private readonly hud: Hud;
  private paused = false;
  private gameOverTime = 0;
  private readonly sour = new Sourness();

  constructor(
    private readonly ctx: SceneContext,
    mode: RunMode,
  ) {
    const opts = mode === 'rogue' ? rogueRunOptions(ctx.save) : defaultRunOptions('rhythm');
    this.state = createInitialState(newSeed(), viewport.w, opts);
    this.renderer = new GameRenderer(ctx.textures, { skin: equippedSkin(ctx.save), laser: equippedLaser(ctx.save) });
    this.hud = new Hud(ctx.textures.glyphs);
    this.root.addChild(this.renderer.root, this.hud);
    ctx.audio?.sfx.start();
    ctx.audio?.startSong(ctx.songForWorld(this.state.world, this.state.loop));
  }

  onHidden(): void {
    this.setPaused(true);
  }

  update(input: FrameInput, dt: number): void {
    const s = this.state;
    if (input.pause && s.phase !== 'gameOver') this.setPaused(!this.paused);
    if (this.paused) {
      if (this.ctx.isTouch && input.taps.length > 0) this.setPaused(false);
      return;
    }
    if (s.phase === 'gameOver') {
      this.gameOverTime += dt;
      if (this.gameOverTime > GAME_OVER_DELAY && (input.menu.includes('confirm') || input.taps.length > 0)) {
        this.ctx.goto(this.ctx.scenes.gameOver({
            mode: s.mode,
            score: s.score,
            world: s.world,
            stage: s.stage,
            loop: s.loop,
            bossesKilled: s.run.bossesKilled,
            perfectStages: s.run.perfectStages,
          }));
      }
      return;
    }
    s.nextFieldW = viewport.w;
    const events = step(s, input.sim);
    this.gradeShots(events);
    this.hud.notify(events);
    this.renderer.notify(events);
    this.playEvents(events);
    this.sour.update(dt);
    this.ctx.audio?.setSour(this.sour.value);
  }

  render(elapsed: number): void {
    const beat = this.ctx.audio?.currentBeat() ?? null;
    this.renderer.render(this.state, this.paused ? 0 : elapsed, beat);
    const shakeOn = this.ctx.save.settings.shake;
    const off = shakeOn ? this.renderer.shakeOffset(this.state.time) : { x: 0, y: 0 };
    this.renderer.root.position.set(Math.round(off.x), Math.round(off.y));
    this.ctx.setAberration(shakeOn ? this.renderer.trauma : 0);
    this.hud.update(this.state, this.paused, beat, this.ctx.audio !== null, elapsed);
  }

  destroy(): void {
    this.ctx.setAberration(0);
    this.root.destroy({ children: true });
  }

  /** Shows PERFECT/GOOD/OFF on the beat track, using the press timing measured at input time. */
  private gradeShots(events: readonly SimEvent[]): void {
    const shot = events.find((e) => e.type === 'shot');
    const press = this.ctx.takePressDelta();
    if (!shot || shot.type !== 'shot' || this.state.mode !== 'rhythm') return;
    const delta = press === null ? null : press - this.ctx.save.settings.latencyOffsetMs / 1000;
    this.hud.judge(judgeLabel(delta, shot.onBeat));
  }

  private setPaused(p: boolean): void {
    if (this.paused === p) return;
    this.paused = p;
    this.ctx.audio?.setPaused(p);
  }

  private playEvents(events: readonly SimEvent[]): void {
    const audio = this.ctx.audio;
    if (!audio) return;
    for (const e of events) {
      switch (e.type) {
        case 'shot':
          audio.sfx.laser(e.onBeat);
          // Only rhythm runs judge timing; rogue runs keep the music clean.
          if (this.state.mode === 'rhythm') this.sour.onShot(e.onBeat);
          break;
        case 'enemyKilled':
        case 'partDestroyed':
          audio.sfx.explosion();
          break;
        case 'enemyShot':
          audio.sfx.enemyShot();
          break;
        case 'playerHit':
          audio.sfx.playerHit();
          break;
        case 'shieldHit':
          audio.sfx.shieldHit();
          break;
        case 'graze':
          audio.sfx.graze();
          break;
        case 'stageClear':
          audio.sfx.stageClear();
          break;
        case 'extraLife':
          audio.sfx.extraLife();
          break;
        case 'dive':
          audio.sfx.dive();
          break;
        case 'bombBurst':
          audio.sfx.bombBurst();
          break;
        case 'bossHit':
          audio.sfx.bossHit();
          break;
        case 'bossPhase':
          audio.sfx.bossPhase();
          if (e.phase === 3) audio.queueArrangement('bossFinal');
          break;
        case 'bossPhased':
          audio.sfx.phaseShift();
          break;
        case 'bossKilled':
          audio.sfx.bossKilled();
          break;
        case 'laserWarn':
          audio.sfx.laserWarn();
          break;
        case 'laserFire':
          audio.sfx.laserFire();
          break;
        case 'stageIntro':
          audio.queueArrangement(e.boss ? 'boss' : 'main');
          break;
        case 'warpStart':
          audio.sfx.warp();
          audio.startSong(this.ctx.songForWorld(e.world, e.loop));
          break;
        case 'gameOver':
          audio.stopSong();
          break;
        default:
          break;
      }
    }
  }
}
