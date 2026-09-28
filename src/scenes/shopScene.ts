import { Container, Graphics } from 'pixi.js';
import { viewport } from '../app/viewport';
import {
  cosmeticsOf,
  equippedLaser,
  equippedSkin,
  type CosmeticDef,
  type CosmeticKind,
  type LaserDef,
  type SkinDef,
} from '../data/cosmetics';
import type { Tap } from '../input/inputFrame';
import { activateCosmetic, itemState, type ShopResult } from '../meta/shop';
import { hueToRgb } from '../view/color';
import { createLaserView, type LaserView } from '../view/laserView';
import { MenuList } from '../view/menuList';
import { SHIP_ART } from '../view/vectorArt';
import { centerText, PixelText } from '../view/pixelText';
import type { FrameInput, Scene, SceneContext } from './scene';
import { centerX, inRect, menuListLayout, narrowMenu, sceneBackground, type Rect } from './ui';

const TABS: readonly CosmeticKind[] = ['skin', 'laser'];
const TAB_LABEL: Record<CosmeticKind, string> = { skin: 'SHIP SKINS', laser: 'LASERS' };
const TAB = { y: 26, w: 70, h: 12 } as const;
/** Tab left edges: spread apart on the full frame, side by side on the narrow one. */
const TAB_X: Record<CosmeticKind, { full: number; narrow: number }> = {
  skin: { full: 30, narrow: 6 },
  laser: { full: 140, narrow: 84 },
};
const PREVIEW = { y: 44, w: 120, h: 84 } as const;
const BACK: Rect = { x: 4, y: 300, w: 40, h: 14 };
const MESSAGE_TIME = 1.5;
const FIRE_EVERY = 0.35;
const PREVIEW_BULLET_SPEED = 160;

const MESSAGES: Record<ShopResult, [string, number]> = {
  bought: ['PURCHASED!', 0x7dff6b],
  equipped: ['EQUIPPED', 0x4af2ff],
  alreadyEquipped: ['ALREADY EQUIPPED', 0xbbbbbb],
  insufficient: ['NOT ENOUGH CREDITS', 0xff3b5c],
};

interface PreviewBullet {
  view: LaserView;
  y: number;
}

export class ShopScene implements Scene {
  readonly root = new Container();
  private tab: CosmeticKind = 'skin';
  private readonly list: MenuList;
  private readonly credits: PixelText;
  private readonly message: PixelText;
  private readonly tabs: Record<CosmeticKind, PixelText>;
  private readonly tabRect: Record<CosmeticKind, Rect>;
  private readonly tabUnderline = new Graphics();
  private readonly ship: Graphics;
  private readonly previewLayer = new Container();
  private bullets: PreviewBullet[] = [];
  private previewLaserId = '';
  private messageTime = 0;
  private fireTimer = 0;
  private t = 0;

  constructor(private readonly ctx: SceneContext) {
    const g = ctx.textures.glyphs;
    const narrow = narrowMenu();
    const tabRect = (k: CosmeticKind): Rect => ({ ...TAB, x: narrow ? TAB_X[k].narrow : TAB_X[k].full });
    this.tabRect = { skin: tabRect('skin'), laser: tabRect('laser') };
    const preview: Rect = { ...PREVIEW, x: centerX(PREVIEW.w) };
    const title = new PixelText(g, 'SHOP', 0xffe14a);
    title.scale.set(2);
    title.position.set(6, 4);
    this.credits = new PixelText(g, '', 0x7dff6b);
    this.tabs = {
      skin: new PixelText(g, TAB_LABEL.skin),
      laser: new PixelText(g, TAB_LABEL.laser),
    };
    for (const k of TABS) {
      const r = this.tabRect[k];
      this.tabs[k].position.set(r.x + Math.round((r.w - this.tabs[k].pixelWidth) / 2), r.y + 3);
    }
    const frame = new Graphics()
      .rect(preview.x, preview.y, preview.w, preview.h)
      .fill(0x0b0f22)
      .rect(preview.x, preview.y, preview.w, preview.h)
      .stroke({ color: 0x333a55, width: 1 });
    this.ship = new Graphics(SHIP_ART.arrow);
    this.ship.position.set(preview.x + preview.w / 2, preview.y + preview.h - 6);
    this.list = new MenuList(g, menuListLayout({ x: 28, y: 140, lineH: 14, width: 184 }));
    this.message = new PixelText(g, '');
    const hint = new PixelText(
      g,
      ctx.isTouch ? 'TAP ITEM TWICE TO BUY/EQUIP' : 'FIRE BUY/EQUIP  LEFT/RIGHT TAB',
      0x777777,
    );
    centerText(hint, 290);
    const back = new PixelText(g, 'BACK', 0xbbbbbb);
    back.position.set(BACK.x + 4, BACK.y + 4);
    const backBox = new Graphics().rect(BACK.x, BACK.y, BACK.w, BACK.h).stroke({ color: 0x555a77, width: 1 });

    this.root.addChild(
      sceneBackground(),
      title,
      this.credits,
      this.tabs.skin,
      this.tabs.laser,
      this.tabUnderline,
      frame,
      this.previewLayer,
      this.ship,
      this.list,
      this.message,
      hint,
      backBox,
      back,
    );
  }

