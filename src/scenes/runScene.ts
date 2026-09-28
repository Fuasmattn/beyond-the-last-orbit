import { Container } from 'pixi.js';
import { viewport } from '../app/viewport';
import { Sourness } from '../audio/sourness';
import { ROUTE } from '../data/balance';
import { equippedLaser, equippedSkin } from '../data/cosmetics';
import { dailyBoard, dailyRunOptions, dailySeed, dayKey } from '../meta/daily';
import { runOptionsFor } from '../meta/upgrades';
import { createInitialState } from '../sim/state';
import {
  buyShopBoon,
  buyShopRepair,
  chooseBoon,
  chooseEvent,
  chooseNode,
  leaveShop,
  rerollDraft,
  rerollShop,
} from '../sim/stageFlow';
import { step } from '../sim/step';
import type { SimEvent, SimState } from '../sim/types';
import type { Board } from '../leaderboard/leaderboard';
import { judgeLabel } from '../view/beatJudge';
import { cameraTarget, followCamera } from '../view/camera';
import { DraftOverlay } from '../view/draftOverlay';
import { EventOverlay } from '../view/eventOverlay';
import { Hud, inPauseButton } from '../view/hud';
import { MenuList } from '../view/menuList';
import { RouteOverlay } from '../view/routeOverlay';
import { GameRenderer } from '../view/renderer';
import type { FrameInput, RunKind, Scene, SceneContext } from './scene';

