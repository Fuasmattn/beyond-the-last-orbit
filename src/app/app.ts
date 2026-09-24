import { Application, Container, Graphics, TextureSource } from 'pixi.js';
import { AudioEngine } from '../audio/engine';
import { compileSong, type CompiledSong } from '../audio/song';
import { FIELD_H, FIELD_W, MAX_STEPS_PER_FRAME, SIM_DT } from '../data/balance';
import { EARTH_SONG } from '../data/songs/earth';
import { MARS_SONG } from '../data/songs/mars';
import { METRONOME_SONG } from '../data/songs/metronome';
import { MOON_SONG } from '../data/songs/moon';
import { worldAt, type WorldId } from '../data/worlds';
import { mergeInputs } from '../input/inputFrame';
import { KeyboardInput } from '../input/keyboard';
import { FIRE_BUTTON, TouchInput } from '../input/touch';
import { loadSave, memoryStore, writeSave, type KeyValueStore } from '../persist/save';
import { CalibrationScene } from '../scenes/calibrationScene';
import { GameOverScene } from '../scenes/gameOverScene';
import { RunScene } from '../scenes/runScene';
import type { FrameInput, Scene, SceneContext } from '../scenes/scene';
import { SettingsScene } from '../scenes/settingsScene';
import { ShopScene } from '../scenes/shopScene';
import { TitleScene } from '../scenes/titleScene';
import { loadTextures } from '../view/textures';
import { FixedLoop } from './fixedLoop';
import { computeLayout, type Layout } from './layout';

function browserStore(): KeyValueStore {
  try {
    const s = window.localStorage;
    s.getItem('space-alliance:probe');
    return s;
  } catch {
    return memoryStore();
  }
}

export async function startApp(host: HTMLElement): Promise<void> {
  TextureSource.defaultOptions.scaleMode = 'nearest';
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#000000',
    antialias: false,
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
  // Clip everything (planets, streaks, off-field bullets) to the 3:4 playfield.
  const fieldMask = new Graphics().rect(0, 0, FIELD_W, FIELD_H).fill(0xffffff);
  game.addChild(sceneLayer, fieldMask);
  sceneLayer.mask = fieldMask;

  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  if (isTouch) {
    const button = new Graphics()
      .circle(FIRE_BUTTON.x, FIRE_BUTTON.y, FIRE_BUTTON.r)
      .fill({ color: 0xff3b5c, alpha: 0.25 })
      .stroke({ color: 0xff3b5c, width: 1, alpha: 0.8 });
    game.addChild(button);
  }
  app.stage.addChild(game);

  let layout: Layout = computeLayout(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  const applyLayout = () => {
    layout = computeLayout(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    game.scale.set(layout.scale);
    game.position.set(layout.offsetX, layout.offsetY);
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
    applySettings: () => audio?.setVolumes(save.settings.musicVolume, save.settings.sfxVolume),
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

  const loop = new FixedLoop(SIM_DT, MAX_STEPS_PER_FRAME);
  app.ticker.add((ticker) => {
    const elapsed = Math.min(ticker.deltaMS / 1000, 0.25);
    loop.advance(elapsed, () => {
      const sim = mergeInputs([keyboard.poll(), touch.poll()]);
      sim.beat = audio?.currentBeat() ?? null;
      const input: FrameInput = {
        sim,
        menu: keyboard.consumeMenu(),
        taps: touch.consumeTaps(),
        pause: keyboard.consumePause(),
      };
      scene.update(input, SIM_DT);
    });
    scene.render(elapsed);
  });
}
