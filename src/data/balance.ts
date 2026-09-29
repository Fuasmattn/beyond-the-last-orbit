/** Logical playfield width limits; the actual width follows the viewport aspect. */
export const FIELD_W_MIN = 140;
export const FIELD_W_MAX = 600;
export const FIELD_W_DEFAULT = 240;
/** Menus are laid out in a fixed MENU_W × FIELD_H frame that the app centers and scales to fit. */
export const MENU_W = 240;
/** Touch devices use a narrower menu frame so text scales up on phones. */
export const MENU_W_TOUCH = 160;
export const FIELD_H = 320;
/**
 * Touch devices: the visible width fills the screen; the field is `overscan` times wider and the camera pans.
 * Views wider than the widest field (landscape) show backdrop past the field walls, up to `maxW`.
 */
export const TOUCH_VIEW = { minW: 132, maxW: 1000, overscan: 1.3 } as const;
/** Top edge of the player movement zone (bottom 25 % of the field). */
export const PLAYER_ZONE_TOP = 240;
/** Rhythm strip along the bottom edge; the player stays above it. */
export const BEAT_TRACK = { h: 20 } as const;
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
  /** Rogue runs: enemy bullets and lasers only hit this core at the hull's center (shown as a dot). */
  hurtW: 5,
  hurtH: 4,
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
  edgeMargin: 8,
  /** Sway approach rate per second toward the current beat side. */
  swayEase: 10,
  /** Fly-in: per-row and per-column launch delays, and flight time. */
  entryRowDelay: 0.3,
  entryColDelay: 0.05,
  entryTime: 1.1,
  /** Bars between advances while > 50 % / > 20 % / fewer of the formation survive. */
  advanceBars: [4, 2, 1],
  /** Beats a shape morph takes. */
  morphBeats: 1,
  /** Row dive (d ≥ rowDiveFrom): every `rowDiveBars` bars all formation divers dive, `rowDiveStagger` s apart. */
  rowDiveFrom: 4,
  rowDiveBars: 4,
  rowDiveStagger: 0.12,
  /** Breakaway (d ≥ breakawayFrom): the last `breakawayShare` (min 2) of the grid charges the player. */
  breakawayFrom: 2,
  breakawayShare: 0.15,
  breakawaySpeed: 70,
} as const;

export const POINTS = {
  freighter: 150,
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

/** M22 threat: enemies scale with the build's power (sum of boon rarity weights). */
export const THREAT = {
  /** Difficulty scalar per point of power. */
  perPower: 0.6,
  /** Power per extra enemy HP. */
  hpPer: 8,
  /** Boss HP scale per point of power. */
  bossHpPerPower: 0.03,
  /** Power per THREAT level shown on the HUD. */
  perLevel: 3,
  rarityPower: { common: 1, rare: 2, epic: 3, curse: 1 },
} as const;

/** M21 fight archetypes. Route weights for battle / elite nodes off the beat row. */
export const FIGHT = {
  weights: { swarm: 35, convoy: 30, miniboss: 20, formation: 15 },
} as const;

/** SWARM: groups fly Bézier paths through the field. */
export const SWARM = {
  groupMin: 4,
  groupMax: 6,
  groupEvery: 2.4,
  eliteGroupEvery: 1.8,
  /** Launch gap between members of a group (s). */
  stagger: 0.15,
  /** Seconds for one pass along a path. */
  passTime: 3.2,
  /** Path progress at which a member fires its aimed shot. */
  fireAt: 0.4,
  /** Full-chain bonus per member. */
  chainPoints: 40,
  /** Budget as a share of the formation's enemy count. */
  budgetShare: 0.8,
} as const;

/** CONVOY: freighters cross the field with escorts. */
export const CONVOY = {
  w: 22,
  h: 10,
  hp: 6,
  speed: 34,
  every: 3.2,
  eliteEvery: 2.4,
  baseCount: 5,
  lanesY: [56, 88, 120],
  /** Seconds after entry at which each escort peels off. */
  escortAt: [1, 3],
  escortSpeed: 75,
  bombEvery: 2.6,
  /** Stage bonus lost per freighter that escapes. */
  escapePenalty: 600,
  scrap: 5,
} as const;

/** SENTINEL miniboss: a gun platform with two turrets, one phase. */
export const SENTINEL = {
  w: 40,
  h: 16,
  y: 40,
  hp: 45,
  hpPerWorld: 0.5,
  eliteHpMul: 1.4,
  coreX: 14,
  coreW: 12,
  turretW: 10,
  turretH: 8,
  turretHp: 8,
  turretOffsets: [
    [0, 14],
    [30, 14],
  ],
  enterTime: 1.6,
  swayAmp: 45,
  swaySpeed: 0.7,
  spreadAngle: 0.28,
  ringCount: 8,
  points: 1500,
  scrap: 12,
} as const;

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
  k: 12,
  loopWeight: 15,
  swayAmp: [8, 22],
  advanceStep: [6, 12],
  fireRate: [1.1, 2.6],
  bulletSpeed: [110, 170],
  diveInterval: [4, 1.8],
  /** Formation rows: fewer while the difficulty scalar is below `fullRowsFrom`. */
  earlyRows: 4,
  fullRowsFrom: 3,
} as const;

