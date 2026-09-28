// Renders the app icons (synthwave planet + arrow ship) to public/icons. Run: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SHIP = [0, -12, 3, -6, 8, -1, 8, 1, 3, -1, 1.5, 1, -1.5, 1, -3, -1, -8, 1, -8, -1, -3, -6];
const BG = [5, 6, 13];
const PLANET_TOP = [127, 248, 255];
const PLANET_BOTTOM = [61, 90, 255];
const GRID = [74, 242, 255];
const SHIP_COLOR = [255, 61, 154];

const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [pts[i], pts[i + 1], pts[j], pts[j + 1]];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Colour at unit coords (0..1): planet disc with slits above a horizon, ship in front. */
function sample(u, v) {
  const horizon = 0.62;
  const r = 0.34;
  const sx = (u - 0.5) * 40;
  const sy = (v - 0.5) * 40 + 4;
  if (inPoly(sx, sy, SHIP)) return SHIP_COLOR;
  if (v >= horizon && v < horizon + 0.012) return GRID;
  if (v > horizon) {
    const d = (v - horizon) / (1 - horizon);
    const line = (d * d * 8) % 1 < 0.06 || Math.abs(((u - 0.5) / Math.max(0.02, v - horizon + 0.02)) % 0.9) < 0.04;
    return line ? lerp(BG, GRID, 0.35) : lerp(BG, [5, 10, 36], 1);
  }
  const dx = u - 0.5;
  const dy = horizon - v;
  if (dx * dx + dy * dy < r * r) {
    const t = 1 - dy / r;
    if (t > 0.45 && ((dy * 100) % 7) < 1 + ((t - 0.45) / 0.55) * 3) return BG;
    return lerp(PLANET_TOP, PLANET_BOTTOM, t);
  }
  return BG;
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const ss = 3;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let i = 0; i < ss; i++)
        for (let j = 0; j < ss; j++) {
          const c = sample((x + (i + 0.5) / ss) / size, (y + (j + 0.5) / ss) / size);
          acc[0] += c[0];
          acc[1] += c[1];
          acc[2] += c[2];
        }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let k = 0; k < 3; k++) raw[o + k] = Math.round(acc[k] / (ss * ss));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(new URL(`../public/icons/${name}`, import.meta.url), png(size));
}
