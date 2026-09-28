import { Container } from 'pixi.js';
import { viewport } from '../app/viewport';
import { Sourness } from '../audio/sourness';
import { ROUTE } from '../data/balance';
import { equippedLaser, equippedSkin } from '../data/cosmetics';
import { rogueRunOptions } from '../meta/upgrades';
import { defaultRunOptions } from '../sim/ship';
import { createInitialState } from '../sim/state';
import { chooseBoon, chooseNode, rerollDraft } from '../sim/stageFlow';
import { step } from '../sim/step';
import type { RunMode, SimEvent, SimState } from '../sim/types';
import { judgeLabel } from '../view/beatJudge';
import { cameraTarget, followCamera } from '../view/camera';
import { DraftOverlay } from '../view/draftOverlay';
import { Hud } from '../view/hud';
import { MenuList } from '../view/menuList';
import { RouteOverlay } from '../view/routeOverlay';
import { GameRenderer } from '../view/renderer';
import type { FrameInput, Scene, SceneContext } from './scene';

const GAME_OVER_DELAY = 1;
const PAUSE_ITEMS = ['RESUME', 'END RUN'] as const;
const PAUSE_MENU = { x: 0, y: 0, lineH: 14, width: 44 } as const;
const PAUSE_MENU_Y = 172;

function newSeed(): number {
  return (Math.random() * 2 ** 32) >>> 0;
}

export class RunScene implements Scene {
  readonly root = new Container();
  readonly state: SimState;
  private readonly renderer: GameRenderer;
  private readonly hud: Hud;
  private readonly route: RouteOverlay;
  private readonly draft: DraftOverlay;
  private readonly pauseMenu: MenuList;
  private elapsed = 0;
  private pauseBlink = 0;
  private paused = false;
  private gameOverTime = 0;
  /** Left edge of the view in field coords; the field is wider than the screen on touch. */
  private camX: number | null = null;
  private readonly sour = new Sourness();

  constructor(
    private readonly ctx: SceneContext,
    mode: RunMode,
  ) {
    const opts = mode === 'rogue' ? rogueRunOptions(ctx.save) : defaultRunOptions('rhythm');
    this.state = createInitialState(newSeed(), viewport.fieldW, opts);
    this.renderer = new GameRenderer(ctx.textures, { skin: equippedSkin(ctx.save), laser: equippedLaser(ctx.save) });
    this.hud = new Hud(ctx.textures.glyphs);
    this.route = new RouteOverlay(ctx.textures.glyphs, ctx.isTouch);
    this.draft = new DraftOverlay(ctx.textures.glyphs, ctx.isTouch);
    this.pauseMenu = new MenuList(ctx.textures.glyphs, PAUSE_MENU);
    this.pauseMenu.setRows(PAUSE_ITEMS.map((label) => ({ label })));
    this.pauseMenu.visible = false;
    this.root.addChild(this.renderer.root, this.hud, this.route, this.draft, this.pauseMenu);
    ctx.audio?.sfx.start();
    ctx.audio?.startSong(ctx.songForWorld(this.state.world, this.state.loop));
  }

  onHidden(): void {
    this.setPaused(true);
  }

  update(input: FrameInput, dt: number): void {
    const s = this.state;
    if (input.pause && s.phase !== 'gameOver') {
      this.setPaused(!this.paused);
      this.pauseMenu.selected = 0;
      return;
    }
    if (this.paused) {
      this.updatePauseMenu(input);
      return;
    }
    if (s.phase === 'gameOver') {
      this.gameOverTime += dt;
      if (this.gameOverTime > GAME_OVER_DELAY && (input.menu.includes('confirm') || input.taps.length > 0)) {
        this.finishRun();
      }
      return;
    }
    s.nextFieldW = viewport.fieldW;
    const events = step(s, input.sim);
    this.handleChoices(input, events);
    this.gradeShots(events);
    this.hud.notify(events);
    this.renderer.notify(events);
    this.playEvents(events);
    this.sour.update(dt);
    this.ctx.audio?.setSour(this.sour.value);
  }

  /**
   * Route map and draft picks (rogue runs); input is ignored briefly so fire-mashing can't pick.
   * Events raised by a pick (stage intro, warp, repair) are appended to `events` for the views and audio.
   */
  private handleChoices(input: FrameInput, events: SimEvent[]): void {
    const s = this.state;
    this.pick(input, events);
    // Overlays opened by this step or by the pick start with the cursor on the first entry.
    if (events.some((e) => e.type === 'routeOpen')) this.route.open();
    if (events.some((e) => e.type === 'draftOpen')) this.draft.open();
  }

