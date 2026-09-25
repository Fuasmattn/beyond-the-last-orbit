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

export interface DrumSet {
  accent: AudioBuffer[];
  normal: AudioBuffer[];
}

export class SampleBank {
  private readonly drums = new Map<DrumName, DrumSet>();
  private readonly cabs = new Map<CabName, AudioBuffer>();

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

  cab(name: CabName): AudioBuffer | null {
    return this.cabs.get(name) ?? null;
  }
}
