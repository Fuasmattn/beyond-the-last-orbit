import { FIELD_H, FIELD_W, TURRET_POINTS, WARDEN } from '../../data/balance';
import { aimVelocity, spawnEnemyBullet } from '../bullets';
import { overlaps } from '../geometry';
import { allocId } from '../ids';
import { clamp } from '../math';
import { hitPlayer } from '../player';
import { nextRandom } from '../rng';
import { recordHit, registerKill } from '../scoring';
import type { Boss, Box, Bullet, Laser, SimEvent, SimState } from '../types';
import { applyPhase, fireRing, fireSpread, killBoss } from './common';

/** ORBITAL WARDEN — satellite station with two turrets, a sweeping laser and spiral rings. */
export function spawnWarden(state: SimState): void {
  const hp = Math.round(WARDEN.hp * state.diff.bossHpScale);
  const x = (FIELD_W - WARDEN.w) / 2;
  const y = -WARDEN.h;
  state.boss = {
    kind: 'warden',
    x,
    y,
    w: WARDEN.w,
    h: WARDEN.h,
    hp,
    maxHp: hp,
    phase: 1,
    t: 0,
    entering: true,
    flash: 0,
    turrets: WARDEN.turretOffsets.map(([ox, oy]) => ({
      id: allocId(state),
      offsetX: ox,
      offsetY: oy,
      x: x + ox,
      y: y + oy,
      w: WARDEN.turretW,
      h: WARDEN.turretH,
      hp: WARDEN.turretHp,
      maxHp: WARDEN.turretHp,
      alive: true,
      flash: 0,
    })),
    laser: null,
    beatCount: 0,
    spiralAngle: 0,
    dying: 0,
  };
}

export function wardenCore(b: Boss): Box {
  return { x: b.x + WARDEN.coreX, y: b.y, w: WARDEN.coreW, h: b.h };
}

export function laserBox(b: Boss, l: Laser): Box {
  const top = b.y + b.h;
  return { x: l.x - WARDEN.laserW / 2, y: top, w: WARDEN.laserW, h: FIELD_H - top };
}

function positionParts(b: Boss): void {
  for (const t of b.turrets) {
    t.x = b.x + t.offsetX;
    t.y = b.y + t.offsetY;
  }
}

export function updateWarden(state: SimState, dt: number, beats: number, events: SimEvent[]): void {
  const b = state.boss;
  if (!b) return;
  b.t += dt;
  b.flash = Math.max(0, b.flash - dt);
  for (const t of b.turrets) t.flash = Math.max(0, t.flash - dt);
  if (b.dying > 0) {
    b.dying = Math.max(0, b.dying - dt);
    return;
  }
  if (b.entering) {
    b.y += ((WARDEN.y + WARDEN.h) / WARDEN.enterTime) * dt;
    if (b.y >= WARDEN.y) {
      b.y = WARDEN.y;
      b.entering = false;
    }
  }
  b.x = FIELD_W / 2 + Math.sin(b.t * WARDEN.swaySpeed) * WARDEN.swayAmp - b.w / 2;
  positionParts(b);
  if (b.entering || state.phase !== 'playing') return;

  for (let i = 0; i < beats; i++) onBeat(state, b, events);
  updateLaser(state, b, dt, events);
}

function onBeat(state: SimState, b: Boss, events: SimEvent[]): void {
  b.beatCount++;
  const n = b.beatCount;
  const speed = state.diff.bulletSpeed;
  const core = wardenCore(b);
  const cx = core.x + core.w / 2;
  const cy = core.y + core.h;

  if (b.phase === 1) {
    if (n % 2 === 0) {
      const alive = b.turrets.filter((t) => t.alive);
      const t = alive[(n / 2) % Math.max(1, alive.length)];
      if (t) {
        const tx = t.x + t.w / 2;
        const ty = t.y + t.h;
        const v = aimVelocity(state, tx, ty, speed);
        spawnEnemyBullet(state, tx, ty, v.vx, v.vy);
        events.push({ type: 'enemyShot', x: tx, y: ty });
      }
    }
    if (n % 4 === 0) fireSpread(state, cx, cy, 3, WARDEN.spreadAngle, speed);
  } else if (b.phase === 2) {
    if (n % 8 === 0 && !b.laser) startLaser(state, b, events);
    if (n % 4 === 2) fireSpread(state, cx, cy, 5, WARDEN.spreadAngle, speed);
  } else {
    fireRing(state, cx, core.y + core.h / 2, WARDEN.ringCount, b.spiralAngle, speed * 0.7);
    b.spiralAngle += WARDEN.ringSpin;
    if (n % 12 === 0 && !b.laser) startLaser(state, b, events);
  }
}

function startLaser(state: SimState, b: Boss, events: SimEvent[]): void {
  const p = state.player;
  const x = clamp(p.x + p.w / 2, 8, FIELD_W - 8);
  b.laser = { state: 'warn', t: 0, x, dir: nextRandom(state.rng) < 0.5 ? -1 : 1 };
  events.push({ type: 'laserWarn', x });
}

function updateLaser(state: SimState, b: Boss, dt: number, events: SimEvent[]): void {
  const l = b.laser;
  if (!l) return;
  l.t += dt;
  if (l.state === 'warn') {
    if (l.t >= WARDEN.laserWarn) {
      l.state = 'fire';
      l.t = 0;
      events.push({ type: 'laserFire', x: l.x });
    }
    return;
  }
  l.x = clamp(l.x + ((l.dir * WARDEN.laserSweep) / WARDEN.laserFire) * dt, 4, FIELD_W - 4);
  if (state.player.invuln <= 0 && overlaps(laserBox(b, l), state.player)) hitPlayer(state, events);
  if (l.t >= WARDEN.laserFire) b.laser = null;
}

function destroyTurrets(b: Boss, events: SimEvent[]): void {
  for (const t of b.turrets) {
    if (!t.alive) continue;
    t.alive = false;
    events.push({ type: 'turretDestroyed', x: t.x + t.w / 2, y: t.y + t.h / 2 });
  }
}

/** Resolves a player bullet against the Warden. Returns true if the bullet was consumed. */
export function hitWarden(state: SimState, bullet: Bullet, events: SimEvent[]): boolean {
  const b = state.boss;
  if (!b || b.entering || b.dying > 0) return false;

  for (const t of b.turrets) {
    if (!t.alive || !overlaps(bullet, t)) continue;
    recordHit(state);
    t.hp--;
    t.flash = 0.06;
    if (t.hp <= 0) {
      t.alive = false;
      registerKill(state, TURRET_POINTS, bullet.mult);
      events.push({ type: 'turretDestroyed', x: t.x + t.w / 2, y: t.y + t.h / 2 });
    }
    return true;
  }

  const core = wardenCore(b);
  if (overlaps(bullet, core)) {
    recordHit(state);
    b.hp--;
    b.flash = 0.06;
    events.push({ type: 'bossHit', x: bullet.x, y: core.y + core.h });
    if (b.hp <= 0) {
      killBoss(state, events);
      return true;
    }
    if (applyPhase(state, b, events)) {
      b.laser = null;
      if (b.phase >= 2) destroyTurrets(b, events);
    }
    return true;
  }

  // Solar panels and struts are armor: they absorb bullets without damage.
  return overlaps(bullet, b);
}
