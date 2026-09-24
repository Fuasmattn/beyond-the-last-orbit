import { Application, Container, Graphics, TextureSource } from 'pixi.js';
import { FIELD_H, FIELD_W, MAX_STEPS_PER_FRAME, SIM_DT } from '../data/balance';
import { mergeInputs } from '../input/inputFrame';
import { KeyboardInput } from '../input/keyboard';
import { FIRE_BUTTON, TouchInput } from '../input/touch';
import { createInitialState } from '../sim/state';
import { step } from '../sim/step';
import type { SimState } from '../sim/types';
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

  const textures = loadTextures();
  const game = new Container();
  const backdrop = new Graphics().rect(0, 0, FIELD_W, FIELD_H).fill(0x05060d);
  const renderer = new GameRenderer(textures);
  const hud = new Hud(textures.glyphs);
  game.addChild(backdrop, renderer.root, hud);

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

  const keyboard = new KeyboardInput(window);
  const touch = new TouchInput(app.canvas, () => layout);

  let mode: AppMode = 'title';
  let paused = false;
  let gameOverTime = 0;
  let state: SimState = createInitialState(newSeed());

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'run') paused = true;
  });

  const loop = new FixedLoop(SIM_DT, MAX_STEPS_PER_FRAME);
  app.ticker.add((ticker) => {
    const elapsed = Math.min(ticker.deltaMS / 1000, 0.25);
    if (keyboard.consumePause() && mode === 'run' && state.phase !== 'gameOver') paused = !paused;

    loop.advance(elapsed, () => {
      const input = mergeInputs([keyboard.poll(), touch.poll()]);
      if (mode === 'title') {
        if (input.firePressed) {
          state = createInitialState(newSeed());
          mode = 'run';
        }
        return;
      }
      if (paused) {
        if (input.firePressed && isTouch) paused = false;
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
      step(state, input);
    });

    renderer.render(state, paused ? 0 : elapsed);
    hud.update(state, mode, paused);
  });
}
