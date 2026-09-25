import { Container, Sprite, Texture } from 'pixi.js';
import { FIELD_H, STAGE, WARP } from '../data/balance';
import type { LaserDef, SkinDef } from '../data/cosmetics';
import { worldAt, type WorldId } from '../data/worlds';
import { laserBox } from '../sim/boss/warden';
import type { Boss, BossKind, Bullet, Enemy, SimEvent, SimState } from '../sim/types';
import { blink, popInScale } from './anim';
import { createBackdrop, type Backdrop } from './backdrops';
import { beatPulse, lerpColor } from './beatPulse';
import { hueToRgb } from './color';
import { Effects } from './effects';
import { createLaserView, type LaserView } from './laserView';
import { Starfield } from './starfield';
import type { GameTextures } from './textures';
import { viewport } from '../app/viewport';

const ENEMY_BULLET_COLOR = 0xffa040;
const BOMB_COLOR = 0xff5a2a;
const BACKDROP_BASE = 0x05060d;
const BACKDROP_PULSE = 0x1a2244;
const LASER_COLOR = 0xff3b5c;
const WORLD_TINT: Record<WorldId, number> = { earth: 0xffffff, moon: 0xdce4ff, mars: 0xffd4b8 };
const LOOP_DARKEN = 0.12;
const WARP_SPEED = 40;
const HUE_SPEED = 0.25;
const SHADOW = { dx: 2, dy: 3, alpha: 0.35 } as const;
const RECOIL_TIME = 0.06;

export interface Cosmetics {
  skin: SkinDef;
  laser: LaserDef;
}

/** Keeps a view per live item id; `release` returns views to a pool or destroys them. */
function syncViews<T extends { id: number }, V>(
  live: Map<number, V>,
  items: Iterable<T>,
  acquire: (item: T) => V,
  release: (view: V) => void,
  update: (view: V, item: T) => void,
): void {
  const seen = new Set<number>();
  for (const item of items) {
    let v = live.get(item.id);
    if (v === undefined) {
      v = acquire(item);
      live.set(item.id, v);
    }
    update(v, item);
    seen.add(item.id);
  }
  for (const [id, v] of live) {
    if (!seen.has(id)) {
      release(v);
      live.delete(id);
    }
  }
}

function whiteSprite(tint: number): Sprite {
  const s = new Sprite(Texture.WHITE);
  s.tint = tint;
  return s;
}

function shadowOf(tex: Texture): Sprite {
  const s = new Sprite(tex);
  s.tint = 0x000000;
  s.alpha = SHADOW.alpha;
  return s;
}

interface EnemyView {
  body: Sprite;
  shadow: Sprite;
}

interface BossSprites {
  kind: BossKind;
  body: Sprite;
  shadow: Sprite;
  parts: Sprite[];
}

export class GameRenderer {
  readonly root = new Container();
  private readonly backdrop = whiteSprite(BACKDROP_BASE);
  private readonly starfield = new Starfield();
  private readonly planetLayer = new Container();
  private readonly shadowLayer = new Container();
  private readonly bossLayer = new Container();
  private readonly entities = new Container();
  private readonly effects: Effects;
  private readonly player: Sprite;
  private readonly playerShadow: Sprite;
  private readonly enemyViews = new Map<number, EnemyView>();
  private readonly bulletSprites = new Map<number, Sprite>();
  private readonly bulletPool: Sprite[] = [];
  private readonly laserViews = new Map<number, LaserView>();
  private readonly laserPool: LaserView[] = [];
  private readonly laserWarn = whiteSprite(LASER_COLOR);
  private readonly laserBeam = whiteSprite(LASER_COLOR);
  private readonly laserCore = whiteSprite(0xffffff);
  private boss: BossSprites | null = null;
  private world: WorldId | null = null;
  private planet: Backdrop | null = null;
  private recoil = 0;

