/// <reference lib="webworker" />
/**
 * Renders guitar notes off the main thread (the oversampled amp costs ~20 ms per chord).
 * Messages: `strings` installs the DI recordings; `render` returns one note's samples.
 */
import { nearestString, renderLeadNote, renderPowerChord, type StringLibrary } from './guitar';
import type { GuitarRenderRequest, GuitarWorkerMessage } from './guitarRenderer';

let library: StringLibrary | null = null;
let libraryRate = 44100;

function render(req: GuitarRenderRequest): Float32Array<ArrayBuffer> {
  const lib = library;
  const source = req.useStrings && lib ? (midi: number, take: number) => nearestString(lib, libraryRate, midi, take) : null;
  return req.kind === 'lead'
    ? renderLeadNote(req.midi, { sampleRate: req.sampleRate, take: req.take, seconds: req.seconds, source })
    : renderPowerChord(req.midi, {
        sampleRate: req.sampleRate,
        mute: req.mute,
        take: req.take,
        seconds: req.seconds,
        voicing: req.voicing,
        source,
      });
}

self.onmessage = (ev: MessageEvent<GuitarWorkerMessage>) => {
  const msg = ev.data;
  if (msg.type === 'strings') {
    library = new Map(msg.notes.map((n) => [n.midi, n.takes]));
    libraryRate = msg.sampleRate;
    return;
  }
  const data = render(msg.req);
  (self as unknown as Worker).postMessage({ key: msg.req.key, data }, [data.buffer]);
};
