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

export const POINTS = {
  grunt: 10,
  gunner: 20,
  diver: 30,
  shield: 40,
  splitter: 50,
  phaser: 50,
  bomber: 50,
  mini: 15,
} as const;
export const TURRET_POINTS = 250;

export const MINI = { w: 7, h: 6, vx: 35, vy: 45 } as const;

export const BOMB = { w: 4, h: 4, speed: 60, fuse: 1.1, ringCount: 8, ringSpeed: 70 } as const;

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

export const WARP = { time: 3, skipAfter: 0.5 } as const;

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

export const HIVE = {
  w: 60,
  h: 22,
  y: 30,
  hp: 110,
  coreX: 20,
  coreW: 20,
  enterTime: 2,
  swayAmp: 40,
  swaySpeed: 0.5,
  escortEvery: 8,
  escortCount: 3,
  escortVx: 25,
  escortVy: 35,
  phaseEvery: 4,
  ringCount: 12,
  ringSpin: 0.26,
  swarmEvery: 4,
  swarmSpeed: 90,
  burstSpread: 0.15,
} as const;

export const DREAD = {
  w: 96,
  h: 24,
  y: 28,
  hp: 140,
  coreX: 38,
  coreW: 20,
  enterTime: 2.4,
  swayAmp: 30,
  swaySpeed: 0.4,
  cannons: [
    [10, 23],
    [85, 23],
  ],
  plateW: 10,
  plateH: 6,
  plateHp: 10,
  plates: [
    [38, 18],
    [48, 18],
  ],
  spreadAngle: 0.25,
  curtainStep: 14,
  curtainSpeed: 70,
  gapNarrow: 20,
  gapWide: 34,
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

/** Off-beat shots detune the soundtrack; see src/audio/sourness.ts. */
export const SOUR = {
  offBeatHit: 0.3,
  onBeatRelief: 0.2,
  decayPerSec: 0.25,
  /** Max modulation depth of the warble delay line, in seconds. */
  warbleDepth: 0.0025,
  /** Max random per-note detune at full sourness. */
  maxDetuneCents: 35,
} as const;

export const CREDITS = { scoreDivisor: 100, perBoss: 50, perPerfect: 25 } as const;

export const CALIBRATION = {
  taps: 8,
  bpm: 120,
  /** Taps further than this from a click are ignored as mistakes. */
  maxAbsMs: 250,
  maxOffsetMs: 300,
} as const;

export const FX = {
  shake: { maxOffset: 6, decay: 1.6 },
  particles: { capacity: 480 },
  popup: { life: 0.7, rise: 14, max: 12 },
  degrade: { windowMs: 2000, maxAvgMs: 20, stallMs: 250 },
} as const;
