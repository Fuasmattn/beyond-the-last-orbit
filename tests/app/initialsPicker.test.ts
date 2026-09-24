import { describe, expect, it } from 'vitest';
import { InitialsPicker } from '../../src/app/initialsPicker';

describe('InitialsPicker', () => {
  it('starts at AAA on the first letter', () => {
    const p = new InitialsPicker();
    expect(p.text).toBe('AAA');
    expect(p.index).toBe(0);
    expect(p.done).toBe(false);
  });

  it('cycles letters with wrap-around', () => {
    const p = new InitialsPicker();
    p.up();
    expect(p.text).toBe('BAA');
    p.down();
    p.down();
    expect(p.text).toBe('9AA');
  });

  it('confirms letter by letter until done', () => {
    const p = new InitialsPicker();
    p.up();
    p.confirm();
    p.up();
    p.up();
    p.confirm();
    p.back();
    expect(p.index).toBe(1);
    p.confirm();
    p.confirm();
    expect(p.done).toBe(true);
    expect(p.text).toBe('BCA');
    p.up();
    expect(p.text).toBe('BCA');
  });

  it('selects a letter directly and can finish early', () => {
    const p = new InitialsPicker();
    p.select(2);
    p.up();
    expect(p.text).toBe('AAB');
    p.finish();
    expect(p.done).toBe(true);
  });
});
