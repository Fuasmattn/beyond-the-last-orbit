import { BEAT_TRACK, FIELD_H, HITSTOP, PLAYER, PLAYER_ZONE_TOP } from '../data/balance';
import { allocId } from './ids';
import { clamp } from './math';
import { applyShotRhythm, recordShot, resetRhythm } from './scoring';
import type { InputFrame, SimEvent, SimState } from './types';

export function updatePlayer(
  state: SimState,
  input: InputFrame,
  dt: number,
  events: SimEvent[],
): void {
  const p = state.player;
  const approach = Math.min(1, PLAYER.response * dt);
  p.vx += (clamp(input.moveX, -1, 1) * PLAYER.maxSpeed - p.vx) * approach;
  p.vy += (clamp(input.moveY, -1, 1) * PLAYER.maxSpeed - p.vy) * approach;
  p.x = clamp(p.x + p.vx * dt + input.dragX, 0, state.fieldW - p.w);
  p.y = clamp(p.y + p.vy * dt + input.dragY, PLAYER_ZONE_TOP, FIELD_H - BEAT_TRACK.h - p.h - PLAYER.bottomMargin);
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.invuln = Math.max(0, p.invuln - dt);

  if (input.firePressed) tryFire(state, input, events);
}

function tryFire(state: SimState, input: InputFrame, events: SimEvent[]): void {
  const p = state.player;
  if (p.cooldown > 0) return;
  let active = 0;
  for (const b of state.bullets) if (b.owner === 'player') active++;
  if (active >= PLAYER.maxBullets) return;

  const x = p.x + p.w / 2 - PLAYER.bulletW / 2;
  const y = p.y - PLAYER.bulletH;
  applyShotRhythm(state, input.fireOnBeat);
  const onBeat = input.fireOnBeat === true;
  state.bullets.push({
    id: allocId(state),
    x,
    y,
    w: PLAYER.bulletW,
    h: PLAYER.bulletH,
    vx: 0,
    vy: -PLAYER.bulletSpeed,
    owner: 'player',
    onBeat,
    mult: state.rhythm.mult,
  });
  p.cooldown = PLAYER.fireCooldown;
  recordShot(state);
  events.push({ type: 'shot', x: x + PLAYER.bulletW / 2, y, onBeat });
}

export function hitPlayer(state: SimState, events: SimEvent[]): void {
  const p = state.player;
  p.lives--;
  p.invuln = PLAYER.invulnTime;
  resetRhythm(state);
  state.stageStats.hitsTaken++;
  state.hitStop = HITSTOP.playerHit;
  state.bullets = state.bullets.filter((b) => b.owner === 'player');
  events.push({ type: 'playerHit', x: p.x + p.w / 2, y: p.y + p.h / 2, livesLeft: p.lives });
  if (p.lives <= 0) {
    state.phase = 'gameOver';
    events.push({ type: 'gameOver', score: state.score });
  }
}
