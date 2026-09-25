import { ENEMY, FORMATION, PLAYER_ZONE_TOP } from '../data/balance';
import { worldAt } from '../data/worlds';
import { enemyHp, kindForRow } from './difficulty';
import { allocId } from './ids';
import { smoothstep } from './math';
import { shapeWidth, slotOffset, stageShapes } from './shapes';
import type { Enemy, Entry, SimState } from './types';

/** Sitting in its formation slot (not flying in, diving or free-moving). */
export function inFormation(e: Enemy): boolean {
  return e.dive === null && e.free === null && e.entry === null;
}

/** Bars between advances for the surviving fraction of the formation. */
export function advanceBars(aliveRatio: number): number {
  const [full, half, few] = FORMATION.advanceBars;
  return aliveRatio > 0.5 ? full : aliveRatio > 0.2 ? half : few;
}

/** Rows launch alternately from the left and right edge, swoop low through the middle, then rise into their slots. */
function entryFor(state: SimState, row: number, col: number): Entry {
  const side = row % 2 === 0 ? -1 : 1;
  const mid = state.fieldW / 2;
  return {
    t: -(row * FORMATION.entryRowDelay + col * FORMATION.entryColDelay),
    duration: FORMATION.entryTime,
    x0: side < 0 ? -ENEMY.w - 8 : state.fieldW + 8,
    y0: 30 + row * 12,
    cx: mid - side * state.fieldW * 0.15,
    cy: PLAYER_ZONE_TOP - 30,
  };
}

export function spawnFormation(state: SimState): void {
  const { cols, d } = state.diff;
  const special = worldAt(state.world).special;
  state.formation = {
    y: ENEMY.startY,
    sway: 0,
    swayDir: 1,
    shapes: stageShapes(state.world, state.stage),
    shapeIdx: 0,
    morph: 1,
    beats: 0,
    total: ENEMY.rows * cols,
    rows: ENEMY.rows,
    cols,
  };
  state.enemies = [];
  for (let row = 0; row < ENEMY.rows; row++) {
    const kind = kindForRow(row, d, special);
    const hp = enemyHp(kind, state.diff);
    for (let col = 0; col < cols; col++) {
      const entry = entryFor(state, row, col);
      state.enemies.push({
        id: allocId(state),
        kind,
        row,
        col,
        hp,
        maxHp: hp,
        flash: 0,
        dive: null,
        entry,
        free: null,
        phased: false,
        x: entry.x0,
        y: entry.y0,
        w: ENEMY.w,
        h: ENEMY.h,
      });
    }
  }
}

/** Top-left of an enemy's slot, blending from the previous shape while morphing. */
export function slotPosition(state: SimState, e: Enemy): { x: number; y: number } {
  const f = state.formation;
  const width = shapeWidth(f.cols, state.fieldW);
  const cur = slotOffset(f.shapes[f.shapeIdx]!, e.row, e.col, f.cols, width);
  let { dx, dy } = cur;
  if (f.morph < 1) {
    const prevKind = f.shapes[(f.shapeIdx - 1 + f.shapes.length) % f.shapes.length]!;
    const prev = slotOffset(prevKind, e.row, e.col, f.cols, width);
    const t = smoothstep(0, 1, f.morph);
    dx = prev.dx + (cur.dx - prev.dx) * t;
    dy = prev.dy + (cur.dy - prev.dy) * t;
  }
  return { x: state.fieldW / 2 + f.sway + dx - e.w / 2, y: f.y + dy };
}

function entryPosition(en: Entry, slot: { x: number; y: number }): { x: number; y: number } {
  const s = smoothstep(0, 1, en.t / en.duration);
  const a = (1 - s) * (1 - s);
  const b = 2 * (1 - s) * s;
  const c = s * s;
  return { x: a * en.x0 + b * en.cx + c * slot.x, y: a * en.y0 + b * en.cy + c * slot.y };
}

/**
 * Beat-driven formation: sways to the other side on every beat, and every few bars
 * advances one step down while morphing into the next shape of the stage.
 */
export function updateFormation(state: SimState, dt: number, beats: number): void {
  const f = state.formation;
  for (const e of state.enemies) if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);

  let members = 0;
  for (const e of state.enemies) if (!e.free) members++;
  if (members === 0) return;

  if (beats % 2 === 1) f.swayDir = f.swayDir === 1 ? -1 : 1;
  f.beats += beats;
  if (f.beats >= advanceBars(members / f.total) * 4) {
    f.beats = 0;
    f.y += state.diff.advanceStep;
    f.shapeIdx = (f.shapeIdx + 1) % f.shapes.length;
    f.morph = 0;
  }
  f.morph = Math.min(1, f.morph + (dt * worldAt(state.world).bpm) / 60 / FORMATION.morphBeats);

  const half = shapeWidth(f.cols, state.fieldW) / 2;
  const amp = Math.max(0, Math.min(state.diff.swayAmp, state.fieldW / 2 - half - ENEMY.w / 2 - FORMATION.edgeMargin));
  f.sway += (f.swayDir * amp - f.sway) * Math.min(1, dt * FORMATION.swayEase);

  for (const e of state.enemies) {
    if (e.entry) {
      const en = e.entry;
      en.t += dt;
      if (en.t < 0) continue;
      if (en.t >= en.duration) {
        e.entry = null;
      } else {
        const p = entryPosition(en, slotPosition(state, e));
        e.x = p.x;
        e.y = p.y;
        continue;
      }
    }
    if (!inFormation(e)) continue;
    const slot = slotPosition(state, e);
    e.x = slot.x;
    e.y = slot.y;
  }
}

/** Lowest edge of enemies sitting in the formation. */
export function formationBottom(state: SimState): number {
  let bottom = -Infinity;
  for (const e of state.enemies) if (inFormation(e)) bottom = Math.max(bottom, e.y + e.h);
  return bottom;
}
