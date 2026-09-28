import { Container, Graphics, type Texture } from 'pixi.js';
import { FIELD_H } from '../data/balance';
import type { MenuAction, Tap } from '../input/inputFrame';
import { reachableLanes } from '../sim/route';
import type { NodeKind, RogueState } from '../sim/types';
import { blink } from './anim';
import { centerText, PixelText } from './pixelText';

const NODE_INFO: Record<NodeKind, { letter: string; name: string; desc: string; color: number }> = {
  battle: { letter: 'B', name: 'BATTLE', desc: 'SCORE AND CREDITS', color: 0x4af2ff },
  elite: { letter: 'E', name: 'ELITE', desc: 'HARD FIGHT - THEN UPGRADE', color: 0xff3b5c },
  cache: { letter: 'C', name: 'CACHE', desc: 'FREE UPGRADE - NO SCORE', color: 0xffe14a },
  repair: { letter: 'R', name: 'REPAIR', desc: '+1 SHIP - NO SCORE', color: 0x7dff6b },
};

const START_Y = 238;
const ROW_Y = [196, 154, 112] as const;
const BOSS_Y = 70;
const BOX = 12;
const TAP_RADIUS = 14;
const DIM = 0x3a4060;
const BEAT_COLOR = 0xff5ad1;
const PATH = 0xffe14a;

/** Slay-the-Spire-style map between rogue stages; bottom row first, boss on top. */
export class RouteOverlay extends Container {
  private readonly shade = new Graphics();
  private readonly links = new Graphics();
  private readonly boxes = new Graphics();
  private readonly letters: PixelText[] = [];
  private readonly title: PixelText;
  private readonly nodeName: PixelText;
  private readonly desc: PixelText;
  private readonly hint: PixelText;
  private readonly boss: PixelText;
  private readonly beatLabel: PixelText;
  private pick = 0;
  /** Lane selected by the last tap; tapping it again goes there. Null until a node is tapped. */
  private tapped: number | null = null;
  private fieldW = 0;

  constructor(
    private readonly glyphs: Map<string, Texture>,
    isTouch: boolean,
  ) {
    super();
    this.title = new PixelText(glyphs, 'CHOOSE YOUR ROUTE', 0xffe14a);
    this.nodeName = new PixelText(glyphs, '');
    this.desc = new PixelText(glyphs, '', 0xcccccc);
    this.hint = new PixelText(glyphs, isTouch ? 'TAP A NODE TWICE TO GO' : 'LEFT/RIGHT  FIRE TO GO', 0x777777);
    this.boss = new PixelText(glyphs, 'BOSS', 0xff3b5c);
    this.beatLabel = new PixelText(glyphs, 'BEAT', BEAT_COLOR);
    this.addChild(this.shade, this.links, this.boxes, this.title, this.nodeName, this.desc, this.hint, this.boss, this.beatLabel);
    this.visible = false;
  }

  /** Fresh map screen: cursor on the first reachable node. */
  open(): void {
    this.pick = 0;
    this.tapped = null;
  }

  /** Returns the picked lane, or null. A tap selects a node (showing its info); a second tap on it goes. */
  handle(r: RogueState, menu: readonly MenuAction[], taps: readonly Tap[]): number | null {
    const lanes = reachableLanes(r);
    if (lanes.length === 0) return null;
    this.pick = Math.min(this.pick, lanes.length - 1);
    for (const a of menu) {
      if (a === 'left' || a === 'up') this.pick = (this.pick - 1 + lanes.length) % lanes.length;
      else if (a === 'right' || a === 'down') this.pick = (this.pick + 1) % lanes.length;
      else if (a === 'confirm') return lanes[this.pick]!;
      this.tapped = null;
    }
    const y = ROW_Y[r.path.length];
    if (y === undefined) return null;
    for (const t of taps) {
      const i = lanes.findIndex((l) => Math.hypot(t.x - this.laneX(l), t.y - y) <= TAP_RADIUS);
      if (i < 0) continue;
      if (this.tapped === lanes[i]) return lanes[i]!;
      this.pick = i;
      this.tapped = lanes[i]!;
    }
    return null;
  }

