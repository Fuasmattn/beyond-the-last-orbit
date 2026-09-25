import { Container, Sprite, Texture } from 'pixi.js';
import { FX } from '../data/balance';
import { ParticleSim, type EmitOptions } from '../fx/particles';
import { popupAlpha, popupRise, Popups } from '../fx/popups';
import { Shake } from '../fx/shake';
import type { EnemyKind, SimEvent, SimState } from '../sim/types';
import { PixelText } from './pixelText';
import { ENEMY_COLOR as KIND_COLOR } from './vectorArt';

const FIRE: readonly number[] = [0xffffff, 0xffe14a, 0xff7a3d, 0xff3b5c];
const CHAIN_EVERY = 0.08;
/** Streak length in logical px per px/s of particle speed. */
const SPARK_STRETCH = 0.05;
const EXHAUST_EVERY = 1 / 60;
const TRAUMA = {
  kill: 0.06,
  part: 0.25,
  playerHit: 0.6,
  bossPhase: 0.5,
  bossKilled: 0.9,
  bomb: 0.12,
  chain: 0.08,
} as const;

/** View-only juice: particles, score popups and screen-shake trauma, driven by sim events. */
export class Effects extends Container {
  readonly shake = new Shake();
  private readonly sim = new ParticleSim(FX.particles.capacity);
  private readonly sprites: Sprite[] = [];
  private readonly popups = new Popups();
  private readonly popupTexts: PixelText[] = [];
  private chainTimer = 0;
  private exhaustTimer = 0;

  constructor(glyphs: Map<string, Texture>) {
    super();
    for (let i = 0; i < FX.particles.capacity; i++) {
      const s = new Sprite(Texture.WHITE);
      s.anchor.set(0.5);
      s.visible = false;
      this.sprites.push(s);
      this.addChild(s);
    }
    for (let i = 0; i < FX.popup.max; i++) {
      const t = new PixelText(glyphs);
      t.visible = false;
      this.popupTexts.push(t);
      this.addChild(t);
    }
  }

  notify(events: readonly SimEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'shot':
          if (e.power) {
            this.explode(e.x, e.y, 10, [0xff5ad1, 0xffe14a, 0xffffff], 80);
            this.shake.add(TRAUMA.kill);
          }
          this.spawn({
            x: e.x,
            y: e.y,
            count: e.onBeat ? 6 : 2,
            color: e.onBeat ? [0xffe14a, 0xffffff] : [0x9ff6ff],
            angle: -Math.PI / 2,
            spread: 1.2,
            speed: [20, 70],
            life: [0.08, 0.2],
          });
          break;
        case 'enemyHit':
          this.sparks(e.x, e.y, 4, [0xffffff]);
          break;
        case 'enemyKilled':
          this.explode(e.x, e.y, 12, [KIND_COLOR[e.kind], 0xffffff], 60);
          this.shake.add(TRAUMA.kill);
          if (e.points > 0) this.popups.spawn(`+${e.points}`, e.points >= 50 ? 0xffe14a : 0xffffff, e.x, e.y);
          break;
        case 'split':
          this.sparks(e.x, e.y, 6, [KIND_COLOR.splitter]);
          break;
        case 'partDestroyed':
          this.explode(e.x, e.y, 18, FIRE, 70);
          this.shake.add(TRAUMA.part);
          break;
        case 'bossHit':
          this.sparks(e.x, e.y, 3, [0xffe14a]);
          break;
        case 'bossPhase':
          this.shake.add(TRAUMA.bossPhase);
          break;
        case 'bossKilled':
          this.explode(e.x, e.y, 60, FIRE, 110);
          this.shake.add(TRAUMA.bossKilled);
          this.popups.spawn(`+${e.points}`, 0xffe14a, e.x, e.y);
          break;
        case 'playerHit':
          this.explode(e.x, e.y, 30, [0x4af2ff, 0xffffff, 0xff3b5c], 90);
          this.shake.add(TRAUMA.playerHit);
          break;
        case 'graze':
          this.sparks(e.x, e.y, 3, [0x4af2ff, 0xffffff]);
          this.popups.spawn(`+${e.points}`, 0x4af2ff, e.x, e.y);
          break;
        case 'shieldHit':
          this.explode(e.x, e.y, 16, [0x7dff6b, 0xffffff], 70);
          this.shake.add(TRAUMA.part);
          break;
        case 'bombBurst':
          this.sparks(e.x, e.y, 10, [0xff7a3d]);
          this.shake.add(TRAUMA.bomb);
          break;
        default:
          break;
      }
    }
  }

  update(dt: number, state: SimState, exhaustColor: number): void {
    const b = state.boss;
    if (b && b.dying > 0) {
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) {
        this.chainTimer = CHAIN_EVERY;
        this.explode(b.x + Math.random() * b.w, b.y + Math.random() * b.h, 10, FIRE, 60);
        this.shake.add(TRAUMA.chain);
      }
    }
    if (state.phase !== 'gameOver') {
      const p = state.player;
      this.exhaustTimer -= dt;
      while (this.exhaustTimer <= 0) {
        this.exhaustTimer += EXHAUST_EVERY;
        this.spawn({
          x: p.x + p.w / 2,
          y: p.y + p.h,
          count: 1,
          color: [exhaustColor, 0xff7a3d],
          angle: Math.PI / 2,
          spread: 0.5,
          speed: [20, 45],
          life: [0.1, 0.25],
        });
      }
    }

    this.sim.update(dt);
    this.shake.update(dt);
    this.popups.update(dt);

    this.sim.particles.forEach((p, i) => {
      const s = this.sprites[i]!;
      s.visible = p.active;
      if (!p.active) return;
      // Sparks: thin streaks stretched along their velocity.
      const speed = Math.hypot(p.vx, p.vy);
      s.position.set(p.x, p.y);
      s.rotation = Math.atan2(p.vy, p.vx);
      s.width = Math.max(p.size, speed * SPARK_STRETCH);
      s.height = Math.max(0.6, p.size * 0.6);
      s.tint = p.color;
      s.alpha = Math.min(1, (p.life / p.maxLife) * 1.5);
    });
    this.popupTexts.forEach((t, i) => {
      const p = this.popups.items[i];
      t.visible = p !== undefined;
      if (!p) return;
      t.setText(p.text);
      t.tint = p.color;
      t.alpha = popupAlpha(p);
      t.position.set(Math.round(p.x - t.pixelWidth / 2), Math.round(p.y + popupRise(p)));
    });
  }

  private spawn(o: EmitOptions): void {
    this.sim.emit(o);
  }

  private explode(x: number, y: number, count: number, color: readonly number[], speed: number): void {
    this.spawn({ x, y, count, color, speed: [15, speed], life: [0.25, 0.6], size: [1, 2], drag: 2 });
  }

  private sparks(x: number, y: number, count: number, color: readonly number[]): void {
    this.spawn({ x, y, count, color, speed: [30, 90], life: [0.1, 0.25], drag: 4 });
  }
}
