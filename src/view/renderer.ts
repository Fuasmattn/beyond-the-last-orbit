import { Container, Sprite, Texture } from 'pixi.js';
import { FIELD_H, FIELD_W, STAGE, WARP } from '../data/balance';
import { worldAt, type WorldId } from '../data/worlds';
import { laserBox } from '../sim/boss/warden';
import type { Boss, BossKind, Bullet, Enemy, SimState } from '../sim/types';
import { blink, popInScale } from './anim';
import { createBackdrop, type Backdrop } from './backdrops';
import { beatPulse, lerpColor } from './beatPulse';
import { Starfield } from './starfield';
import type { GameTextures } from './textures';

const PLAYER_BULLET_COLOR = 0x9ff6ff;
const ENEMY_BULLET_COLOR = 0xffa040;
const BOMB_COLOR = 0xff5a2a;
const ON_BEAT_BULLET_COLOR = 0xffe14a;
const BACKDROP_BASE = 0x05060d;
const BACKDROP_PULSE = 0x1a2244;
const LASER_COLOR = 0xff3b5c;
const WORLD_TINT: Record<WorldId, number> = { earth: 0xffffff, moon: 0xdce4ff, mars: 0xffd4b8 };
const LOOP_DARKEN = 0.12;
const WARP_SPEED = 40;

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

interface BossSprites {
  kind: BossKind;
  body: Sprite;
  parts: Sprite[];
}

export class GameRenderer {
  readonly root = new Container();
  private readonly backdrop = whiteSprite(BACKDROP_BASE);
  private readonly starfield = new Starfield();
  private readonly planetLayer = new Container();
  private readonly entities = new Container();
  private readonly player: Sprite;
  private readonly enemySprites = new Map<number, Sprite>();
  private readonly bulletSprites = new Map<number, Sprite>();
  private readonly bossLayer = new Container();
  private readonly laserWarn = whiteSprite(LASER_COLOR);
  private readonly laserBeam = whiteSprite(LASER_COLOR);
  private readonly laserCore = whiteSprite(0xffffff);
  private boss: BossSprites | null = null;
  private world: WorldId | null = null;
  private planet: Backdrop | null = null;

  constructor(private readonly tex: GameTextures) {
    this.backdrop.width = FIELD_W;
    this.backdrop.height = FIELD_H;
    this.player = new Sprite(tex.player);
    this.laserBeam.alpha = 0.85;
    this.bossLayer.addChild(this.laserWarn, this.laserBeam, this.laserCore);
    this.entities.addChild(this.player);
    this.root.addChild(this.backdrop, this.starfield, this.planetLayer, this.bossLayer, this.entities);
  }

  render(state: SimState, dt: number, beat: number | null): void {
    const pulse = beatPulse(beat);
    const warp = state.phase === 'warp';
    const warpProgress = warp ? 1 - state.phaseTimer / WARP.time : 0;
    this.backdrop.tint = lerpColor(BACKDROP_BASE, BACKDROP_PULSE, pulse * 0.6);
    this.starfield.update(dt, warp ? 1 + WARP_SPEED * Math.sin(Math.PI * warpProgress) : 1);
    this.renderPlanet(state, dt, warp);

    const worldTint = lerpColor(
      WORLD_TINT[worldAt(state.world).id],
      0x000000,
      Math.min(3, state.loop) * LOOP_DARKEN,
    );

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
        s.scale.set(e.row >= 0 ? popInScale(intro, e.row) : 1);
        s.tint = worldTint;
        s.alpha = e.phased ? 0.25 : e.flash > 0 ? 0.5 : 1;
      },
    );

    syncSprites<Bullet>(
      this.bulletSprites,
      state.bullets,
      this.entities,
      (b) => {
        const color =
          b.fuse !== undefined
            ? BOMB_COLOR
            : b.owner === 'enemy'
              ? ENEMY_BULLET_COLOR
              : b.onBeat
                ? ON_BEAT_BULLET_COLOR
                : PLAYER_BULLET_COLOR;
        const s = whiteSprite(color);
        s.width = b.w;
        s.height = b.h;
        return s;
      },
      (s, b) => {
        s.position.set(Math.round(b.x), Math.round(b.y));
        if (b.fuse !== undefined) s.alpha = b.fuse < 0.4 && !blink(state.time, 8) ? 0.4 : 1;
      },
    );

    this.renderBoss(state.boss, state.time, pulse, worldTint);
  }

  private renderPlanet(state: SimState, dt: number, warp: boolean): void {
    const id = worldAt(state.world).id;
    if (id !== this.world) {
      this.planet?.root.destroy({ children: true });
      this.planet = createBackdrop(id);
      this.planetLayer.addChild(this.planet.root);
      this.world = id;
    }
    this.planet?.update(dt);
    const target = warp ? 0 : 1;
    this.planetLayer.alpha += (target - this.planetLayer.alpha) * Math.min(1, dt * 3);
  }

  private ensureBossSprites(b: Boss): BossSprites {
    if (this.boss && this.boss.kind === b.kind && this.boss.parts.length === b.parts.length) return this.boss;
    if (this.boss) {
      this.boss.body.destroy();
      for (const p of this.boss.parts) p.destroy();
    }
    const body = new Sprite(this.tex.bosses[b.kind]);
    const partTex = b.kind === 'dreadnought' ? this.tex.plate : this.tex.turret;
    const parts = b.parts.map(() => new Sprite(partTex));
    this.bossLayer.addChild(body, ...parts);
    this.boss = { kind: b.kind, body, parts };
    return this.boss;
  }

  private renderBoss(b: Boss | null, time: number, pulse: number, worldTint: number): void {
    this.bossLayer.visible = b !== null;
    if (!b) return;
    const sprites = this.ensureBossSprites(b);
    const body = sprites.body;
    body.position.set(Math.round(b.x), Math.round(b.y));
    body.visible = b.dying === 0 || blink(time, 10);
    body.alpha = b.phased ? (blink(time, 6) ? 0.3 : 0.15) : b.flash > 0 ? 0.6 : 1;
    body.tint = b.phase === 3 ? lerpColor(worldTint, 0xff6070, 0.4 + 0.6 * pulse) : worldTint;
    b.parts.forEach((t, i) => {
      const s = sprites.parts[i];
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
