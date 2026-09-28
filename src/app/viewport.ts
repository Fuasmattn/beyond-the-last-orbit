import { FIELD_W_DEFAULT } from '../data/balance';

/**
 * Current logical widths for the view layer; updated by the app on resize.
 * `w` is visible on screen (HUD, menus), `fieldW` is the sim field (wider on touch). Sim reads `SimState.fieldW`.
 */
export const viewport = { w: FIELD_W_DEFAULT as number, fieldW: FIELD_W_DEFAULT as number };
