import type { ShotJudgement } from '../audio/rhythmJudge';
import type { Layout } from '../app/layout';
import { BEAT_TRACK, FIELD_H } from '../data/balance';
import type { InputFrame } from '../sim/types';
import type { FireJudge, InputSource, Tap } from './inputFrame';

const FIRE_RADIUS = 26;
const FIRE_SLOP = 10;

/** Fire button in logical playfield coords: bottom right, just above the beat track. */
export function fireButton(fieldW: number): { x: number; y: number; r: number } {
  return { x: fieldW - 36, y: FIELD_H - BEAT_TRACK.h - 30, r: FIRE_RADIUS };
}
const DRAG_SENSITIVITY = 1.25;

export function isInFireButton(lx: number, ly: number, fieldW: number): boolean {
  const b = fireButton(fieldW);
  return Math.hypot(lx - b.x, ly - b.y) <= b.r + FIRE_SLOP;
}

/** Relative drag anywhere moves the ship; fire button taps shoot. Multi-touch. Every press is also a menu tap. */
export class TouchInput implements InputSource {
  private dragPointer: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private dx = 0;
  private dy = 0;
  private firePending = false;
  private fireJudgement: ShotJudgement | null = null;
  private taps: Tap[] = [];

  constructor(
    el: HTMLElement,
    getLayout: () => Layout,
    private readonly judgeFire: FireJudge = () => null,
  ) {
    el.addEventListener('pointerdown', (e) => {
      const l = getLayout();
      const lx = (e.clientX - l.offsetX) / l.scale;
      const ly = (e.clientY - l.offsetY) / l.scale;
      this.taps.push({ x: lx, y: ly });
      if (e.pointerType === 'mouse') return;
      if (isInFireButton(lx, ly, l.fieldW)) {
        if (!this.firePending) {
          this.firePending = true;
          this.fireJudgement = this.judgeFire(e.timeStamp);
        }
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
      fireOnBeat: this.firePending ? (this.fireJudgement?.onBeat ?? null) : null,
      firePerfect: this.firePending && this.fireJudgement?.perfect === true,
      beat: null,
    };
    this.fireJudgement = null;
    this.dx = 0;
    this.dy = 0;
    this.firePending = false;
    return frame;
  }

  consumeTaps(): Tap[] {
    const t = this.taps;
    this.taps = [];
    return t;
  }
}
