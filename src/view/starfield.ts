import { Container, Sprite, Texture } from 'pixi.js';
import { FIELD_H, FIELD_W } from '../data/balance';

interface Layer {
  stars: Sprite[];
  speed: number;
}

const LAYERS = [
  { count: 40, speed: 6, color: 0x3a4466, size: 1 },
  { count: 24, speed: 14, color: 0x8899bb, size: 1 },
  { count: 10, speed: 32, color: 0xffffff, size: 2 },
] as const;

export class Starfield extends Container {
  private readonly layers: Layer[] = [];

  constructor() {
    super();
    for (const def of LAYERS) {
      const stars: Sprite[] = [];
      for (let i = 0; i < def.count; i++) {
        const s = new Sprite(Texture.WHITE);
        s.tint = def.color;
        s.width = 1;
        s.height = def.size;
        s.x = Math.floor(Math.random() * FIELD_W);
        s.y = Math.random() * FIELD_H;
        this.addChild(s);
        stars.push(s);
      }
      this.layers.push({ stars, speed: def.speed });
    }
  }

  update(dt: number): void {
    for (const layer of this.layers) {
      for (const s of layer.stars) {
        s.y += layer.speed * dt;
        if (s.y > FIELD_H) {
          s.y -= FIELD_H + 2;
          s.x = Math.floor(Math.random() * FIELD_W);
        }
      }
    }
  }
}
