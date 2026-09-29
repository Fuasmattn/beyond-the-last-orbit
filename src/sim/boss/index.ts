import { worldAt } from '../../data/worlds';
import type { Bullet, SimEvent, SimState } from '../types';
import { hitDreadnought, spawnDreadnought, updateDreadnought } from './dreadnought';
import { hitHive, spawnHive, updateHive } from './hive';
import { hitSentinel, updateSentinel } from './sentinel';
import { hitWarden, spawnWarden, updateWarden } from './warden';

export function spawnBoss(state: SimState): void {
  switch (worldAt(state.world).boss) {
    case 'warden':
      spawnWarden(state);
      return;
    case 'hive':
      spawnHive(state);
      return;
    case 'dreadnought':
      spawnDreadnought(state);
      return;
  }
}

export function updateBoss(state: SimState, dt: number, beats: number, events: SimEvent[]): void {
  switch (state.boss?.kind) {
    case 'warden':
      updateWarden(state, dt, beats, events);
      return;
    case 'hive':
      updateHive(state, dt, beats, events);
      return;
    case 'dreadnought':
      updateDreadnought(state, dt, beats, events);
      return;
    case 'sentinel':
      updateSentinel(state, dt, beats, events);
      return;
    case undefined:
      return;
  }
}

export function hitBoss(state: SimState, bullet: Bullet, events: SimEvent[]): boolean {
  switch (state.boss?.kind) {
    case 'warden':
      return hitWarden(state, bullet, events);
    case 'hive':
      return hitHive(state, bullet, events);
    case 'dreadnought':
      return hitDreadnought(state, bullet, events);
    case 'sentinel':
      return hitSentinel(state, bullet, events);
    case undefined:
      return false;
  }
}
