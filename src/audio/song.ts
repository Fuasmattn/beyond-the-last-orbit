import type { BeatClock } from './beatClock';
import { parseDrumPattern, parseNotePattern, type NoteEvent } from './pattern';

export const STEPS_PER_BEAT = 4;
export const STEPS_PER_BAR = 16;

export interface SectionDef {
  bars: number;
  guitar: string;
  lead?: string;
  /** Harmony lead (twin guitars), panned opposite to `lead`. */
  lead2?: string;
  kick: string;
  snare: string;
  hat: string;
  crash?: string;
  /** Trashy china cymbal (breakdowns, choruses). */
  china?: string;
}

export interface ArrangementDef {
  order: readonly string[];
  /** Index into `order` where playback loops back to after the end. */
  loopFrom: number;
}

export interface SongDef {
  name: string;
  bpm: number;
  sections: Record<string, SectionDef>;
  arrangements: Record<string, ArrangementDef> & { main: ArrangementDef };
}

export interface CompiledSection {
  name: string;
  steps: number;
  guitar: (NoteEvent | undefined)[];
  lead: (NoteEvent | undefined)[];
  lead2: (NoteEvent | undefined)[];
  kick: number[];
  snare: number[];
  hat: number[];
  crash: number[];
  china: number[];
}

export interface CompiledArrangement {
  entries: { section: CompiledSection; offset: number }[];
  totalSteps: number;
  loopStartStep: number;
}

export interface CompiledSong {
  name: string;
  bpm: number;
  arrangements: Record<string, CompiledArrangement>;
}

function noteTrack(name: string, src: string | undefined, steps: number): (NoteEvent | undefined)[] {
  const track = new Array<NoteEvent | undefined>(steps).fill(undefined);
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
    lead2: noteTrack(`${name}.lead2`, def.lead2, steps),
    kick: drumTrack(`${name}.kick`, def.kick, steps),
    snare: drumTrack(`${name}.snare`, def.snare, steps),
    hat: drumTrack(`${name}.hat`, def.hat, steps),
    crash: drumTrack(`${name}.crash`, def.crash, steps),
    china: drumTrack(`${name}.china`, def.china, steps),
  };
}

function compileArrangement(
  name: string,
  def: ArrangementDef,
  sections: Map<string, CompiledSection>,
): CompiledArrangement {
  const entries: CompiledArrangement['entries'] = [];
  let offset = 0;
  let loopStartStep = 0;
  def.order.forEach((sectionName, i) => {
    const section = sections.get(sectionName);
    if (!section) throw new Error(`arrangement "${name}": unknown section "${sectionName}"`);
    if (i === def.loopFrom) loopStartStep = offset;
    entries.push({ section, offset });
    offset += section.steps;
  });
  if (offset === 0) throw new Error(`arrangement "${name}" is empty`);
  return { entries, totalSteps: offset, loopStartStep };
}

export function compileSong(def: SongDef): CompiledSong {
  const sections = new Map<string, CompiledSection>();
  for (const [name, section] of Object.entries(def.sections)) sections.set(name, compileSection(name, section));
  const arrangements: Record<string, CompiledArrangement> = {};
  for (const [name, arr] of Object.entries(def.arrangements)) {
    arrangements[name] = compileArrangement(name, arr, sections);
  }
  return { name: def.name, bpm: def.bpm, arrangements };
}

export function resolveStep(
  arr: CompiledArrangement,
  step: number,
): { section: CompiledSection; step: number } | null {
  if (step < 0) return null;
  let i = step;
  if (i >= arr.totalSteps) {
    const loopLen = arr.totalSteps - arr.loopStartStep;
    i = arr.loopStartStep + ((i - arr.loopStartStep) % loopLen);
  }
  for (const entry of arr.entries) {
    if (i < entry.offset + entry.section.steps) return { section: entry.section, step: i - entry.offset };
  }
  return null;
}

/** First 16th-step index on a bar line at or after `time`. */
export function nextBarStep(clock: BeatClock, time: number): number {
  const stepDur = clock.beatDur / STEPS_PER_BEAT;
  const step = Math.ceil((time - clock.startTime) / stepDur - 1e-6);
  return Math.max(0, Math.ceil(step / STEPS_PER_BAR) * STEPS_PER_BAR);
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
