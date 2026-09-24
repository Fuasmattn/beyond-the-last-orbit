export const INITIALS_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const INITIALS_LENGTH = 3;

/** Arcade-style 3-letter name entry: up/down cycles the current letter, confirm advances. */
export class InitialsPicker {
  private readonly letters = [0, 0, 0];
  private cursor = 0;

  get index(): number {
    return this.cursor;
  }

  get done(): boolean {
    return this.cursor >= INITIALS_LENGTH;
  }

  get text(): string {
    return this.letters.map((_, i) => this.charAt(i)).join('');
  }

  charAt(i: number): string {
    return INITIALS_CHARSET[this.letters[i] ?? 0] ?? 'A';
  }

  up(): void {
    this.shift(1);
  }

  down(): void {
    this.shift(-1);
  }

  confirm(): void {
    if (!this.done) this.cursor++;
  }

  back(): void {
    if (this.cursor > 0 && !this.done) this.cursor--;
  }

  select(i: number): void {
    if (!this.done && i >= 0 && i < INITIALS_LENGTH) this.cursor = i;
  }

  finish(): void {
    this.cursor = INITIALS_LENGTH;
  }

  private shift(delta: number): void {
    if (this.done) return;
    const n = INITIALS_CHARSET.length;
    const i = this.cursor;
    this.letters[i] = ((this.letters[i] ?? 0) + delta + n) % n;
  }
}
