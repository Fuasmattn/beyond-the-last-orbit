import type { CosmeticDef } from '../data/cosmetics';
import type { SaveData } from '../persist/schema';

export type ItemState = 'locked' | 'owned' | 'equipped';
export type ShopResult = 'bought' | 'equipped' | 'alreadyEquipped' | 'insufficient';

export function itemState(save: SaveData, item: CosmeticDef): ItemState {
  if (save.equipped[item.kind] === item.id) return 'equipped';
  return save.owned.includes(item.id) ? 'owned' : 'locked';
}

/** Buy (and equip) a locked item, or equip an owned one. Mutates `save`. */
export function activateCosmetic(save: SaveData, item: CosmeticDef): ShopResult {
  const state = itemState(save, item);
  if (state === 'equipped') return 'alreadyEquipped';
  if (state === 'locked') {
    if (save.credits < item.price) return 'insufficient';
    save.credits -= item.price;
    save.owned.push(item.id);
    save.equipped[item.kind] = item.id;
    return 'bought';
  }
  save.equipped[item.kind] = item.id;
  return 'equipped';
}
