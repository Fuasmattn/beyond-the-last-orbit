import { Container } from 'pixi.js';
import { Sourness } from '../audio/sourness';
import { createInitialState } from '../sim/state';
import { step } from '../sim/step';
import type { SimEvent, SimState } from '../sim/types';
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

  constructor(private readonly ctx: SceneContext) {
    this.state = createInitialState(newSeed());
    this.renderer = new GameRenderer(ctx.textures);
    this.hud = new Hud(ctx.textures.glyphs);
    this.root.addChild(this.renderer.root, this.hud);
    ctx.audio?.sfx.start();
    ctx.audio?.startSong(ctx.songForWorld(this.state.world));
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
        this.ctx.goto(this.ctx.scenes.gameOver({ score: s.score, world: s.world, stage: s.stage, loop: s.loop }));
      }
      return;
    }
    const events = step(s, input.sim);
    this.hud.notify(events);
    this.playEvents(events);
    this.sour.update(dt);
    this.ctx.audio?.setSour(this.sour.value);
  }

  render(elapsed: number): void {
    const beat = this.ctx.audio?.currentBeat() ?? null;
    this.renderer.render(this.state, this.paused ? 0 : elapsed, beat);
    this.hud.update(this.state, this.paused, beat, this.ctx.audio !== null, elapsed);
  }

  destroy(): void {
    this.root.destroy({ children: true });
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
          this.sour.onShot(e.onBeat);
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
          audio.startSong(this.ctx.songForWorld(e.world));
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
