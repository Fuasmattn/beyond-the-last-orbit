import { Container, Graphics, type Texture } from 'pixi.js';
import { BEAT_TRACK, FIELD_H, RHYTHM } from '../data/balance';
import { lerpColor } from './beatPulse';
import { LOOKAHEAD_BEATS, markerOffset, upcomingBeats, type JudgeLabel } from './beatJudge';
import { PixelText } from './pixelText';

const TOP = FIELD_H - BEAT_TRACK.h;
const MID = TOP + BEAT_TRACK.h / 2;
const GATE_HALF = 6;
const EDGE_PAD = 6;
const MARKER_COLOR = 0x4af2ff;
/** Beat stages (rogue): markers turn pink so the stage reads as special at a glance. */
const MASTER_COLOR = 0xff5ad1;
const DOWNBEAT_COLOR = 0xffe14a;
const GATE_COLOR = 0xffffff;
const FLASH_TIME = 0.3;
const LABEL_TIME = 0.55;
const LABEL_COLOR: Record<JudgeLabel, number> = { PERFECT: 0xffe14a, GOOD: 0x4af2ff, OFF: 0xff3b5c };

const MULT_COLORS: readonly [number, number][] = [
  [4, 0xffe14a],
  [3, 0xff5ad1],
  [2, 0x4af2ff],
  [1.5, 0x7dff6b],
  [1, 0xffffff],
];

export function multColor(mult: number): number {
  for (const [min, color] of MULT_COLORS) if (mult >= min) return color;
  return 0xffffff;
}

/**
 * Rhythm-game strip along the bottom edge: markers slide in from both sides and meet
 * in the center gate exactly on each beat. Shots flash the gate and show a PERFECT/GOOD/OFF grade beside it.
 */
export class BeatTrack extends Container {
  private readonly band = new Graphics();
  private readonly markers = new Graphics();
  private readonly gate = new Graphics();
  private readonly grade: PixelText;
  private readonly mult: PixelText;
  private readonly pips = new Graphics();
  private trackW = 0;
  private flash = 0;
  private flashColor = GATE_COLOR;
  private labelTime = 0;
  private markerColor = MARKER_COLOR;

  constructor(glyphs: Map<string, Texture>) {
    super();
    this.grade = new PixelText(glyphs);
    this.mult = new PixelText(glyphs);
    this.addChild(this.band, this.markers, this.gate, this.pips, this.mult, this.grade);
  }

  judge(label: JudgeLabel): void {
    this.flash = FLASH_TIME;
    this.flashColor = LABEL_COLOR[label];
    this.grade.setText(label);
    this.labelTime = LABEL_TIME;
  }

  /**
   * `beat` null (no audio) hides the rhythm parts. `streak` drives the pips toward the next multiplier step.
   * `markers` false (rogue runs): only the multiplier and pips are shown, audio or not.
   */
  update(
    fieldW: number,
    beat: number | null,
    mult: number,
    streak: number,
    dt: number,
    markers = true,
    master = false,
  ): void {
    this.markerColor = master ? MASTER_COLOR : MARKER_COLOR;
    if (fieldW !== this.trackW) this.layout(fieldW);
    const cx = fieldW / 2;
    this.flash = Math.max(0, this.flash - dt);
    this.labelTime = Math.max(0, this.labelTime - dt);

    const rhythm = markers && beat !== null;
    this.markers.visible = this.gate.visible = rhythm;
    this.mult.visible = this.pips.visible = rhythm || !markers;
    this.grade.visible = rhythm && this.labelTime > 0;
    if (!this.mult.visible) return;

    if (rhythm) {
      this.drawMarkers(cx, beat);
      this.drawGate(cx, beat);
    }

    this.mult.setText(`X${mult.toFixed(1)}`);
    this.mult.tint = multColor(mult);
    this.mult.position.set(Math.round(cx + GATE_HALF + 6), MID - 2);
    const steps = RHYTHM.shotsPerStep;
    const filled = mult >= RHYTHM.maxMult ? steps : streak % steps;
    const px = this.mult.x + this.mult.pixelWidth + 3;
    this.pips.clear();
    for (let i = 0; i < steps; i++) {
      this.pips.rect(px + i * 3, MID - 1, 2, 2).fill(i < filled ? multColor(mult) : 0x333a55);
    }

    // Grade pops in big above the gate, then settles and fades.
    const age = 1 - this.labelTime / LABEL_TIME;
    const s = 1 + 0.6 * Math.max(0, 1 - age * 4);
    this.grade.scale.set(s);
    this.grade.tint = this.flashColor;
    this.grade.alpha = Math.min(1, this.labelTime / (LABEL_TIME * 0.4));
    // Sits left of the gate, mirroring the multiplier on the right.
    this.grade.position.set(Math.round(cx - GATE_HALF - 8 - this.grade.pixelWidth), Math.round(MID - 2.5 * s));
  }

