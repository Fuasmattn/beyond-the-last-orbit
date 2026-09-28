import { Container, Graphics } from 'pixi.js';
import { viewport } from '../app/viewport';
import { UPGRADES, type UpgradeDef } from '../data/upgrades';
import type { Tap } from '../input/inputFrame';
import { buyUpgrade, nextCost, upgradeLevel, type UpgradeResult } from '../meta/upgrades';
import { MenuList } from '../view/menuList';
import { centerText, PixelText } from '../view/pixelText';
import type { FrameInput, Scene, SceneContext } from './scene';
import { inRect, menuListLayout, narrowMenu, sceneBackground, type Rect } from './ui';

const BACK: Rect = { x: 4, y: 300, w: 40, h: 14 };
const LIST = { x: 28, y: 60, lineH: 16, width: 184 } as const;
const PIP = { w: 5, h: 3, gap: 2 } as const;
const MESSAGE_TIME = 1.5;
/** Subtitle; two lines on the narrow frame. */
const SUB = ['PERMANENT UPGRADES', 'NOT FOR BEAT RUNS'] as const;

const MESSAGES: Record<UpgradeResult, [string, number]> = {
  bought: ['UPGRADED!', 0x7dff6b],
  maxed: ['FULLY UPGRADED', 0xbbbbbb],
  insufficient: ['NOT ENOUGH CREDITS', 0xff3b5c],
};

/** Permanent upgrades for rogue runs, bought with credits. */
export class HangarScene implements Scene {
  readonly root = new Container();
  private readonly list: MenuList;
  private readonly credits: PixelText;
  private readonly desc: PixelText;
  private readonly message: PixelText;
  private readonly pips = new Graphics();
  private messageTime = 0;
  private t = 0;

  constructor(private readonly ctx: SceneContext) {
    const g = ctx.textures.glyphs;
    const title = new PixelText(g, 'HANGAR', 0xffe14a);
    title.scale.set(2);
    title.position.set(6, 4);
    const sub = (narrowMenu() ? SUB : [SUB.join(' - ')]).map((line, i, lines) => {
      const t = new PixelText(g, line, 0x4af2ff);
      centerText(t, lines.length > 1 ? 26 + i * 8 : 30);
      return t;
    });
    this.credits = new PixelText(g, '', 0x7dff6b);
    this.list = new MenuList(g, menuListLayout(LIST));
    this.desc = new PixelText(g, '', 0xcccccc);
    this.message = new PixelText(g, '');
    const hint = new PixelText(g, ctx.isTouch ? 'TAP ITEM TWICE TO BUY' : 'FIRE BUY  ESC BACK', 0x777777);
    centerText(hint, 290);
    const back = new PixelText(g, 'BACK', 0xbbbbbb);
    back.position.set(BACK.x + 4, BACK.y + 4);
    const backBox = new Graphics().rect(BACK.x, BACK.y, BACK.w, BACK.h).stroke({ color: 0x555a77, width: 1 });
    this.root.addChild(sceneBackground(), title, ...sub, this.credits, this.list, this.pips, this.desc, this.message, hint, backBox, back);
  }

  update(input: FrameInput, dt: number): void {
    this.t += dt;
    this.messageTime = Math.max(0, this.messageTime - dt);
    for (const a of input.menu) {
      if (a === 'up' || a === 'down') {
        this.list.move(a === 'up' ? -1 : 1);
        this.ctx.audio?.sfx.menuMove();
      } else if (a === 'confirm') this.buy();
      else if (a === 'back') return this.exit();
    }
    for (const tap of input.taps) if (this.handleTap(tap)) return;
  }

  render(): void {
    const save = this.ctx.save;
    this.list.setRows(
      UPGRADES.map((u) => {
        const cost = nextCost(save, u);
        return { label: u.name, value: cost === null ? 'MAX' : `${cost} CR` };
      }),
    );
    this.list.refresh(this.t);
    // Level pips under each name.
    this.pips.clear();
    UPGRADES.forEach((u, i) => {
      const lv = upgradeLevel(save, u.id);
      const { x, y: top, lineH } = this.list.layout;
      const y = top + i * lineH + 8;
      u.costs.forEach((_, k) => {
        this.pips.rect(x + k * (PIP.w + PIP.gap), y, PIP.w, PIP.h).fill(k < lv ? 0x7dff6b : 0x333a55);
      });
    });
    const sel = this.selected();
    this.desc.setText(sel ? sel.desc : '');
    centerText(this.desc, LIST.y + UPGRADES.length * LIST.lineH + 10);
    this.credits.setText(`CREDITS ${save.credits}`);
    this.credits.position.set(viewport.menuW - 4 - this.credits.pixelWidth, 6);
    this.message.visible = this.messageTime > 0;
    centerText(this.message, 262);
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }

  private selected(): UpgradeDef | undefined {
    return UPGRADES[this.list.selected];
  }

  private handleTap(tap: Tap): boolean {
    if (inRect(tap, BACK)) {
      this.exit();
      return true;
    }
    const i = this.list.indexAt(tap);
    if (i === null) return false;
    if (i === this.list.selected) this.buy();
    else {
      this.list.selected = i;
      this.ctx.audio?.sfx.menuMove();
    }
    return false;
  }

  private buy(): void {
    const def = this.selected();
    if (!def) return;
    const result = buyUpgrade(this.ctx.save, def);
    const [text, color] = MESSAGES[result];
    this.message.setText(text);
    this.message.tint = color;
    this.messageTime = MESSAGE_TIME;
    if (result === 'bought') {
      this.ctx.audio?.sfx.buy();
      this.ctx.persist();
    } else {
      this.ctx.audio?.sfx.deny();
    }
  }

  private exit(): void {
    this.ctx.audio?.sfx.menuSelect();
    this.ctx.goto(this.ctx.scenes.title());
  }
}
