import { Application, Container, Graphics, TextureSource } from 'pixi.js';
import { AudioEngine } from '../audio/engine';
import { compileSong, type CompiledSong } from '../audio/song';
import { FIELD_H, FX, MAX_STEPS_PER_FRAME, MENU_W, MENU_W_TOUCH, SIM_DT } from '../data/balance';
import { EARTH_SONG } from '../data/songs/earth';
import { MARS_SONG } from '../data/songs/mars';
import { METRONOME_SONG } from '../data/songs/metronome';
import { MOON_SONG } from '../data/songs/moon';
import { bpmFor, worldAt, type WorldId } from '../data/worlds';
import { FrameMonitor } from '../fx/frameMonitor';
import { mergeInputs, type Tap } from '../input/inputFrame';
import { KeyboardInput } from '../input/keyboard';
import { TouchInput } from '../input/touch';
import { Leaderboard, readLeaderboardConfig } from '../leaderboard/leaderboard';
import { loadSave, memoryStore, writeSave, type KeyValueStore } from '../persist/save';
import { CalibrationScene } from '../scenes/calibrationScene';
import { GameOverScene } from '../scenes/gameOverScene';
import { RunScene } from '../scenes/runScene';
import type { FrameInput, Scene, SceneContext } from '../scenes/scene';
import { SettingsScene } from '../scenes/settingsScene';
import { HangarScene } from '../scenes/hangarScene';
import { ShopScene } from '../scenes/shopScene';
import { TitleScene } from '../scenes/titleScene';
import { createBackdrop, type Backdrop } from '../view/backdrops';
import { beatPulse } from '../view/beatPulse';
import { PostFx } from '../view/postfx';
import { SoundToggle } from '../view/soundToggle';
import { Starfield } from '../view/starfield';
import { loadTextures } from '../view/textures';
import { FixedLoop } from './fixedLoop';
import { computeLayout, type Layout } from './layout';
import { viewport } from './viewport';

function browserStore(): KeyValueStore {
  try {
    const s = window.localStorage;
    s.getItem('beyond-the-last-orbit:probe');
    return s;
  } catch {
    return memoryStore();
  }
}

/** Screens that show the speaker toggle: the first screen, and where volumes live. */
function showsSoundToggle(scene: Scene): boolean {
  return scene instanceof TitleScene || scene instanceof SettingsScene;
}

/** Menus use a `viewport.menuW × FIELD_H` design frame, centered and shrunk to fit narrow fields. */
function menuFrame(scene: Scene): boolean {
  return !(scene instanceof RunScene);
}

function menuScale(): number {
  return Math.min(1, viewport.w / viewport.menuW);
}

function frameMenu(scene: Scene): void {
  const k = menuScale();
  scene.root.scale.set(k);
  scene.root.position.set(Math.round((viewport.w - viewport.menuW * k) / 2), Math.round((FIELD_H - FIELD_H * k) / 2));
}

function toMenu(scene: Scene, t: Tap): Tap {
  const k = menuScale();
  return { x: (t.x - scene.root.x) / k, y: (t.y - scene.root.y) / k };
}

