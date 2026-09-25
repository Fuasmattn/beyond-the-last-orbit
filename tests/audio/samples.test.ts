import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAB_FILES, DRUM_FILES, SampleBank } from '../../src/audio/samples';

/** Fake context whose "decoded" buffers just remember their URL. */
const fakeCtx = {
  decodeAudioData: async (data: ArrayBuffer) => ({ url: new TextDecoder().decode(data) }) as unknown as AudioBuffer,
} as unknown as BaseAudioContext;

function mockFetch(fail: (url: string) => boolean = () => false): string[] {
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(url);
    return fail(url)
      ? { ok: false, status: 404 }
      : { ok: true, arrayBuffer: async () => new TextEncoder().encode(url).buffer };
  });
  return urls;
}

const urlOf = (b: AudioBuffer | null) => (b as unknown as { url: string } | null)?.url ?? null;

afterEach(() => vi.unstubAllGlobals());

describe('SampleBank', () => {
  it('requests every drum layer and cabinet under the base URL', async () => {
    const urls = mockFetch();
    await new SampleBank().load(fakeCtx, '/base/');
    const drums = Object.values(DRUM_FILES).reduce((n, c) => n + c.accent + c.normal, 0);
    expect(urls).toHaveLength(drums + CAB_FILES.length);
    expect(urls).toContain('/base/audio/drums/kick-a1.flac');
    expect(urls).toContain('/base/audio/cab/v30-sm57.flac');
  });

  it('picks accents for level 2, normals for level 1, and accents when no normal exists', async () => {
    mockFetch();
    const bank = new SampleBank();
    await bank.load(fakeCtx, '/');
    expect(urlOf(bank.drum('snare', 2, () => 0))).toMatch(/snare-a/);
    expect(urlOf(bank.drum('snare', 1, () => 0))).toMatch(/snare-n/);
    expect(urlOf(bank.drum('china', 1, () => 0))).toMatch(/china-a/);
    expect(bank.hasNormal('china')).toBe(false);
  });

  it('skips missing files and returns null for sounds that never loaded', async () => {
    mockFetch((url) => url.includes('crash') || url.includes('cab/'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bank = new SampleBank();
    await bank.load(fakeCtx, '/');
    expect(bank.drum('crash', 2)).toBeNull();
    expect(bank.cab('v30-sm57')).toBeNull();
    expect(bank.drum('kick', 2)).not.toBeNull();
  });
});
