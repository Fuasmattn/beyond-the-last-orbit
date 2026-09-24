import { DREAD, FIELD_W, TURRET_POINTS } from '../../data/balance';
import { spawnBomb, spawnEnemyBullet } from '../bullets';
import { overlaps } from '../geometry';
import { allocId } from '../ids';
import { fireSpread } from '../patterns';
import { recordHit, registerKill } from '../scoring';
import type { Boss, Box, Bullet, SimEvent, SimState } from '../types';
import { aimedShot, applyPhase, coreBox, killBoss, tickBoss } from './common';

/** ARES DREADNOUGHT — battleship: bomb spreads, armored core, then beat-timed bullet curtains. */
export function spawnDreadnought(state: SimState): void {
  const hp = Math.round(DREAD.hp * state.diff.bossHpScale);
  const x = (FIELD_W - DREAD.w) / 2;
  const y = -DREAD.h;
  state.boss = {
    kind: 'dreadnought',
    x,
    y,
    w: DREAD.w,
    h: DREAD.h,
    hp,
    maxHp: hp,
    phase: 1,
    t: 0,
    entering: true,
    flash: 0,
    // Armor plates stay inactive until phase 2.
    parts: DREAD.plates.map(([ox, oy]) => ({
      id: allocId(state),
      offsetX: ox,
      offsetY: oy,
      x: x + ox,
      y: y + oy,
      w: DREAD.plateW,
      h: DREAD.plateH,
      hp: DREAD.plateHp,
      maxHp: DREAD.plateHp,
      alive: false,
      flash: 0,
    })),
    laser: null,
    beatCount: 0,
    spiralAngle: 0,
    phased: false,
    dying: 0,
  };
}

export function dreadCore(b: Boss): Box {
  return coreBox(b, DREAD.coreX, DREAD.coreW);
}

/** Horizontal center of the curtain gap for a given beat count. */
export function curtainGapX(beatCount: number): number {
  return FIELD_W / 2 + Math.sin(beatCount * 0.4) * 80;
}

export function updateDreadnought(state: SimState, dt: number, beats: number, events: SimEvent[]): void {
  const b = state.boss;
  if (!b || !tickBoss(state, b, dt, DREAD)) return;
  for (let i = 0; i < beats; i++) onBeat(state, b, events);
}

function dropBombs(state: SimState, b: Boss): void {
  for (const [ox, oy] of DREAD.cannons) spawnBomb(state, b.x + ox, b.y + oy);
}

function curtain(state: SimState, b: Boss, wide: boolean): void {
  const gapX = curtainGapX(b.beatCount);
  const half = wide ? DREAD.gapWide : DREAD.gapNarrow;
  for (let x = 6; x < FIELD_W; x += DREAD.curtainStep) {
    if (Math.abs(x - gapX) < half) continue;
    spawnEnemyBullet(state, x, b.y + b.h, 0, DREAD.curtainSpeed);
  }
}

function onBeat(state: SimState, b: Boss, events: SimEvent[]): void {
  b.beatCount++;
  const n = b.beatCount;
  const core = dreadCore(b);
  const cx = core.x + core.w / 2;
  const cy = core.y + core.h;

  if (b.phase === 1) {
    if (n % 4 === 0) dropBombs(state, b);
    if (n % 2 === 0) aimedShot(state, cx, cy, events);
  } else if (b.phase === 2) {
    if (n % 4 === 2) fireSpread(state, cx, cy, 5, DREAD.spreadAngle, state.diff.bulletSpeed);
    if (n % 8 === 0) dropBombs(state, b);
  } else if (n % 2 === 0) {
    // Gaps open wide on the downbeat.
    curtain(state, b, n % 4 === 0);
  }
}

/** Resolves a player bullet: plates first, core only while no plate remains. */
export function hitDreadnought(state: SimState, bullet: Bullet, events: SimEvent[]): boolean {
  const b = state.boss;
  if (!b || b.entering || b.dying > 0) return false;

  for (const p of b.parts) {
    if (!p.alive || !overlaps(bullet, p)) continue;
    recordHit(state);
    p.hp--;
    p.flash = 0.06;
    if (p.hp <= 0) {
      p.alive = false;
      registerKill(state, TURRET_POINTS, bullet.mult);
      events.push({ type: 'partDestroyed', x: p.x + p.w / 2, y: p.y + p.h / 2 });
    }
    return true;
  }

  const core = dreadCore(b);
  if (overlaps(bullet, core)) {
    if (b.parts.some((p) => p.alive)) return true;
    recordHit(state);
    b.hp--;
    b.flash = 0.06;
    events.push({ type: 'bossHit', x: bullet.x, y: core.y + core.h });
    if (b.hp <= 0) {
      killBoss(state, events);
      return true;
    }
    if (applyPhase(state, b, events) && b.phase === 2) {
      for (const p of b.parts) {
        p.alive = true;
        p.hp = p.maxHp;
      }
    }
    return true;
  }
  return overlaps(bullet, b);
}
