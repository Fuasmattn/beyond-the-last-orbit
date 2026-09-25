/** Square-wave on/off at `hz` full cycles per second. */
export function blink(time: number, hz: number): boolean {
  return Math.floor(time * hz * 2) % 2 === 0;
}
