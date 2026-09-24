import type { InputFrame } from '../sim/types';
import type { FireJudge, InputSource } from './inputFrame';

const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];
const UP = ['ArrowUp', 'KeyW'];
const DOWN = ['ArrowDown', 'KeyS'];
const FIRE = 'Space';
const PAUSE = ['KeyP', 'Escape'];
const GAME_KEYS = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN, FIRE, ...PAUSE]);

export class KeyboardInput implements InputSource {
  private readonly held = new Set<string>();
  private firePending = false;
  private fireOnBeat: boolean | null = null;
  private pausePending = false;

  constructor(
    target: EventTarget,
    private readonly judgeFire: FireJudge = () => null,
  ) {
    target.addEventListener('keydown', (ev) => {
      const e = ev as KeyboardEvent;
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) {
        if (e.code === FIRE && !this.firePending) {
          this.firePending = true;
          this.fireOnBeat = this.judgeFire();
        }
        if (PAUSE.includes(e.code)) this.pausePending = true;
      }
      this.held.add(e.code);
    });
    target.addEventListener('keyup', (ev) => this.held.delete((ev as KeyboardEvent).code));
    target.addEventListener('blur', () => this.held.clear());
  }

  poll(): InputFrame {
    const frame: InputFrame = {
      moveX: this.axis(LEFT, RIGHT),
      moveY: this.axis(UP, DOWN),
      dragX: 0,
      dragY: 0,
      firePressed: this.firePending,
      fireOnBeat: this.firePending ? this.fireOnBeat : null,
    };
    this.firePending = false;
    this.fireOnBeat = null;
    return frame;
  }

  consumePause(): boolean {
    const p = this.pausePending;
    this.pausePending = false;
    return p;
  }

  private axis(neg: readonly string[], pos: readonly string[]): number {
    const n = neg.some((k) => this.held.has(k)) ? 1 : 0;
    const p = pos.some((k) => this.held.has(k)) ? 1 : 0;
    return p - n;
  }
}
