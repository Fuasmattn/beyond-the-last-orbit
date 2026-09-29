import type { Container, Filter } from 'pixi.js';
import { AdvancedBloomFilter, CRTFilter, RGBSplitFilter } from 'pixi-filters';
import type { Settings } from '../persist/schema';

const ABERRATION_PX = 3;
const ABERRATION_MIN = 0.05;

/** Bloom → chromatic aberration → CRT on the scaled game container. */
export class PostFx {
  private readonly bloom: AdvancedBloomFilter;
  private readonly crt: CRTFilter;
  private readonly split: RGBSplitFilter;
  private wantBloom = true;
  private wantCrt = true;
  private degradeLevel = 0;
  private aberration = 0;
  private active = '';

  constructor(
    private readonly target: Container,
    resolution: number,
    /** Touch screens: a wider, fainter vignette, so a portrait phone's HUD and beat track stay readable. */
    soft = false,
  ) {
    const vignette = soft
      ? { vignetting: 0.05, vignettingAlpha: 0.4, vignettingBlur: 0.6 }
      : { vignetting: 0.32, vignettingAlpha: 0.75, vignettingBlur: 0.35 };
    this.bloom = new AdvancedBloomFilter({ threshold: 0.45, bloomScale: 0.9, brightness: 1, blur: 5, quality: 5 });
    this.crt = new CRTFilter({
      curvature: 2,
      lineWidth: 1,
      lineContrast: 0.18,
      noise: 0.05,
      noiseSize: 1,
      ...vignette,
    });
    this.split = new RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } });
    for (const f of [this.bloom, this.crt, this.split]) f.resolution = resolution;
  }

  configure(settings: Pick<Settings, 'crt' | 'bloom'>): void {
    this.wantBloom = settings.bloom;
    this.wantCrt = settings.crt;
    this.apply();
  }

  /** One scanline per logical pixel. */
  setScale(scale: number): void {
    this.crt.lineWidth = Math.max(1, scale * 0.5);
  }

  setAberration(amount: number): void {
    this.aberration = amount;
    const px = amount * ABERRATION_PX;
    this.split.red = { x: -px, y: 0 };
    this.split.blue = { x: px, y: 0 };
    this.apply();
  }

  /** Drops bloom, then CRT. Returns false when nothing is left to drop. */
  degrade(): boolean {
    if (this.degradeLevel >= 2) return false;
    this.degradeLevel++;
    this.apply();
    return true;
  }

  update(dt: number): void {
    this.crt.time += dt * 10;
    this.crt.seed = Math.random();
  }

  private apply(): void {
    const bloom = this.wantBloom && this.degradeLevel < 1;
    const split = this.aberration > ABERRATION_MIN;
    const crt = this.wantCrt && this.degradeLevel < 2;
    const key = `${+bloom}${+split}${+crt}`;
    if (key === this.active) return;
    this.active = key;
    const list: Filter[] = [];
    if (bloom) list.push(this.bloom);
    if (split) list.push(this.split);
    if (crt) list.push(this.crt);
    this.target.filters = list.length > 0 ? list : null;
  }
}
