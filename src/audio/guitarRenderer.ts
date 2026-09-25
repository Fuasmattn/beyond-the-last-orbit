import type { Voicing } from './pattern';
import type { StringLibrary } from './guitar';

export interface GuitarRenderRequest {
  key: string;
  kind: 'chord' | 'lead';
  midi: number;
  mute: boolean;
  voicing: Voicing;
  take: number;
  seconds: number;
  sampleRate: number;
  /** Use the installed DI recordings (else synthesize strings). */
  useStrings: boolean;
}

export type GuitarWorkerMessage =
  | { type: 'strings'; notes: { midi: number; takes: Float32Array[] }[]; sampleRate: number }
  | { type: 'render'; req: GuitarRenderRequest };

/**
 * Main-thread side of the guitar render worker. One worker per page; results arrive as raw samples
 * keyed by the request's cache key. Without Worker support `available` is false and callers render
 * synchronously instead.
 */
class GuitarRenderer {
  private worker: Worker | null = null;
  private stringsSent: StringLibrary | null = null;
  private readonly pending = new Map<string, ((data: Float32Array<ArrayBuffer>) => void)[]>();

  get available(): boolean {
    return this.ensure() !== null;
  }

  /** Hands the DI recordings to the worker (copied once per library). */
  setStrings(library: StringLibrary, sampleRate: number): void {
    const w = this.ensure();
    if (!w || this.stringsSent === library) return;
    this.stringsSent = library;
    const notes = [...library].map(([midi, takes]) => ({ midi, takes: takes.filter(Boolean).map((t) => t.slice()) }));
    w.postMessage({ type: 'strings', notes, sampleRate } satisfies GuitarWorkerMessage);
  }

  render(req: GuitarRenderRequest): Promise<Float32Array<ArrayBuffer>> {
    const w = this.ensure();
    if (!w) return Promise.reject(new Error('no worker'));
    return new Promise((resolve) => {
      const waiting = this.pending.get(req.key);
      if (waiting) {
        waiting.push(resolve);
        return;
      }
      this.pending.set(req.key, [resolve]);
      w.postMessage({ type: 'render', req } satisfies GuitarWorkerMessage);
    });
  }

  private ensure(): Worker | null {
    if (this.worker) return this.worker;
    if (typeof Worker === 'undefined') return null;
    try {
      this.worker = new Worker(new URL('./guitar.worker.ts', import.meta.url), { type: 'module' });
    } catch (err) {
      console.warn('Guitar render worker unavailable', err);
      return null;
    }
    this.worker.onmessage = (ev: MessageEvent<{ key: string; data: Float32Array<ArrayBuffer> }>) => {
      const waiting = this.pending.get(ev.data.key) ?? [];
      this.pending.delete(ev.data.key);
      // Each waiter gets its own copy only if there are several (rare).
      waiting.forEach((resolve, i) => resolve(i === 0 ? ev.data.data : ev.data.data.slice()));
    };
    return this.worker;
  }
}

export const guitarRenderer = new GuitarRenderer();