  update(r: RogueState, fieldW: number, time: number): void {
    if (fieldW !== this.fieldW) this.shade.clear().rect(0, 0, fieldW, FIELD_H).fill({ color: 0x000000, alpha: 0.6 });
    this.fieldW = fieldW;
    const lanes = reachableLanes(r);
    const row = r.path.length;
    const selected = lanes[Math.min(this.pick, lanes.length - 1)];
    const cx = fieldW / 2;

    // Links: start → row 0, row i → row i+1, last row → boss.
    const g = this.links.clear();
    const taken = (i: number, lane: number) => r.path[i] === lane;
    for (const n of r.map.rows[0] ?? []) {
      g.moveTo(cx, START_Y).lineTo(this.laneX(n.lane), ROW_Y[0]).stroke({ color: taken(0, n.lane) ? PATH : DIM, width: 1 });
    }
    const last = r.map.rows.length - 1;
    r.map.rows.forEach((nodes, i) => {
      for (const n of nodes) {
        const from = [this.laneX(n.lane), ROW_Y[i]!] as const;
        if (i === last) {
          g.moveTo(...from).lineTo(cx, BOSS_Y).stroke({ color: taken(i, n.lane) ? PATH : DIM, width: 1 });
          continue;
        }
        for (const l of n.next) {
          const onPath = taken(i, n.lane) && taken(i + 1, l);
          g.moveTo(...from).lineTo(this.laneX(l), ROW_Y[i + 1]!).stroke({ color: onPath ? PATH : DIM, width: 1 });
        }
      }
    });

    // Nodes. The beat row sits on a pulsing pink band.
    const b = this.boxes.clear();
    const beatRow = r.map.rows.findIndex((nodes) => nodes.some((n) => n.beat));
    this.beatLabel.visible = beatRow >= 0;
    if (beatRow >= 0) {
      const y = ROW_Y[beatRow]!;
      b.rect(0, y - BOX, fieldW, BOX * 2).fill({ color: BEAT_COLOR, alpha: 0.08 + 0.06 * Math.sin(time * 6) });
      this.beatLabel.position.set(4, y - 2);
    }
    b.circle(cx, START_Y, 3).fill(PATH);
    let li = 0;
    r.map.rows.forEach((nodes, i) => {
      for (const n of nodes) {
        const info = NODE_INFO[n.kind];
        const x = this.laneX(n.lane);
        const y = ROW_Y[i]!;
        const reachable = i === row && lanes.includes(n.lane);
        const past = i < row;
        const color = past && !taken(i, n.lane) ? DIM : info.color;
        b.rect(x - BOX / 2, y - BOX / 2, BOX, BOX).fill({ color: 0x05030f, alpha: 0.9 });
        b.rect(x - BOX / 2, y - BOX / 2, BOX, BOX).stroke({ color, width: 1, alpha: reachable || taken(i, n.lane) ? 1 : 0.5 });
        if (taken(i, n.lane)) b.rect(x - BOX / 2, y - BOX / 2, BOX, BOX).fill({ color: PATH, alpha: 0.25 });
        if (reachable && n.lane === selected && blink(time, 3)) {
          b.rect(x - BOX / 2 - 3, y - BOX / 2 - 3, BOX + 6, BOX + 6).stroke({ color: 0xffffff, width: 1 });
        }
        const t = this.letter(li++);
        t.setText(info.letter);
        t.tint = color;
        t.alpha = reachable || past || i > row ? 1 : 0.5;
        t.position.set(Math.round(x - 1), Math.round(y - 2));
      }
    });
    for (let i = li; i < this.letters.length; i++) this.letters[i]!.visible = false;
    b.rect(cx - 12, BOSS_Y - 7, 24, 14).fill({ color: 0x05030f, alpha: 0.9 }).rect(cx - 12, BOSS_Y - 7, 24, 14).stroke({ color: 0xff3b5c, width: 1 });
    this.boss.position.set(Math.round(cx - this.boss.pixelWidth / 2), BOSS_Y - 2);

    centerText(this.title, 30, fieldW);
    const node = selected === undefined ? undefined : r.map.rows[row]?.find((n) => n.lane === selected);
    const info = node ? NODE_INFO[node.kind] : null;
    this.nodeName.setText(info ? (node?.beat ? `BEAT ${info.name}` : info.name) : '');
    this.nodeName.tint = node?.beat ? BEAT_COLOR : (info?.color ?? 0xffffff);
    this.desc.setText(node?.beat ? 'ON BEAT X8 - RANK A+ UPGRADES' : (info?.desc ?? ''));
    centerText(this.nodeName, 256, fieldW);
    centerText(this.desc, 266, fieldW);
    centerText(this.hint, FIELD_H - 40, fieldW);
  }

  laneX(lane: number): number {
    const spacing = Math.min(48, (this.fieldW - 40) / 2);
    return Math.round(this.fieldW / 2 + (lane - 1) * spacing);
  }

  private letter(i: number): PixelText {
    let t = this.letters[i];
    if (!t) {
      t = new PixelText(this.glyphs);
      this.letters.push(t);
      this.addChild(t);
    }
    t.visible = true;
    return t;
  }
}
