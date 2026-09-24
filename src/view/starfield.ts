import { Container, Sprite, Texture } from 'pixi.js';
import { FIELD_H, FIELD_W } from '../data/balance';

interface Star {
  sprite: Sprite;
  size: number;
}

interface Layer {
  stars: Star[];
  speed: number;
}

const LAYERS = [
  { count: 40, speed: 6, color: 0x3a4466, size: 1 },
  { count: 24, speed: 14, color: 0x8899bb, size: 1 },
  { count: 10, speed: 32, color: 0xffffff, size: 2 },
] as const;

/** Stretch of star streaks per unit of extra speed during warp. */
const STREAK = 0.35;

export class Starfield extends Container {
  private readonly layers: Layer[] = [];

  constructor() {
    super();
    for (const def of LAYERS) {
      const stars: Star[] = [];
      for (let i = 0; i < def.count; i++) {
        const s = new Sprite(Texture.WHITE);
        s.tint = def.color;
        s.width = 1;
        s.height = def.size;
        s.x = Math.floor(Math.random() * FIELD_W);
        s.y = Math.random() * FIELD_H;
        this.addChild(s);
        stars.push({ sprite: s, size: def.size });
      }
      this.layers.push({ stars, speed: def.speed });
    }
  }

  /** `speedMul` > 1 streaks the stars (warp). */
  update(dt: number, speedMul = 1): void {
    for (const layer of this.layers) {
      for (const { sprite, size } of layer.stars) {
        sprite.y += layer.speed * speedMul * dt;
        sprite.height = size * (1 + (speedMul - 1) * STREAK);
        if (sprite.y > FIELD_H) {
          sprite.y -= FIELD_H + sprite.height + 2;
          sprite.x = Math.floor(Math.random() * FIELD_W);
        }
      }
    }
  }
}
