import { describe, expect, it } from 'vitest';
import { FX } from '../../src/data/balance';
import { FrameMonitor } from '../../src/fx/frameMonitor';
import { ParticleSim } from '../../src/fx/particles';
import { popupAlpha, popupRise, Popups } from '../../src/fx/popups';
import { Shake } from '../../src/fx/shake';

describe('Shake', () => {
  it('caps trauma at 1 and decays over time', () => {
    const s = new Shake();
    s.add(0.7);
    s.add(0.7);
    expect(s.trauma).toBe(1);
    s.update(0.5);
    expect(s.trauma).toBeCloseTo(1 - FX.shake.decay * 0.5);
    s.update(10);
    expect(s.trauma).toBe(0);
  });

  it('does not move without trauma and stays within the max offset', () => {
    const s = new Shake();
    expect(s.offset(1.23)).toEqual({ x: 0, y: 0 });
    s.add(1);
    for (let t = 0; t < 2; t += 0.01) {
      const o = s.offset(t);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(FX.shake.maxOffset + 1e-9);
      expect(Math.abs(o.y)).toBeLessThanOrEqual(FX.shake.maxOffset + 1e-9);
    }
  });
});

describe('ParticleSim', () => {
  const rng = () => 0.5;

  it('emits particles in the requested direction', () => {
    const sim = new ParticleSim(10, rng);
    sim.emit({ x: 5, y: 5, count: 3, color: [0xff0000], speed: [10, 10], life: [1, 1], angle: Math.PI / 2, spread: 0 });
    expect(sim.activeCount).toBe(3);
    sim.update(0.5);
    const p = sim.particles[0]!;
    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(10);
    expect(p.color).toBe(0xff0000);
  });

  it('recycles the oldest particles past capacity', () => {
    const sim = new ParticleSim(4, rng);
    sim.emit({ x: 0, y: 0, count: 6, color: [1], speed: [0, 0], life: [1, 1] });
    expect(sim.activeCount).toBe(4);
  });

  it('applies gravity and expires particles', () => {
    const sim = new ParticleSim(2, rng);
    sim.emit({ x: 0, y: 0, count: 1, color: [1], speed: [0, 0], life: [0.2, 0.2], gravity: 100 });
    sim.update(0.1);
    expect(sim.particles[0]!.vy).toBeCloseTo(10);
    sim.update(0.2);
    expect(sim.activeCount).toBe(0);
  });
});

describe('Popups', () => {
  it('rise, fade and expire', () => {
    const p = new Popups();
    p.spawn('+10', 0xffffff, 10, 20);
    p.update(FX.popup.life / 2);
    const item = p.items[0]!;
    expect(popupAlpha(item)).toBeCloseTo(0.5);
    expect(popupRise(item)).toBeCloseTo(-FX.popup.rise / 2);
    p.update(FX.popup.life);
    expect(p.items).toHaveLength(0);
  });

  it('keeps at most the configured number', () => {
    const p = new Popups();
    for (let i = 0; i < FX.popup.max + 5; i++) p.spawn(String(i), 0, 0, 0);
    expect(p.items).toHaveLength(FX.popup.max);
    expect(p.items[0]!.text).toBe('5');
  });
});

describe('FrameMonitor', () => {
  it('stays quiet at 60 fps', () => {
    const m = new FrameMonitor(2000, 20, 250);
    for (let i = 0; i < 400; i++) expect(m.push(16.7)).toBe(false);
  });

  it('fires once a full window runs slow, then restarts', () => {
    const m = new FrameMonitor(2000, 20, 250);
    let fired = 0;
    for (let i = 0; i < 70; i++) if (m.push(30)) fired++;
    expect(fired).toBe(1);
  });

  it('ignores stalls', () => {
    const m = new FrameMonitor(2000, 20, 250);
    for (let i = 0; i < 20; i++) expect(m.push(500)).toBe(false);
  });
});
