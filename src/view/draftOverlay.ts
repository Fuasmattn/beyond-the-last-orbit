import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { FIELD_H, SHOP } from '../data/balance';
import type { MenuAction, Tap } from '../input/inputFrame';
import { boonDef, RARITY_COLOR, type BoonDef } from '../sim/boons';
import { shopPrice } from '../sim/stageFlow';
import type { BoonId, DraftTier, RogueState } from '../sim/types';
import { blink } from './anim';
import { centerText, charsThatFit, PixelText, wrapText } from './pixelText';

/** What the player picked in the draft or shop (`skip` doubles as LEAVE). */
export type DraftPick = { type: 'boon'; index: number } | { type: 'reroll' } | { type: 'skip' } | { type: 'repair' };

export type DraftMode = 'draft' | 'shop';

const TOP = 66;
/** Draft heading per tier: the run-opening pick, the small common draft after a plain stage, the rest. */
const DRAFT_TITLE: Readonly<Record<DraftTier, string>> = {
  starter: 'PICK A LOADOUT',
  basic: 'FIELD UPGRADE',
  full: 'CHOOSE AN UPGRADE',
  rare: 'RARE PARTS',
};
const CARD_H = 48;
/** Card height when descriptions need two lines (narrow views). */
const CARD_H_WRAPPED = 58;
const ICON_INSET = 3;
const ICON_GAP = 3;
const ROW_H = 16;
const MAX_W = 200;
/** Card icon: 8×8 pictogram drawn at this scale, inset from the card's left edge. */
const ICON_SCALE = 2;

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

/** Draft: pick 1 of 3 upgrades, with reroll (hangar INSIGHT) and skip. Shop: buy any for scrap, then leave. */
export class DraftOverlay extends Container {
  private readonly panel = new Graphics();
  private readonly title: PixelText;
  private readonly hint: PixelText;
  private readonly scrap: PixelText;
  private readonly texts: PixelText[] = [];
  private readonly icons: Sprite[] = [];
  private rows: Row[] = [];
  private sel = 0;
  private mode: DraftMode = 'draft';
  /** Row selected by the last tap; tapping it again picks it. Null until a row is tapped. */
  private tapped: number | null = null;
  /** View width from the last update; rows lay out against it (default field width before the first frame). */
  private viewW = 240;

  constructor(
    private readonly glyphs: Map<string, Texture>,
    private readonly iconTex: Map<BoonId, Texture>,
    isTouch: boolean,
  ) {
    super();
    this.title = new PixelText(glyphs, 'CHOOSE AN UPGRADE', 0xffe14a);
    this.hint = new PixelText(glyphs, isTouch ? 'TAP TWICE TO PICK' : 'UP/DOWN  FIRE TO PICK', 0x777777);
    this.scrap = new PixelText(glyphs, '', 0xffb347);
    this.addChild(this.panel, this.title, this.hint, this.scrap);
    this.visible = false;
  }

