import { BOMB, FIELD_H, MINI } from '../data/balance';
import { inFormation } from './formation';
import { allocId } from './ids';
import { fireRing } from './patterns';
import type { Bullet, EnemyKind, SimEvent, SimState } from './types';

/** Phasers blink out for 2 beats every 4, staggered by column. */
export function phaserPhased(beatCount: number, col: number): boolean {
  return Math.floor((beatCount + col) / 2) % 2 === 1;
}

/** Spawns a free-moving enemy centered on (cx, cy). */
export function spawnFree(
  state: SimState,
  kind: EnemyKind,
  cx: number,
  cy: number,
  vx: number,
  vy: number,
  size: { w: number; h: number },
): void {
  state.enemies.push({
    id: allocId(state),
    kind,
    row: -1,
    col: -1,
    hp: 1,
    maxHp: 1,
    flash: 0,
    dive: null,
    entry: null,
    free: { vx, vy },
    phased: false,
    x: cx - size.w / 2,
    y: cy - size.h / 2,
    w: size.w,
    h: size.h,
  });
}

export function spawnMini(state: SimState, cx: number, cy: number, dir: 1 | -1): void {
  spawnFree(state, 'mini', cx, cy, dir * MINI.vx, MINI.vy, MINI);
}

/** Phaser blinking, free-mover motion, bomb fuses. */
export function updateSpecials(state: SimState, dt: number, events: SimEvent[]): void {
  const count = state.beat.count;
  for (const e of state.enemies) {
    if (e.kind === 'phaser') e.phased = inFormation(e) && phaserPhased(count, e.col);
    const f = e.free;
    if (!f) continue;
    e.x += f.vx * dt;
    e.y += f.vy * dt;
    if (e.x < 0) {
      e.x = 0;
      f.vx = Math.abs(f.vx);
    } else if (e.x + e.w > state.fieldW) {
      e.x = state.fieldW - e.w;
      f.vx = -Math.abs(f.vx);
    }
  }
  state.enemies = state.enemies.filter((e) => !(e.free && e.y > FIELD_H));

  const bursting: Bullet[] = [];
  for (const b of state.bullets) {
    if (b.fuse === undefined) continue;
    b.fuse -= dt;
    if (b.fuse <= 0) bursting.push(b);
  }
  if (bursting.length === 0) return;
  state.bullets = state.bullets.filter((b) => !bursting.includes(b));
  for (const b of bursting) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    fireRing(state, cx, cy, BOMB.ringCount, 0, BOMB.ringSpeed);
    events.push({ type: 'bombBurst', x: cx, y: cy });
  }
}
