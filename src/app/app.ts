import { Application, Container, Graphics, TextureSource } from 'pixi.js';
import { AudioEngine } from '../audio/engine';
import { compileSong, type CompiledSong } from '../audio/song';
import { FIELD_H, FX, MAX_STEPS_PER_FRAME, MENU_W, SIM_DT } from '../data/balance';
import { EARTH_SONG } from '../data/songs/earth';
import { MARS_SONG } from '../data/songs/mars';
import { METRONOME_SONG } from '../data/songs/metronome';
import { MOON_SONG } from '../data/songs/moon';
import { worldAt, type WorldId } from '../data/worlds';
import { FrameMonitor } from '../fx/frameMonitor';
import { mergeInputs, type Tap } from '../input/inputFrame';
import { KeyboardInput } from '../input/keyboard';
import { TouchInput } from '../input/touch';
import { loadSave, memoryStore, writeSave, type KeyValueStore } from '../persist/save';
import { CalibrationScene } from '../scenes/calibrationScene';
import { GameOverScene } from '../scenes/gameOverScene';
import { RunScene } from '../scenes/runScene';
import type { FrameInput, Scene, SceneContext } from '../scenes/scene';
import { SettingsScene } from '../scenes/settingsScene';
import { ShopScene } from '../scenes/shopScene';
import { TitleScene } from '../scenes/titleScene';
import { createBackdrop, type Backdrop } from '../view/backdrops';
import { beatPulse } from '../view/beatPulse';
import { FireButtonView } from '../view/fireButton';
import { PostFx } from '../view/postfx';
import { Starfield } from '../view/starfield';
import { loadTextures } from '../view/textures';
import { FixedLoop } from './fixedLoop';
import { computeLayout, type Layout } from './layout';
import { viewport } from './viewport';

function browserStore(): KeyValueStore {
  try {
    const s = window.localStorage;
    s.getItem('space-alliance:probe');
    return s;
  } catch {
    return memoryStore();
  }
}

/** Menus use a fixed MENU_W × FIELD_H design frame, centered and shrunk to fit narrow fields. */
function menuFrame(scene: Scene): boolean {
  return !(scene instanceof RunScene);
}

function menuScale(): number {
  return Math.min(1, viewport.w / MENU_W);
}

function frameMenu(scene: Scene): void {
  const k = menuScale();
  scene.root.scale.set(k);
  scene.root.position.set(Math.round((viewport.w - MENU_W * k) / 2), Math.round((FIELD_H - FIELD_H * k) / 2));
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

  let pressDelta: number | null = null;
  const judgeFire = () => {
    pressDelta = audio?.beatDelta() ?? null;
    return audio?.judgeFire(save.settings.latencyOffsetMs) ?? null;
  };

  const songs: Record<WorldId, CompiledSong> = {
    earth: compileSong(EARTH_SONG),
    moon: compileSong(MOON_SONG),
    mars: compileSong(MARS_SONG),
  };
  const songForWorld = (world: number) => songs[worldAt(world).id];


  const textures = loadTextures();
  const game = new Container();
  const sceneLayer = new Container();
  // Shared animated backdrop behind every menu; runs draw their own world backdrop.
  const menuBackdrop = new Container();
  const menuStars = new Starfield();
  let menuPlanet: Backdrop | null = null;
  sceneLayer.addChild(menuBackdrop);
  // Clip everything (planets, streaks, off-field bullets) to the playfield.
  const fieldMask = new Graphics();
  game.addChild(sceneLayer, fieldMask);
  sceneLayer.mask = fieldMask;

  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const fireButton = isTouch ? new FireButtonView() : null;
  if (fireButton) game.addChild(fireButton);
  app.stage.addChild(game);
  const postFx = new PostFx(game, window.devicePixelRatio || 1);
  app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  let layout: Layout = computeLayout(window.innerWidth, window.innerHeight);
  // Menus lay themselves out once; rebuild them when the field width changes. Runs adopt it at the next stage.
  let rebuildMenu: (() => void) | null = null;
  const applyLayout = () => {
    layout = computeLayout(window.innerWidth, window.innerHeight);
    const widthChanged = layout.fieldW !== viewport.w;
    viewport.w = layout.fieldW;
    game.scale.set(layout.scale);
    game.position.set(layout.offsetX, layout.offsetY);
    fieldMask.clear().rect(0, 0, layout.fieldW, FIELD_H).fill(0xffffff);
    menuPlanet?.root.destroy({ children: true });
    menuPlanet = createBackdrop('earth', layout.fieldW);
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
      audio?.setVolumes(save.settings.musicVolume, save.settings.sfxVolume);
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
      run: () => new RunScene(ctx),
      gameOver: (summary) => new GameOverScene(ctx, summary),
      shop: () => new ShopScene(ctx),
      settings: () => new SettingsScene(ctx),
      calibration: () => new CalibrationScene(ctx),
    },
  };
  ctx.applySettings();
  rebuildMenu = () => {
    if (scene instanceof TitleScene) ctx.goto(ctx.scenes.title());
    else if (scene instanceof ShopScene) ctx.goto(ctx.scenes.shop());
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
    };
  }

  const monitor = new FrameMonitor(FX.degrade.windowMs, FX.degrade.maxAvgMs, FX.degrade.stallMs);
  const loop = new FixedLoop(SIM_DT, MAX_STEPS_PER_FRAME);
  app.ticker.add((ticker) => {
    const elapsed = Math.min(ticker.deltaMS / 1000, 0.25);
    if (!document.hidden && monitor.push(ticker.deltaMS) && postFx.degrade()) {
      console.info('Performance: reduced post-FX');
    }
    loop.advance(elapsed, () => {
      const touchFrame = touch.poll();
      if (touchFrame.firePressed) fireButton?.press();
      const sim = mergeInputs([keyboard.poll(), touchFrame]);
      sim.beat = audio?.currentBeat() ?? null;
      const input: FrameInput = {
        sim,
        menu: keyboard.consumeMenu(),
        taps: menuFrame(scene) ? touch.consumeTaps().map((t) => toMenu(scene, t)) : touch.consumeTaps(),
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
    fireButton?.update(elapsed, pulse);
    postFx.update(elapsed);
  });
}
