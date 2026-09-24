import { Container, Sprite, Texture } from 'pixi.js';
import { FIELD_H, FIELD_W, STAGE, WARDEN } from '../data/balance';
import { laserBox } from '../sim/boss/warden';
import type { Boss, Bullet, Enemy, SimState } from '../sim/types';
import { blink, popInScale } from './anim';
import { beatPulse, lerpColor } from './beatPulse';
import { Starfield } from './starfield';
import type { GameTextures } from './textures';

const PLAYER_BULLET_COLOR = 0x9ff6ff;
const ENEMY_BULLET_COLOR = 0xffa040;
const ON_BEAT_BULLET_COLOR = 0xffe14a;
const BACKDROP_BASE = 0x05060d;
const BACKDROP_PULSE = 0x1a2244;
const LASER_COLOR = 0xff3b5c;

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

function whiteSprite(tint: number): Sprite {
  const s = new Sprite(Texture.WHITE);
  s.tint = tint;
  return s;
}

export class GameRenderer {
  readonly root = new Container();
  private readonly backdrop = whiteSprite(BACKDROP_BASE);
  private readonly starfield = new Starfield();
  private readonly entities = new Container();
  private readonly player: Sprite;
  private readonly enemySprites = new Map<number, Sprite>();
  private readonly bulletSprites = new Map<number, Sprite>();
  private readonly bossLayer = new Container();
  private readonly bossBody: Sprite;
  private readonly turretSprites: Sprite[] = [];
  private readonly laserWarn = whiteSprite(LASER_COLOR);
  private readonly laserBeam = whiteSprite(LASER_COLOR);
  private readonly laserCore = whiteSprite(0xffffff);

  constructor(private readonly tex: GameTextures) {
    this.backdrop.width = FIELD_W;
    this.backdrop.height = FIELD_H;
    this.player = new Sprite(tex.player);
    this.bossBody = new Sprite(tex.wardenBody);
    for (let i = 0; i < WARDEN.turretOffsets.length; i++) this.turretSprites.push(new Sprite(tex.turret));
    this.laserBeam.alpha = 0.85;
    this.bossLayer.addChild(this.laserWarn, this.laserBeam, this.laserCore, this.bossBody, ...this.turretSprites);
    this.bossLayer.visible = false;
    this.entities.addChild(this.player);
    this.root.addChild(this.backdrop, this.starfield, this.bossLayer, this.entities);
  }

  render(state: SimState, dt: number, beat: number | null): void {
    const pulse = beatPulse(beat);
    this.backdrop.tint = lerpColor(BACKDROP_BASE, BACKDROP_PULSE, pulse * 0.6);
    this.starfield.update(dt);

    const p = state.player;
    this.player.position.set(Math.round(p.x), Math.round(p.y));
    const blinkOff = p.invuln > 0 && Math.floor(state.time * 20) % 2 === 1;
    this.player.visible = state.phase !== 'gameOver' && !blinkOff;

    const tick = beat !== null && beat >= 0 ? Math.floor(beat) : Math.floor(state.time * 2);
    const frame = tick % 2 === 0 ? 0 : 1;
    const intro = state.phase === 'stageIntro' && !state.boss ? 1 - state.phaseTimer / STAGE.introTime : 1;

    syncSprites<Enemy>(
      this.enemySprites,
      state.enemies,
      this.entities,
      (e) => {
        const s = new Sprite(this.tex.enemies[e.kind][0]);
        s.anchor.set(0.5);
        return s;
      },
      (s, e) => {
        s.texture =
          e.kind === 'shield' && e.hp < e.maxHp ? this.tex.shieldCracked[frame] : this.tex.enemies[e.kind][frame];
        s.position.set(Math.round(e.x + e.w / 2), Math.round(e.y + e.h / 2));
        s.scale.set(popInScale(intro, e.row));
        s.alpha = e.flash > 0 ? 0.5 : 1;
      },
    );

    syncSprites<Bullet>(
      this.bulletSprites,
      state.bullets,
      this.entities,
      (b) => {
        const s = whiteSprite(
          b.owner === 'enemy' ? ENEMY_BULLET_COLOR : b.onBeat ? ON_BEAT_BULLET_COLOR : PLAYER_BULLET_COLOR,
        );
        s.width = b.w;
        s.height = b.h;
        return s;
      },
      (s, b) => s.position.set(Math.round(b.x), Math.round(b.y)),
    );

    this.renderBoss(state.boss, state.time, pulse);
  }

  private renderBoss(b: Boss | null, time: number, pulse: number): void {
    this.bossLayer.visible = b !== null;
    if (!b) return;
    this.bossBody.position.set(Math.round(b.x), Math.round(b.y));
    this.bossBody.visible = b.dying === 0 || blink(time, 10);
    this.bossBody.alpha = b.flash > 0 ? 0.6 : 1;
    this.bossBody.tint = b.phase === 3 ? lerpColor(0xffffff, 0xff6070, 0.4 + 0.6 * pulse) : 0xffffff;
    b.turrets.forEach((t, i) => {
      const s = this.turretSprites[i];
      if (!s) return;
      s.visible = t.alive && b.dying === 0;
      s.position.set(Math.round(t.x), Math.round(t.y));
      s.alpha = t.flash > 0 ? 0.5 : 1;
    });

    const l = b.laser;
    this.laserWarn.visible = l !== null && l.state === 'warn' && blink(time, 8);
    this.laserBeam.visible = l !== null && l.state === 'fire';
    this.laserCore.visible = this.laserBeam.visible;
    if (!l) return;
    const box = laserBox(b, l);
    this.laserWarn.position.set(Math.round(l.x), Math.round(box.y));
    this.laserWarn.width = 1;
    this.laserWarn.height = box.h;
    this.laserBeam.position.set(Math.round(box.x), Math.round(box.y));
    this.laserBeam.width = box.w;
    this.laserBeam.height = box.h;
    this.laserCore.position.set(Math.round(l.x) - 1, Math.round(box.y));
    this.laserCore.width = 2;
    this.laserCore.height = box.h;
  }
}
