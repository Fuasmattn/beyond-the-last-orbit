import { Container } from 'pixi.js';
import { adjustSetting, type SettingKey } from '../meta/settings';
import { MenuList } from '../view/menuList';
import { centerText, PixelText } from '../view/pixelText';
import type { FrameInput, Scene, SceneContext } from './scene';
import { sceneBackground } from './ui';

type Row = SettingKey | 'calibrate' | 'back';

const ROWS: readonly { key: Row; label: string }[] = [
  { key: 'musicVolume', label: 'MUSIC VOLUME' },
  { key: 'sfxVolume', label: 'SFX VOLUME' },
  { key: 'crt', label: 'CRT FILTER' },
  { key: 'bloom', label: 'BLOOM' },
  { key: 'shake', label: 'SCREEN SHAKE' },
  { key: 'calibrate', label: 'CALIBRATE TIMING' },
  { key: 'visualOffsetMs', label: 'VISUAL OFFSET' },
  { key: 'back', label: 'BACK' },
];

/** Rows adjusted by tapping their left or right half. */
const isStepped = (k: Row): k is 'musicVolume' | 'sfxVolume' | 'visualOffsetMs' =>
  k === 'musicVolume' || k === 'sfxVolume' || k === 'visualOffsetMs';

export class SettingsScene implements Scene {
  readonly root = new Container();
  private readonly list: MenuList;
  private t = 0;

  constructor(private readonly ctx: SceneContext) {
    const g = ctx.textures.glyphs;
    const title = new PixelText(g, 'SETTINGS', 0xffe14a);
    title.scale.set(2);
    centerText(title, 40);
    const hint = new PixelText(
      g,
      ctx.isTouch ? 'TAP LEFT/RIGHT SIDE TO ADJUST' : 'LEFT/RIGHT ADJUST  FIRE SELECT',
      0x777777,
    );
    centerText(hint, 290);
    this.list = new MenuList(g, { x: 36, y: 90, lineH: 16, width: 168 });
    this.root.addChild(sceneBackground(), title, this.list, hint);
  }

  update(input: FrameInput, dt: number): void {
    this.t += dt;
    for (const a of input.menu) {
      const row = ROWS[this.list.selected]!.key;
      if (a === 'up' || a === 'down') {
        this.list.move(a === 'up' ? -1 : 1);
        this.ctx.audio?.sfx.menuMove();
      } else if (a === 'left' || a === 'right') {
        if (row !== 'calibrate' && row !== 'back') this.change(row, a === 'left' ? -1 : 1);
      } else if (a === 'confirm') {
        if (this.activate(row)) return;
      } else if (a === 'back') {
        return this.exit();
      }
    }
    for (const tap of input.taps) {
      const i = this.list.indexAt(tap);
      if (i === null) continue;
      this.list.selected = i;
      const row = ROWS[i]!.key;
      if (isStepped(row)) {
        const mid = this.list.layout.x + this.list.layout.width / 2;
        this.change(row, tap.x < mid ? -1 : 1);
      } else if (this.activate(row)) {
        return;
      }
    }
  }

  render(): void {
    const s = this.ctx.save.settings;
    const onOff = (v: boolean) => (v ? 'ON' : 'OFF');
    const offset = s.latencyOffsetMs;
    this.list.setRows(
      ROWS.map(({ key, label }) => {
        switch (key) {
          case 'musicVolume':
          case 'sfxVolume':
            return { label, value: `< ${Math.round(s[key] * 10)} >` };
          case 'crt':
          case 'bloom':
          case 'shake':
            return { label, value: onOff(s[key]) };
          case 'calibrate':
            return { label, value: `${offset >= 0 ? '+' : ''}${offset}MS` };
          case 'visualOffsetMs': {
            const v = s.visualOffsetMs;
            return { label, value: `< ${v > 0 ? '+' : ''}${v}MS >` };
          }
          case 'back':
            return { label };
        }
      }),
    );
    this.list.refresh(this.t);
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }

  private change(key: SettingKey, delta: number): void {
    const save = this.ctx.save;
    save.settings = adjustSetting(save.settings, key, delta);
    this.ctx.applySettings();
    this.ctx.persist();
    this.ctx.audio?.sfx.menuMove();
  }

  /** Returns true when the scene was left. */
  private activate(row: Row): boolean {
    if (row === 'back') {
      this.exit();
      return true;
    }
    if (row === 'calibrate') {
      this.ctx.audio?.sfx.menuSelect();
      this.ctx.goto(this.ctx.scenes.calibration());
      return true;
    }
    this.change(row, 1);
    return false;
  }

  private exit(): void {
    this.ctx.audio?.sfx.menuSelect();
    this.ctx.goto(this.ctx.scenes.title());
  }
}
