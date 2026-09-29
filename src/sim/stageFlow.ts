import { BEAT_STAGE, CONVOY, PLAYER, SCRAP, SHOP, STAGE, WARP } from '../data/balance';
import { WORLDS } from '../data/worlds';
import { spawnBoss } from './boss';
import { boonDef, rollOffer, takeBoon } from './boons';
import { difficultyFor, eliteDifficulty } from './difficulty';
import { spawnFight } from './fight';
import { clamp } from './math';
import { generateMap, nodeAt, reachableLanes } from './route';
import { cancelBullets, clampStreak } from './scoring';
import { canChoose, resolveEvent, rollEvent } from './signal';
import type { BeatMode, BeatRank, BoonId, DraftTier, SimEvent, SimState, StageResult, StageStats } from './types';

export function emptyStageStats(): StageStats {
  return { shots: 0, hits: 0, onBeatShots: 0, hitsTaken: 0, grazes: 0, time: 0, escaped: 0 };
}

export function isBossStage(stage: number): boolean {
  return stage === STAGE.perWorld;
}

export function startStage(state: SimState, events: SimEvent[]): void {
  const boss = isBossStage(state.stage);
  state.fieldW = state.nextFieldW;
  state.player.x = clamp(state.player.x, 0, state.fieldW - state.player.w);
  const elite = !boss && state.rogue.node === 'elite';
  state.diff = (elite ? eliteDifficulty : difficultyFor)(state.world, state.stage, state.loop);
  // Beat stages start the x8 climb from zero; leaving one clamps back to the x4 cap.
  const master = state.beatLock || (!boss && state.rogue.beat);
  if (master && state.beatMode !== 'master') state.rhythm.streak = 0;
  state.beatMode = master ? 'master' : 'off';
  clampStreak(state);
  state.bullets = [];
  state.enemies = [];
  state.boss = null;
  state.stageStats = emptyStageStats();
  state.result = null;
  const refill = state.stage === 1 ? Math.max(state.ship.shieldMax, state.ship.worldShield) : state.ship.shieldMax;
  state.player.shield = Math.max(state.player.shield, refill);
  if (boss) spawnBoss(state);
  else spawnFight(state);
  state.enemyFireTimer = 1.5;
  state.diveTimer = state.diff.diveInterval;
  state.phase = 'stageIntro';
  state.phaseTimer = boss ? STAGE.bossIntroTime : STAGE.introTime;
  events.push({ type: 'stageIntro', world: state.world, stage: state.stage, loop: state.loop, boss });
}

/** Beat rank from the on-beat share; C when too few shots were fired to judge. */
export function beatRankFor(stats: StageStats): BeatRank {
  if (stats.shots < BEAT_STAGE.minShots) return 'C';
  const pct = stats.onBeatShots / stats.shots;
  for (const [rank, min] of BEAT_STAGE.ranks) if (pct >= min) return rank;
  return 'C';
}

export function computeStageResult(stats: StageStats, boss: boolean, beatMode: BeatMode = 'off'): StageResult {
  const accuracy = stats.shots > 0 ? Math.min(1, stats.hits / stats.shots) : 0;
  const beatPct = stats.shots > 0 ? stats.onBeatShots / stats.shots : 0;
  const noHit = stats.hitsTaken === 0;
  const par = boss ? STAGE.bossParTime : STAGE.parTime;
  const timeBonus = Math.max(0, par - stats.time) * STAGE.timeBonusPerSec;
  // Unjudged stages weigh accuracy only; beat stages weigh accuracy and the beat.
  const rogue = beatMode === 'off';
  const skill = rogue ? accuracy * STAGE.rogueAccuracyBonus : accuracy * 1000 + beatPct * 1000;
  const beatRank = beatMode === 'master' ? beatRankFor(stats) : null;
  const rankMul = beatRank === 'S' ? BEAT_STAGE.sBonusMul : 1;
  // Convoy stages: every freighter that got away costs part of the bonus.
  const escapePenalty = stats.escaped * CONVOY.escapePenalty;
  const bonus = Math.max(0, Math.round((skill + (noHit ? 2000 : 0) + timeBonus) * rankMul - escapePenalty));
  return {
    accuracy,
    beatPct,
    noHit,
    time: stats.time,
    bonus,
    perfect: noHit && stats.escaped === 0 && (rogue ? accuracy >= STAGE.roguePerfectAccuracy : beatPct >= STAGE.perfectBeatPct),
    beatRank,
    escaped: stats.escaped,
  };
}

