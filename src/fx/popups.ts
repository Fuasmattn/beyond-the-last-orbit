import { FX } from '../data/balance';

export interface Popup {
  text: string;
  color: number;
  x: number;
  y: number;
  age: number;
}

/** Floating score texts that rise and fade. */
export class Popups {
  items: Popup[] = [];

  spawn(text: string, color: number, x: number, y: number): void {
    this.items.push({ text, color, x, y, age: 0 });
    if (this.items.length > FX.popup.max) this.items.shift();
  }

  update(dt: number): void {
    for (const p of this.items) p.age += dt;
    this.items = this.items.filter((p) => p.age < FX.popup.life);
  }
}

export function popupAlpha(p: Popup): number {
  return Math.max(0, 1 - p.age / FX.popup.life);
}

export function popupRise(p: Popup): number {
  return -FX.popup.rise * (p.age / FX.popup.life);
}