export const STAGE = {
  perWorld: 5,
  introTime: 1.0,
  bossIntroTime: 2.2,
  clearTime: 2.2,
  parTime: 35,
  bossParTime: 60,
  timeBonusPerSec: 50,
  perfectBeatPct: 0.7,
  /** Rogue runs: accuracy weight of the stage bonus and accuracy needed for PERFECT. */
  rogueAccuracyBonus: 2000,
  roguePerfectAccuracy: 0.7,
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
  /** Phase 3 rings fire every this many beats, and pause while the laser burns. */
  ringEveryBeats: 2,
  laserWarn: 1.1,
  laserFire: 1.2,
  laserSweep: 40,
  laserW: 6,
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
  ringCount: 10,
  ringSpin: 0.26,
  swarmEvery: 6,
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
  /** Phase 3: a curtain every `curtainEvery` beats; every other one opens wide. */
  curtainEvery: 4,
  curtainStep: 16,
  curtainSpeed: 70,
  /** Half-widths of the curtain gap. */
  gapNarrow: 26,
  gapWide: 40,
  /** Gap center drift per beat (rad of a sine sweep); keeps the next gap within reach. */
  gapDrift: 0.12,
} as const;

export const RHYTHM = {
  /**
   * ± seconds around a grid line that count as on-beat (GOOD). Generous on purpose: timing competes
   * with aiming and dodging, so this sits at the forgiving end of rhythm-game windows.
   */
  windowSec: 0.1,
  /** ± seconds for a PERFECT grade (display only; scoring treats PERFECT and GOOD alike). */
  perfectSec: 0.045,
  /** The window never exceeds this fraction of a grid step, so fast endless-loop tempos stay a timing test. */
  maxWindowBeats: 0.25,
  /** Grid lines per beat (1 = quarter notes). */
  subdivision: 1,
  shotsPerStep: 4,
  multStep: 0.5,
  maxMult: 4,
} as const;

/** Rogue beat stages: on-beat is the only multiplier source, with bigger stakes. */
export const BEAT_STAGE = {
  maxMult: 8,
  /** Multiplier levels lost per off-beat shot. */
  offBeatDrop: 2,
  /** PERFECT shots become power shots with this much extra damage and pierce, and a wider bolt. */
  powerDamage: 1,
  powerPierce: 1,
  powerW: 4,
  /** Beat rank thresholds on the on-beat share, best first. */
  ranks: [
    ['S', 0.9],
    ['A', 0.75],
    ['B', 0.5],
  ],
  /** Fewer shots than this rank C (no rank farming by barely shooting). */
  minShots: 10,
  /** Stage bonus multiplier for an S rank. */
  sBonusMul: 2,
} as const;

