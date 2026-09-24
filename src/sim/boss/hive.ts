import { ENEMY, FIELD_W, HIVE } from '../../data/balance';
import { aimVelocity } from '../bullets';
import { overlaps } from '../geometry';
import { fireAimedBurst, fireRing } from '../patterns';
import { recordHit } from '../scoring';
import { spawnFree } from '../specials';
import type { Boss, Box, Bullet, SimEvent, SimState } from '../types';
import { aimedShot, applyPhase, coreBox, killBoss, tickBoss } from './common';

/** LUNAR HIVE — mothership: escort waves, phasing in and out, then a diving swarm. */
export function spawnHive(state: SimState): void {
  const hp = Math.round(HIVE.hp * state.diff.bossHpScale);
  state.boss = {
    kind: 'hive',
    x: (FIELD_W - HIVE.w) / 2,
    y: -HIVE.h,
    w: HIVE.w,
    h: HIVE.h,
    hp,
    maxHp: hp,
    phase: 1,
    t: 0,
    entering: true,
    flash: 0,
    parts: [],
    laser: null,
    beatCount: 0,
    spiralAngle: 0,
    phased: false,
    dying: 0,
  };
}

export function hiveCore(b: Boss): Box {
  return coreBox(b, HIVE.coreX, HIVE.coreW);
}

export function updateHive(state: SimState, dt: number, beats: number, events: SimEvent[]): void {
  const b = state.boss;
  if (!b || !tickBoss(state, b, dt, HIVE)) return;
  for (let i = 0; i < beats; i++) onBeat(state, b, events);
}

function onBeat(state: SimState, b: Boss, events: SimEvent[]): void {
  b.beatCount++;
  const n = b.beatCount;
  const speed = state.diff.bulletSpeed;
  const cx = b.x + b.w / 2;
  const bottom = b.y + b.h;

  if (b.phase === 1) {
    if (n % HIVE.escortEvery === 0) {
      for (let i = 0; i < HIVE.escortCount; i++) {
        const k = i - (HIVE.escortCount - 1) / 2;
        spawnFree(state, 'grunt', cx + k * 16, bottom, k * HIVE.escortVx, HIVE.escortVy, ENEMY);
      }
    }
    if (n % 2 === 0) aimedShot(state, cx, bottom, events);
  } else if (b.phase === 2) {
    if (n % HIVE.phaseEvery === 0) {
      b.phased = !b.phased;
      events.push({ type: 'bossPhased', phased: b.phased });
    }
    if (b.phased) {
      if (n % 2 === 0) {
        fireRing(state, cx, b.y + b.h / 2, HIVE.ringCount, b.spiralAngle, speed * 0.6);
        b.spiralAngle += HIVE.ringSpin;
      }
    } else if (n % 2 === 1) {
      aimedShot(state, cx, bottom, events);
    }
  } else {
    if (n % HIVE.swarmEvery === 0) {
      for (const side of [-1, 1]) {
        const sx = side < 0 ? b.x + 6 : b.x + b.w - 6;
        const v = aimVelocity(state, sx, bottom, HIVE.swarmSpeed);
        spawnFree(state, 'diver', sx, bottom, v.vx, v.vy, ENEMY);
      }
    }
    if (n % 2 === 0) fireAimedBurst(state, cx, bottom, 3, HIVE.burstSpread, speed);
  }
}

/** Resolves a player bullet against the Hive. Phased → bullets pass through. */
export function hitHive(state: SimState, bullet: Bullet, events: SimEvent[]): boolean {
  const b = state.boss;
  if (!b || b.entering || b.dying > 0 || b.phased) return false;
  const core = hiveCore(b);
  if (overlaps(bullet, core)) {
    recordHit(state);
    b.hp--;
    b.flash = 0.06;
    events.push({ type: 'bossHit', x: bullet.x, y: core.y + core.h });
    if (b.hp <= 0) {
      killBoss(state, events);
      return true;
    }
    if (applyPhase(state, b, events)) b.phased = false;
    return true;
  }
  return overlaps(bullet, b);
}
