import { Container, Sprite, Texture } from 'pixi.js';
import { FIELD_H, TOUCH_VIEW } from '../data/balance';

interface Star {
  sprite: Sprite;
  size: number;
}

interface Layer {
  root: Container;
  stars: Star[];
  speed: number;
  parallax: number;
}

/** `parallax`: fraction of the camera's pan the layer moves on screen (far stars move least). */
const LAYERS = [
  { count: 100, speed: 6, color: 0x3a4466, size: 1, parallax: 0.2 },
  { count: 60, speed: 14, color: 0x8899bb, size: 1, parallax: 0.4 },
  { count: 25, speed: 32, color: 0xffffff, size: 2, parallax: 0.65 },
] as const;

/**
 * Stars span this x range so every layer covers the widest view, including parallax offsets and
 * views wider than the field (camera x down to −(maxW − field)/2). Counts are per `SPAN_UNIT` px.
 */
const SPAN = { x0: -TOUCH_VIEW.maxW / 2, x1: TOUCH_VIEW.maxW } as const;
const SPAN_UNIT = 600;
const randomX = () => Math.floor(SPAN.x0 + Math.random() * (SPAN.x1 - SPAN.x0));

/** Stretch of star streaks per unit of extra speed during warp. */
const STREAK = 0.35;

export class Starfield extends Container {
  private readonly layers: Layer[] = [];

  constructor() {
    super();
    for (const def of LAYERS) {
      const root = new Container();
      this.addChild(root);
      const stars: Star[] = [];
      const count = Math.round((def.count * (SPAN.x1 - SPAN.x0)) / SPAN_UNIT);
      for (let i = 0; i < count; i++) {
        const s = new Sprite(Texture.WHITE);
        s.tint = def.color;
        s.width = 1;
        s.height = def.size;
        s.x = randomX();
        s.y = Math.random() * FIELD_H;
        root.addChild(s);
        stars.push({ sprite: s, size: def.size });
      }
      this.layers.push({ root, stars, speed: def.speed, parallax: def.parallax });
    }
  }

  /** Offsets the layers for a camera at `camX` inside a parent that is shifted by `-camX`. */
  pan(camX: number): void {
    for (const layer of this.layers) layer.root.x = camX * (1 - layer.parallax);
  }

  /** `speedMul` > 1 streaks the stars (warp). */
  update(dt: number, speedMul = 1): void {
    for (const layer of this.layers) {
      for (const { sprite, size } of layer.stars) {
        sprite.y += layer.speed * speedMul * dt;
        sprite.height = size * (1 + (speedMul - 1) * STREAK);
        if (sprite.y > FIELD_H) {
          sprite.y -= FIELD_H + sprite.height + 2;
          sprite.x = randomX();
        }
      }
    }
  }
}
