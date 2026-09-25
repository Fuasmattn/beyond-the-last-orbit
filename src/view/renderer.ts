import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { viewport } from '../app/viewport';
import { FIELD_H, WARP } from '../data/balance';
import type { LaserDef, SkinDef } from '../data/cosmetics';
import { worldAt, type WorldId } from '../data/worlds';
import { laserBox } from '../sim/boss/warden';
import type { Boss, BossKind, Bullet, Enemy, SimEvent, SimState } from '../sim/types';
import { blink } from './anim';
import { createBackdrop, type Backdrop } from './backdrops';
import { beatPulse, lerpColor } from './beatPulse';
import { hueToRgb, mulColor } from './color';
import { Effects } from './effects';
import { createLaserView, type LaserView } from './laserView';
import { Starfield } from './starfield';
import type { GameTextures } from './textures';
import {
  BOMB_ART,
  BOSS_ART,
  BOSS_COLOR,
  BOSS_CORE,
  ENEMY_ART,
  ENEMY_COLOR,
  ENEMY_SHOT_ART,
  FLAME_ART,
  PLATE_ART,
  SHIELD_CRACKED_ART,
  SHIP_ART,
  TURRET_ART,
} from './vectorArt';

const ENEMY_BULLET_COLOR = 0xffd05a;
const BOMB_COLOR = 0xff3b5c;
const BACKDROP_BASE = 0x05060d;
const BACKDROP_PULSE = 0x150f2e;
const LASER_COLOR = 0xff3b5c;
const WORLD_TINT: Record<WorldId, number> = { earth: 0xffffff, moon: 0xe6ebff, mars: 0xffe0cc };
const LOOP_DARKEN = 0.12;
const WARP_SPEED = 40;
const HUE_SPEED = 0.25;
const RECOIL_TIME = 0.06;
/** Extra scale on the downbeat; enemies "thump" with the kick. */
const ENEMY_PULSE = 0.18;
const FLAME_COLOR = 0x9ff6ff;

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

interface BossViews {
  kind: BossKind;
  body: Graphics;
  core: Graphics;
  parts: Graphics[];
}

export class GameRenderer {
  readonly root = new Container();
  private readonly backdrop = whiteSprite(BACKDROP_BASE);
  private readonly starfield = new Starfield();
  private readonly planetLayer = new Container();
  private readonly bossLayer = new Container();
  private readonly entities = new Container();
  private readonly effects: Effects;
  private readonly ship = new Container();
  private readonly hull: Graphics;
  private readonly flame = new Graphics(FLAME_ART);
  private readonly enemyViews = new Map<number, Graphics>();
  private readonly bulletViews = new Map<number, Graphics>();
  private readonly bulletPool: Graphics[] = [];
  private readonly laserViews = new Map<number, LaserView>();
  private readonly laserPool: LaserView[] = [];
  private readonly laserWarn = whiteSprite(LASER_COLOR);
  private readonly laserBeam = whiteSprite(LASER_COLOR);
  private readonly laserCore = whiteSprite(0xffffff);
  private boss: BossViews | null = null;
  private world: WorldId | null = null;
  private backdropW = 0;
  private planet: Backdrop | null = null;
  private recoil = 0;

