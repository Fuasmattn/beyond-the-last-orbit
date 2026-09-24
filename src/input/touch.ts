import type { Layout } from '../app/layout';
import type { InputFrame } from '../sim/types';
import type { InputSource } from './inputFrame';

/** Fire button in logical playfield coords. */
export const FIRE_BUTTON = { x: 206, y: 286, r: 22 } as const;
const FIRE_SLOP = 8;
const DRAG_SENSITIVITY = 1.25;

export function isInFireButton(lx: number, ly: number): boolean {
  return Math.hypot(lx - FIRE_BUTTON.x, ly - FIRE_BUTTON.y) <= FIRE_BUTTON.r + FIRE_SLOP;
}

/** Relative drag anywhere moves the ship; fire button taps shoot. Multi-touch. */
export class TouchInput implements InputSource {
  private dragPointer: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private dx = 0;
  private dy = 0;
  private firePending = false;

  constructor(el: HTMLElement, getLayout: () => Layout) {
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      const l = getLayout();
      const lx = (e.clientX - l.offsetX) / l.scale;
      const ly = (e.clientY - l.offsetY) / l.scale;
      if (isInFireButton(lx, ly)) {
        this.firePending = true;
        return;
      }
      if (this.dragPointer === null) {
        this.dragPointer = e.pointerId;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.dragPointer) return;
      const s = getLayout().scale;
      this.dx += ((e.clientX - this.lastX) / s) * DRAG_SENSITIVITY;
      this.dy += ((e.clientY - this.lastY) / s) * DRAG_SENSITIVITY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId === this.dragPointer) this.dragPointer = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  poll(): InputFrame {
    const frame: InputFrame = {
      moveX: 0,
      moveY: 0,
      dragX: this.dx,
      dragY: this.dy,
      firePressed: this.firePending,
      fireOnBeat: null,
    };
    this.dx = 0;
    this.dy = 0;
    this.firePending = false;
    return frame;
  }
}
