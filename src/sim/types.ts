import type { ShapeKind } from './shapes';

/** `rhythm`: linear run scored on the beat. `rogue`: route map, drafted upgrades, streak scoring. */
export type RunMode = 'rhythm' | 'rogue';

/** Rogue route map node types. */
export type NodeKind = 'battle' | 'elite' | 'cache' | 'repair';

export type BoonId =
  | 'twin'
  | 'spread'
  | 'pierce'
  | 'overclock'
  | 'heavy'
  | 'deflector'
  | 'bounty'
  | 'afterburner'
  | 'nanorepair';

export interface RouteNode {
  lane: number;
  kind: NodeKind;
  /** Lanes of the connected nodes in the next row. */
  next: number[];
}

/** One world's branching map: `rows[i]` holds the choices for stage i + 2. */
export interface RouteMap {
  rows: RouteNode[][];
}

export interface RogueState {
  /** Separate stream for map and draft rolls, so route choices don't reshuffle combat. */
  rng: { seed: number };
  map: RouteMap;
  /** Lane picked in each map row so far this world. */
  path: number[];
  /** Kind of the current or last-entered node (stage 1 counts as a battle). */
  node: NodeKind;
  /** Drafted upgrade stacks. */
  boons: Partial<Record<BoonId, number>>;
  /** Upgrades on offer while drafting. */
  offer: BoonId[];
  /** A draft is owed after the stage-clear screen (elite or boss beaten). */
  draftPending: boolean;
  rerolls: number;
}

export type EnemyKind = 'grunt' | 'gunner' | 'diver' | 'shield' | 'splitter' | 'phaser' | 'bomber' | 'mini';
export type BossKind = 'warden' | 'hive' | 'dreadnought';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Dive {
  t: number;
  duration: number;
  startX: number;
  startY: number;
  targetX: number;
  dir: 1 | -1;
  fired: boolean;
}

/** Fly-in from off-screen: quadratic curve from (x0, y0) via (cx, cy) to the live slot. */
export interface Entry {
  /** Seconds since launch; negative while waiting to launch. */
  t: number;
  duration: number;
  x0: number;
  y0: number;
  cx: number;
  cy: number;
}

export interface Enemy extends Box {
  id: number;
  kind: EnemyKind;
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  flash: number;
  /** Scripted swoop out of the formation and back. */
  dive: Dive | null;
  /** Flying in to its slot at stage start. */
  entry: Entry | null;
  /** Self-moving outside the formation (bounces off walls, leaves at the bottom). */
  free: { vx: number; vy: number } | null;
  /** Bullets pass through while phased. */
  phased: boolean;
}

export interface Bullet extends Box {
  id: number;
  vx: number;
  vy: number;
  owner: 'player' | 'enemy';
  onBeat: boolean;
  /** Rhythm multiplier captured at fire time. */
  mult: number;
  /** Bombs: seconds until the bullet bursts into a ring. */
  fuse?: number;
  /** Player bolts: damage per hit (default 1). */
  damage?: number;
  /** Player bolts: enemies it may still pass through. */
  pierce?: number;
  /** Player bolts: ids of enemies already pierced (so a bolt hits each enemy once). */
  pierced?: number[];
  /** Player side bolts (twin/spread): not capped and not counted for accuracy. */
  extra?: boolean;
  /** Enemy bullets: entered the graze margin (scores once it leaves without hitting). */
  nearMiss?: boolean;
  /** Enemy bullets: already scored a graze. */
  grazed?: boolean;
}

/** Per-run ship performance; base values from PLAYER, raised by permanent and drafted upgrades. */
export interface ShipStats {
  /** Primary bolts allowed on screen. */
  maxBullets: number;
  cooldown: number;
  speed: number;
  damage: number;
  pierce: number;
  twin: boolean;
  spread: boolean;
  /** Multiplies all kill points. */
  scoreMul: number;
  /** Shield charges restored at every stage start. */
  shieldMax: number;
  /** Shield charges restored at the start of every world. */
  worldShield: number;
}

export interface Player extends Box {
  vx: number;
  vy: number;
  cooldown: number;
  invuln: number;
  lives: number;
  /** Charges that each absorb one hit. */
  shield: number;
}

export interface Formation {
  /** Top edge; advances down over time. */
  y: number;
  /** Horizontal offset of the center, eased toward `swayDir × amplitude`. */
  sway: number;
  /** Flips on every beat. */
  swayDir: 1 | -1;
  shapes: readonly ShapeKind[];
  shapeIdx: number;
  /** 0..1 progress from the previous shape to the current one. */
  morph: number;
  /** Beats since the last advance. */
  beats: number;
  total: number;
  rows: number;
  cols: number;
}

export interface BossPart extends Box {
  id: number;
  offsetX: number;
  offsetY: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  flash: number;
}

export interface Laser {
  state: 'warn' | 'fire';
  t: number;
  x: number;
  dir: 1 | -1;
}

