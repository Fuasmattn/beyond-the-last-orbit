import type { ShotJudgement } from '../audio/rhythmJudge';
import type { Layout } from '../app/layout';
import type { InputFrame } from '../sim/types';
import type { FireJudge, InputSource, Tap } from './inputFrame';

const DRAG_SENSITIVITY = 1.25;
/** A steer touch released this quickly without moving far counts as a tap (fire). */
export const TAP_MAX_MS = 250;
export const TAP_MAX_MOVE = 10;

export function isTap(durationMs: number, movedPx: number): boolean {
  return durationMs <= TAP_MAX_MS && movedPx < TAP_MAX_MOVE;
}

interface Pointer {
  x: number;
  y: number;
  downX: number;
  downY: number;
  downTime: number;
}

/**
 * Whole-screen gestures, no touch zones. The first finger steers (relative drag); a quick tap with it
 * fires on release, judged at the press time. Any finger landing while another steers fires at once.
 * Every press is also a menu tap.
 */
export class TouchInput implements InputSource {
  private readonly pointers = new Map<number, Pointer>();
  private steer: number | null = null;
  private dx = 0;
  private dy = 0;
  private firePending = false;
  private fireJudgement: ShotJudgement | null = null;
  private taps: Tap[] = [];

  constructor(
    el: HTMLElement,
    private readonly getLayout: () => Layout,
    private readonly judgeFire: FireJudge = () => null,
  ) {
    el.addEventListener('pointerdown', (e) => {
      const l = getLayout();
      this.taps.push({ x: (e.clientX - l.offsetX) / l.scale, y: (e.clientY - l.offsetY) / l.scale });
      if (e.pointerType === 'mouse') return;
      this.pointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        downX: e.clientX,
        downY: e.clientY,
        downTime: e.timeStamp,
      });
      if (this.steer === null) this.steer = e.pointerId;
      else this.fire(e.timeStamp);
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      if (e.pointerId === this.steer) {
        const s = this.getLayout().scale;
        this.dx += ((e.clientX - p.x) / s) * DRAG_SENSITIVITY;
        this.dy += ((e.clientY - p.y) / s) * DRAG_SENSITIVITY;
      }
      p.x = e.clientX;
      p.y = e.clientY;
    });
    const end = (e: PointerEvent, cancelled: boolean) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      if (e.pointerId !== this.steer) return;
      const moved = Math.hypot(e.clientX - p.downX, e.clientY - p.downY);
      if (!cancelled && isTap(e.timeStamp - p.downTime, moved)) this.fire(p.downTime);
      // A finger still down takes over steering.
      this.steer = this.pointers.keys().next().value ?? null;
    };
    el.addEventListener('pointerup', (e) => end(e, false));
    el.addEventListener('pointercancel', (e) => end(e, true));
  }

  private fire(timeStamp: number): void {
    if (this.firePending) return;
    this.firePending = true;
    this.fireJudgement = this.judgeFire(timeStamp);
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
