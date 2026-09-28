import { describe, expect, it } from 'vitest';
import { cameraTarget, followCamera } from '../../src/view/camera';

describe('cameraTarget', () => {
  it('shows each field edge when the ship is at that wall', () => {
    expect(cameraTarget(0, 13, 200, 150)).toBe(0);
    expect(cameraTarget(187, 13, 200, 150)).toBe(50);
    expect(cameraTarget(93.5, 13, 200, 150)).toBeCloseTo(25);
  });

  it('centers a field narrower than the view', () => {
    expect(cameraTarget(50, 13, 500, 600)).toBe(-50);
  });
});

describe('followCamera', () => {
  it('snaps on the first frame, then eases', () => {
    expect(followCamera(null, 40, 1 / 60)).toBe(40);
    const x = followCamera(0, 40, 1 / 60);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(40);
  });
});