export interface Boss extends Box {
  kind: BossKind;
  hp: number;
  maxHp: number;
  phase: 1 | 2 | 3;
  t: number;
  entering: boolean;
  flash: number;
  /** Destroyable attachments: Warden turrets, Dreadnought armor plates. */
  parts: BossPart[];
  laser: Laser | null;
  beatCount: number;
  spiralAngle: number;
  /** Hive: intangible while phased. */
  phased: boolean;
  /** Seconds of death animation left; 0 while alive. */
  dying: number;
}

export interface Difficulty {
  d: number;
  swayAmp: number;
  advanceStep: number;
  fireRate: number;
  bulletSpeed: number;
  diveInterval: number;
  cols: number;
  hpBonus: number;
  bossHpScale: number;
  /** Rogue elite stage: denser fire, bullet patterns, bonus score. */
  elite: boolean;
}

export interface StageStats {
  shots: number;
  hits: number;
  onBeatShots: number;
  hitsTaken: number;
  grazes: number;
  time: number;
}

export interface StageResult {
  accuracy: number;
  beatPct: number;
  noHit: boolean;
  time: number;
  bonus: number;
  perfect: boolean;
}

/** `route` / `draft`: rogue runs wait for the player to pick a map node / an upgrade. */
export type Phase = 'stageIntro' | 'playing' | 'bossDying' | 'stageClear' | 'route' | 'draft' | 'warp' | 'gameOver';

export interface SimState {
  mode: RunMode;
  ship: ShipStats;
  time: number;
  /** Logical playfield width, fixed for the current stage. */
  fieldW: number;
  /** Width requested by the view; adopted at the next stage start. */
  nextFieldW: number;
  rng: { seed: number };
  nextId: number;
  phase: Phase;
  phaseTimer: number;
  world: number;
  stage: number;
  loop: number;
  score: number;
  nextExtraLife: number;
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  formation: Formation;
  boss: Boss | null;
  diff: Difficulty;
  enemyFireTimer: number;
  diveTimer: number;
  hitStop: number;
  /** `last`: last whole beat seen (null = resync); `count`: beats crossed so far. */
  beat: { last: number | null; count: number };
  rhythm: { streak: number; mult: number };
  combo: { chain: number; timer: number };
  stats: { shots: number; hits: number; onBeatShots: number };
  stageStats: StageStats;
  result: StageResult | null;
  run: { bossesKilled: number; perfectStages: number; stagesCleared: number };
  /** Rogue runs only. */
  rogue: RogueState | null;
}

export type SimEvent =
  | { type: 'shot'; x: number; y: number; onBeat: boolean }
  | { type: 'enemyHit'; id: number; x: number; y: number }
  | { type: 'enemyKilled'; id: number; kind: EnemyKind; x: number; y: number; points: number }
  | { type: 'enemyShot'; x: number; y: number }
  | { type: 'playerHit'; x: number; y: number; livesLeft: number }
  | { type: 'routeOpen' }
  | { type: 'nodeChosen'; kind: NodeKind }
  | { type: 'draftOpen' }
  | { type: 'boonTaken'; id: BoonId | null }
  | { type: 'repaired'; lives: number; shield: number }
  | { type: 'graze'; x: number; y: number; points: number }
  | { type: 'shieldHit'; x: number; y: number; shieldLeft: number }
  | { type: 'formationInvaded' }
  | { type: 'split'; id: number; x: number; y: number }
  | { type: 'bombBurst'; x: number; y: number }
  | { type: 'stageIntro'; world: number; stage: number; loop: number; boss: boolean }
  | { type: 'stageStart'; stage: number }
  | { type: 'stageClear'; stage: number; result: StageResult }
  | { type: 'worldClear'; world: number }
  | { type: 'warpStart'; world: number; loop: number }
  | { type: 'extraLife'; lives: number }
  | { type: 'dive'; id: number }
  | { type: 'bossPhase'; phase: 2 | 3 }
  | { type: 'bossPhased'; phased: boolean }
  | { type: 'bossHit'; x: number; y: number }
  | { type: 'partDestroyed'; x: number; y: number }
  | { type: 'bossKilled'; x: number; y: number; points: number }
  | { type: 'laserWarn'; x: number }
  | { type: 'laserFire'; x: number }
  | { type: 'gameOver'; score: number };

/** Input for one sim tick. Produced by input adapters, consumed by the sim. */
export interface InputFrame {
  /** Digital/analog movement axis, -1..1. */
  moveX: number;
  moveY: number;
  /** Direct displacement in logical px (touch relative drag). */
  dragX: number;
  dragY: number;
  /** Fire was pressed since the previous tick (edge, not held). */
  firePressed: boolean;
  /** Rhythm judgement for the press; null when no audio / no press. */
  fireOnBeat: boolean | null;
  /** Press landed within the PERFECT window (implies fireOnBeat). */
  firePerfect: boolean;
  /** Current beat position from the audio clock; null → sim-time fallback. */
  beat: number | null;
}

export const NO_INPUT: Readonly<InputFrame> = {
  moveX: 0,
  moveY: 0,
  dragX: 0,
  dragY: 0,
  firePressed: false,
  fireOnBeat: null,
  firePerfect: false,
  beat: null,
};
