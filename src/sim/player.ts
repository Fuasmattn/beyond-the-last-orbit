import { BEAT_TRACK, FIELD_H, HITSTOP, PLAYER, PLAYER_ZONE_TOP } from '../data/balance';
import { allocId } from './ids';
import { clamp } from './math';
import { applyShotRhythm, dropStreakLevel, recordShot, resetRhythm } from './scoring';
import type { InputFrame, SimEvent, SimState } from './types';

export function updatePlayer(
  state: SimState,
  input: InputFrame,
  dt: number,
  events: SimEvent[],
): void {
  const p = state.player;
  const approach = Math.min(1, PLAYER.response * dt);
  const speed = state.ship.speed;
  p.vx += (clamp(input.moveX, -1, 1) * speed - p.vx) * approach;
  p.vy += (clamp(input.moveY, -1, 1) * speed - p.vy) * approach;
  p.x = clamp(p.x + p.vx * dt + input.dragX, 0, state.fieldW - p.w);
  p.y = clamp(p.y + p.vy * dt + input.dragY, PLAYER_ZONE_TOP, FIELD_H - BEAT_TRACK.h - p.h - PLAYER.bottomMargin);
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.invuln = Math.max(0, p.invuln - dt);

  if (input.firePressed) tryFire(state, input, events);
}

/** Horizontal speed of spread-shot side bolts, as a fraction of bolt speed. */
const SPREAD_VX = 0.28;
const TWIN_GAP = 3;

function tryFire(state: SimState, input: InputFrame, events: SimEvent[]): void {
  const p = state.player;
  const ship = state.ship;
  if (p.cooldown > 0) return;
  let active = 0;
  for (const b of state.bullets) if (b.owner === 'player' && !b.extra) active++;
  if (active >= ship.maxBullets) return;

  const cx = p.x + p.w / 2;
  const y = p.y - PLAYER.bulletH;
  if (state.mode === 'rhythm') applyShotRhythm(state, input.fireOnBeat);
  const onBeat = state.mode === 'rhythm' && input.fireOnBeat === true;
  const bolt = (x: number, vx: number, extra: boolean) =>
    state.bullets.push({
      id: allocId(state),
      x: x - PLAYER.bulletW / 2,
      y,
      w: PLAYER.bulletW,
      h: PLAYER.bulletH,
      vx,
      vy: -PLAYER.bulletSpeed,
      owner: 'player',
      onBeat,
      mult: state.rhythm.mult,
      damage: ship.damage,
      pierce: ship.pierce,
      ...(extra ? { extra } : {}),
    });
  if (ship.twin) {
    bolt(cx - TWIN_GAP, 0, false);
    bolt(cx + TWIN_GAP, 0, true);
  } else {
    bolt(cx, 0, false);
  }
  if (ship.spread) {
    bolt(cx, -PLAYER.bulletSpeed * SPREAD_VX, true);
    bolt(cx, PLAYER.bulletSpeed * SPREAD_VX, true);
  }
  p.cooldown = ship.cooldown;
  recordShot(state);
  events.push({ type: 'shot', x: cx, y, onBeat });
}

export function hitPlayer(state: SimState, events: SimEvent[]): void {
  const p = state.player;
  if (p.shield > 0) {
    // Absorbed: no life lost and NO HIT survives, but the multiplier still drops a level.
    p.shield--;
    dropStreakLevel(state);
    p.invuln = PLAYER.invulnTime;
    state.hitStop = HITSTOP.playerHit;
    state.bullets = state.bullets.filter((b) => b.owner === 'player');
    events.push({ type: 'shieldHit', x: p.x + p.w / 2, y: p.y + p.h / 2, shieldLeft: p.shield });
    return;
  }
  p.lives--;
  p.invuln = PLAYER.invulnTime;
  if (state.mode === 'rogue') dropStreakLevel(state);
  else resetRhythm(state);
  state.stageStats.hitsTaken++;
  state.hitStop = HITSTOP.playerHit;
  state.bullets = state.bullets.filter((b) => b.owner === 'player');
  events.push({ type: 'playerHit', x: p.x + p.w / 2, y: p.y + p.h / 2, livesLeft: p.lives });
  if (p.lives <= 0) {
    state.phase = 'gameOver';
    events.push({ type: 'gameOver', score: state.score });
  }
}
