import { EVENTS } from '../data/events';
import { SIGNAL } from '../data/balance';
import { nextRandom } from './rng';
import type { EventId, SimEvent, SimState } from './types';

/** Picks an event the run has not seen yet (the pool resets once every event was seen). */
export function rollEvent(state: SimState): EventId {
  const r = state.rogue;
  let fresh = EVENTS.filter((e) => !r.seenEvents.includes(e.id));
  if (fresh.length === 0) {
    r.seenEvents = [];
    fresh = [...EVENTS];
  }
  const id = fresh[Math.floor(nextRandom(r.rng) * fresh.length)]!.id;
  r.seenEvents.push(id);
  return id;
}

/** Whether the player can afford a choice (a ship to trade, scrap to pay). */
export function canChoose(state: SimState, id: EventId, index: number): boolean {
  if (id === 'market' && index === 0) return state.player.lives >= 2;
  if (id === 'market' && index === 1) return state.rogue.scrap >= SIGNAL.shieldPrice;
  return true;
}

export type EventOutcome = 'continue' | 'fight' | 'ambush';

/** Applies a choice; the caller moves the run on (`fight` starts an elite stage, `ambush` one without a draft). */
export function resolveEvent(state: SimState, id: EventId, index: number, events: SimEvent[]): EventOutcome {
  const r = state.rogue;
  const p = state.player;
  const say = (text: string) => events.push({ type: 'eventResolved', text });
  const scrap = (n: number) => {
    r.scrap += n;
    say(`+${n} SCRAP`);
  };
  switch (id) {
    case 'distress':
      if (index === 0) {
        r.drafts.push('full');
        say('ESCORT DUTY!');
        return 'fight';
      }
      scrap(SIGNAL.distressScrap);
      return 'continue';
    case 'derelict':
      if (index === 0) {
        if (nextRandom(r.rng) < SIGNAL.derelictAmbushChance) {
          say('AMBUSH!');
          return 'ambush';
        }
        scrap(SIGNAL.derelictScrap);
        return 'continue';
      }
      scrap(SIGNAL.scanScrap);
      return 'continue';
    case 'market':
      if (index === 0) {
        p.lives--;
        r.drafts.push('rare');
        say('-1 SHIP');
      } else {
        r.scrap -= SIGNAL.shieldPrice;
        p.shield++;
        say('+1 SHIELD');
      }
      return 'continue';
    case 'ghost':
      if (index === 0) {
        r.beatNext = true;
        say('NEXT FIGHT ON THE BEAT');
      } else scrap(SIGNAL.staticScrap);
      return 'continue';
  }
}

/** Lives can never exceed the cap through events. */
