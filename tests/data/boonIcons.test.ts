import { describe, expect, it } from 'vitest';
import { BOON_ICONS, ICON_SIZE } from '../../src/data/boonIcons';
import { BOONS } from '../../src/sim/boons';

describe('boon icons', () => {
  it('every boon has an 8x8 pictogram that is not blank', () => {
    for (const b of BOONS) {
      const rows = BOON_ICONS[b.id];
      expect(rows, b.id).toHaveLength(ICON_SIZE);
      for (const r of rows) expect(r, b.id).toHaveLength(ICON_SIZE);
      expect(rows.join('').includes('#'), b.id).toBe(true);
    }
  });

  it('no two boons share a pictogram', () => {
    const seen = new Map<string, string>();
    for (const [id, rows] of Object.entries(BOON_ICONS)) {
      const key = rows.join('/');
      expect(seen.get(key), `${id} duplicates ${seen.get(key)}`).toBeUndefined();
      seen.set(key, id);
    }
  });
});
