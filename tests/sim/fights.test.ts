import { describe, expect, it } from 'vitest';
import { CONVOY, FIELD_H, FORMATION, GAUNTLET, SENTINEL, SIM_DT, SWARM } from '../../src/data/balance';
import { generateScript } from '../../src/sim/gauntlet';
import { generateMap } from '../../src/sim/route';
import { spawnFight } from '../../src/sim/fight';
import { createInitialState } from '../../src/sim/state';
import { chooseNode, computeStageResult, finishStage, startStage } from '../../src/sim/stageFlow';
import { resolveCollisions } from '../../src/sim/collision';
import { step } from '../../src/sim/step';
import { NO_INPUT, type Bullet, type FightKind, type SimEvent, type SimState } from '../../src/sim/types';
import { clearStage, landFormation } from './helpers';

/** A stage of the given fight kind, in play, with the player invulnerable so enemy fire cannot end the test. */
function fight(kind: FightKind, seed = 3, stage = 2): SimState {
  const s = createInitialState(seed);
  s.rogue.fight = kind;
  s.stage = stage;
  startStage(s, []);
  s.phase = 'playing';
  s.player.invuln = 9999;
  return s;
}

function run(s: SimState, seconds: number): SimEvent[] {
  const all: SimEvent[] = [];
  for (let t = 0; t < seconds; t += SIM_DT) {
    s.player.invuln = 9999;
    all.push(...step(s, NO_INPUT));
    if (s.phase !== 'playing') break;
  }
  return all;
}

const bullet = (over: Partial<Bullet>): Bullet => ({
  id: 999, x: 0, y: 0, w: 2, h: 6, vx: 0, vy: 0, owner: 'player', onBeat: false, mult: 1, ...over,
});

describe('route fight kinds', () => {
  it('gives every battle and elite node off the beat row a fight kind, keeps the beat row formations', () => {
    const kinds = new Set<FightKind>();
    for (let seed = 1; seed <= 60; seed++) {
      const map = generateMap({ seed }, 1);
      map.rows.forEach((row, i) => {
        for (const n of row) {
          if (n.kind !== 'battle' && n.kind !== 'elite') {
            expect(n.fight).toBeUndefined();
          } else if (i === 1) {
            expect(n.fight).toBeUndefined();
          } else {
            expect(n.fight).toBeDefined();
            kinds.add(n.fight!);
          }
        }
      });
    }
    expect([...kinds].sort()).toEqual(['convoy', 'formation', 'gauntlet', 'miniboss', 'swarm']);
  });

  it('holds the miniboss back from the first row of world 1', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const n of generateMap({ seed }, 0).rows[0]!) expect(n.fight).not.toBe('miniboss');
    }
  });

  it('choosing a node sets the run fight; the boss stage resets it', () => {
    const s = createInitialState(7);
    clearStage(s);
    s.rogue.map.rows[0]!.forEach((n) => {
      n.kind = 'battle';
      n.fight = 'swarm';
    });
    chooseNode(s, s.rogue.map.rows[0]![0]!.lane, []);
    expect(s.rogue.fight).toBe('swarm');
    expect(s.enemies).toHaveLength(0);
    expect(s.fight.budget).toBeGreaterThan(0);
  });
});

describe('swarm', () => {
  it('launches groups along paths, fires as it passes, and ends once the budget is spent and the field is empty', () => {
    const s = fight('swarm');
    const budget = s.fight.budget;
    run(s, 1.2);
    expect(s.enemies.length).toBeGreaterThanOrEqual(SWARM.groupMin);
    expect(s.enemies.every((e) => e.path && e.group === 0)).toBe(true);
    const events = run(s, 1.5);
    expect(events.some((e) => e.type === 'enemyShot')).toBe(true);
    const total = budget;
    run(s, 60);
    expect(s.fight.budget).toBe(0);
    expect(s.fight.launched).toBeGreaterThanOrEqual(Math.ceil(total / SWARM.groupMax));
    expect(s.phase).toBe('stageClear');
  });

  it('pays a full-chain bonus when a whole group dies', () => {
    const s = fight('swarm');
    run(s, 1.2);
    const group = s.enemies.filter((e) => e.group === 0);
    expect(group.length).toBeGreaterThan(0);
    const events: SimEvent[] = [];
    const before = s.score;
    for (const e of group) {
      e.hp = 1;
      s.bullets = [bullet({ x: e.x + 2, y: e.y + 1 })];
      resolveCollisions(s, events);
    }
    const chain = events.find((e) => e.type === 'groupCleared');
    expect(chain).toBeDefined();
    expect(s.score - before).toBeGreaterThan(SWARM.chainPoints * group.length);
  });
});

