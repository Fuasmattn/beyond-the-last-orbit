import { describe, expect, it } from 'vitest';
import { ELITE, PLAYER, STAGE } from '../../src/data/balance';
import { BOONS } from '../../src/sim/boons';
import { BEAT_ROW, createRogueState, generateMap, MAP_ROWS, reachableLanes } from '../../src/sim/route';
import { defaultRunOptions } from '../../src/sim/ship';
import { advanceStage, chooseBoon, chooseNode, finishStage, rerollDraft, startStage } from '../../src/sim/stageFlow';
import { createInitialState } from '../../src/sim/state';
import { step } from '../../src/sim/step';
import { NO_INPUT, type NodeKind, type SimEvent, type SimState } from '../../src/sim/types';

function rogue(seed = 7, rerolls = 0): SimState {
  return createInitialState(seed, undefined, { ...defaultRunOptions(), rerolls });
}

/** Clears the current stage and runs through the stage-clear screen. */
function clearStage(s: SimState, events: SimEvent[] = []): SimEvent[] {
  finishStage(s, events);
  advanceStage(s, events);
  return events;
}

function laneOf(s: SimState, kind: NodeKind): number | undefined {
  const r = s.rogue!;
  const row = r.map.rows[r.path.length]!;
  return reachableLanes(r).find((l) => row.find((n) => n.lane === l)!.kind === kind);
}

describe('generateMap', () => {
  const maps = Array.from({ length: 300 }, (_, i) => generateMap({ seed: i * 7919 }, i % 3));

  it('has MAP_ROWS rows of 2–3 nodes in distinct lanes', () => {
    for (const m of maps) {
      expect(m.rows).toHaveLength(MAP_ROWS);
      for (const row of m.rows) {
        expect(row.length).toBeGreaterThanOrEqual(2);
        expect(new Set(row.map((n) => n.lane)).size).toBe(row.length);
      }
    }
  });

  it('links only adjacent lanes; every node has an exit and an entry', () => {
    for (const m of maps) {
      m.rows.forEach((row, i) => {
        const next = m.rows[i + 1];
        for (const n of row) {
          if (next) {
            expect(n.next.length).toBeGreaterThan(0);
            for (const l of n.next) {
              expect(Math.abs(l - n.lane)).toBeLessThanOrEqual(1);
              expect(next.some((x) => x.lane === l)).toBe(true);
            }
          } else {
            expect(n.next).toEqual([]);
          }
        }
        if (i > 0) for (const n of row) expect(m.rows[i - 1]!.some((p) => p.next.includes(n.lane))).toBe(true);
      });
    }
  });

  it('has no crossing links', () => {
    for (const m of maps) {
      for (const row of m.rows) {
        for (const a of row) {
          const b = row.find((n) => n.lane === a.lane + 1);
          if (b) expect(a.next.includes(a.lane + 1) && b.next.includes(a.lane)).toBe(false);
        }
      }
    }
  });

  it('has one battle and distinct kinds per row, no repair in the first row', () => {
    for (const m of maps) {
      m.rows.forEach((row, i) => {
        if (i === BEAT_ROW) return;
        const kinds = row.map((n) => n.kind);
        expect(kinds.filter((k) => k === 'battle')).toHaveLength(1);
        expect(new Set(kinds).size).toBe(kinds.length);
        if (i === 0) expect(kinds).not.toContain('repair');
        expect(row.every((n) => !n.beat)).toBe(true);
      });
    }
  });

  it('makes the beat row all fights, at least one battle', () => {
    for (const m of maps) {
      const row = m.rows[BEAT_ROW]!;
      expect(row.every((n) => n.beat && (n.kind === 'battle' || n.kind === 'elite'))).toBe(true);
      expect(row.some((n) => n.kind === 'battle')).toBe(true);
    }
  });

  it('is deterministic per seed', () => {
    expect(generateMap({ seed: 42 }, 1)).toEqual(generateMap({ seed: 42 }, 1));
    expect(createRogueState(5, 0, 0)).toEqual(createRogueState(5, 0, 0));
  });
});

