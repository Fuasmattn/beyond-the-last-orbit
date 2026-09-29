import { viewport } from '../app/viewport';
import { textWidth } from '../data/font';
import type { HighscoreEntry } from '../persist/schema';

/** Typical row (" 1. ABC    1234 1-3") the table is centered on; loop rows run a few chars longer. */
const TYPICAL_LINE_CHARS = 21;

/** " 1. ABC    1234 1-3" — fixed-width row for the pixel font. */
export function formatHighscoreLine(rank: number, e: HighscoreEntry): string {
  const where = `${e.loop > 0 ? `L${e.loop + 1} ` : ''}${e.world + 1}-${e.stage}`;
  return `${String(rank).padStart(2, ' ')}. ${e.initials.padEnd(3, ' ')} ${String(e.score).padStart(7, ' ')} ${where}`;
}

/** Left edge of the table rows, centered in the menu frame (57 on the desktop frame). */
export function highscoreTableX(): number {
  return Math.floor((viewport.menuW - textWidth(' '.repeat(TYPICAL_LINE_CHARS))) / 2);
}
