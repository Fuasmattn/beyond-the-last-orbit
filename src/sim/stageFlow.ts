import { PLAYER, STAGE, WARP } from '../data/balance';
import { WORLDS } from '../data/worlds';
import { spawnBoss } from './boss';
import { difficultyFor } from './difficulty';
import { spawnFormation } from './formation';
import { clamp } from './math';
import type { SimEvent, SimState, StageResult, StageStats } from './types';

export function emptyStageStats(): StageStats {
  return { shots: 0, hits: 0, onBeatShots: 0, hitsTaken: 0, time: 0 };
}

export function isBossStage(stage: number): boolean {
  return stage === STAGE.perWorld;
}

export function startStage(state: SimState, events: SimEvent[]): void {
  const boss = isBossStage(state.stage);
  state.fieldW = state.nextFieldW;
  state.player.x = clamp(state.player.x, 0, state.fieldW - state.player.w);
  state.diff = difficultyFor(state.world, state.stage, state.loop);
  state.bullets = [];
  state.enemies = [];
  state.boss = null;
  state.stageStats = emptyStageStats();
  state.result = null;
  if (boss) spawnBoss(state);
  else spawnFormation(state);
  state.enemyFireTimer = 1.5;
  state.diveTimer = state.diff.diveInterval;
  state.phase = 'stageIntro';
  state.phaseTimer = boss ? STAGE.bossIntroTime : STAGE.introTime;
  events.push({ type: 'stageIntro', world: state.world, stage: state.stage, loop: state.loop, boss });
}

export function computeStageResult(stats: StageStats, boss: boolean): StageResult {
  const accuracy = stats.shots > 0 ? Math.min(1, stats.hits / stats.shots) : 0;
  const beatPct = stats.shots > 0 ? stats.onBeatShots / stats.shots : 0;
  const noHit = stats.hitsTaken === 0;
  const par = boss ? STAGE.bossParTime : STAGE.parTime;
  const timeBonus = Math.max(0, par - stats.time) * STAGE.timeBonusPerSec;
  const bonus = Math.round(accuracy * 1000 + beatPct * 1000 + (noHit ? 2000 : 0) + timeBonus);
  return {
    accuracy,
    beatPct,
    noHit,
    time: stats.time,
    bonus,
    perfect: noHit && beatPct >= STAGE.perfectBeatPct,
  };
}

export function finishStage(state: SimState, events: SimEvent[]): void {
  const result = computeStageResult(state.stageStats, isBossStage(state.stage));
  state.result = result;
  state.score += result.bonus;
  if (result.perfect) state.run.perfectStages++;
  state.run.stagesCleared++;
  state.bullets = [];
  state.phase = 'stageClear';
  state.phaseTimer = STAGE.clearTime;
  events.push({ type: 'stageClear', stage: state.stage, result });
}

/** Warp to the (already selected) next world; the new song's clock takes over the beat. */
export function startWarp(state: SimState, events: SimEvent[]): void {
  state.phase = 'warp';
  state.phaseTimer = WARP.time;
  state.bullets = [];
  state.enemies = [];
  state.boss = null;
  state.beat.last = null;
  events.push({ type: 'warpStart', world: state.world, loop: state.loop });
}

export function advanceStage(state: SimState, events: SimEvent[]): void {
  state.stage++;
  if (state.stage > STAGE.perWorld) {
    events.push({ type: 'worldClear', world: state.world });
    state.stage = 1;
    state.world++;
    if (state.world >= WORLDS.length) {
      state.world = 0;
      state.loop++;
    }
    startWarp(state, events);
    return;
  }
  startStage(state, events);
}

export function checkExtraLife(state: SimState, events: SimEvent[]): void {
  while (state.score >= state.nextExtraLife) {
    state.nextExtraLife += PLAYER.extraLifeEvery;
    if (state.player.lives < PLAYER.maxLives) {
      state.player.lives++;
      events.push({ type: 'extraLife', lives: state.player.lives });
    }
  }
}
