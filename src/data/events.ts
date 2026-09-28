import { SIGNAL } from './balance';
import type { EventId } from '../sim/types';

export interface EventDef {
  id: EventId;
  title: string;
  /** Two description lines (≤ 22 chars each). */
  lines: readonly [string, string];
  /** Two choices (≤ 24 chars each). */
  choices: readonly [string, string];
}

export const EVENTS: readonly EventDef[] = [
  {
    id: 'distress',
    title: 'DISTRESS CALL',
    lines: ['A FREIGHTER UNDER FIRE', 'ASKS FOR AN ESCORT'],
    choices: ['ESCORT: ELITE + 2 DRAFTS', `IGNORE: +${SIGNAL.distressScrap} SCRAP`],
  },
  {
    id: 'derelict',
    title: 'DERELICT HULK',
    lines: ['A DEAD SHIP DRIFTS BY', 'SOMETHING MOVES INSIDE'],
    choices: ['BOARD: SCRAP OR AMBUSH', `SCAN: +${SIGNAL.scanScrap} SCRAP`],
  },
  {
    id: 'market',
    title: 'BLACK MARKET',
    lines: ['A SMUGGLER OFFERS', 'RARE PARTS - AT A PRICE'],
    choices: ['A SHIP FOR A RARE DRAFT', `${SIGNAL.shieldPrice} SCRAP FOR A SHIELD`],
  },
  {
    id: 'ghost',
    title: 'GHOST SIGNAL',
    lines: ['A BEAT PULSES THROUGH', 'THE STATIC'],
    choices: ['TUNE IN: NEXT FIGHT X8', `STATIC: +${SIGNAL.staticScrap} SCRAP`],
  },
];

export function eventDef(id: EventId): EventDef {
  return EVENTS.find((e) => e.id === id)!;
}
