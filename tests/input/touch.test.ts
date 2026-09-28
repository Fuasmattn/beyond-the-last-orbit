import { describe, expect, it } from 'vitest';
import type { Layout } from '../../src/app/layout';
import { isTap, TouchInput } from '../../src/input/touch';

type Handler = (e: PointerEvent) => void;

function setup(scale = 2) {
  const handlers = new Map<string, Handler>();
  const el = { addEventListener: (type: string, h: Handler) => handlers.set(type, h) } as unknown as HTMLElement;
  const layout: Layout = { fieldW: 200, viewW: 150, scale, offsetX: 0, offsetY: 0 };
  const judged: number[] = [];
  const input = new TouchInput(el, () => layout, (t) => {
    judged.push(t ?? -1);
    return { onBeat: true, perfect: false };
  });
  const send = (type: string, id: number, x: number, y: number, timeStamp: number) =>
    handlers.get(type)!({ pointerId: id, pointerType: 'touch', clientX: x, clientY: y, timeStamp } as PointerEvent);
  return { input, judged, send };
}

describe('isTap', () => {
  it('accepts short, still presses only', () => {
    expect(isTap(100, 2)).toBe(true);
    expect(isTap(400, 2)).toBe(false);
    expect(isTap(100, 30)).toBe(false);
  });
});

describe('TouchInput', () => {
  it('drags anywhere to move, relative to the finger', () => {
    const { input, send } = setup(2);
    send('pointerdown', 1, 100, 500, 0);
    send('pointermove', 1, 120, 480, 16);
    const f = input.poll();
    expect(f.dragX).toBeCloseTo(12.5);
    expect(f.dragY).toBeCloseTo(-12.5);
    expect(f.firePressed).toBe(false);
  });

  it('a quick tap anywhere fires on release, judged at the press time', () => {
    const { input, judged, send } = setup();
    send('pointerdown', 1, 300, 100, 1000);
    expect(input.poll().firePressed).toBe(false);
    send('pointerup', 1, 301, 100, 1080);
    const f = input.poll();
    expect(f.firePressed).toBe(true);
    expect(f.fireOnBeat).toBe(true);
    expect(judged).toEqual([1000]);
  });

  it('a drag release does not fire', () => {
    const { input, send } = setup();
    send('pointerdown', 1, 100, 100, 0);
    send('pointermove', 1, 160, 100, 50);
    send('pointerup', 1, 160, 100, 100);
    expect(input.poll().firePressed).toBe(false);
  });

  it('a second finger fires immediately while the first steers', () => {
    const { input, judged, send } = setup();
    send('pointerdown', 1, 100, 500, 0);
    send('pointerdown', 2, 300, 200, 40);
    expect(input.poll().firePressed).toBe(true);
    expect(judged).toEqual([40]);
    // The firing finger does not steer.
    send('pointermove', 2, 350, 200, 50);
    expect(input.poll().dragX).toBe(0);
  });

  it('hands steering to a remaining finger when the steer finger lifts', () => {
    const { input, send } = setup(1);
    send('pointerdown', 1, 100, 500, 0);
    send('pointerdown', 2, 300, 200, 10);
    send('pointermove', 1, 200, 500, 500);
    send('pointerup', 1, 200, 500, 600);
    input.poll();
    send('pointermove', 2, 310, 200, 700);
    expect(input.poll().dragX).toBeCloseTo(12.5);
  });
});
