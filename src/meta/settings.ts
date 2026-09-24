import type { Settings } from '../persist/schema';

export type SettingKey = 'musicVolume' | 'sfxVolume' | 'crt' | 'bloom' | 'shake';
export const VOLUME_STEP = 0.1;

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
      return { ...s, [key]: !s[key] };
  }
}
