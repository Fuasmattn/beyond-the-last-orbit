import { describe, expect, it } from 'vitest';
import { KeyboardInput } from '../../src/input/keyboard';

function key(target: EventTarget, type: 'keydown' | 'keyup', code: string, repeat = false) {
  const e = new Event(type) as Event & { code: string; repeat: boolean };
  Object.assign(e, { code, repeat });
  target.dispatchEvent(e);
}

describe('KeyboardInput', () => {
  it('judges the fire press at keydown time', () => {
    const target = new EventTarget();
    let verdict = { onBeat: true, perfect: true };
    const kb = new KeyboardInput(target, () => verdict);
    key(target, 'keydown', 'Space');
    verdict = { onBeat: false, perfect: false };
    const f = kb.poll();
    expect(f.firePressed).toBe(true);
    expect(f.fireOnBeat).toBe(true);
    expect(f.firePerfect).toBe(true);
    expect(kb.poll().firePressed).toBe(false);
  });

  it('reads movement axes from held keys', () => {
    const target = new EventTarget();
    const kb = new KeyboardInput(target);
    key(target, 'keydown', 'ArrowLeft');
    expect(kb.poll().moveX).toBe(-1);
    key(target, 'keyup', 'ArrowLeft');
    expect(kb.poll().moveX).toBe(0);
  });

  it('ignores auto-repeat for fire', () => {
    const target = new EventTarget();
    const kb = new KeyboardInput(target);
    key(target, 'keydown', 'Space', true);
    expect(kb.poll().firePressed).toBe(false);
  });

  it('queues menu actions, repeating only up/down', () => {
    const target = new EventTarget();
    const kb = new KeyboardInput(target);
    key(target, 'keydown', 'ArrowUp');
    key(target, 'keydown', 'ArrowUp', true);
    key(target, 'keydown', 'Enter');
    key(target, 'keydown', 'Enter', true);
    expect(kb.consumeMenu()).toEqual(['up', 'up', 'confirm']);
    expect(kb.consumeMenu()).toEqual([]);
  });
});
