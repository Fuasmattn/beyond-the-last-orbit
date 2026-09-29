import { BEAT_STAGE, BEAT_TRACK, BOON, FIELD_H, HITSTOP, PLAYER, PLAYER_ZONE_TOP } from '../data/balance';
import { allocId } from './ids';
import { clamp } from './math';
import { applyShotRhythm, dropStreakLevel, recordShot, resetRhythm } from './scoring';
import type { Box, InputFrame, SimEvent, SimState } from './types';

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
  // Volley cap: a shot holds a slot until every bolt it fired has hit or left the field, so side bolts sprayed
  // at an angle are not free (M22). Shrapnel and burst bolts carry no volley and never block a shot.
  const volleys = new Set<number>();
  for (const b of state.bullets) if (b.owner === 'player' && b.volley !== undefined) volleys.add(b.volley);
  if (volleys.size >= ship.maxBullets) return;
  const volley = allocId(state);

  const cx = p.x + p.w / 2;
  const y = p.y - PLAYER.bulletH;
  applyShotRhythm(state, input.fireOnBeat);
  const judged = state.beatMode !== 'off';
  const onBeat = judged && input.fireOnBeat === true;
  // Beat stages: a PERFECT press fires a power shot. GRAZE CHARGE: a full meter does too.
  const charged = ship.chargeGrazes > 0 && state.charge >= ship.chargeGrazes;
  const power = (state.beatMode === 'master' && onBeat && input.firePerfect) || charged;
  if (charged) state.charge = 0;
  const overdrive = ship.overdrive && state.rhythm.mult >= BOON.overdriveMult ? 1 : 0;
  const sniper = ship.sniper && Math.hypot(p.vx, p.vy) < BOON.sniperStill ? 1 : 0;
  const w = power ? Math.max(BEAT_STAGE.powerW, ship.boltW) : ship.boltW;
  const bolt = (x: number, vx: number, extra: boolean) =>
    state.bullets.push({
      id: allocId(state),
      x: x - w / 2,
      y,
      w,
      h: PLAYER.bulletH,
      vx,
      vy: -ship.boltSpeed,
      owner: 'player',
      onBeat,
      mult: state.rhythm.mult,
      damage: ship.damage + overdrive + sniper + (power ? BEAT_STAGE.powerDamage : 0),
      pierce: ship.pierce + (power ? BEAT_STAGE.powerPierce : 0),
      volley,
      ...(extra ? { extra } : {}),
      ...(extra && vx !== 0 && ship.bounce > 0 ? { bounce: ship.bounce } : {}),
      ...(power ? { power } : {}),
    });
  if (ship.twin) {
    bolt(cx - TWIN_GAP, 0, false);
    bolt(cx + TWIN_GAP, 0, true);
  } else {
    bolt(cx, 0, false);
  }
  if (ship.spread) {
    bolt(cx, -ship.boltSpeed * SPREAD_VX, true);
    bolt(cx, ship.boltSpeed * SPREAD_VX, true);
  }
  if (ship.mirror) bolt(state.fieldW - cx, 0, true);
  p.cooldown = ship.cooldown;
  recordShot(state);
  events.push({ type: 'shot', x: cx, y, onBeat, power });
}

/** What enemy bullets and lasers must touch to hit: a small core at the center of the hull (HOT ZONE grows it). */
/** SHIELD BURST: a ring of side bolts from the ship's center, carrying the current bolt damage. */
function shieldBurst(state: SimState, events: SimEvent[]): void {
  const p = state.player;
  const ship = state.ship;
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  for (let i = 0; i < BOON.burstCount; i++) {
    const a = (i / BOON.burstCount) * Math.PI * 2;
    state.bullets.push({
      id: allocId(state),
      x: cx - ship.boltW / 2,
      y: cy - PLAYER.bulletH / 2,
      w: ship.boltW,
      h: PLAYER.bulletH,
      vx: Math.sin(a) * BOON.burstSpeed,
      vy: -Math.cos(a) * BOON.burstSpeed,
      owner: 'player',
      onBeat: false,
      mult: state.rhythm.mult,
      damage: ship.damage,
      pierce: ship.pierce,
      extra: true,
    });
  }
  events.push({ type: 'shieldBurst', x: cx, y: cy });
}

export function hurtbox(state: SimState): Box {
  const p = state.player;
  const w = PLAYER.hurtW * state.ship.hurtScale;
  const h = PLAYER.hurtH * state.ship.hurtScale;
  return { x: p.x + (p.w - w) / 2, y: p.y + (p.h - h) / 2, w, h };
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
    if (state.ship.shieldBurst) shieldBurst(state, events);
    return;
  }
  p.lives--;
  p.invuln = PLAYER.invulnTime;
  if (state.ship.fragileStreak) resetRhythm(state);
  else dropStreakLevel(state);
  state.stageStats.hitsTaken++;
  state.hitStop = HITSTOP.playerHit;
  state.bullets = state.bullets.filter((b) => b.owner === 'player');
  events.push({ type: 'playerHit', x: p.x + p.w / 2, y: p.y + p.h / 2, livesLeft: p.lives });
  if (p.lives > 0) return;
  if (state.ship.revives > 0) {
    // SECOND WIND: back with one ship and a shield.
    state.ship.revives--;
    p.lives = 1;
    p.shield = Math.max(p.shield, 1);
    p.invuln = BOON.reviveInvuln;
    events.push({ type: 'revived', lives: p.lives });
    return;
  }
  state.phase = 'gameOver';
  events.push({ type: 'gameOver', score: state.score });
}
