export type EnemyKind = 'grunt' | 'gunner' | 'diver' | 'shield';
export type BossKind = 'warden';

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

export interface Enemy extends Box {
  id: number;
  kind: EnemyKind;
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  flash: number;
  dive: Dive | null;
}

export interface Bullet extends Box {
  id: number;
  vx: number;
  vy: number;
  owner: 'player' | 'enemy';
  onBeat: boolean;
  /** Rhythm multiplier captured at fire time. */
  mult: number;
}

export interface Player extends Box {
  vx: number;
  vy: number;
  cooldown: number;
  invuln: number;
  lives: number;
}

export interface Formation {
  x: number;
  y: number;
  dir: 1 | -1;
  total: number;
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
  turrets: BossPart[];
  laser: Laser | null;
  beatCount: number;
  spiralAngle: number;
  /** Seconds of death animation left; 0 while alive. */
  dying: number;
}

export interface Difficulty {
  d: number;
  marchMin: number;
  marchMax: number;
  fireRate: number;
  bulletSpeed: number;
  diveInterval: number;
  cols: number;
  hpBonus: number;
  bossHpScale: number;
}

export interface StageStats {
  shots: number;
  hits: number;
  onBeatShots: number;
  hitsTaken: number;
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

export type Phase = 'stageIntro' | 'playing' | 'bossDying' | 'stageClear' | 'gameOver';

export interface SimState {
  time: number;
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
  beat: { last: number | null };
  rhythm: { streak: number; mult: number };
  combo: { chain: number; timer: number };
  stats: { shots: number; hits: number; onBeatShots: number };
  stageStats: StageStats;
  result: StageResult | null;
  run: { bossesKilled: number; perfectStages: number; stagesCleared: number };
}

export type SimEvent =
  | { type: 'shot'; x: number; y: number; onBeat: boolean }
  | { type: 'enemyHit'; id: number; x: number; y: number }
  | { type: 'enemyKilled'; id: number; kind: EnemyKind; x: number; y: number; points: number }
  | { type: 'enemyShot'; x: number; y: number }
  | { type: 'playerHit'; x: number; y: number; livesLeft: number }
  | { type: 'formationInvaded' }
  | { type: 'stageIntro'; world: number; stage: number; loop: number; boss: boolean }
  | { type: 'stageStart'; stage: number }
  | { type: 'stageClear'; stage: number; result: StageResult }
  | { type: 'worldClear'; world: number }
  | { type: 'extraLife'; lives: number }
  | { type: 'dive'; id: number }
  | { type: 'bossPhase'; phase: 2 | 3 }
  | { type: 'bossHit'; x: number; y: number }
  | { type: 'turretDestroyed'; x: number; y: number }
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
  beat: null,
};