  private layout(fieldW: number): void {
    this.trackW = fieldW;
    this.band
      .clear()
      .rect(0, TOP, fieldW, BEAT_TRACK.h)
      .fill({ color: 0x05030f, alpha: 0.8 })
      .rect(0, TOP, fieldW, 1)
      .fill({ color: MARKER_COLOR, alpha: 0.35 })
      .rect(0, MID, fieldW, 1)
      .fill({ color: MARKER_COLOR, alpha: 0.12 });
  }

  private drawMarkers(cx: number, beat: number): void {
    const halfW = cx - EDGE_PAD;
    const g = this.markers.clear();
    for (const k of upcomingBeats(beat)) {
      const d = markerOffset(k, beat, halfW);
      const down = ((k % 4) + 4) % 4 === 0;
      const h = down ? 16 : 11;
      const w = down ? 4 : 3;
      const color = down ? DOWNBEAT_COLOR : this.markerColor;
      // Fade in from the edges, snap bright near the gate, vanish just past it.
      const near = 1 - Math.min(1, Math.abs(d) / halfW);
      const alpha = d < 0 ? Math.max(0, 1 + d / 4) : 0.4 + 0.6 * near;
      for (const x of [cx - d, cx + d]) {
        g.rect(x - w / 2 - 2, MID - h / 2 - 1, w + 4, h + 2).fill({ color, alpha: alpha * 0.25 });
        g.rect(x - w / 2, MID - h / 2, w, h).fill({ color, alpha });
      }
      // Connecting trail toward the gate on the final beat of approach.
      if (d > 0 && d < halfW / LOOKAHEAD_BEATS) {
        g.rect(cx - d, MID, d * 2, 1).fill({ color, alpha: 0.15 * near });
      }
    }
  }

  private drawGate(cx: number, beat: number): void {
    const whole = Math.floor(beat);
    const frac = beat - whole;
    const onBeat = Math.max(0, 1 - frac * 4) ** 2;
    const beatColor = ((whole % 4) + 4) % 4 === 0 ? DOWNBEAT_COLOR : this.markerColor;
    const flash = this.flash / FLASH_TIME;
    const color = lerpColor(GATE_COLOR, this.flashColor, flash);
    const open = GATE_HALF + 3 * onBeat + 2 * flash;
    const top = TOP + 2;
    const bottom = FIELD_H - 2;
    const g = this.gate.clear();
    // Every beat: the strip flares from the gate outward and the gate lights up.
    if (onBeat > 0) {
      const reach = (this.trackW / 2) * (0.3 + 0.7 * (1 - onBeat));
      g.rect(cx - reach, MID - 0.5, reach * 2, 1.5).fill({ color: beatColor, alpha: 0.6 * onBeat });
      g.rect(cx - open, top, open * 2, bottom - top).fill({ color: beatColor, alpha: 0.4 * onBeat });
    }
    if (flash > 0) g.rect(cx - open, top, open * 2, bottom - top).fill({ color: this.flashColor, alpha: 0.35 * flash });
    for (const side of [-1, 1]) {
      const x = cx + side * open;
      g.moveTo(x - side * 3, top)
        .lineTo(x, top)
        .lineTo(x, bottom)
        .lineTo(x - side * 3, bottom)
        .stroke({ color, width: 1.5, alpha: 0.7 + 0.3 * Math.max(onBeat, flash) });
    }
  }
}