/** Rogue elite stages. */
export const ELITE = {
  difficultyBoost: 3,
  fireRateMul: 1.3,
  scoreMul: 1.5,
  /** Gunners fire aimed bursts of this many bullets, `burstSpread` rad apart. */
  burstCount: 3,
  burstSpread: 0.22,
  /** Every `ringEvery` beats (one bar) a formation enemy fires the world's volley; it flashes one beat before. */
  ringEvery: 4,
  ringCount: 8,
  ringSpeed: 55,
  /** Earth: a falling wall of bullets with one gap, every `wallEveryBars` bars. */
  wallEveryBars: 2,
  wallSpacing: 12,
  wallGap: 40,
  wallSpeed: 45,
  /** The gap center lands within this many px of the player, so it is always reachable. */
  wallGapDrift: 60,
  /** Mars: aimed fan, alternating with rings. */
  fanCount: 5,
  fanSpread: 0.24,
} as const;

/** Rogue route map: node weights for the non-battle slots (elite gains per world). */
export const ROUTE = {
  lanes: 3,
  weights: { elite: 30, cache: 25, repair: 30, shop: 25, signal: 30 },
  eliteWeightPerWorld: 10,
  /** Seconds before route/draft overlays accept input, so fire-mashing can't pick by accident. */
  inputDelay: 0.6,
  draftSize: 3,
} as const;

/** Scrap: in-run currency for SHOP nodes and SIGNAL events. */
export const SCRAP = { kill: 1, eliteKill: 2, boss: 30 } as const;

/** SHOP node prices in scrap. */
export const SHOP = {
  prices: { common: 25, rare: 40, epic: 70, curse: 15 },
  repair: 30,
  reroll: 10,
  rerollStep: 10,
} as const;

/** SIGNAL events. */
export const SIGNAL = {
  distressScrap: 40,
  derelictScrap: 60,
  derelictAmbushChance: 0.5,
  scanScrap: 20,
  shieldPrice: 30,
  staticScrap: 25,
} as const;

/** Stage clear: every enemy bullet left on screen scores this × the multiplier. */
export const CANCEL = { points: 5 } as const;

/** Enemy bullets passing this close to the ship without hitting score a graze. */
export const GRAZE = { margin: 8, points: 10 } as const;

/** Draft boons (M14): rarity odds and the numbers behind the behaviour boons. */
export const BOON = {
  /** Draft-slot rarity weights at world 1; epic grows per world. */
  rarityWeights: { common: 60, rare: 30, epic: 8 },
  epicWeightPerWorld: 4,
  /** Chance that one slot of a draft holds a curse. */
  curseChance: 0.2,
  /** MAGNET: extra graze margin per level (px). */
  magnetMargin: 6,
  /** GRAZE CHARGE: grazes per power shot. */
  chargeGrazes: 10,
  /** SHRAPNEL fragments: speed, lifetime and the angle from straight up. */
  shrapnelSpeed: 150,
  shrapnelTtl: 0.35,
  shrapnelAngle: 0.7,
  /** OVERDRIVE: bolts get +1 damage from this multiplier up. */
  overdriveMult: 4,
  /** GLASS CANNON damage; BERSERK cooldown factor; HOT ZONE core scale and graze points. */
  glassDamage: 2,
  berserkCooldown: 0.6,
  hotZoneScale: 1.6,
  hotZoneGrazeMul: 3,
  /** SECOND WIND: invulnerability after the revive (s). */
  reviveInvuln: 2.5,
  /** M19: LONG BARREL speed factor, WIDE BOLTS extra width, HARDPOINT shield ceiling. */
  longBarrel: 1.3,
  wideBolts: 2,
  hardpointMax: 2,
  /** SNIPER: ship speed (px/s) under which it counts as still. */
  sniperStill: 10,
  /** ARC: zap range (px) and damage. */
  arcRange: 60,
  arcDamage: 1,
  /** SHIELD BURST: bolts in the ring and their speed. */
  burstCount: 8,
  burstSpeed: 200,
  /** GRAZE MEND: grazes per shield. */
  mendGrazes: 25,
  /** JACKPOT: extra multiplier levels above the stage cap. */
  jackpotLevels: 2,
  /** LOANSHARK: scrap now and the income factor after. BLIND SPOT damage. */
  loanScrap: 80,
  loanMul: 0.5,
  blindDamage: 2,
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
