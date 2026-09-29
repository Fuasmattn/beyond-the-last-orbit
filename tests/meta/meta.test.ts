import { describe, expect, it } from 'vitest';
import { CREDITS } from '../../src/data/balance';
import { LASERS, SKINS, equippedLaser, equippedSkin } from '../../src/data/cosmetics';
import { computeLatencyOffset } from '../../src/meta/calibration';
import { computeCredits } from '../../src/meta/credits';
import { adjustSetting } from '../../src/meta/settings';
import { activateCosmetic, itemState } from '../../src/meta/shop';
import { defaultSave } from '../../src/persist/schema';

describe('cosmetics', () => {
  it('have unique ids, six per tab, a free default and ascending prices', () => {
    for (const list of [SKINS, LASERS]) {
      expect(list).toHaveLength(6);
      expect(list[0]!.price).toBe(0);
      expect(new Set(list.map((c) => c.id)).size).toBe(6);
      const prices = list.map((c) => c.price);
      expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    }
  });

  it('gives every skin a vector hull', () => {
    for (const s of SKINS) expect(['arrow', 'swept'], s.id).toContain(s.hull);
  });

  it('defaults are owned and equipped in a fresh save', () => {
    const save = defaultSave();
    expect(equippedSkin(save).id).toBe(SKINS[0]!.id);
    expect(equippedLaser(save).id).toBe(LASERS[0]!.id);
    expect(save.owned).toContain(SKINS[0]!.id);
  });
});

describe('credits', () => {
  it('converts score, bosses and perfect stages', () => {
    expect(computeCredits(12_345, 2, 3)).toBe(123 + 2 * CREDITS.perBoss + 3 * CREDITS.perPerfect);
    expect(computeCredits(99, 0, 0)).toBe(0);
  });
});

describe('shop', () => {
  it('refuses purchases without enough credits', () => {
    const save = defaultSave();
    save.credits = 10;
    expect(activateCosmetic(save, SKINS[1]!)).toBe('insufficient');
    expect(save.credits).toBe(10);
    expect(itemState(save, SKINS[1]!)).toBe('locked');
  });

  it('buys, equips, then re-equips owned items', () => {
    const save = defaultSave();
    save.credits = 1000;
    expect(activateCosmetic(save, SKINS[1]!)).toBe('bought');
    expect(save.credits).toBe(1000 - SKINS[1]!.price);
    expect(itemState(save, SKINS[1]!)).toBe('equipped');
    expect(itemState(save, SKINS[0]!)).toBe('owned');
    expect(activateCosmetic(save, SKINS[0]!)).toBe('equipped');
    expect(activateCosmetic(save, SKINS[0]!)).toBe('alreadyEquipped');
    expect(save.credits).toBe(1000 - SKINS[1]!.price);
  });

  it('keeps skin and laser slots independent', () => {
    const save = defaultSave();
    save.credits = 5000;
    activateCosmetic(save, LASERS[2]!);
    expect(save.equipped.laser).toBe(LASERS[2]!.id);
    expect(save.equipped.skin).toBe(SKINS[0]!.id);
  });
});

describe('settings', () => {
  it('steps volumes within 0..1 without float drift', () => {
    const s = defaultSave().settings;
    expect(adjustSetting(s, 'musicVolume', 1).musicVolume).toBe(0.9);
    expect(adjustSetting({ ...s, sfxVolume: 1 }, 'sfxVolume', 1).sfxVolume).toBe(1);
    expect(adjustSetting({ ...s, sfxVolume: 0 }, 'sfxVolume', -1).sfxVolume).toBe(0);
  });

  it('flips toggles in either direction', () => {
    const s = defaultSave().settings;
    expect(adjustSetting(s, 'crt', 1).crt).toBe(!s.crt);
    expect(adjustSetting(s, 'shake', -1).shake).toBe(!s.shake);
    expect(adjustSetting(s, 'tilt', 1).tilt).toBe(true);
  });
});

describe('computeLatencyOffset', () => {
  it('takes the median of consistent taps in ms', () => {
    expect(computeLatencyOffset([0.03, 0.04, 0.05, 0.04, 0.035, 0.045, 0.04, 0.05])).toBe(40);
  });

  it('ignores outliers', () => {
    expect(computeLatencyOffset([0.02, 0.02, 0.02, 0.02, 0.02, 0.9, -0.8, 0.02])).toBe(20);
  });

  it('gives up when too few taps are usable', () => {
    expect(computeLatencyOffset([0.02, 0.5, 0.6, -0.7, 0.9, 0.8, 0.02, 0.4])).toBeNull();
  });
});

describe('visual offset setting', () => {
  it('steps by 10 ms and clamps to ±100 ms', () => {
    let s = defaultSave().settings;
    s = adjustSetting(s, 'visualOffsetMs', 1);
    expect(s.visualOffsetMs).toBe(10);
    for (let i = 0; i < 30; i++) s = adjustSetting(s, 'visualOffsetMs', -1);
    expect(s.visualOffsetMs).toBe(-100);
  });
});
