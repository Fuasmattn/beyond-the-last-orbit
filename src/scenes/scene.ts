import type { Container } from 'pixi.js';
import type { AudioEngine } from '../audio/engine';
import type { CompiledSong } from '../audio/song';
import type { MenuAction, Tap } from '../input/inputFrame';
import type { SaveData } from '../persist/schema';
import type { InputFrame, RunMode } from '../sim/types';
import type { GameTextures } from '../view/textures';

/** Everything input-related for one fixed sim step. */
export interface FrameInput {
  sim: InputFrame;
  menu: readonly MenuAction[];
  taps: readonly Tap[];
  pause: boolean;
}

export interface RunSummary {
  mode: RunMode;
  score: number;
  world: number;
  stage: number;
  loop: number;
  bossesKilled: number;
  perfectStages: number;
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
  run(mode: RunMode): Scene;
  gameOver(summary: RunSummary): Scene;
  shop(): Scene;
  hangar(): Scene;
  settings(): Scene;
  calibration(): Scene;
}

export interface SceneContext {
  readonly textures: GameTextures;
  readonly audio: AudioEngine | null;
  readonly save: SaveData;
  readonly isTouch: boolean;
  readonly scenes: SceneFactory;
  readonly metronome: CompiledSong;
  /** One-shot message for the title screen (e.g. save reset). */
  notice: string | null;
  /** The world's song at its loop tempo. */
  songForWorld(world: number, loop: number): CompiledSong;
  /** Beat delta (s) captured at the most recent fire press, consumed on read. */
  takePressDelta(): number | null;
  /** Push settings (volumes) to the audio engine. */
  applySettings(): void;
  /** 0..1 chromatic aberration strength (driven by screen shake). */
  setAberration(amount: number): void;
  persist(): void;
  goto(next: Scene): void;
}