  private pick(input: FrameInput, events: SimEvent[]): void {
    const s = this.state;
    if (!s.rogue || s.phaseTimer < ROUTE.inputDelay) return;
    const moved = input.menu.some((a) => a !== 'confirm' && a !== 'back');
    if (s.phase === 'route') {
      const lane = this.route.handle(s.rogue, input.menu, input.taps);
      if (lane !== null && chooseNode(s, lane, events)) this.ctx.audio?.sfx.choose();
      else if (moved) this.ctx.audio?.sfx.menuMove();
    } else if (s.phase === 'draft') {
      const pick = this.draft.handle(s.rogue, input.menu, input.taps);
      if (pick?.type === 'reroll') {
        if (rerollDraft(s)) {
          this.draft.open();
          this.ctx.audio?.sfx.menuSelect();
        }
      } else if (pick && chooseBoon(s, pick.type === 'boon' ? pick.index : null, events)) {
        this.ctx.audio?.sfx.choose();
      } else if (moved) this.ctx.audio?.sfx.menuMove();
    }
  }

  render(elapsed: number): void {
    const beat = this.ctx.audio?.currentBeat() ?? null;
    const p = this.state.player;
    const target = cameraTarget(p.x, p.w, this.state.fieldW, viewport.w);
    this.camX = followCamera(this.camX, target, this.paused ? 0 : elapsed);
    this.renderer.render(this.state, this.paused ? 0 : elapsed, beat, this.camX, viewport.w);
    const shakeOn = this.ctx.save.settings.shake;
    const off = shakeOn ? this.renderer.shakeOffset(this.state.time) : { x: 0, y: 0 };
    this.renderer.root.position.set(Math.round(off.x) - this.camX, Math.round(off.y));
    this.ctx.setAberration(shakeOn ? this.renderer.trauma : 0);
    this.hud.update(this.state, this.paused, beat, this.ctx.audio !== null, elapsed);
    this.pauseMenu.visible = this.paused;
    if (this.paused) {
      this.pauseMenu.position.set(Math.round(viewport.w / 2 - PAUSE_MENU.width / 2), PAUSE_MENU_Y);
      this.pauseBlink += elapsed;
      this.pauseMenu.refresh(this.pauseBlink);
    }
    this.elapsed += this.paused ? 0 : elapsed;
    const r = this.state.rogue;
    this.route.visible = r !== null && this.state.phase === 'route' && !this.paused;
    this.draft.visible = r !== null && this.state.phase === 'draft' && !this.paused;
    if (r && this.route.visible) this.route.update(r, viewport.w, this.elapsed);
    if (r && this.draft.visible) this.draft.update(r, viewport.w, this.elapsed);
  }

  destroy(): void {
    this.ctx.setAberration(0);
    this.root.destroy({ children: true });
  }

  /** Shows PERFECT/GOOD/OFF on the beat track, using the press timing measured at input time. */
  private gradeShots(events: readonly SimEvent[]): void {
    const shot = events.find((e) => e.type === 'shot');
    const press = this.ctx.takePressDelta();
    if (!shot || shot.type !== 'shot' || this.state.beatMode === 'off') return;
    const delta = press === null ? null : press - this.ctx.save.settings.latencyOffsetMs / 1000;
    this.hud.judge(judgeLabel(delta, shot.onBeat));
  }

  /** Pause menu: RESUME, or END RUN (scored like a game over: credits and highscore still count). */
  private updatePauseMenu(input: FrameInput): void {
    const menu = this.pauseMenu;
    let chosen: number | null = null;
    for (const a of input.menu) {
      if (a === 'up' || a === 'down') {
        menu.move(a === 'up' ? -1 : 1);
        this.ctx.audio?.sfx.menuMove();
      } else if (a === 'confirm') chosen = menu.selected;
    }
    for (const t of input.taps) {
      const i = menu.indexAt({ x: t.x - menu.x, y: t.y - menu.y });
      // Tapping outside the menu resumes, as before.
      chosen = i ?? 0;
    }
    if (chosen === null) return;
    this.setPaused(false);
    if (PAUSE_ITEMS[chosen] === 'END RUN') {
      this.ctx.audio?.stopSong();
      this.finishRun();
    }
  }

  private finishRun(): void {
    const s = this.state;
    this.ctx.goto(
      this.ctx.scenes.gameOver({
        mode: s.mode,
        score: s.score,
        world: s.world,
        stage: s.stage,
        loop: s.loop,
        bossesKilled: s.run.bossesKilled,
        perfectStages: s.run.perfectStages,
      }),
    );
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
          // Only judged stages (rhythm runs, rogue beat stages) sour the music.
          if (this.state.beatMode !== 'off') this.sour.onShot(e.onBeat);
          if (e.power) audio.sfx.powerShot();
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
          if (this.state.beatMode === 'master') audio.sfx.beatStage();
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