describe('rogue route flow', () => {
  it('opens the route after stage 1 and starts the chosen battle', () => {
    const s = rogue();
    const events = clearStage(s);
    expect(s.phase).toBe('route');
    expect(events.some((e) => e.type === 'routeOpen')).toBe(true);
    const lane = laneOf(s, 'battle')!;
    expect(chooseNode(s, lane, events)).toBe(true);
    expect(s.stage).toBe(2);
    expect(s.phase).toBe('stageIntro');
    expect(s.diff.elite).toBe(false);
    expect(s.rogue!.path).toEqual([lane]);
  });

  it('rejects unreachable lanes and picks outside the route phase', () => {
    const s = rogue();
    expect(chooseNode(s, 0, [])).toBe(false);
    clearStage(s);
    expect(chooseNode(s, 7, [])).toBe(false);
  });

  it('elite stages are harder and owe a draft after clearing', () => {
    // Find a seed whose first row offers an elite.
    let s = rogue(1);
    for (let seed = 1; laneOf((clearStage(s), s), 'elite') === undefined; seed++) s = rogue(seed + 1);
    chooseNode(s, laneOf(s, 'elite')!, []);
    expect(s.diff.elite).toBe(true);
    expect(s.enemies[0]!.hp).toBeGreaterThan(1);
    const events = clearStage(s);
    expect(s.phase).toBe('draft');
    expect(events.some((e) => e.type === 'draftOpen')).toBe(true);
    expect(s.rogue!.offer).toHaveLength(3);
    expect(new Set(s.rogue!.offer).size).toBe(3);
    const taken = s.rogue!.offer[0]!;
    chooseBoon(s, 0, events);
    expect(s.rogue!.boons[taken]).toBe(1);
    expect(s.phase).toBe('route');
  });

  it('cache drafts without a fight; repair adds a ship or a shield', () => {
    const s = rogue(3);
    clearStage(s);
    s.rogue!.map.rows[0]!.forEach((n) => (n.kind = 'cache'));
    chooseNode(s, reachableLanes(s.rogue!)[0]!, []);
    expect(s.phase).toBe('draft');
    expect(s.stage).toBe(2);
    chooseBoon(s, null, []);
    expect(s.phase).toBe('route');
    s.rogue!.map.rows[1]!.forEach((n) => (n.kind = 'repair'));
    s.player.lives = PLAYER.maxLives;
    const events: SimEvent[] = [];
    chooseNode(s, reachableLanes(s.rogue!)[0]!, events);
    expect(s.player.shield).toBe(1);
    expect(events.some((e) => e.type === 'repaired')).toBe(true);
    expect(s.phase).toBe('route');
    expect(s.stage).toBe(3);
  });

  it('goes to the boss after the last map row, drafts after it, then warps with a new map', () => {
    const s = rogue(9);
    clearStage(s);
    for (let row = 0; row < MAP_ROWS; row++) {
      s.rogue!.map.rows[row]!.forEach((n) => (n.kind = 'battle'));
      chooseNode(s, reachableLanes(s.rogue!)[0]!, []);
      if (row < MAP_ROWS - 1) clearStage(s);
    }
    clearStage(s);
    expect(s.stage).toBe(STAGE.perWorld);
    expect(s.boss).not.toBeNull();
    const oldMap = s.rogue!.map;
    s.boss = null;
    clearStage(s);
    expect(s.phase).toBe('draft');
    chooseBoon(s, 0, []);
    expect(s.phase).toBe('warp');
    expect(s.world).toBe(1);
    expect(s.rogue!.path).toEqual([]);
    expect(s.rogue!.map).not.toBe(oldMap);
  });

  it('rerolls spend a charge and replace the offer', () => {
    const s = rogue(4, 1);
    clearStage(s);
    s.rogue!.map.rows[0]!.forEach((n) => (n.kind = 'cache'));
    chooseNode(s, reachableLanes(s.rogue!)[0]!, []);
    expect(rerollDraft(s)).toBe(true);
    expect(s.rogue!.rerolls).toBe(0);
    expect(s.rogue!.offer).toHaveLength(3);
    expect(rerollDraft(s)).toBe(false);
  });

  it('waits in the route phase while stepping', () => {
    const s = rogue();
    clearStage(s);
    for (let i = 0; i < 120; i++) step(s, NO_INPUT);
    expect(s.phase).toBe('route');
    expect(s.phaseTimer).toBeGreaterThan(1.9);
  });
});

