/**
 * Recorded audio: drum hits (DrumGizmo MuldjordKit, CC-BY 4.0) and guitar-cabinet impulse
 * responses (Jester's Brutal Pack, CC0). See public/audio/CREDITS.md.
 *
 * Loading is asynchronous; until a sound has arrived the rig keeps using its synthesized fallback.
 */

export type DrumName = 'kick' | 'snare' | 'hat' | 'hatopen' | 'china' | 'crash';
export type CabName = 'v30-sm57' | 'v30-rockdriver-blend';

/** Files per drum: accent (loud) and normal round-robin hits. */
export const DRUM_FILES: Readonly<Record<DrumName, { accent: number; normal: number }>> = {
  kick: { accent: 3, normal: 2 },
  snare: { accent: 3, normal: 2 },
  hat: { accent: 3, normal: 2 },
  hatopen: { accent: 2, normal: 0 },
  china: { accent: 3, normal: 0 },
  crash: { accent: 2, normal: 0 },
};

export const CAB_FILES: readonly CabName[] = ['v30-sm57', 'v30-rockdriver-blend'];

/** Recorded DI guitar notes (FreePats FSBS Direct, CC0): MIDI pitch → two takes each. */
export const DI_NOTES: readonly number[] = [36, 40, 41, 45, 48, 50, 52, 55, 59, 61, 64, 67, 71, 74, 77, 80, 82, 85];
export const DI_TAKES = 2;
/** Farthest a recording is pitch-shifted before falling back to synthesis. */
const DI_MAX_SHIFT = 4;

export interface DrumSet {
  accent: AudioBuffer[];
  normal: AudioBuffer[];
}

export class SampleBank {
  private readonly drums = new Map<DrumName, DrumSet>();
  private readonly cabs = new Map<CabName, AudioBuffer>();
  private readonly di = new Map<number, Float32Array[]>();
  private diRate = 44100;

  /** Starts loading every file; resolves when all have settled (failures are logged and skipped). */
  load(ctx: BaseAudioContext, baseUrl: string): Promise<void> {
    const get = async (path: string): Promise<AudioBuffer | null> => {
      try {
        const res = await fetch(`${baseUrl}audio/${path}`);
        if (!res.ok) throw new Error(`${res.status} ${path}`);
        return await ctx.decodeAudioData(await res.arrayBuffer());
      } catch (err) {
        console.warn('Audio sample unavailable', path, err);
        return null;
      }
    };
    const jobs: Promise<unknown>[] = [];
    for (const [name, counts] of Object.entries(DRUM_FILES) as [DrumName, { accent: number; normal: number }][]) {
      const set: DrumSet = { accent: [], normal: [] };
      for (const [layer, count, prefix] of [
        ['accent', counts.accent, 'a'],
        ['normal', counts.normal, 'n'],
      ] as const) {
        for (let i = 1; i <= count; i++) {
          jobs.push(
            get(`drums/${name}-${prefix}${i}.flac`).then((buf) => {
              if (!buf) return;
              set[layer].push(buf);
              this.drums.set(name, set);
            }),
          );
        }
      }
    }
    for (const midi of DI_NOTES) {
      const takes: Float32Array[] = [];
      this.di.set(midi, takes);
      for (let take = 1; take <= DI_TAKES; take++) {
        jobs.push(
          get(`guitar/di-${midi}-${take}.flac`).then((buf) => {
            if (!buf) return;
            this.diRate = buf.sampleRate;
            takes[take - 1] = buf.getChannelData(0);
          }),
        );
      }
    }
    for (const cab of CAB_FILES) {
      jobs.push(get(`cab/${cab}.flac`).then((buf) => buf && this.cabs.set(cab, buf)));
    }
    return Promise.all(jobs).then(() => undefined);
  }

  /** A hit for `level` (2 = accent), picked at random among the round-robins; null until loaded. */
  drum(name: DrumName, level: number, random: () => number = Math.random): AudioBuffer | null {
    const set = this.drums.get(name);
    if (!set) return null;
    const pool = level >= 2 || set.normal.length === 0 ? set.accent : set.normal;
    const fallback = pool.length > 0 ? pool : set.accent.length > 0 ? set.accent : set.normal;
    return fallback[Math.floor(random() * fallback.length)] ?? null;
  }

  /** Whether a softer recording exists for normal hits (otherwise play the accent quieter). */
  hasNormal(name: DrumName): boolean {
    return (this.drums.get(name)?.normal.length ?? 0) > 0;
  }

  /** Nearest recorded DI note to `midi` for this take (null if none is close enough or loaded). */
  guitarString(midi: number, take: number): { data: Float32Array; sampleRate: number; midi: number } | null {
    let best: number | null = null;
    for (const m of this.di.keys()) {
      if (Math.abs(m - midi) > DI_MAX_SHIFT) continue;
      if (best === null || Math.abs(m - midi) < Math.abs(best - midi)) best = m;
    }
    if (best === null) return null;
    const takes = this.di.get(best)!.filter(Boolean);
    const data = takes[take % Math.max(1, takes.length)];
    return data ? { data, sampleRate: this.diRate, midi: best } : null;
  }

  /** Whether the DI guitar recordings have arrived. */
  get hasGuitar(): boolean {
    return [...this.di.values()].some((t) => t.length > 0);
  }

  cab(name: CabName): AudioBuffer | null {
    return this.cabs.get(name) ?? null;
  }
}