describe('convoy', () => {
  it('sends freighters across, releases escorts and bombs, and counts escapes against the bonus', () => {
    const s = fight('convoy');
    const events = run(s, 3.5);
    const freighters = s.enemies.filter((e) => e.kind === 'freighter');
    expect(freighters.length).toBeGreaterThanOrEqual(1);
    expect(freighters[0]!.free!.vy).toBe(0);
    expect(s.enemies.some((e) => e.kind === 'diver' && e.free)).toBe(true);
    expect(events.some((e) => e.type === 'dive')).toBe(true);
    run(s, 90);
    expect(s.phase).toBe('stageClear');
    expect(s.stageStats.escaped).toBeGreaterThan(0);
    expect(s.result!.escaped).toBe(s.stageStats.escaped);
    expect(s.result!.perfect).toBe(false);
  });

  it('a killed freighter pays scrap and never escapes', () => {
    const s = fight('convoy');
    run(s, 2);
    const f = s.enemies.find((e) => e.kind === 'freighter')!;
    f.hp = 1;
    s.bullets = [bullet({ x: f.x + 4, y: f.y + 2 })];
    const scrap = s.rogue.scrap;
    step(s, NO_INPUT);
    expect(s.rogue.scrap).toBe(scrap + 1 + CONVOY.scrap);
    expect(s.enemies).not.toContain(f);
  });
});

describe('gauntlet', () => {
  it('rolls a deterministic script that spans the stage length and gets denser with difficulty', () => {
    const a = fight('gauntlet', 5);
    const b = fight('gauntlet', 5);
    expect(a.fight.script).toEqual(b.fight.script);
    const script = a.fight.script!;
    expect(script.length).toBeGreaterThan(5);
    expect(script[0]!.at).toBeLessThan(1);
    expect(script[script.length - 1]!.at).toBeLessThan(GAUNTLET.length);
    for (let i = 1; i < script.length; i++) expect(script[i]!.at).toBeGreaterThan(script[i - 1]!.at);
    for (const w of script) {
      expect(w.x).toBeGreaterThan(0);
      expect(w.x).toBeLessThan(a.fieldW);
    }
    const hard = createInitialState(5);
    hard.rogue.fight = 'gauntlet';
    hard.stage = 2;
    hard.loop = 2;
    startStage(hard, []);
    expect(hard.fight.script!.length).toBeGreaterThan(script.length);
    expect(hard.fight.script![0]!.speed).toBeGreaterThan(script[0]!.speed);
  });

  it('launches waves on the clock, fires gunner pass shots, counts escapes, and ends once the script is spent', () => {
    const s = fight('gauntlet');
    const budget = s.fight.budget;
    expect(budget).toBe(s.fight.script!.reduce((n, w) => n + w.count, 0));
    run(s, 1.5);
    expect(s.enemies.length).toBeGreaterThanOrEqual(GAUNTLET.members[0]);
    expect(s.enemies.every((e) => e.group === 0 && e.y < FIELD_H)).toBe(true);
    const events = run(s, GAUNTLET.length);
    expect(events.some((e) => e.type === 'enemyShot')).toBe(true);
    expect(events.some((e) => e.type === 'escaped')).toBe(true);
    run(s, 20);
    expect(s.fight.budget).toBe(0);
    expect(s.fight.cursor).toBe(s.fight.script!.length);
    expect(s.enemies).toHaveLength(0);
    expect(s.phase).toBe('stageClear');
    // Nothing was shot, so everything got through and the stage is not perfect.
    expect(s.stageStats.escaped).toBe(budget);
    expect(s.result!.escaped).toBe(budget);
    expect(s.result!.perfect).toBe(false);
  });

  it('charges the gauntlet escape penalty, not the convoy one', () => {
    const s = fight('gauntlet');
    s.stageStats = { shots: 10, hits: 10, onBeatShots: 0, hitsTaken: 0, grazes: 0, time: 10, escaped: 2 };
    const t = s.stageStats.time;
    finishStage(s, []);
    const clean = computeStageResult({ ...s.stageStats, escaped: 0 }, false);
    expect(s.result!.bonus).toBe(clean.bonus - 2 * GAUNTLET.escapePenalty);
    expect(t).toBe(10);
  });

  it('pays a chain bonus when a whole wave dies', () => {
    const s = fight('gauntlet');
    run(s, 1.5);
    const wave = s.enemies.filter((e) => e.group === 0);
    expect(wave.length).toBeGreaterThan(0);
    const events: SimEvent[] = [];
    const before = s.score;
    for (const e of wave) {
      e.hp = 1;
      s.bullets = [bullet({ x: e.x + 2, y: e.y + 1 })];
      resolveCollisions(s, events);
    }
    expect(events.some((e) => e.type === 'groupCleared')).toBe(true);
    expect(s.score - before).toBeGreaterThan(GAUNTLET.chainPoints * wave.length);
  });

  it('owes a basic draft like any plain battle', () => {
    const s = fight('gauntlet');
    run(s, 60);
    expect(s.phase).toBe('stageClear');
    expect(s.rogue.drafts).toEqual(['basic']);
  });
});

