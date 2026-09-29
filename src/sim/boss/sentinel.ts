import { SENTINEL, TURRET_POINTS } from '../../data/balance';
import { overlaps } from '../geometry';
import { allocId } from '../ids';
import { fireRing, fireSpread } from '../patterns';
import { recordHit, registerKill } from '../scoring';
import type { Boss, Box, Bullet, SimEvent, SimState } from '../types';
import { aimedShot, coreBox, killBoss, tickBoss } from './common';

/** SENTINEL — the miniboss: a gun platform with two turrets and one phase. */
export function spawnSentinel(state: SimState): void {
  const scale = (1 + state.world * SENTINEL.hpPerWorld) * (state.diff.elite ? SENTINEL.eliteHpMul : 1);
  const hp = Math.round(SENTINEL.hp * scale);
  const x = (state.fieldW - SENTINEL.w) / 2;
  const y = -SENTINEL.h;
  state.boss = {
    kind: 'sentinel',
    x,
    y,
    w: SENTINEL.w,
    h: SENTINEL.h,
    hp,
    maxHp: hp,
    phase: 1,
    t: 0,
    entering: true,
    flash: 0,
    parts: SENTINEL.turretOffsets.map(([ox, oy]) => ({
      id: allocId(state),
      offsetX: ox,
      offsetY: oy,
      x: x + ox,
      y: y + oy,
      w: SENTINEL.turretW,
      h: SENTINEL.turretH,
      hp: SENTINEL.turretHp,
      maxHp: SENTINEL.turretHp,
      alive: true,
      flash: 0,
    })),
    laser: null,
    beatCount: 0,
    spiralAngle: 0,
    phased: false,
    dying: 0,
  };
}

export function sentinelCore(b: Boss): Box {
  return coreBox(b, SENTINEL.coreX, SENTINEL.coreW);
}

export function updateSentinel(state: SimState, dt: number, beats: number, events: SimEvent[]): void {
  const b = state.boss;
  if (!b || !tickBoss(state, b, dt, SENTINEL)) return;
  for (let i = 0; i < beats; i++) onBeat(state, b, events);
}

function onBeat(state: SimState, b: Boss, events: SimEvent[]): void {
  b.beatCount++;
  const n = b.beatCount;
  const core = sentinelCore(b);
  const cx = core.x + core.w / 2;
  const cy = core.y + core.h;
  if (n % 2 === 0) {
    const alive = b.parts.filter((t) => t.alive);
    const t = alive[(n / 2) % Math.max(1, alive.length)];
    if (t) aimedShot(state, t.x + t.w / 2, t.y + t.h, events);
  }
  if (n % 4 === 0) fireSpread(state, cx, cy, 3, SENTINEL.spreadAngle, state.diff.bulletSpeed);
  if (n % 8 === 4) {
    fireRing(state, cx, core.y + core.h / 2, SENTINEL.ringCount, b.spiralAngle, state.diff.bulletSpeed * 0.7);
    b.spiralAngle += 0.4;
  }
}

/** Resolves a player bullet against the Sentinel. Returns true if the bullet was consumed. */
export function hitSentinel(state: SimState, bullet: Bullet, events: SimEvent[]): boolean {
  const b = state.boss;
  if (!b || b.entering || b.dying > 0) return false;
  for (const t of b.parts) {
    if (!t.alive || !overlaps(bullet, t)) continue;
    recordHit(state, bullet);
    t.hp -= bullet.damage ?? 1;
    t.flash = 0.06;
    if (t.hp <= 0) {
      t.alive = false;
      registerKill(state, TURRET_POINTS, bullet.mult);
      events.push({ type: 'partDestroyed', x: t.x + t.w / 2, y: t.y + t.h / 2 });
    }
    return true;
  }
  const core = sentinelCore(b);
  if (overlaps(bullet, core)) {
    recordHit(state, bullet);
    b.hp -= bullet.damage ?? 1;
    b.flash = 0.06;
    events.push({ type: 'bossHit', x: bullet.x, y: core.y + core.h });
    if (b.hp <= 0) {
      // A miniboss: scores its own bounty and pays scrap, but is not a world boss for credits.
      killBoss(state, events, { points: SENTINEL.points * (state.world + 1), miniboss: true });
      state.rogue.scrap += SENTINEL.scrap;
    }
    return true;
  }
  return overlaps(bullet, b);
}
