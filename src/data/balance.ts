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
  maxLives: 5,
  extraLifeEvery: 50_000,
  invulnTime: 1.5,
} as const;

export const ENEMY = {
  w: 11,
  h: 8,
  spacingX: 18,
  spacingY: 14,
  rows: 5,
  startY: 36,
  bulletW: 2,
  bulletH: 6,
  flashTime: 0.08,
} as const;

export const FORMATION = {
  dropStep: 6,
  edgeMargin: 4,
} as const;

export const POINTS = { grunt: 10, gunner: 20, diver: 30, shield: 40 } as const;
export const TURRET_POINTS = 250;

export const DIVE = {
  duration: 2.4,
  /** Lowest point of the swoop — inside the player zone. */
  bottomY: 270,
  swing: 30,
  /** Fraction of the dive at which the diver fires its aimed shot. */
  fireAt: 0.3,
} as const;

export const DIFFICULTY = {
  k: 18,
  loopWeight: 15,
  marchMin: [12, 40],
  marchMax: [80, 150],
  fireRate: [0.7, 2.6],
  bulletSpeed: [100, 170],
  diveInterval: [7, 2],
} as const;

export const STAGE = {
  perWorld: 5,
  introTime: 1.5,
  bossIntroTime: 2.2,
  clearTime: 3,
  parTime: 35,
  bossParTime: 60,
  timeBonusPerSec: 50,
  perfectBeatPct: 0.7,
} as const;

export const HITSTOP = {
  playerHit: 0.04,
  bossPhase: 0.04,
} as const;

export const BOSS_DYING_TIME = 1.6;
export const BOSS_POINTS = 5000;

export const WARDEN = {
  w: 56,
  h: 20,
  y: 34,
  hp: 90,
  coreX: 18,
  coreW: 20,
  turretW: 10,
  turretH: 8,
  turretHp: 10,
  turretOffsets: [
    [4, 18],
    [42, 18],
  ],
  enterTime: 2,
  swayAmp: 50,
  swaySpeed: 0.6,
  spreadAngle: 0.3,
  ringCount: 10,
  ringSpin: 0.35,
  laserWarn: 0.8,
  laserFire: 1.2,
  laserSweep: 60,
  laserW: 8,
} as const;

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
