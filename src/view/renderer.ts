import { Container, Sprite, Texture } from 'pixi.js';
import type { Bullet, Enemy, SimState } from '../sim/types';
import { Starfield } from './starfield';
import type { GameTextures } from './textures';

const PLAYER_BULLET_COLOR = 0x9ff6ff;
const ENEMY_BULLET_COLOR = 0xffa040;

function syncSprites<T extends { id: number }>(
  sprites: Map<number, Sprite>,
  items: readonly T[],
  layer: Container,
  create: (item: T) => Sprite,
  update: (sprite: Sprite, item: T) => void,
): void {
  const seen = new Set<number>();
  for (const item of items) {
    let s = sprites.get(item.id);
    if (!s) {
      s = create(item);
      sprites.set(item.id, s);
      layer.addChild(s);
    }
    update(s, item);
    seen.add(item.id);
  }
  for (const [id, s] of sprites) {
    if (!seen.has(id)) {
      s.destroy();
      sprites.delete(id);
    }
  }
}

export class GameRenderer {
  readonly root = new Container();
  private readonly starfield = new Starfield();
  private readonly entities = new Container();
  private readonly player: Sprite;
  private readonly enemySprites = new Map<number, Sprite>();
  private readonly bulletSprites = new Map<number, Sprite>();

  constructor(private readonly tex: GameTextures) {
    this.player = new Sprite(tex.player);
    this.entities.addChild(this.player);
    this.root.addChild(this.starfield, this.entities);
  }

  render(state: SimState, dt: number): void {
    this.starfield.update(dt);

    const p = state.player;
    this.player.position.set(Math.round(p.x), Math.round(p.y));
    const blinkOff = p.invuln > 0 && Math.floor(state.time * 20) % 2 === 1;
    this.player.visible = state.phase !== 'gameOver' && !blinkOff;

    const frame = Math.floor(state.time * 2) % 2 === 0 ? 0 : 1;
    syncSprites<Enemy>(
      this.enemySprites,
      state.enemies,
      this.entities,
      (e) => new Sprite(this.tex.enemies[e.kind][0]),
      (s, e) => {
        s.texture = this.tex.enemies[e.kind][frame];
        s.position.set(Math.round(e.x), Math.round(e.y));
      },
    );

    syncSprites<Bullet>(
      this.bulletSprites,
      state.bullets,
      this.entities,
      (b) => {
        const s = new Sprite(Texture.WHITE);
        s.width = b.w;
        s.height = b.h;
        s.tint = b.owner === 'player' ? PLAYER_BULLET_COLOR : ENEMY_BULLET_COLOR;
        return s;
      },
      (s, b) => s.position.set(Math.round(b.x), Math.round(b.y)),
    );
  }
}