  constructor(
    private readonly tex: GameTextures,
    private readonly cosmetics: Cosmetics,
  ) {
    this.backdrop.height = FIELD_H;
    const shipTex = tex.skins.get(cosmetics.skin.id) ?? Texture.WHITE;
    this.player = new Sprite(shipTex);
    this.player.anchor.set(0.5, 1);
    this.playerShadow = shadowOf(shipTex);
    this.playerShadow.anchor.set(0.5, 1);
    this.effects = new Effects(tex.glyphs);
    this.laserBeam.alpha = 0.85;
    this.bossLayer.addChild(this.laserWarn, this.laserBeam, this.laserCore);
    this.shadowLayer.addChild(this.playerShadow);
    this.entities.addChild(this.player);
    this.root.addChild(
      this.backdrop,
      this.starfield,
      this.planetLayer,
      this.shadowLayer,
      this.bossLayer,
      this.entities,
      this.effects,
    );
  }

  get trauma(): number {
    return this.effects.shake.trauma;
  }

  shakeOffset(time: number): { x: number; y: number } {
    return this.effects.shake.offset(time);
  }

  notify(events: readonly SimEvent[]): void {
    this.effects.notify(events);
    if (events.some((e) => e.type === 'shot')) this.recoil = RECOIL_TIME;
  }

  render(state: SimState, dt: number, beat: number | null): void {
    const pulse = beatPulse(beat);
    this.backdrop.width = viewport.w;
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
    const skinColor = this.cosmetics.skin.hueCycle
      ? hueToRgb(state.time * HUE_SPEED)
      : (this.cosmetics.skin.palette['#'] ?? 0x4af2ff);

    this.renderPlayer(state, dt);
    this.renderEnemies(state, beat, worldTint);
    this.renderEnemyBullets(state);
    this.renderPlayerBullets(state, pulse);
    this.renderBoss(state.boss, state.time, pulse, worldTint);
    this.effects.update(dt, state, skinColor);
  }

  private renderPlayer(state: SimState, dt: number): void {
    const p = state.player;
    this.recoil = Math.max(0, this.recoil - dt);
    const x = Math.round(p.x + p.w / 2);
    const y = Math.round(p.y + p.h);
    this.player.position.set(x, y);
    this.playerShadow.position.set(x + SHADOW.dx, y + SHADOW.dy);
    this.player.scale.set(this.recoil > 0 ? 1.15 : 1, this.recoil > 0 ? 0.75 : 1);
    const blinkOff = p.invuln > 0 && Math.floor(state.time * 20) % 2 === 1;
    this.player.visible = state.phase !== 'gameOver' && !blinkOff;
    this.playerShadow.visible = this.player.visible;
    if (this.cosmetics.skin.hueCycle) this.player.tint = hueToRgb(state.time * HUE_SPEED);
  }

  private renderEnemies(state: SimState, beat: number | null, worldTint: number): void {
    const tick = beat !== null && beat >= 0 ? Math.floor(beat) : Math.floor(state.time * 2);
    const frame = tick % 2 === 0 ? 0 : 1;
    const intro = state.phase === 'stageIntro' && !state.boss ? 1 - state.phaseTimer / STAGE.introTime : 1;
    syncViews<Enemy, EnemyView>(
      this.enemyViews,
      state.enemies,
      (e) => {
        const body = new Sprite(this.tex.enemies[e.kind][0]);
        body.anchor.set(0.5);
        const shadow = shadowOf(this.tex.enemies[e.kind][0]);
        shadow.anchor.set(0.5);
        this.entities.addChild(body);
        this.shadowLayer.addChild(shadow);
        return { body, shadow };
      },
      (v) => {
        v.body.destroy();
        v.shadow.destroy();
      },
      ({ body, shadow }, e) => {
        const base =
          e.kind === 'shield' && e.hp < e.maxHp ? this.tex.shieldCracked[frame] : this.tex.enemies[e.kind][frame];
        const flashing = e.flash > 0;
        body.texture = flashing ? this.tex.enemiesWhite[e.kind][frame] : base;
        body.tint = flashing ? 0xffffff : worldTint;
        const x = Math.round(e.x + e.w / 2);
        const y = Math.round(e.y + e.h / 2);
        const scale = e.row >= 0 ? popInScale(intro, e.row) : 1;
        body.position.set(x, y);
        body.scale.set(scale);
        body.alpha = e.phased ? 0.25 : 1;
        shadow.texture = base;
        shadow.position.set(x + SHADOW.dx, y + SHADOW.dy);
        shadow.scale.set(scale);
        shadow.visible = !e.phased;
      },
    );
  }

