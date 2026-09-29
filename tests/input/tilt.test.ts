import { describe, expect, it } from 'vitest';
import { screenTilt, tiltAxis, TiltInput } from '../../src/input/tilt';

function orient(target: EventTarget, beta: number, gamma: number) {
  const e = new Event('deviceorientation') as Event & { beta: number; gamma: number };
  Object.assign(e, { beta, gamma });
  target.dispatchEvent(e);
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('tiltAxis', () => {
  it('ignores the dead zone and ramps linearly to full deflection', () => {
    expect(tiltAxis(1, 2, 14)).toBe(0);
    expect(tiltAxis(-2, 2, 14)).toBe(0);
    expect(tiltAxis(8, 2, 14)).toBeCloseTo(0.5);
    expect(tiltAxis(-8, 2, 14)).toBeCloseTo(-0.5);
    expect(tiltAxis(30, 2, 14)).toBe(1);
  });
});

describe('screenTilt', () => {
  it('rotates device axes into screen axes per orientation angle', () => {
    const o = { beta: 10, gamma: 3 };
    expect(screenTilt(o, 0)).toEqual({ x: 3, y: 10 });
    expect(screenTilt(o, 90)).toEqual({ x: -10, y: -3 });
    expect(screenTilt(o, 180)).toEqual({ x: -3, y: -10 });
    expect(screenTilt(o, 270)).toEqual({ x: 10, y: 3 });
    expect(screenTilt(o, -90)).toEqual(screenTilt(o, 270));
  });
});

describe('TiltInput', () => {
  it('steers relative to the pose at enable time', () => {
    const sensor = new EventTarget();
    const tilt = new TiltInput(sensor, new EventTarget(), null, () => 0);
    tilt.setEnabled(true);
    expect(tilt.status).toBe('on');
    orient(sensor, 45, 0);
    expect(tilt.poll().moveX).toBe(0);
    orient(sensor, 45, 14);
    expect(tilt.poll().moveX).toBe(1);
    orient(sensor, 31, 8);
    const f = tilt.poll();
    expect(f.moveX).toBeCloseTo(0.5);
    expect(f.moveY).toBe(-1);
    expect(f.firePressed).toBe(false);
  });

  it('recenters on request and when the screen rotates', () => {
    const sensor = new EventTarget();
    let angle = 0;
    const tilt = new TiltInput(sensor, new EventTarget(), null, () => angle);
    tilt.setEnabled(true);
    orient(sensor, 45, 0);
    orient(sensor, 45, 14);
    tilt.recenter();
    expect(tilt.poll().moveX).toBe(0);
    orient(sensor, 45, 22);
    expect(tilt.poll().moveX).toBeCloseTo(0.5);
    angle = 90;
    expect(tilt.poll().moveX).toBe(0);
  });

  it('is idle while off, unsupported or denied', async () => {
    const sensor = new EventTarget();
    const off = new TiltInput(sensor, new EventTarget(), null, () => 0);
    orient(sensor, 0, 30);
    expect(off.poll().moveX).toBe(0);
    const none = new TiltInput(sensor, new EventTarget(), null, () => 0, false);
    none.setEnabled(true);
    expect(none.status).toBe('unsupported');
    const denied = new TiltInput(sensor, new EventTarget(), () => Promise.resolve('denied'), () => 0);
    denied.setEnabled(true);
    expect(denied.status).toBe('pending');
    await flush();
    expect(denied.status).toBe('denied');
    orient(sensor, 0, 30);
    expect(denied.poll().moveX).toBe(0);
  });

  it('retries the permission prompt on the next press when the first ask had no gesture', async () => {
    const sensor = new EventTarget();
    const gestures = new EventTarget();
    let asks = 0;
    const permission = () => (++asks === 1 ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve('granted'));
    const tilt = new TiltInput(sensor, gestures, permission, () => 0);
    tilt.setEnabled(true);
    await flush();
    expect(tilt.status).toBe('pending');
    gestures.dispatchEvent(new Event('pointerup'));
    await flush();
    expect(tilt.status).toBe('on');
    expect(asks).toBe(2);
    orient(sensor, 45, 0);
    orient(sensor, 45, -14);
    expect(tilt.poll().moveX).toBe(-1);
    tilt.setEnabled(false);
    expect(tilt.status).toBe('off');
    orient(sensor, 45, 14);
    expect(tilt.poll().moveX).toBe(0);
  });
});
