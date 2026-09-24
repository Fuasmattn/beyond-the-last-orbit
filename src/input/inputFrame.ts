import { clamp } from '../sim/math';
import type { InputFrame } from '../sim/types';

export interface InputSource {
  /** Returns input since last poll; consumes pending edge events. */
  poll(): InputFrame;
}

/** Called at the moment fire is pressed; returns rhythm verdict or null (no audio). */
export type FireJudge = () => boolean | null;

export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

/** A pointer press in logical playfield coordinates. */
export interface Tap {
  x: number;
  y: number;
}

export function mergeInputs(frames: readonly InputFrame[]): InputFrame {
  let moveX = 0;
  let moveY = 0;
  let dragX = 0;
  let dragY = 0;
  let firePressed = false;
  let fireOnBeat: boolean | null = null;
  let beat: number | null = null;
  for (const f of frames) {
    moveX += f.moveX;
    moveY += f.moveY;
    dragX += f.dragX;
    dragY += f.dragY;
    if (f.firePressed && !firePressed) {
      firePressed = true;
      fireOnBeat = f.fireOnBeat;
    }
    if (beat === null && f.beat !== null) beat = f.beat;
  }
  return {
    moveX: clamp(moveX, -1, 1),
    moveY: clamp(moveY, -1, 1),
    dragX,
    dragY,
    firePressed,
    fireOnBeat,
    beat,
  };
}
