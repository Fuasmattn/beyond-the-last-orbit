import { FIELD_W_DEFAULT } from '../data/balance';

/** Current logical playfield width for the view layer; updated by the app on resize. Sim reads `SimState.fieldW`. */
export const viewport = { w: FIELD_W_DEFAULT as number };
