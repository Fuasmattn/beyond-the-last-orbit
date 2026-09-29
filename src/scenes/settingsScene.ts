import { Container } from 'pixi.js';
import { adjustSetting, type SettingKey } from '../meta/settings';
import { MenuList } from '../view/menuList';
import { centerText, PixelText } from '../view/pixelText';
import type { FrameInput, Scene, SceneContext } from './scene';
import { menuListLayout, narrowMenu, sceneBackground } from './ui';

type Row = SettingKey | 'calibrate' | 'musicTest' | 'back';

/** Music test tracks: each world's song in its main, boss and final-phase arrangements. */
const TRACKS = [0, 1, 2].flatMap((world) =>
  (['main', 'boss', 'bossFinal'] as const).map((arrangement) => ({
    world,
    arrangement,
    label: `${['EARTH', 'MOON', 'MARS'][world]}${arrangement === 'main' ? '' : arrangement === 'boss' ? ' BOSS' : ' FINAL'}`,
  })),
);

/** CC-BY 4.0 attribution for the recorded drums (full credits in audio/CREDITS.md); two lines on the narrow frame. */
const DRUM_CREDIT = ['DRUMS: DRUMGIZMO', 'MULDJORDKIT, CC BY 4.0'] as const;

const ALL_ROWS: readonly { key: Row; label: string; touchOnly?: true }[] = [
  { key: 'musicVolume', label: 'MUSIC VOLUME' },
  { key: 'sfxVolume', label: 'SFX VOLUME' },
  { key: 'guitarTone', label: 'GUITAR TONE' },
  { key: 'musicTest', label: 'MUSIC TEST' },
  { key: 'crt', label: 'CRT FILTER' },
  { key: 'bloom', label: 'BLOOM' },
  { key: 'shake', label: 'SCREEN SHAKE' },
  { key: 'beatLock', label: 'BEAT LOCK' },
  { key: 'tilt', label: 'TILT STEERING', touchOnly: true },
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
  private readonly rows: readonly { key: Row; label: string }[];
  private t = 0;
  private track = 0;
  private playing = false;

  constructor(private readonly ctx: SceneContext) {
    this.rows = ALL_ROWS.filter((r) => ctx.isTouch || !r.touchOnly);
    const g = ctx.textures.glyphs;
    const title = new PixelText(g, 'SETTINGS', 0xffe14a);
    title.scale.set(2);
    centerText(title, 40);
    const hint = new PixelText(
      g,
      ctx.isTouch ? 'TAP LEFT/RIGHT TO ADJUST' : 'LEFT/RIGHT ADJUST  FIRE SELECT',
      0x777777,
    );
    centerText(hint, 290);
    const credit = (narrowMenu() ? DRUM_CREDIT : [DRUM_CREDIT.join(' - ')]).map((line, i, lines) => {
      const t = new PixelText(g, line, 0x555a77);
      centerText(t, lines.length > 1 ? 300 + i * 9 : 304);
      return t;
    });
    this.list = new MenuList(g, menuListLayout({ x: 36, y: 90, lineH: 16, width: 168 }));
    this.root.addChild(sceneBackground(), title, this.list, hint, ...credit);
  }

  update(input: FrameInput, dt: number): void {
    this.t += dt;
    for (const a of input.menu) {
      const row = this.rows[this.list.selected]!.key;
      if (a === 'up' || a === 'down') {
        this.list.move(a === 'up' ? -1 : 1);
        this.ctx.audio?.sfx.menuMove();
      } else if (a === 'left' || a === 'right') {
        if (row === 'musicTest') this.cycleTrack(a === 'left' ? -1 : 1);
        else if (row !== 'calibrate' && row !== 'back') this.change(row, a === 'left' ? -1 : 1);
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
      const row = this.rows[i]!.key;
      if (row === 'musicTest') {
        const mid = this.list.layout.x + this.list.layout.width / 2;
        this.cycleTrack(tap.x < mid ? -1 : 1);
      } else if (isStepped(row)) {
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
      this.rows.map(({ key, label }) => {
        switch (key) {
          case 'musicVolume':
          case 'sfxVolume':
            return { label, value: `< ${Math.round(s[key] * 10)} >` };
          case 'crt':
          case 'bloom':
          case 'shake':
          case 'beatLock':
            return { label, value: onOff(s[key]) };
          case 'tilt':
            return { label, value: this.tiltValue() };
          case 'musicTest':
            return { label, value: `${this.playing ? '> ' : ''}< ${TRACKS[this.track]!.label} >` };
          case 'guitarTone':
            return { label, value: s.guitarTone === 'amp' ? 'AMP' : 'RETRO' };
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

  private tiltValue(): string {
    switch (this.ctx.tilt.status) {
      case 'unsupported':
        return 'NO SENSOR';
      case 'denied':
        return 'DENIED';
      case 'off':
        return 'OFF';
      default:
        return 'ON';
    }
  }

  private change(key: SettingKey, delta: number): void {
    const save = this.ctx.save;
    save.settings = adjustSetting(save.settings, key, delta);
    this.ctx.applySettings();
    this.ctx.persist();
    this.ctx.audio?.sfx.menuMove();
    // The tone applies from the next song start; restart the music test so the switch is audible.
    if (key === 'guitarTone' && this.playing) this.toggleMusic(true);
  }

  /** Plays the selected track (restarting it) or stops it. */
  private toggleMusic(play = !this.playing): void {
    const audio = this.ctx.audio;
    if (!audio) return;
    this.playing = play;
    if (!play) {
      audio.stopSong();
      return;
    }
    const tr = TRACKS[this.track]!;
    audio.startSong(this.ctx.songForWorld(tr.world, 0));
    if (tr.arrangement !== 'main') audio.queueArrangement(tr.arrangement);
  }

  private cycleTrack(delta: number): void {
    this.track = (this.track + delta + TRACKS.length) % TRACKS.length;
    this.ctx.audio?.sfx.menuMove();
    this.toggleMusic(true);
  }

  /** Returns true when the scene was left. */
  private activate(row: Row): boolean {
    if (row === 'musicTest') {
      this.toggleMusic();
      return false;
    }
    if (row === 'back') {
      this.exit();
      return true;
    }
    if (row === 'calibrate') {
      this.toggleMusic(false);
      this.ctx.audio?.sfx.menuSelect();
      this.ctx.goto(this.ctx.scenes.calibration());
      return true;
    }
    this.change(row, 1);
    return false;
  }

  private exit(): void {
    this.toggleMusic(false);
    this.ctx.audio?.sfx.menuSelect();
    this.ctx.goto(this.ctx.scenes.title());
  }
}
