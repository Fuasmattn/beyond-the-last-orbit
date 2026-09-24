/** Join bar strings with visual bar separators (ignored by the parser). */
export const bars = (...b: string[]): string => b.join(' | ');

/** `n` copies of a token, space separated. */
export const rep = (token: string, n: number): string => new Array<string>(n).fill(token).join(' ');

export const EMPTY = '................';
export const BACKBEAT = '....x.......x...';
export const EIGHTH_HAT = 'x.x.x.x.x.x.x.x.';
export const EIGHTH_KICK = 'x.x.x.x.x.x.x.x.';
export const GALLOP_KICK = 'x.xxx.xxx.xxx.xx';
export const DOUBLE_KICK = 'xxxxxxxxxxxxxxxx';
export const SKANK_KICK = 'x...x...x...x...';
export const SKANK_SNARE = '..x...x...x...x.';