  constructor(
    private readonly tex: GameTextures,
    private readonly cosmetics: Cosmetics,
  ) {
    this.hull = new Graphics(SHIP_ART[cosmetics.skin.hull]);
    this.flame.tint = FLAME_COLOR;
    this.flame.position.set(0, 1);
    this.ship.addChild(this.flame, this.hull);
    this.backdrop.height = FIELD_H;
    this.effects = new Effects(tex.glyphs);
    this.laserBeam.alpha = 0.85;
    this.bossLayer.addChild(this.laserWarn, this.laserBeam, this.laserCore);
    this.entities.addChild(this.ship);
    this.root.addChild(this.backdrop, this.starfield, this.planetLayer, this.bossLayer, this.entities, this.effects);
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
    const warp = state.phase === 'warp';
    const warpProgress = warp ? 1 - state.phaseTimer / WARP.time : 0;
    this.backdrop.width = viewport.w;
    this.backdrop.tint = lerpColor(BACKDROP_BASE, BACKDROP_PULSE, pulse * 0.6);
    this.starfield.update(dt, warp ? 1 + WARP_SPEED * Math.sin(Math.PI * warpProgress) : 1);
    this.renderPlanet(state, dt, warp, pulse);

    const worldTint = lerpColor(
      WORLD_TINT[worldAt(state.world).id],
      0x000000,
      Math.min(3, state.loop) * LOOP_DARKEN,
    );
    const skinColor = this.cosmetics.skin.hueCycle
      ? hueToRgb(state.time * HUE_SPEED)
      : (this.cosmetics.skin.palette['#'] ?? 0x4af2ff);

    this.renderPlayer(state, dt, skinColor);
    this.renderEnemies(state, pulse, worldTint);
    this.renderEnemyBullets(state);
    this.renderPlayerBullets(state, pulse);
    this.renderBoss(state.boss, state.time, pulse, worldTint);
    this.effects.update(dt, state, skinColor);
  }

  private renderPlayer(state: SimState, dt: number, color: number): void {
    const p = state.player;
    this.recoil = Math.max(0, this.recoil - dt);
    this.ship.position.set(p.x + p.w / 2, p.y + p.h);
    this.ship.scale.set(this.recoil > 0 ? 1.15 : 1, this.recoil > 0 ? 0.8 : 1);
    const blinkOff = p.invuln > 0 && Math.floor(state.time * 20) % 2 === 1;
    this.ship.visible = state.phase !== 'gameOver' && !blinkOff;
    this.hull.tint = color;
    // Flame flickers and stretches while moving up.
    const thrust = 1 + Math.max(0, -p.vy) / 140;
    this.flame.scale.set(1, thrust * (0.7 + 0.3 * Math.sin(state.time * 60)));
  }

  private renderEnemies(state: SimState, pulse: number, worldTint: number): void {
    syncViews<Enemy, Graphics>(
      this.enemyViews,
      state.enemies,
      (e) => {
        const g = new Graphics(ENEMY_ART[e.kind]);
        this.entities.addChild(g);
        return g;
      },
      (g) => g.destroy(),
      (g, e) => {
        const cracked = e.kind === 'shield' && e.hp < e.maxHp;
        const ctx = cracked ? SHIELD_CRACKED_ART : ENEMY_ART[e.kind];
        if (g.context !== ctx) g.context = ctx;
        const flashing = e.flash > 0;
        g.tint = flashing ? 0xffffff : mulColor(cracked ? 0xff5a5a : ENEMY_COLOR[e.kind], worldTint);
        g.position.set(e.x + e.w / 2, e.y + e.h / 2);
        const s = (flashing ? 1.25 : 1) + ENEMY_PULSE * pulse * pulse;
        g.scale.set(s);
        const spin = e.kind === 'phaser' ? 1.2 : e.kind === 'mini' ? 5 : 0;
        // Divers and fly-ins bank into their motion.
        g.rotation = spin ? state.time * spin : e.dive || e.entry ? Math.sin(state.time * 8 + e.id) * 0.25 : 0;
        g.alpha = e.phased ? 0.25 : 1;
      },
    );
  }