const RANK_ORDER: readonly BeatRank[] = ['C', 'B', 'A', 'S'];

export function finishStage(state: SimState, events: SimEvent[]): void {
  cancelBullets(state, events);
  const result = computeStageResult(state.stageStats, isBossStage(state.stage), state.beatMode);
  state.result = result;
  state.score += result.bonus;
  if (result.beatRank) {
    const best = state.run.bestBeatRank;
    if (!best || RANK_ORDER.indexOf(result.beatRank) > RANK_ORDER.indexOf(best)) state.run.bestBeatRank = result.beatRank;
  }
  if (result.perfect) state.run.perfectStages++;
  state.run.stagesCleared++;
  const beatDraft = result.beatRank === 'S' || result.beatRank === 'A';
  const r = state.rogue;
  // Every stage clear owes a draft: commons after a plain battle, the full table after an elite, boss, miniboss or beat rank.
  const big = state.diff.elite || isBossStage(state.stage) || beatDraft || r.fight === 'miniboss';
  if (!r.ambush) r.drafts.push(big ? 'full' : 'basic');
  r.ambush = false;
  if (isBossStage(state.stage)) r.scrap += SCRAP.boss;
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

/** After the stage-clear screen: draft / route / boss / next world. */
export function advanceStage(state: SimState, events: SimEvent[]): void {
  const tier = state.rogue.drafts.shift();
  if (tier) openDraft(state, events, tier);
  else continueRoute(state, events);
}

/** Starts a fight at the current node (elite unless the node says battle). */
function startFight(state: SimState, events: SimEvent[], kind: 'battle' | 'elite'): void {
  const r = state.rogue;
  r.node = kind;
  if (r.beatNext) {
    r.beat = true;
    r.beatNext = false;
  }
  startStage(state, events);
}

function nextWorld(state: SimState, events: SimEvent[]): void {
  events.push({ type: 'worldClear', world: state.world });
  state.stage = 1;
  state.world++;
  if (state.world >= WORLDS.length) {
    state.world = 0;
    state.loop++;
  }
  const r = state.rogue;
  r.map = generateMap(r.rng, state.world);
  r.path = [];
  r.node = 'battle';
  r.beat = false;
  r.fight = 'formation';
  startWarp(state, events);
}

/** The current node is resolved; move on to the map, the boss or the next world. */
function continueRoute(state: SimState, events: SimEvent[]): void {
  if (state.stage >= STAGE.perWorld) {
    nextWorld(state, events);
  } else if (state.stage === STAGE.perWorld - 1) {
    state.stage++;
    state.rogue.node = 'battle';
    state.rogue.beat = false;
    state.rogue.fight = 'formation';
    startStage(state, events);
  } else {
    state.phase = 'route';
    state.phaseTimer = 0;
    state.bullets = [];
    state.enemies = [];
    events.push({ type: 'routeOpen' });
  }
}

function openDraft(state: SimState, events: SimEvent[], tier: DraftTier): void {
  const r = state.rogue;
  r.draftTier = tier;
  r.offer = rollOffer(state, r, tier);
  if (r.offer.length === 0) {
    advanceStage(state, events);
    return;
  }
  state.phase = 'draft';
  state.phaseTimer = 0;
  state.bullets = [];
  state.enemies = [];
  events.push({ type: 'draftOpen' });
}

/** Route pick. Returns false if the lane is not reachable or no route is open. */
export function chooseNode(state: SimState, lane: number, events: SimEvent[]): boolean {
  const r = state.rogue;
  if (state.phase !== 'route' || !reachableLanes(r).includes(lane)) return false;
  const node = nodeAt(r, r.path.length, lane)!;
  r.path.push(lane);
  r.node = node.kind;
  r.beat = node.beat === true;
  r.fight = node.fight ?? 'formation';
  state.stage++;
  events.push({ type: 'nodeChosen', kind: node.kind });
  switch (node.kind) {
    case 'battle':
    case 'elite':
      startFight(state, events, node.kind);
      break;
    case 'cache':
      openDraft(state, events, 'full');
      break;
    case 'shop':
      openShop(state, events);
      break;
    case 'signal':
      openEvent(state, events);
      break;
    case 'repair': {
      const p = state.player;
      if (p.lives < PLAYER.maxLives) p.lives++;
      else p.shield++;
      events.push({ type: 'repaired', lives: p.lives, shield: p.shield });
      advanceStage(state, events);
      break;
    }
  }
  return true;
}

function openShop(state: SimState, events: SimEvent[]): void {
  const r = state.rogue;
  r.shop = { offer: rollOffer(state, r), rerollPrice: SHOP.reroll };
  state.phase = 'shop';
  state.phaseTimer = 0;
  state.bullets = [];
  state.enemies = [];
  events.push({ type: 'shopOpen' });
}

export function shopPrice(id: BoonId): number {
  return SHOP.prices[boonDef(id).rarity];
}

/** Buys the shop offer at `index`. False when no shop is open, the index is bad or scrap is short. */
export function buyShopBoon(state: SimState, index: number, events: SimEvent[]): boolean {
  const r = state.rogue;
  const id = r.shop?.offer[index];
  if (state.phase !== 'shop' || !r.shop || id === undefined || r.scrap < shopPrice(id)) return false;
  r.scrap -= shopPrice(id);
  r.shop.offer.splice(index, 1);
  takeBoon(state, r, id);
  events.push({ type: 'boonTaken', id });
  return true;
}

export function buyShopRepair(state: SimState, events: SimEvent[]): boolean {
  const r = state.rogue;
  const p = state.player;
  if (state.phase !== 'shop' || !r.shop || r.scrap < SHOP.repair || p.lives >= PLAYER.maxLives) return false;
  r.scrap -= SHOP.repair;
  p.lives++;
  events.push({ type: 'repaired', lives: p.lives, shield: p.shield });
  return true;
}

export function rerollShop(state: SimState): boolean {
  const r = state.rogue;
  if (state.phase !== 'shop' || !r.shop || r.scrap < r.shop.rerollPrice) return false;
  r.scrap -= r.shop.rerollPrice;
  r.shop.rerollPrice += SHOP.rerollStep;
  r.shop.offer = rollOffer(state, r);
  return true;
}

export function leaveShop(state: SimState, events: SimEvent[]): boolean {
  const r = state.rogue;
  if (state.phase !== 'shop' || !r.shop) return false;
  r.shop = null;
  advanceStage(state, events);
  return true;
}

function openEvent(state: SimState, events: SimEvent[]): void {
  const r = state.rogue;
  r.event = rollEvent(state);
  state.phase = 'event';
  state.phaseTimer = 0;
  state.bullets = [];
  state.enemies = [];
  events.push({ type: 'eventOpen', id: r.event });
}

/** Resolves the open event with choice `index`. False when no event is open or the choice is unaffordable. */
export function chooseEvent(state: SimState, index: number, events: SimEvent[]): boolean {
  const r = state.rogue;
  const id = r.event;
  if (state.phase !== 'event' || id === null || !canChoose(state, id, index)) return false;
  r.event = null;
  const outcome = resolveEvent(state, id, index, events);
  if (outcome === 'continue') {
    advanceStage(state, events);
    return true;
  }
  r.ambush = outcome === 'ambush';
  startFight(state, events, 'elite');
  return true;
}

/** Run opener: a draft before stage 1 (the formation is spawned and waits). */
export function openStarterDraft(state: SimState): void {
  const r = state.rogue;
  r.draftTier = 'starter';
  r.offer = rollOffer(state, r, 'starter');
  if (r.offer.length === 0) return;
  r.starter = true;
  state.phase = 'draft';
  state.phaseTimer = 0;
}

/** Draft pick; `index` null skips. Returns false if no draft is open or the index is invalid. */
export function chooseBoon(state: SimState, index: number | null, events: SimEvent[]): boolean {
  const r = state.rogue;
  if (state.phase !== 'draft') return false;
  const id = index === null ? null : r.offer[index];
  if (id === undefined) return false;
  if (id) takeBoon(state, r, id);
  r.offer = [];
  events.push({ type: 'boonTaken', id });
  if (r.starter) {
    // Back to the stage-1 intro the run was paused in.
    r.starter = false;
    state.phase = 'stageIntro';
    state.phaseTimer = STAGE.introTime;
    return true;
  }
  advanceStage(state, events);
  return true;
}

/** Spends a reroll on a fresh offer. */
export function rerollDraft(state: SimState): boolean {
  const r = state.rogue;
  if (state.phase !== 'draft' || r.rerolls <= 0) return false;
  r.rerolls--;
  r.offer = rollOffer(state, r, r.draftTier);
  return true;
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
