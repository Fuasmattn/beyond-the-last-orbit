import { Container, Sprite, Texture } from 'pixi.js';
import type { LaserDef } from '../data/cosmetics';
import { lerpColor } from './beatPulse';

const ON_BEAT_GOLD = 0xffe14a;

export interface LaserView {
  readonly root: Container;
  /** (x, y) = top-left of the 2×6 bullet hitbox. */
  update(x: number, y: number, time: number, pulse: number, onBeat: boolean): void;
  destroy(): void;
}

function tintFor(color: number, onBeat: boolean): number {
  return onBeat ? lerpColor(color, ON_BEAT_GOLD, 0.65) : color;
}

/** View-only bullet visuals; the sim hitbox stays 2×6 for every style. */
export function createLaserView(laser: LaserDef, orb: Texture): LaserView {
  const root = new Container();
  const part = (w: number, h: number, tex: Texture = Texture.WHITE): Sprite => {
    const s = new Sprite(tex);
    s.width = w;
    s.height = h;
    root.addChild(s);
    return s;
  };
  const view = (update: LaserView['update']): LaserView => ({
    root,
    update,
    destroy: () => root.destroy({ children: true }),
  });
  const c = laser.color;

  switch (laser.style) {
    case 'bolt': {
      const s = part(2, 6);
      return view((x, y, _t, _p, onBeat) => {
        s.position.set(x, y);
        s.tint = tintFor(c, onBeat);
      });
    }
    case 'orb': {
      const s = part(4, 4, orb);
      return view((x, y, _t, _p, onBeat) => {
        s.position.set(x - 1, y + 1);
        s.tint = tintFor(c, onBeat);
      });
    }
    case 'twin': {
      const a = part(1, 6);
      const b = part(1, 6);
      return view((x, y, _t, _p, onBeat) => {
        a.position.set(x - 1, y);
        b.position.set(x + 2, y);
        a.tint = b.tint = tintFor(c, onBeat);
      });
    }
    case 'wave': {
      const s = part(2, 4);
      return view((x, y, t, _p, onBeat) => {
        s.position.set(x + Math.round(Math.sin(y * 0.25 + t * 10) * 2), y + 1);
        s.tint = tintFor(c, onBeat);
      });
    }
    case 'trail': {
      const head = part(2, 6);
      const tail = [0.5, 0.3, 0.15].map((alpha) => {
        const s = part(2, 3);
        s.alpha = alpha;
        return s;
      });
      return view((x, y, _t, _p, onBeat) => {
        const tint = tintFor(c, onBeat);
        head.position.set(x, y);
        head.tint = tint;
        tail.forEach((s, i) => {
          s.position.set(x, y + 7 + i * 4);
          s.tint = tint;
        });
      });
    }
    case 'pulse': {
      const s = part(2, 6);
      return view((x, y, _t, pulse, onBeat) => {
        const grow = 1 + pulse * 0.8;
        s.width = 2 * grow;
        s.height = 6 * grow;
        s.position.set(x + 1 - s.width / 2, y + 3 - s.height / 2);
        s.tint = lerpColor(tintFor(c, onBeat), ON_BEAT_GOLD, pulse);
      });
    }
  }
}