  private renderEnemyBullets(state: SimState): void {
    syncViews<Bullet, Graphics>(
      this.bulletViews,
      state.bullets.filter((b) => b.owner === 'enemy'),
      () => {
        const g = this.bulletPool.pop() ?? new Graphics(ENEMY_SHOT_ART);
        if (!g.parent) this.entities.addChild(g);
        g.visible = true;
        return g;
      },
      (g) => {
        g.visible = false;
        this.bulletPool.push(g);
      },
      (g, b) => {
        const bomb = b.fuse !== undefined;
        const ctx = bomb ? BOMB_ART : ENEMY_SHOT_ART;
        if (g.context !== ctx) g.context = ctx;
        g.tint = bomb ? BOMB_COLOR : ENEMY_BULLET_COLOR;
        g.rotation = bomb ? state.time * 6 : 0;
        g.alpha = bomb && b.fuse! < 0.4 && !blink(state.time, 8) ? 0.4 : 1;
        g.position.set(b.x + b.w / 2, b.y + b.h / 2);
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
      (v, b) => v.update(b.x, b.y, state.time, pulse, b.onBeat),
    );
  }

  private renderPlanet(state: SimState, dt: number, warp: boolean, pulse: number): void {
    const id = worldAt(state.world).id;
    if (id !== this.world || viewport.w !== this.backdropW) {
      this.planet?.root.destroy({ children: true });
      this.planet = createBackdrop(id, viewport.w);
      this.planetLayer.addChild(this.planet.root);
      this.world = id;
      this.backdropW = viewport.w;
    }
    this.planet?.update(dt, pulse);
    const target = warp ? 0 : 1;
    this.planetLayer.alpha += (target - this.planetLayer.alpha) * Math.min(1, dt * 3);
  }

  private ensureBossViews(b: Boss): BossViews {
    if (this.boss && this.boss.kind === b.kind && this.boss.parts.length === b.parts.length) return this.boss;
    if (this.boss) {
      this.boss.body.destroy();
      this.boss.core.destroy();
      for (const p of this.boss.parts) p.destroy();
    }
    const body = new Graphics(BOSS_ART[b.kind]);
    const c = BOSS_CORE[b.kind];
    const core = new Graphics()
      .circle(0, 0, c.r * 1.8)
      .fill({ color: c.color, alpha: 0.25 })
      .circle(0, 0, c.r)
      .fill(c.color)
      .circle(0, 0, c.r * 0.45)
      .fill(0xffffff);
    const partArt = b.kind === 'dreadnought' ? PLATE_ART : TURRET_ART;
    const parts = b.parts.map(() => new Graphics(partArt));
    this.bossLayer.addChild(body, core, ...parts);
    this.boss = { kind: b.kind, body, core, parts };
    return this.boss;
  }

  private renderBoss(b: Boss | null, time: number, pulse: number, worldTint: number): void {
    this.bossLayer.visible = b !== null;
    if (!b) return;
    const views = this.ensureBossViews(b);
    const { body, core } = views;
    body.position.set(b.x, b.y);
    body.visible = b.dying === 0 || blink(time, 10);
    const flashing = b.flash > 0 && !b.phased;
    body.alpha = b.phased ? (blink(time, 6) ? 0.3 : 0.15) : 1;
    const base = mulColor(BOSS_COLOR[b.kind], worldTint);
    body.tint = flashing ? 0xffffff : b.phase === 3 ? lerpColor(base, 0xff6070, 0.4 + 0.6 * pulse) : base;
    const c = BOSS_CORE[b.kind];
    core.position.set(b.x + c.x, b.y + c.y);
    core.scale.set(1 + 0.35 * pulse);
    core.visible = body.visible;
    core.alpha = body.alpha;
    b.parts.forEach((t, i) => {
      const g = views.parts[i];
      if (!g) return;
      g.visible = t.alive && b.dying === 0;
      g.position.set(t.x, t.y);
      g.tint = t.flash > 0 ? 0xffffff : 0xffe14a;
    });

    const l = b.laser;
    this.laserWarn.visible = l !== null && l.state === 'warn' && blink(time, 8);
    this.laserBeam.visible = l !== null && l.state === 'fire';
    this.laserCore.visible = this.laserBeam.visible;
    if (!l) return;
    const box = laserBox(b, l);
    this.laserWarn.position.set(l.x - 0.5, box.y);
    this.laserWarn.width = 1;
    this.laserWarn.height = box.h;
    this.laserBeam.position.set(box.x, box.y);
    this.laserBeam.width = box.w;
    this.laserBeam.height = box.h;
    this.laserCore.position.set(l.x - 1, box.y);
    this.laserCore.width = 2;
    this.laserCore.height = box.h;
  }
}
