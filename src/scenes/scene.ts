import type { Container } from 'pixi.js';
import type { AudioEngine } from '../audio/engine';
import type { CompiledSong } from '../audio/song';
import type { MenuAction, Tap } from '../input/inputFrame';
import type { SaveData } from '../persist/schema';
import type { InputFrame } from '../sim/types';
import type { GameTextures } from '../view/textures';

/** Everything input-related for one fixed sim step. */
export interface FrameInput {
  sim: InputFrame;
  menu: readonly MenuAction[];
  taps: readonly Tap[];
  pause: boolean;
}

export interface RunSummary {
  score: number;
  world: number;
  stage: number;
  loop: number;
}

export interface Scene {
  readonly root: Container;
  /** Fixed-step update (SIM_DT). */
  update(input: FrameInput, dt: number): void;
  /** Once per rendered frame. */
  render(elapsed: number): void;
  onHidden?(): void;
  destroy(): void;
}

export interface SceneFactory {
  title(): Scene;
  run(): Scene;
  gameOver(summary: RunSummary): Scene;
}

export interface SceneContext {
  readonly textures: GameTextures;
  readonly audio: AudioEngine | null;
  readonly save: SaveData;
  readonly isTouch: boolean;
  readonly scenes: SceneFactory;
  /** One-shot message for the title screen (e.g. save reset). */
  notice: string | null;
  songForWorld(world: number): CompiledSong;
  persist(): void;
  goto(next: Scene): void;
}
