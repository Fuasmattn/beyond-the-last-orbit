export const FIELD_W = 240;
export const FIELD_H = 320;
/** Top edge of the player movement zone (bottom 25 % of the field). */
export const PLAYER_ZONE_TOP = 240;
export const SIM_DT = 1 / 60;
export const MAX_STEPS_PER_FRAME = 5;

export const PLAYER = {
  w: 13,
  h: 8,
  maxSpeed: 140,
  /** Velocity approach rate per second; higher = snappier, lower = more inertia. */
  response: 18,
  bottomMargin: 6,
  fireCooldown: 0.12,
  maxBullets: 3,
  bulletSpeed: 320,
  bulletW: 2,
  bulletH: 6,
  startLives: 3,
  invulnTime: 1.5,
} as const;

export const ENEMY = {
  w: 11,
  h: 8,
  spacingX: 18,
  spacingY: 14,
  rows: 5,
  cols: 8,
  startY: 36,
  bulletSpeed: 110,
  bulletW: 2,
  bulletH: 6,
  firePerSec: 0.9,
  flashTime: 0.08,
} as const;

export const FORMATION = {
  minSpeed: 14,
  maxSpeed: 90,
  dropStep: 6,
  edgeMargin: 4,
} as const;

export const POINTS = { grunt: 10, gunner: 20 } as const;

export const STAGE_CLEAR_TIME = 2;

export const RHYTHM = {
  /** ± seconds around a grid line that count as on-beat. */
  windowSec: 0.07,
  /** Grid lines per beat (1 = quarter notes). */
  subdivision: 1,
  shotsPerStep: 4,
  multStep: 0.5,
  maxMult: 4,
} as const;

export const COMBO = {
  window: 1,
  step: 0.1,
  maxChain: 10,
} as const;
