import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { FIELD_H, PLAYER, WARP } from '../data/balance';
import type { LaserDef, SkinDef } from '../data/cosmetics';
import { worldAt, type WorldId } from '../data/worlds';
import { laserBox, laserZone } from '../sim/boss/warden';
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
const MASTER_PULSE = 1.6;
const MASTER_BACKDROP = 0x2a0f2e;
/** Fraction of the camera's pan the planet and grid move on screen. */
const PLANET_PARALLAX = 0.35;
/** Past the field walls (views wider than the field): darkened, with a faint wall line. */
const OUTSIDE_DIM = 0.45;
const WALL_COLOR = 0x4af2ff;

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
  private readonly outside = new Graphics();
  private readonly bossLayer = new Container();
  private readonly entities = new Container();
  private readonly effects: Effects;
  private readonly ship = new Container();
  private readonly hull: Graphics;
  /** MIRROR: translucent copy of the hull at the mirrored x. */
  private readonly ghost: Graphics;
  private readonly flame = new Graphics(FLAME_ART);
  private readonly shield = new Graphics();
  /** Rogue runs: marks the small hurtbox at the hull's center. */
  private readonly hitDot = new Graphics()
    .rect(-(PLAYER.hurtW + 2) / 2, -(PLAYER.hurtH + 2) / 2, PLAYER.hurtW + 2, PLAYER.hurtH + 2)
    .fill({ color: 0xff3d9a, alpha: 0.8 })
    .rect(-PLAYER.hurtW / 2, -PLAYER.hurtH / 2, PLAYER.hurtW, PLAYER.hurtH)
    .fill(0xffffff);
  private readonly enemyViews = new Map<number, Graphics>();
  private readonly bulletViews = new Map<number, Graphics>();
  private readonly bulletPool: Graphics[] = [];
  private readonly laserViews = new Map<number, LaserView>();
  private readonly laserPool: LaserView[] = [];
  private readonly laserWarn = whiteSprite(LASER_COLOR);
  private readonly laserZone = whiteSprite(LASER_COLOR);
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
    this.ghost = new Graphics(SHIP_ART[cosmetics.skin.hull]);
    this.ghost.alpha = 0.35;
    this.ghost.visible = false;
    this.flame.tint = FLAME_COLOR;
    this.flame.position.set(0, 1);
    this.ship.addChild(this.flame, this.hull, this.shield, this.hitDot);
    this.backdrop.height = FIELD_H;
    this.effects = new Effects(tex.glyphs);
    this.laserBeam.alpha = 0.85;
    this.laserZone.alpha = 0.18;
    this.bossLayer.addChild(this.laserZone, this.laserWarn, this.laserBeam, this.laserCore);
    this.entities.addChild(this.ghost, this.ship);
    this.root.addChild(
      this.backdrop,
      this.starfield,
      this.planetLayer,
      this.outside,
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

  /**
   * `camX` is the left edge of the view in field coords (the caller shifts `root` by `-camX`), `viewW` its width.
   * Background layers are offset so they pan slower than the field.
   */
  render(state: SimState, dt: number, beat: number | null, camX = 0, viewW = state.fieldW): void {
    // Beat stages thump harder so the rhythm is felt even with the sound low.
    const pulse = Math.min(1, beatPulse(beat) * (state.beatMode === 'master' ? MASTER_PULSE : 1));
    const warp = state.phase === 'warp';
    const warpProgress = warp ? 1 - state.phaseTimer / WARP.time : 0;
    this.backdrop.x = camX;
    this.backdrop.width = viewW;
    this.starfield.pan(camX);
    // A field narrower than the view: the planet spans the view and stays put.
    this.planetLayer.x = camX < 0 ? camX : camX * (1 - PLANET_PARALLAX);
    this.renderOutside(state.fieldW, camX, viewW);
    const pulseColor = state.beatMode === 'master' ? MASTER_BACKDROP : BACKDROP_PULSE;
    this.backdrop.tint = lerpColor(BACKDROP_BASE, pulseColor, pulse * 0.6);
    this.starfield.update(dt, warp ? 1 + WARP_SPEED * Math.sin(Math.PI * warpProgress) : 1);
    this.renderPlanet(state, dt, warp, pulse, Math.max(state.fieldW, viewW));

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
    this.renderBoss(state.boss, state.time, pulse, worldTint, state.fieldW);
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
    this.ghost.visible = state.ship.mirror && this.ship.visible;
    this.ghost.tint = color;
    this.ghost.position.set(state.fieldW - (p.x + p.w / 2), p.y + p.h);
    this.ghost.scale.set(-1 + Math.sin(state.time * 5) * 0.05, 1);
    this.hitDot.visible = true;
    this.hitDot.position.set(0, -p.h / 2);
    // Shield charges: a pulsing ring per charge.
    this.shield.clear();
    for (let i = 0; i < p.shield; i++) {
      const r = 10 + i * 3 + Math.sin(state.time * 6) * 0.6;
      this.shield.circle(0, -p.h / 2, r).stroke({ color: 0x7dff6b, width: 1, alpha: 0.55 });
    }
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
        // Elite telegraph: the next volley's shooter strobes white.
        const charging = e.charging === true && blink(state.time, 12);
        const flashing = e.flash > 0 || charging;
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
      (v, b) => {
        // Laser art is drawn for the standard bolt width; center it on wider bolts.
        const x = b.x + (b.w - PLAYER.bulletW) / 2;
        v.update(x, b.y, state.time, pulse, b.onBeat, b.vy !== 0 ? -b.vx / b.vy : 0);
        // Wider bolts (power shots, WIDE BOLTS) stretch the art around the bolt's center.
        const sx = b.w / PLAYER.bulletW;
        const cx = sx !== 1 ? b.x + b.w / 2 : 0;
        v.root.scale.x = sx;
        v.root.pivot.x = v.root.position.x = cx;
      },
    );
  }

  private renderOutside(fieldW: number, camX: number, viewW: number): void {
    const g = this.outside.clear();
    const side = -camX;
    if (side <= 0) return;
    g.rect(camX, 0, side, FIELD_H)
      .rect(fieldW, 0, viewW - fieldW - side, FIELD_H)
      .fill({ color: 0x000000, alpha: OUTSIDE_DIM })
      .rect(-1, 0, 1, FIELD_H)
      .rect(fieldW, 0, 1, FIELD_H)
      .fill({ color: WALL_COLOR, alpha: 0.35 });
  }

  /** `width`: the planet and grid span the field, or the whole view when that is wider. */
  private renderPlanet(state: SimState, dt: number, warp: boolean, pulse: number, width: number): void {
    const id = worldAt(state.world).id;
    if (id !== this.world || width !== this.backdropW) {
      this.planet?.root.destroy({ children: true });
      this.planet = createBackdrop(id, width);
      this.planetLayer.addChild(this.planet.root);
      this.world = id;
      this.backdropW = width;
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

  private renderBoss(b: Boss | null, time: number, pulse: number, worldTint: number, fieldW: number): void {
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
    this.laserZone.visible = l !== null && l.state === 'warn';
    this.laserBeam.visible = l !== null && l.state === 'fire';
    this.laserCore.visible = this.laserBeam.visible;
    if (!l) return;
    const box = laserBox(b, l);
    this.laserWarn.position.set(l.x - 0.5, box.y);
    this.laserWarn.width = 1;
    this.laserWarn.height = box.h;
    const zone = laserZone(b, l, fieldW);
    this.laserZone.position.set(zone.x, zone.y);
    this.laserZone.width = zone.w;
    this.laserZone.height = zone.h;
    this.laserBeam.position.set(box.x, box.y);
    this.laserBeam.width = box.w;
    this.laserBeam.height = box.h;
    this.laserCore.position.set(l.x - 1, box.y);
    this.laserCore.width = 2;
    this.laserCore.height = box.h;
  }
}