const GAME_OVER_DELAY = 1;
const PAUSE_ITEMS = ['RESUME', 'END RUN'] as const;
const PAUSE_MENU = { x: 0, y: 0, lineH: 14, width: 44 } as const;
const PAUSE_MENU_Y = 172;
/** HUD text is 1.5× on touch screens so it stays readable on phones. */
const TOUCH_HUD_SCALE = 1.5;

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
  private readonly event: EventOverlay;
  private readonly pauseMenu: MenuList;
  private elapsed = 0;
  private pauseBlink = 0;
  private paused = false;
  private gameOverTime = 0;
  /** Left edge of the view in field coords; the field is wider than the screen on touch. */
  private camX: number | null = null;
  /** Last whole multiplier called out. */
  private multStep = 1;
  private readonly sour = new Sourness();
  private readonly board: Board;

  constructor(
    private readonly ctx: SceneContext,
    kind: RunKind,
  ) {
    if (kind === 'daily') {
      // Everyone shares today's seed and ship; the attempt is spent the moment the run starts.
      const day = dayKey();
      this.board = dailyBoard(day);
      ctx.save.dailyPlayed = day;
      ctx.persist();
      this.state = createInitialState(dailySeed(day), viewport.fieldW, dailyRunOptions());
    } else {
      this.board = 'rogue';
      this.state = createInitialState(newSeed(), viewport.fieldW, runOptionsFor(ctx.save));
    }
    this.renderer = new GameRenderer(ctx.textures, { skin: equippedSkin(ctx.save), laser: equippedLaser(ctx.save) });
    this.hud = new Hud(ctx.textures.glyphs, ctx.isTouch ? TOUCH_HUD_SCALE : 1, ctx.isTouch);
    this.route = new RouteOverlay(ctx.textures.glyphs, ctx.isTouch);
    this.draft = new DraftOverlay(ctx.textures.glyphs, ctx.isTouch);
    this.event = new EventOverlay(ctx.textures.glyphs, ctx.isTouch);
    this.pauseMenu = new MenuList(ctx.textures.glyphs, PAUSE_MENU);
    this.pauseMenu.setRows(PAUSE_ITEMS.map((label) => ({ label })));
    this.pauseMenu.visible = false;
    this.root.addChild(this.renderer.root, this.hud, this.route, this.draft, this.event, this.pauseMenu);
    ctx.audio?.sfx.start();
    ctx.audio?.startSong(ctx.songForWorld(this.state.world, this.state.loop));
    if (this.state.phase === 'draft') this.draft.open('draft');
  }

  onHidden(): void {
    this.setPaused(true);
  }

  update(input: FrameInput, dt: number): void {
    const s = this.state;
    const pauseTap = this.ctx.isTouch && !this.paused && input.taps.some(inPauseButton);
    if ((input.pause || pauseTap) && s.phase !== 'gameOver') {
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
    this.calloutMultiplier();
    this.hud.notify(events);
    this.renderer.notify(events);
    this.playEvents(events);
    this.sour.update(dt);
    this.ctx.audio?.setSour(this.sour.value);
  }

  /**
   * Route map and draft picks; input is ignored briefly so fire-mashing can't pick.
   * Events raised by a pick (stage intro, warp, repair) are appended to `events` for the views and audio.
   */
  private handleChoices(input: FrameInput, events: SimEvent[]): void {
    const s = this.state;
    this.pick(input, events);
    // Overlays opened by this step or by the pick start with the cursor on the first entry.
    if (events.some((e) => e.type === 'routeOpen')) this.route.open();
    if (events.some((e) => e.type === 'draftOpen')) this.draft.open('draft');
    if (events.some((e) => e.type === 'shopOpen')) this.draft.open('shop');
    if (events.some((e) => e.type === 'eventOpen')) this.event.open();
  }

  private pick(input: FrameInput, events: SimEvent[]): void {
    const s = this.state;
    if (s.phaseTimer < ROUTE.inputDelay) return;
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
    } else if (s.phase === 'shop') {
      const pick = this.draft.handle(s.rogue, input.menu, input.taps);
      const sfx = this.ctx.audio?.sfx;
      if (!pick) {
        if (moved) sfx?.menuMove();
        return;
      }
      if (pick.type === 'skip') {
        if (leaveShop(s, events)) sfx?.choose();
        return;
      }
      const ok =
        pick.type === 'boon'
          ? buyShopBoon(s, pick.index, events)
          : pick.type === 'repair'
            ? buyShopRepair(s, events)
            : rerollShop(s);
      if (ok) sfx?.buy();
      else sfx?.deny();
    } else if (s.phase === 'event') {
      const i = this.event.handle(input.menu, input.taps);
      if (i !== null) {
        if (chooseEvent(s, i, events)) this.ctx.audio?.sfx.choose();
        else this.ctx.audio?.sfx.deny();
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
    const phase = this.state.phase;
    this.route.visible = phase === 'route' && !this.paused;
    this.draft.visible = (phase === 'draft' || phase === 'shop') && !this.paused;
    this.event.visible = phase === 'event' && !this.paused;
    if (this.route.visible) this.route.update(r, viewport.w, this.elapsed);
    if (this.draft.visible) this.draft.update(r, viewport.w, this.elapsed);
    if (this.event.visible) this.event.update(this.state, viewport.w, this.elapsed);
  }

  destroy(): void {
    this.ctx.setAberration(0);
    this.root.destroy({ children: true });
  }

  /** Reaching a whole multiplier (x2, x3, …) gets a callout; dropping back is silent. */
  private calloutMultiplier(): void {
    const mult = this.state.rhythm.mult;
    const whole = Math.floor(mult);
    if (whole > this.multStep && whole >= 2 && mult === whole) {
      this.hud.say(`X${whole}!`);
      this.ctx.audio?.sfx.multUp();
    }
    if (whole !== this.multStep) this.multStep = whole;
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
        board: this.board,
        score: s.score,
        world: s.world,
        stage: s.stage,
        loop: s.loop,
        bossesKilled: s.run.bossesKilled,
        perfectStages: s.run.perfectStages,
        accuracy: s.stats.shots > 0 ? Math.min(1, s.stats.hits / s.stats.shots) : 0,
        kills: s.run.kills,
        grazes: s.run.grazes,
        bestBeatRank: s.run.bestBeatRank,
        upgrades: Object.values(s.rogue.boons).reduce((a, b) => a + b, 0),
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
          // Only beat stages sour the music.
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
        case 'revived':
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
