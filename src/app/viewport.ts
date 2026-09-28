import { FIELD_W_DEFAULT, MENU_W } from '../data/balance';

/**
 * Current logical widths for the view layer; updated by the app on resize.
 * `w` is visible on screen (HUD, menus), `fieldW` is the sim field (wider on touch). Sim reads `SimState.fieldW`.
 * `menuW` is the width of the menu design frame (narrower on touch); menu scenes lay out in `menuW × FIELD_H`.
 */
export const viewport = { w: FIELD_W_DEFAULT as number, fieldW: FIELD_W_DEFAULT as number, menuW: MENU_W as number };