describe('sentinel miniboss', () => {
  it('spawns as a boss with two turrets, shoots on beats, and dies into a full draft and scrap', () => {
    const s = fight('miniboss');
    expect(s.boss?.kind).toBe('sentinel');
    expect(s.boss?.parts).toHaveLength(2);
    expect(s.boss?.maxHp).toBe(SENTINEL.hp * (1 + s.world * SENTINEL.hpPerWorld));
    // Enters over 1.6 s, then shoots on the sim's own beat clock.
    const events = run(s, 5);
    expect(events.some((e) => e.type === 'enemyShot')).toBe(true);
    const b = s.boss!;
    b.hp = 1;
    const core = { x: b.x + SENTINEL.coreX + 2, y: b.y + 2 };
    s.bullets = [bullet(core)];
    const scrap = s.rogue.scrap;
    const bosses = s.run.bossesKilled;
    const before = s.score;
    step(s, NO_INPUT);
    expect(s.phase).toBe('bossDying');
    expect(s.rogue.scrap).toBe(scrap + SENTINEL.scrap);
    expect(s.run.bossesKilled).toBe(bosses);
    expect(s.score - before).toBeGreaterThanOrEqual(SENTINEL.points);
    for (let t = 0; t < 3; t += SIM_DT) step(s, NO_INPUT);
    expect(s.phase).toBe('stageClear');
    expect(s.rogue.drafts).toEqual(['full']);
  });
});

describe('formation behaviours', () => {
  it('breakaway: the last few grid enemies charge the player as free movers', () => {
    const s = landFormation(createInitialState(1));
    s.phase = 'playing';
    s.diff = { ...s.diff, d: FORMATION.breakawayFrom };
    s.enemies = s.enemies.slice(0, 2);
    step(s, NO_INPUT);
    expect(s.enemies.every((e) => e.free !== null)).toBe(true);
    expect(s.enemies.every((e) => e.free!.vy > 0)).toBe(true);
  });

  it('row dive: on the fourth bar every formation diver dives together', () => {
    const s = landFormation(createInitialState(1));
    s.phase = 'playing';
    s.player.invuln = 9999;
    s.diff = { ...s.diff, d: FORMATION.rowDiveFrom, diveInterval: 999 };
    s.diveTimer = 999;
    const divers = s.enemies.filter((e) => e.kind === 'diver');
    expect(divers.length).toBeGreaterThan(1);
    for (let beat = 0; beat <= FORMATION.rowDiveBars * 4; beat++) step(s, { ...NO_INPUT, beat: beat + 0.01 });
    expect(s.enemies.filter((e) => e.kind === 'diver' && e.dive).length).toBe(divers.length);
  });
});
