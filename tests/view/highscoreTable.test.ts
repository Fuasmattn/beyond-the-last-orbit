import { describe, expect, it } from 'vitest';
import { formatHighscoreLine } from '../../src/view/highscoreTable';

describe('formatHighscoreLine', () => {
  it('pads rank, initials and score to fixed columns', () => {
    expect(
      formatHighscoreLine(1, { initials: 'ABC', score: 1234, world: 0, stage: 3, loop: 0, date: '' }),
    ).toBe(' 1. ABC    1234 1-3');
  });

  it('shows the loop when past the first', () => {
    expect(
      formatHighscoreLine(10, { initials: 'Z', score: 9, world: 2, stage: 5, loop: 1, date: '' }),
    ).toBe('10. Z         9 L2 3-5');
  });
});
