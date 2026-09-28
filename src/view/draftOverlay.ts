import { Container, Graphics, type Texture } from 'pixi.js';
import { FIELD_H } from '../data/balance';
import type { MenuAction, Tap } from '../input/inputFrame';
import { boonDef, RARITY_COLOR, type BoonDef } from '../sim/boons';
import type { RogueState } from '../sim/types';
import { blink } from './anim';
import { centerText, PixelText } from './pixelText';

/** What the player picked in the draft. */
export type DraftPick = { type: 'boon'; index: number } | { type: 'reroll' } | { type: 'skip' };

const TOP = 70;
const CARD_H = 38;
const ROW_H = 16;
const MAX_W = 150;

/** Third card line: the synergy partner (green when owned), or CURSE. */
function cardTag(def: BoonDef, r: RogueState): { text: string; color: number } | null {
  if (def.rarity === 'curse') return { text: 'CURSE', color: RARITY_COLOR.curse };
  if (!def.synergy?.length) return null;
  const owned = def.synergy.find((id) => (r.boons[id] ?? 0) > 0);
  const partner = boonDef(owned ?? def.synergy[0]!);
  return { text: `WITH ${partner.name}`, color: owned ? 0x7dff6b : 0x666a88 };
}

interface Row {
  pick: DraftPick;
  y: number;
  h: number;
}

/** Pick 1 of 3 upgrades, with reroll (hangar INSIGHT) and skip. */
export class DraftOverlay extends Container {
  private readonly panel = new Graphics();
  private readonly title: PixelText;
  private readonly hint: PixelText;
  private readonly texts: PixelText[] = [];
  private rows: Row[] = [];
  private sel = 0;
  /** Row selected by the last tap; tapping it again picks it. Null until a row is tapped. */
  private tapped: number | null = null;

  constructor(
    private readonly glyphs: Map<string, Texture>,
    isTouch: boolean,
  ) {
    super();
    this.title = new PixelText(glyphs, 'CHOOSE AN UPGRADE', 0xffe14a);
    this.hint = new PixelText(glyphs, isTouch ? 'TAP TWICE TO PICK' : 'UP/DOWN  FIRE TO PICK', 0x777777);
    this.addChild(this.panel, this.title, this.hint);
    this.visible = false;
  }

  open(): void {
    this.sel = 0;
    this.tapped = null;
  }

  /** A tap selects a row (highlighting it); a second tap on the same row picks it. */
  handle(r: RogueState, menu: readonly MenuAction[], taps: readonly Tap[]): DraftPick | null {
    this.layoutRows(r);
    const n = this.rows.length;
    for (const a of menu) {
      if (a === 'up' || a === 'left') this.sel = (this.sel - 1 + n) % n;
      else if (a === 'down' || a === 'right') this.sel = (this.sel + 1) % n;
      else if (a === 'confirm') return this.rows[this.sel]!.pick;
      this.tapped = null;
    }
    for (const t of taps) {
      const i = this.rows.findIndex((x) => t.y >= x.y - 4 && t.y < x.y - 4 + x.h);
      if (i < 0) continue;
      if (this.tapped === i) return this.rows[i]!.pick;
      this.sel = i;
      this.tapped = i;
    }
    return null;
  }

  update(r: RogueState, fieldW: number, time: number): void {
    this.layoutRows(r);
    this.sel = Math.min(this.sel, this.rows.length - 1);
    const w = Math.min(MAX_W, fieldW - 8);
    const x0 = Math.round((fieldW - w) / 2);
    const g = this.panel.clear().rect(0, 0, fieldW, FIELD_H).fill({ color: 0x000000, alpha: 0.6 });
    let ti = 0;
    const text = (s: string, color: number, y: number) => {
      const t = this.text(ti++);
      t.setText(s);
      t.tint = color;
      centerText(t, y, fieldW);
    };
    this.rows.forEach((row, i) => {
      const on = i === this.sel;
      const border = on ? 0xffe14a : 0x3a4060;
      g.rect(x0, row.y - 4, w, row.h - 3).fill({ color: 0x05030f, alpha: 0.9 });
      g.rect(x0, row.y - 4, w, row.h - 3).stroke({ color: border, width: 1, alpha: on && !blink(time, 3) ? 0.6 : 1 });
      if (row.pick.type === 'boon') {
        const id = r.offer[row.pick.index]!;
        const def = boonDef(id);
        const owned = r.boons[id] ?? 0;
        text(owned > 0 ? `${def.name} LV${owned + 1}` : def.name, on ? 0xffe14a : RARITY_COLOR[def.rarity], row.y + 2);
        text(def.desc, 0xcccccc, row.y + 12);
        const tag = cardTag(def, r);
        if (tag) text(tag.text, tag.color, row.y + 22);
      } else if (row.pick.type === 'reroll') {
        text(`REROLL  ${r.rerolls} LEFT`, on ? 0xffe14a : 0x4af2ff, row.y + 1);
      } else {
        text('SKIP', on ? 0xffe14a : 0x999999, row.y + 1);
      }
    });
    for (let i = ti; i < this.texts.length; i++) this.texts[i]!.visible = false;
    centerText(this.title, TOP - 24, fieldW);
    centerText(this.hint, FIELD_H - 40, fieldW);
  }

  private layoutRows(r: RogueState): void {
    const rows: Row[] = [];
    let y = TOP;
    r.offer.forEach((_, index) => {
      rows.push({ pick: { type: 'boon', index }, y, h: CARD_H });
      y += CARD_H;
    });
    y += 4;
    if (r.rerolls > 0) {
      rows.push({ pick: { type: 'reroll' }, y, h: ROW_H });
      y += ROW_H;
    }
    rows.push({ pick: { type: 'skip' }, y, h: ROW_H });
    this.rows = rows;
  }

  private text(i: number): PixelText {
    let t = this.texts[i];
    if (!t) {
      t = new PixelText(this.glyphs);
      this.texts.push(t);
      this.addChild(t);
    }
    t.visible = true;
    return t;
  }
}
