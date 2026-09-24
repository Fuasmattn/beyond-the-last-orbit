import { worldAt } from '../../data/worlds';
import type { Bullet, SimEvent, SimState } from '../types';
import { hitWarden, spawnWarden, updateWarden } from './warden';

export function spawnBoss(state: SimState): void {
  switch (worldAt(state.world).boss) {
    case 'warden':
      spawnWarden(state);
      return;
  }
}

export function updateBoss(state: SimState, dt: number, beats: number, events: SimEvent[]): void {
  switch (state.boss?.kind) {
    case 'warden':
      updateWarden(state, dt, beats, events);
      return;
    case undefined:
      return;
  }
}

export function hitBoss(state: SimState, bullet: Bullet, events: SimEvent[]): boolean {
  switch (state.boss?.kind) {
    case 'warden':
      return hitWarden(state, bullet, events);
    case undefined:
      return false;
  }
}
