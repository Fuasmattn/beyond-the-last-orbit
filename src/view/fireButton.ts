import { Graphics } from 'pixi.js';
import { FIRE_BUTTON } from '../input/touch';

const PRESS_TIME = 0.12;

/** Touch fire button that throbs on the beat (a timing aid) and flashes when pressed. */
export class FireButtonView extends Graphics {
  private pressed = 0;

  press(): void {
    this.pressed = PRESS_TIME;
  }

  update(dt: number, pulse: number): void {
    this.pressed = Math.max(0, this.pressed - dt);
    const { x, y, r } = FIRE_BUTTON;
    this.clear()
      .circle(x, y, r)
      .fill({ color: 0xff3b5c, alpha: this.pressed > 0 ? 0.55 : 0.2 })
      .circle(x, y, r)
      .stroke({ color: 0xff3b5c, width: 1, alpha: 0.6 + 0.4 * pulse })
      .circle(x, y, r + 2 + 5 * pulse)
      .stroke({ color: 0xffe14a, width: 1, alpha: 0.6 * pulse });
  }
}
