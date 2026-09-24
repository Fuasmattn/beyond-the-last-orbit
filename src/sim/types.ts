export type EnemyKind = 'grunt' | 'gunner';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Enemy extends Box {
  id: number;
  kind: EnemyKind;
  row: number;
  col: number;
  hp: number;
  flash: number;
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

export type Phase = 'playing' | 'stageClear' | 'gameOver';

export interface SimState {
  time: number;
  rng: { seed: number };
  nextId: number;
  phase: Phase;
  phaseTimer: number;
  stage: number;
  score: number;
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  formation: Formation;
  enemyFireTimer: number;
  rhythm: { streak: number; mult: number };
  combo: { chain: number; timer: number };
  stats: { shots: number; hits: number; onBeatShots: number };
}

export type SimEvent =
  | { type: 'shot'; x: number; y: number; onBeat: boolean }
  | { type: 'enemyHit'; id: number; x: number; y: number }
  | { type: 'enemyKilled'; id: number; kind: EnemyKind; x: number; y: number; points: number }
  | { type: 'enemyShot'; x: number; y: number }
  | { type: 'playerHit'; x: number; y: number; livesLeft: number }
  | { type: 'formationInvaded' }
  | { type: 'stageClear'; stage: number }
  | { type: 'stageStart'; stage: number }
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
}

export const NO_INPUT: Readonly<InputFrame> = {
  moveX: 0,
  moveY: 0,
  dragX: 0,
  dragY: 0,
  firePressed: false,
  fireOnBeat: null,
};
