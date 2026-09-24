import type { BeatClock } from './beatClock';
import { parseDrumPattern, parseNotePattern, type NoteEvent } from './pattern';

export const STEPS_PER_BEAT = 4;
export const STEPS_PER_BAR = 16;

export interface SectionDef {
  bars: number;
  guitar: string;
  lead?: string;
  kick: string;
  snare: string;
  hat: string;
  crash?: string;
}

export interface SongDef {
  name: string;
  bpm: number;
  sections: Record<string, SectionDef>;
  order: readonly string[];
  /** Index into `order` where playback loops back to after the end. */
  loopFrom: number;
}

export interface CompiledSection {
  name: string;
  steps: number;
  guitar: (NoteEvent | undefined)[];
  lead: (NoteEvent | undefined)[];
  kick: number[];
  snare: number[];
  hat: number[];
  crash: number[];
}

export interface CompiledSong {
  name: string;
  bpm: number;
  entries: { section: CompiledSection; offset: number }[];
  totalSteps: number;
  loopStartStep: number;
}

function noteTrack(name: string, src: string | undefined, steps: number): (NoteEvent | undefined)[] {
  const track: (NoteEvent | undefined)[] = new Array<NoteEvent | undefined>(steps).fill(undefined);
  if (src === undefined) return track;
  const parsed = parseNotePattern(src);
  if (parsed.steps !== steps) throw new Error(`${name}: expected ${steps} steps, got ${parsed.steps}`);
  for (const e of parsed.events) track[e.step] = e;
  return track;
}

function drumTrack(name: string, src: string | undefined, steps: number): number[] {
  if (src === undefined) return new Array<number>(steps).fill(0);
  const track = parseDrumPattern(src);
  if (track.length !== steps) throw new Error(`${name}: expected ${steps} steps, got ${track.length}`);
  return track;
}

function compileSection(name: string, def: SectionDef): CompiledSection {
  const steps = def.bars * STEPS_PER_BAR;
  return {
    name,
    steps,
    guitar: noteTrack(`${name}.guitar`, def.guitar, steps),
    lead: noteTrack(`${name}.lead`, def.lead, steps),
    kick: drumTrack(`${name}.kick`, def.kick, steps),
    snare: drumTrack(`${name}.snare`, def.snare, steps),
    hat: drumTrack(`${name}.hat`, def.hat, steps),
    crash: drumTrack(`${name}.crash`, def.crash, steps),
  };
}

export function compileSong(def: SongDef): CompiledSong {
  const compiled = new Map<string, CompiledSection>();
  for (const [name, section] of Object.entries(def.sections)) {
    compiled.set(name, compileSection(name, section));
  }
  const entries: CompiledSong['entries'] = [];
  let offset = 0;
  let loopStartStep = 0;
  def.order.forEach((name, i) => {
    const section = compiled.get(name);
    if (!section) throw new Error(`unknown section "${name}" in order`);
    if (i === def.loopFrom) loopStartStep = offset;
    entries.push({ section, offset });
    offset += section.steps;
  });
  return { name: def.name, bpm: def.bpm, entries, totalSteps: offset, loopStartStep };
}

export function resolveStep(
  song: CompiledSong,
  globalStep: number,
): { section: CompiledSection; step: number } | null {
  if (globalStep < 0) return null;
  let i = globalStep;
  if (i >= song.totalSteps) {
    const loopLen = song.totalSteps - song.loopStartStep;
    i = song.loopStartStep + ((i - song.loopStartStep) % loopLen);
  }
  for (const entry of song.entries) {
    if (i < entry.offset + entry.section.steps) return { section: entry.section, step: i - entry.offset };
  }
  return null;
}

export function stepsInWindow(
  clock: BeatClock,
  from: number,
  to: number,
): { index: number; time: number }[] {
  const stepDur = clock.beatDur / STEPS_PER_BEAT;
  const out: { index: number; time: number }[] = [];
  let i = Math.max(0, Math.ceil((from - clock.startTime) / stepDur - 1e-6));
  for (;; i++) {
    const time = clock.startTime + i * stepDur;
    if (time >= to) break;
    if (time >= from) out.push({ index: i, time });
  }
  return out;
}