export async function startApp(host: HTMLElement): Promise<void> {
  TextureSource.defaultOptions.scaleMode = 'nearest';
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#000000',
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  host.appendChild(app.canvas);

  const audio = AudioEngine.create();
  const unlockAudio = () => audio?.unlock();
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('pointerdown', unlockAudio);

  const store = browserStore();
  const { data: save, reset } = loadSave(store);
  const leaderboard = new Leaderboard(readLeaderboardConfig(import.meta.env));
  void leaderboard.refresh('rogue');
  void leaderboard.refresh('rhythm');

  let pressDelta: number | null = null;
  const judgeFire = (timeStamp?: number) => {
    pressDelta = audio?.beatDelta(timeStamp) ?? null;
    return audio?.judgeFire(save.settings.latencyOffsetMs, timeStamp) ?? null;
  };

  const songs: Record<WorldId, CompiledSong> = {
    earth: compileSong(EARTH_SONG),
    moon: compileSong(MOON_SONG),
    mars: compileSong(MARS_SONG),
  };
  const songForWorld = (world: number, loop: number): CompiledSong => ({
    ...songs[worldAt(world).id],
    bpm: bpmFor(world, loop),
  });


  const textures = loadTextures();
  const game = new Container();
  const sceneLayer = new Container();
  // Shared animated backdrop behind every menu; runs draw their own world backdrop.
  const menuBackdrop = new Container();
  const menuStars = new Starfield();
  let menuPlanet: Backdrop | null = null;
  sceneLayer.addChild(menuBackdrop);
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  // Clip everything (planets, streaks, off-field bullets) to the visible part of the playfield.
  const fieldMask = new Graphics();
  game.addChild(sceneLayer, fieldMask);
  sceneLayer.mask = fieldMask;

  const soundToggle = new SoundToggle(textures.glyphs, isTouch ? 2 : 1);
  game.addChild(soundToggle);
  app.stage.addChild(game);
  const postFx = new PostFx(game, window.devicePixelRatio || 1);
  app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  let layout: Layout = computeLayout(window.innerWidth, window.innerHeight, isTouch);
  // Menus lay themselves out once; rebuild them when the field width changes. Runs adopt it at the next stage.
  let rebuildMenu: (() => void) | null = null;
  const applyLayout = () => {
    layout = computeLayout(window.innerWidth, window.innerHeight, isTouch);
    const widthChanged = layout.viewW !== viewport.w;
    viewport.w = layout.viewW;
    viewport.fieldW = layout.fieldW;
    viewport.menuW = isTouch ? MENU_W_TOUCH : MENU_W;
    game.scale.set(layout.scale);
    game.position.set(layout.offsetX, layout.offsetY);
    fieldMask.clear().rect(0, 0, layout.viewW, FIELD_H).fill(0xffffff);
    menuPlanet?.root.destroy({ children: true });
    menuPlanet = createBackdrop('earth', layout.viewW);
    menuBackdrop.removeChildren();
    menuBackdrop.addChild(menuStars, menuPlanet.root);
    postFx.setScale(layout.scale);
    if (widthChanged) rebuildMenu?.();
  };
  applyLayout();
  window.addEventListener('resize', applyLayout);

  const keyboard = new KeyboardInput(window, judgeFire);
  const touch = new TouchInput(app.canvas, () => layout, judgeFire);

  let scene: Scene;
  const ctx: SceneContext = {
    textures,
    audio,
    save,
    leaderboard,
    isTouch,
    notice: reset ? 'SAVE DATA WAS RESET' : null,
    songForWorld,
    metronome: compileSong(METRONOME_SONG),
    takePressDelta: () => {
      const d = pressDelta;
      pressDelta = null;
      return d;
    },
    applySettings: () => {
      const on = save.settings.muted ? 0 : 1;
      audio?.setVolumes(save.settings.musicVolume * on, save.settings.sfxVolume * on);
      audio?.setVisualOffset(save.settings.visualOffsetMs);
      audio?.setGuitarTone(save.settings.guitarTone);
      postFx.configure(save.settings);
    },
    setAberration: (a) => postFx.setAberration(a),
    persist: () => {
      writeSave(store, save);
    },
    goto: (next) => {
      scene.destroy();
      scene = next;
      sceneLayer.addChild(next.root);
    },
    scenes: {
      title: () => new TitleScene(ctx),
      run: (mode) => new RunScene(ctx, mode),
      gameOver: (summary) => new GameOverScene(ctx, summary),
      shop: () => new ShopScene(ctx),
      hangar: () => new HangarScene(ctx),
      settings: () => new SettingsScene(ctx),
      calibration: () => new CalibrationScene(ctx),
    },
  };
  ctx.applySettings();
  rebuildMenu = () => {
    if (scene instanceof TitleScene) ctx.goto(ctx.scenes.title());
    else if (scene instanceof ShopScene) ctx.goto(ctx.scenes.shop());
    else if (scene instanceof HangarScene) ctx.goto(ctx.scenes.hangar());
    else if (scene instanceof SettingsScene) ctx.goto(ctx.scenes.settings());
  };
  scene = ctx.scenes.title();
  sceneLayer.addChild(scene.root);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) scene.onHidden?.();
  });

  if (import.meta.env.DEV) {
    // Dev-only inspection hook for manual/browser verification.
    (window as unknown as { __sa: unknown }).__sa = {
      get scene() {
        return scene;
      },
      get run() {
        return scene instanceof RunScene ? scene.state : null;
      },
      audio,
      save,
      leaderboard,
      app,
    };
  }

  const monitor = new FrameMonitor(FX.degrade.windowMs, FX.degrade.maxAvgMs, FX.degrade.stallMs);
  const loop = new FixedLoop(SIM_DT, MAX_STEPS_PER_FRAME);
  // A tap that starts audio only starts it; the toggle reacts once sound was already running.
  let soundReady = false;
  let uiTime = 0;
  const toggleSound = (taps: Tap[]): Tap[] => {
    if (!audio || !showsSoundToggle(scene)) return taps;
    const rest = taps.filter((t) => !soundToggle.hit(t));
    if (rest.length < taps.length && soundReady) {
      save.settings.muted = !save.settings.muted;
      ctx.applySettings();
      ctx.persist();
      if (!save.settings.muted) audio.sfx.menuSelect();
    }
    return rest;
  };
  app.ticker.add((ticker) => {
    const elapsed = Math.min(ticker.deltaMS / 1000, 0.25);
    if (!document.hidden && monitor.push(ticker.deltaMS) && postFx.degrade()) {
      console.info('Performance: reduced post-FX');
    }
    loop.advance(elapsed, () => {
      const sim = mergeInputs([keyboard.poll(), touch.poll()]);
      sim.beat = audio?.simBeat() ?? null;
      const input: FrameInput = {
        sim,
        menu: keyboard.consumeMenu(),
        taps: menuFrame(scene) ? toggleSound(touch.consumeTaps()).map((t) => toMenu(scene, t)) : touch.consumeTaps(),
        pause: keyboard.consumePause(),
      };
      scene.update(input, SIM_DT);
    });
    const pulse = beatPulse(audio?.currentBeat() ?? null);
    const inMenu = menuFrame(scene);
    menuBackdrop.visible = inMenu;
    if (inMenu) {
      frameMenu(scene);
      menuStars.update(elapsed);
      menuPlanet?.update(elapsed, pulse);
    }
    scene.render(elapsed);
    uiTime += elapsed;
    soundToggle.visible = audio !== null && showsSoundToggle(scene);
    if (soundToggle.visible) soundToggle.update(save.settings.muted, audio!.isUnlocked, viewport.w, uiTime);
    soundReady = audio?.isUnlocked ?? false;
    postFx.update(elapsed);
  });
}
