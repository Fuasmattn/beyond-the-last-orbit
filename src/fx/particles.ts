export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  gravity: number;
  drag: number;
}

export interface EmitOptions {
  x: number;
  y: number;
  count: number;
  color: readonly number[];
  speed: readonly [number, number];
  life: readonly [number, number];
  size?: readonly [number, number];
  gravity?: number;
  /** Fraction of velocity lost per second. */
  drag?: number;
  /** Center direction in radians (0 = right, π/2 = down). */
  angle?: number;
  /** Full cone width in radians; default 2π (all directions). */
  spread?: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Fixed-capacity ring buffer: emitting past capacity recycles the oldest particles. */
export class ParticleSim {
  readonly particles: Particle[];
  private next = 0;

  constructor(
    capacity: number,
    private readonly random: () => number = Math.random,
  ) {
    this.particles = Array.from({ length: capacity }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 1,
      color: 0xffffff,
      gravity: 0,
      drag: 0,
    }));
  }

  get activeCount(): number {
    let n = 0;
    for (const p of this.particles) if (p.active) n++;
    return n;
  }

  emit(o: EmitOptions): void {
    const r = this.random;
    for (let i = 0; i < o.count; i++) {
      const p = this.particles[this.next]!;
      this.next = (this.next + 1) % this.particles.length;
      const angle = (o.angle ?? 0) + (r() - 0.5) * (o.spread ?? Math.PI * 2);
      const speed = lerp(o.speed[0], o.speed[1], r());
      const life = lerp(o.life[0], o.life[1], r());
      const size = o.size ? Math.round(lerp(o.size[0], o.size[1], r())) : 1;
      p.active = true;
      p.x = o.x;
      p.y = o.y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = life;
      p.maxLife = life;
      p.size = size;
      p.color = o.color[Math.floor(r() * o.color.length)] ?? 0xffffff;
      p.gravity = o.gravity ?? 0;
      p.drag = o.drag ?? 0;
    }
  }

  update(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      const keep = Math.max(0, 1 - p.drag * dt);
      p.vx *= keep;
      p.vy = p.vy * keep + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
}
