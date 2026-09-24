import { Application, Container, Graphics, TextureSource } from 'pixi.js';
import { AudioEngine } from '../audio/engine';
import { compileSong } from '../audio/song';
import { MAX_STEPS_PER_FRAME, SIM_DT } from '../data/balance';
import { EARTH_SONG } from '../data/songs/earth';
import { mergeInputs } from '../input/inputFrame';
import { KeyboardInput } from '../input/keyboard';
import { FIRE_BUTTON, TouchInput } from '../input/touch';
import { createInitialState } from '../sim/state';
import { step } from '../sim/step';
import type { SimEvent, SimState } from '../sim/types';
import { Hud, type AppMode } from '../view/hud';
import { GameRenderer } from '../view/renderer';
import { loadTextures } from '../view/textures';
import { FixedLoop } from './fixedLoop';
import { computeLayout, type Layout } from './layout';

const RESTART_DELAY = 1;

function newSeed(): number {
  return (Math.random() * 2 ** 32) >>> 0;
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
  const earthSong = compileSong(EARTH_SONG);
  const unlockAudio = () => audio?.unlock();
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('pointerdown', unlockAudio);
  const judgeFire = () => audio?.judgeFire() ?? null;

  const textures = loadTextures();
  const game = new Container();
  const renderer = new GameRenderer(textures);
  const hud = new Hud(textures.glyphs);
  game.addChild(renderer.root, hud);

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

  let mode: AppMode = 'title';
  let paused = false;
  let gameOverTime = 0;
  let state: SimState = createInitialState(newSeed());

  const setPaused = (p: boolean) => {
    if (paused === p) return;
    paused = p;
    audio?.setPaused(p);
  };

  const playEvents = (events: readonly SimEvent[]) => {
    if (!audio) return;
    for (const e of events) {
      switch (e.type) {
        case 'shot':
          audio.sfx.laser(e.onBeat);
          break;
        case 'enemyKilled':
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
        case 'gameOver':
          audio.stopSong();
          break;
        default:
          break;
      }
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'run') setPaused(true);
  });

  if (import.meta.env.DEV) {
    // Dev-only inspection hook for manual/browser verification.
    (window as unknown as { __sa: unknown }).__sa = {
      get state() {
        return state;
      },
      get mode() {
        return mode;
      },
      audio,
    };
  }

  const loop = new FixedLoop(SIM_DT, MAX_STEPS_PER_FRAME);
  app.ticker.add((ticker) => {
    const elapsed = Math.min(ticker.deltaMS / 1000, 0.25);
    if (keyboard.consumePause() && mode === 'run' && state.phase !== 'gameOver') setPaused(!paused);

    loop.advance(elapsed, () => {
      const input = mergeInputs([keyboard.poll(), touch.poll()]);
      if (mode === 'title') {
        if (input.firePressed) {
          state = createInitialState(newSeed());
          mode = 'run';
          audio?.sfx.start();
          audio?.startSong(earthSong);
        }
        return;
      }
      if (paused) {
        if (input.firePressed && isTouch) setPaused(false);
        return;
      }
      if (state.phase === 'gameOver') {
        gameOverTime += SIM_DT;
        if (gameOverTime > RESTART_DELAY && input.firePressed) {
          gameOverTime = 0;
          mode = 'title';
        }
        return;
      }
      playEvents(step(state, input));
    });

    const beat = audio?.currentBeat() ?? null;
    renderer.render(state, paused ? 0 : elapsed, beat);
    hud.update(state, mode, paused, beat, audio !== null);
  });
}
