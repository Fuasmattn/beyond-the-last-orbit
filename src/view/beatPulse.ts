export function beatPulse(beat: number | null): number {
  if (beat === null || beat < 0) return 0;
  const whole = Math.floor(beat);
  const frac = beat - whole;
  const strength = whole % 4 === 0 ? 1 : 0.5;
  return strength * (1 - frac) ** 4;
}

export function lerpColor(a: number, b: number, t: number): number {
  const ch = (shift: number) => {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * t) << shift;
  };
  return ch(16) | ch(8) | ch(0);
}