describe('boons', () => {
  it('never offers maxed boons', () => {
    const s = rogue();
    const r = s.rogue!;
    for (const b of BOONS) if (b.max !== Infinity) r.boons[b.id] = b.max;
    s.player.lives = 1;
    clearStage(s);
    r.map.rows[0]!.forEach((n) => (n.kind = 'cache'));
    chooseNode(s, reachableLanes(r)[0]!, []);
    expect(r.offer).toEqual(['nanorepair']);
  });

  it('each boon changes the ship', () => {
    for (const b of BOONS) {
      const s = rogue();
      s.player.lives = 1;
      const before = JSON.stringify({ ship: s.ship, lives: s.player.lives, shield: s.player.shield });
      b.apply(s);
      expect(JSON.stringify({ ship: s.ship, lives: s.player.lives, shield: s.player.shield })).not.toBe(before);
    }
  });
});

describe('elite volleys', () => {
  it('fire rings on bar lines during elite stages', () => {
    const s = rogue();
    s.rogue!.node = 'elite';
    s.stage = 2;
    startStage(s, []);
    for (const e of s.enemies) e.entry = null;
    s.phase = 'playing';
    s.enemyFireTimer = 999;
    s.player.invuln = 999;
    let bullets = 0;
    for (let beat = 0; beat < 12; beat++) {
      step(s, { ...NO_INPUT, beat: beat + 0.01 });
      bullets = Math.max(bullets, s.bullets.filter((b) => b.owner === 'enemy').length);
    }
    expect(bullets).toBeGreaterThanOrEqual(10);
  });
});

describe('per-world elite volleys', () => {
  function eliteAt(world: number): SimState {
    const s = rogue();
    s.world = world;
    s.rogue!.node = 'elite';
    s.stage = 2;
    startStage(s, []);
    for (const e of s.enemies) e.entry = null;
    s.phase = 'playing';
    s.enemyFireTimer = 999;
    s.player.invuln = 999;
    return s;
  }

  it('telegraphs the shooter one beat before the bar line', () => {
    const s = eliteAt(1);
    step(s, { ...NO_INPUT, beat: 0.01 });
    step(s, { ...NO_INPUT, beat: 3.01 });
    expect(s.enemies.filter((e) => e.charging)).toHaveLength(1);
    step(s, { ...NO_INPUT, beat: 4.01 });
    expect(s.enemies.some((e) => e.charging)).toBe(false);
    expect(s.bullets.filter((b) => b.owner === 'enemy').length).toBeGreaterThanOrEqual(ELITE.ringCount);
  });

  it('Earth fires a wall with a gap', () => {
    const s = eliteAt(0);
    step(s, { ...NO_INPUT, beat: 0.01 });
    step(s, { ...NO_INPUT, beat: 4.01 });
    expect(s.bullets.filter((b) => b.owner === 'enemy')).toHaveLength(0);
    step(s, { ...NO_INPUT, beat: 8.01 });
    const xs = s.bullets.filter((b) => b.owner === 'enemy' && b.vx === 0).map((b) => b.x).sort((a, b) => a - b);
    expect(xs.length).toBeGreaterThan(s.fieldW / 20);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]!);
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(ELITE.wallGap);
  });
});

describe('starter draft', () => {
  it('opens a draft before stage 1 and picking resumes the stage intro', () => {
    const s = createInitialState(7, undefined, { ...defaultRunOptions(), starterDraft: true });
    expect(s.phase).toBe('draft');
    expect(s.rogue.offer).toHaveLength(3);
    expect(s.enemies.length).toBeGreaterThan(0);
    const events: SimEvent[] = [];
    expect(chooseBoon(s, 0, events)).toBe(true);
    expect(s.phase).toBe('stageIntro');
    expect(s.stage).toBe(1);
    expect(Object.values(s.rogue.boons).reduce((a, b) => a + b, 0)).toBe(1);
    expect(s.rogue.starter).toBe(false);
  });

  it('is off by default', () => {
    expect(createInitialState(7).phase).toBe('stageIntro');
  });
});