  update(input: FrameInput, dt: number): void {
    this.t += dt;
    this.messageTime = Math.max(0, this.messageTime - dt);
    for (const a of input.menu) {
      if (a === 'up' || a === 'down') this.moveSelection(a === 'up' ? -1 : 1);
      else if (a === 'left' || a === 'right') this.switchTab(this.tab === 'skin' ? 'laser' : 'skin');
      else if (a === 'confirm') this.activate();
      else if (a === 'back') return this.exit();
    }
    for (const tap of input.taps) {
      if (this.handleTap(tap)) return;
    }
    this.updatePreview(dt);
  }

  render(): void {
    const items = this.items();
    this.list.setRows(
      items.map((item) => {
        const state = itemState(this.ctx.save, item);
        return {
          label: item.name,
          value: state === 'equipped' ? 'EQUIPPED' : state === 'owned' ? 'OWNED' : `${item.price} CR`,
        };
      }),
    );
    this.list.refresh(this.t);
    this.credits.setText(`CREDITS ${this.ctx.save.credits}`);
    this.credits.position.set(viewport.menuW - 4 - this.credits.pixelWidth, 6);
    for (const k of TABS) this.tabs[k].tint = k === this.tab ? 0xffe14a : 0x666666;
    const r = this.tabRect[this.tab];
    this.tabUnderline.clear().rect(r.x, r.y + r.h, r.w, 1).fill(0xffe14a);

    const skin = this.previewSkin();
    this.ship.context = SHIP_ART[skin.hull];
    this.ship.tint = skin.hueCycle ? hueToRgb(this.t * 0.25) : (skin.palette['#'] ?? 0xffffff);
    const pulse = Math.max(0, 1 - ((this.t * 2) % 1) * 4);
    for (const b of this.bullets) b.view.update(this.ship.x - 1, Math.round(b.y), this.t, pulse, false);

    this.message.visible = this.messageTime > 0;
    centerText(this.message, 236);
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }

  private items(): readonly CosmeticDef[] {
    return cosmeticsOf(this.tab);
  }

  private selectedItem(): CosmeticDef | undefined {
    return this.items()[this.list.selected];
  }

  private previewSkin(): SkinDef {
    const sel = this.selectedItem();
    return sel?.kind === 'skin' ? sel : equippedSkin(this.ctx.save);
  }

  private previewLaser(): LaserDef {
    const sel = this.selectedItem();
    return sel?.kind === 'laser' ? sel : equippedLaser(this.ctx.save);
  }

  private moveSelection(delta: number): void {
    this.list.move(delta);
    this.ctx.audio?.sfx.menuMove();
  }

  private switchTab(tab: CosmeticKind): void {
    if (tab === this.tab) return;
    this.tab = tab;
    this.list.selected = 0;
    this.ctx.audio?.sfx.menuMove();
  }

  private handleTap(tap: Tap): boolean {
    if (inRect(tap, BACK)) {
      this.exit();
      return true;
    }
    for (const k of TABS) {
      if (inRect(tap, this.tabRect[k])) {
        this.switchTab(k);
        return false;
      }
    }
    const i = this.list.indexAt(tap);
    if (i === null) return false;
    if (i === this.list.selected) this.activate();
    else {
      this.list.selected = i;
      this.ctx.audio?.sfx.menuMove();
    }
    return false;
  }

  private activate(): void {
    const item = this.selectedItem();
    if (!item) return;
    const result = activateCosmetic(this.ctx.save, item);
    const [text, color] = MESSAGES[result];
    this.message.setText(text);
    this.message.tint = color;
    this.messageTime = MESSAGE_TIME;
    const sfx = this.ctx.audio?.sfx;
    if (result === 'bought') sfx?.buy();
    else if (result === 'insufficient') sfx?.deny();
    else sfx?.menuSelect();
    if (result === 'bought' || result === 'equipped') this.ctx.persist();
  }

  private updatePreview(dt: number): void {
    const laser = this.previewLaser();
    if (laser.id !== this.previewLaserId) {
      for (const b of this.bullets) b.view.destroy();
      this.bullets = [];
      this.previewLaserId = laser.id;
    }
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = FIRE_EVERY;
      const view = createLaserView(laser, this.ctx.textures.orb);
      this.previewLayer.addChild(view.root);
      this.bullets.push({ view, y: this.ship.y - 14 });
    }
    for (const b of this.bullets) b.y -= PREVIEW_BULLET_SPEED * dt;
    const gone = this.bullets.filter((b) => b.y < PREVIEW.y + 2);
    for (const b of gone) b.view.destroy();
    this.bullets = this.bullets.filter((b) => b.y >= PREVIEW.y + 2);
  }

  private exit(): void {
    this.ctx.audio?.sfx.menuSelect();
    this.ctx.goto(this.ctx.scenes.title());
  }
}
