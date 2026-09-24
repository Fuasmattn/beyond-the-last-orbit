import type { HighscoreEntry } from '../persist/schema';

/** " 1. ABC    1234 1-3" — fixed-width row for the pixel font. */
export function formatHighscoreLine(rank: number, e: HighscoreEntry): string {
  const where = `${e.loop > 0 ? `L${e.loop + 1} ` : ''}${e.world + 1}-${e.stage}`;
  return `${String(rank).padStart(2, ' ')}. ${e.initials.padEnd(3, ' ')} ${String(e.score).padStart(7, ' ')} ${where}`;
}
