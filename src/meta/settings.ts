import type { Settings } from '../persist/schema';

export type SettingKey =
  | 'musicVolume'
  | 'sfxVolume'
  | 'crt'
  | 'bloom'
  | 'shake'
  | 'visualOffsetMs'
  | 'guitarTone'
  | 'beatLock';
export const VOLUME_STEP = 0.1;
export const VISUAL_OFFSET_STEP_MS = 10;
export const VISUAL_OFFSET_MAX_MS = 100;

/** Volumes step by ±0.1 within 0..1; toggles flip regardless of direction. */
export function adjustSetting(s: Settings, key: SettingKey, delta: number): Settings {
  switch (key) {
    case 'musicVolume':
    case 'sfxVolume': {
      const v = Math.min(1, Math.max(0, s[key] + delta * VOLUME_STEP));
      return { ...s, [key]: Math.round(v * 10) / 10 };
    }
    case 'crt':
    case 'bloom':
    case 'shake':
    case 'beatLock':
      return { ...s, [key]: !s[key] };
    case 'guitarTone':
      return { ...s, guitarTone: s.guitarTone === 'amp' ? 'retro' : 'amp' };
    case 'visualOffsetMs': {
      const v = s.visualOffsetMs + delta * VISUAL_OFFSET_STEP_MS;
      return { ...s, visualOffsetMs: Math.min(VISUAL_OFFSET_MAX_MS, Math.max(-VISUAL_OFFSET_MAX_MS, v)) };
    }
  }
}