  private renderEnemyBullets(state: SimState): void {
    syncViews<Bullet, Sprite>(
      this.bulletSprites,
      state.bullets.filter((b) => b.owner === 'enemy'),
      () => {
        const s = this.bulletPool.pop() ?? whiteSprite(ENEMY_BULLET_COLOR);
        if (!s.parent) this.entities.addChild(s);
        s.visible = true;
        return s;
      },
      (s) => {
        s.visible = false;
        this.bulletPool.push(s);
      },
      (s, b) => {
        s.width = b.w;
        s.height = b.h;
        s.tint = b.fuse !== undefined ? BOMB_COLOR : ENEMY_BULLET_COLOR;
        s.alpha = b.fuse !== undefined && b.fuse < 0.4 && !blink(state.time, 8) ? 0.4 : 1;
        s.position.set(Math.round(b.x), Math.round(b.y));
      },
    );
  }

  private renderPlayerBullets(state: SimState, pulse: number): void {
    syncViews<Bullet, LaserView>(
      this.laserViews,
      state.bullets.filter((b) => b.owner === 'player'),
      () => {
        const v = this.laserPool.pop() ?? createLaserView(this.cosmetics.laser, this.tex.orb);
        if (!v.root.parent) this.entities.addChild(v.root);
        v.root.visible = true;
        return v;
      },
      (v) => {
        v.root.visible = false;
        this.laserPool.push(v);
      },
      (v, b) => v.update(Math.round(b.x), Math.round(b.y), state.time, pulse, b.onBeat),
    );
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
      this.boss.shadow.destroy();
      for (const p of this.boss.parts) p.destroy();
    }
    const body = new Sprite(this.tex.bosses[b.kind]);
    const shadow = shadowOf(this.tex.bosses[b.kind]);
    const partTex = b.kind === 'dreadnought' ? this.tex.plate : this.tex.turret;
    const parts = b.parts.map(() => new Sprite(partTex));
    this.bossLayer.addChild(body, ...parts);
    this.shadowLayer.addChild(shadow);
    this.boss = { kind: b.kind, body, shadow, parts };
    return this.boss;
  }

  private renderBoss(b: Boss | null, time: number, pulse: number, worldTint: number): void {
    this.bossLayer.visible = b !== null;
    if (this.boss) this.boss.shadow.visible = b !== null;
    if (!b) return;
    const sprites = this.ensureBossSprites(b);
    const { body, shadow } = sprites;
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    body.position.set(x, y);
    shadow.position.set(x + SHADOW.dx + 1, y + SHADOW.dy + 2);
    body.visible = b.dying === 0 || blink(time, 10);
    shadow.visible = body.visible && !b.phased;
    const flashing = b.flash > 0 && !b.phased;
    body.texture = flashing ? this.tex.bossesWhite[b.kind] : this.tex.bosses[b.kind];
    body.alpha = b.phased ? (blink(time, 6) ? 0.3 : 0.15) : 1;
    body.tint = flashing
      ? 0xffffff
      : b.phase === 3
        ? lerpColor(worldTint, 0xff6070, 0.4 + 0.6 * pulse)
        : worldTint;
    b.parts.forEach((t, i) => {
      const s = sprites.parts[i];
      if (!s) return;
      s.visible = t.alive && b.dying === 0;
      s.position.set(Math.round(t.x), Math.round(t.y));
      s.tint = t.flash > 0 ? 0xffe14a : 0xffffff;
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