  open(mode: DraftMode = 'draft'): void {
    this.mode = mode;
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
    this.viewW = fieldW;
    this.layoutRows(r);
    this.sel = Math.min(this.sel, this.rows.length - 1);
    const w = Math.min(MAX_W, fieldW - 8);
    const maxChars = charsThatFit(w - 4);
    const x0 = Math.round((fieldW - w) / 2);
    const g = this.panel.clear().rect(0, 0, fieldW, FIELD_H).fill({ color: 0x000000, alpha: 0.6 });
    const shop = this.mode === 'shop';
    const offer = shop ? (r.shop?.offer ?? []) : r.offer;
    this.title.setText(shop ? 'SHOP' : DRAFT_TITLE[r.draftTier]);
    const afford = (price: number) => r.scrap >= price;
    let ti = 0;
    let ii = 0;
    const text = (s: string, color: number, y: number, x?: number) => {
      const t = this.text(ti++);
      t.setText(s);
      t.tint = color;
      if (x === undefined) centerText(t, y, fieldW);
      else t.position.set(x, y);
    };
    this.rows.forEach((row, i) => {
      const on = i === this.sel;
      const border = on ? 0xffe14a : 0x3a4060;
      g.rect(x0, row.y - 4, w, row.h - 3).fill({ color: 0x05030f, alpha: 0.9 });
      g.rect(x0, row.y - 4, w, row.h - 3).stroke({ color: border, width: 1, alpha: on && !blink(time, 3) ? 0.6 : 1 });
      if (row.pick.type === 'boon') {
        const id = offer[row.pick.index]!;
        const def = boonDef(id);
        const owned = r.boons[id] ?? 0;
        // Line 1: pictogram at the left edge, name beside it. Lines 2–3 centred over the card.
        const icon = this.icon(ii++);
        icon.texture = this.iconTex.get(id) ?? icon.texture;
        icon.tint = RARITY_COLOR[def.rarity];
        icon.position.set(x0 + ICON_INSET, row.y + 1);
        const nameX = x0 + ICON_INSET + 8 * ICON_SCALE + ICON_GAP;
        text(owned > 0 ? `${def.name} LV${owned + 1}` : def.name, on ? 0xffe14a : RARITY_COLOR[def.rarity], row.y + 5, nameX);
        const lines = wrapText(def.desc, maxChars);
        lines.forEach((line, k) => text(line, 0xcccccc, row.y + 21 + k * 10));
        const tagY = row.y + 21 + lines.length * 10;
        if (shop) {
          const price = shopPrice(id);
          text(`${price} SCRAP`, afford(price) ? 0x7dff6b : 0xff5a5a, tagY);
        } else {
          const tag = cardTag(def, r);
          if (tag) text(tag.text, tag.color, tagY);
        }
      } else if (row.pick.type === 'repair') {
        text(`+1 SHIP  ${SHOP.repair} SCRAP`, on ? 0xffe14a : afford(SHOP.repair) ? 0x7dff6b : 0x666a88, row.y + 1);
      } else if (row.pick.type === 'reroll') {
        if (shop) {
          const price = r.shop?.rerollPrice ?? 0;
          text(`REROLL  ${price} SCRAP`, on ? 0xffe14a : afford(price) ? 0x4af2ff : 0x666a88, row.y + 1);
        } else text(`REROLL  ${r.rerolls} LEFT`, on ? 0xffe14a : 0x4af2ff, row.y + 1);
      } else {
        text(shop ? 'LEAVE' : 'SKIP', on ? 0xffe14a : 0x999999, row.y + 1);
      }
    });
    for (let i = ti; i < this.texts.length; i++) this.texts[i]!.visible = false;
    for (let i = ii; i < this.icons.length; i++) this.icons[i]!.visible = false;
    this.scrap.visible = shop;
    if (shop) {
      this.scrap.setText(`SCRAP ${r.scrap}`);
      centerText(this.scrap, TOP - 11, fieldW);
    }
    centerText(this.title, TOP - 20, fieldW);
    centerText(this.hint, FIELD_H - 36, fieldW);
  }

  private layoutRows(r: RogueState): void {
    const shop = this.mode === 'shop';
    const offer = shop ? (r.shop?.offer ?? []) : r.offer;
    const rows: Row[] = [];
    const maxChars = charsThatFit(Math.min(MAX_W, this.viewW - 8) - 4);
    const wrapped = offer.some((id) => boonDef(id).desc.length > maxChars);
    const cardH = wrapped ? CARD_H_WRAPPED : CARD_H;
    let y = TOP;
    offer.forEach((_, index) => {
      rows.push({ pick: { type: 'boon', index }, y, h: cardH });
      y += cardH;
    });
    y += 4;
    if (shop) {
      rows.push({ pick: { type: 'repair' }, y, h: ROW_H });
      y += ROW_H;
    }
    if (shop || r.rerolls > 0) {
      rows.push({ pick: { type: 'reroll' }, y, h: ROW_H });
      y += ROW_H;
    }
    rows.push({ pick: { type: 'skip' }, y, h: ROW_H });
    this.rows = rows;
  }

  private icon(i: number): Sprite {
    let s = this.icons[i];
    if (!s) {
      s = new Sprite();
      s.scale.set(ICON_SCALE);
      this.icons.push(s);
      this.addChild(s);
    }
    s.visible = true;
    return s;
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
