#!/usr/bin/env node
//
// make-icons.mjs — generate the app/PWA icons with zero dependencies.
//
// Draws a targeting-reticle mark (fitting for a counter-pick app) in the app's
// accent gold on the theme navy, anti-aliased via 3x supersampling, and writes:
//   public/assets/icon-192.png   PWA manifest icon
//   public/assets/icon-512.png   PWA manifest icon (maskable)
//   resources/icon.png (1024)    source for @capacitor/assets (Android launcher)
//
// Run: npm run make-icons

import { writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const NAVY = [0x0b, 0x13, 0x20];
const GOLD = [0xff, 0xb7, 0x03];
const SS = 3; // supersample factor for anti-aliasing

// Is the supersampled pixel (sx, sy) part of the reticle mark? Geometry is
// defined in normalized units (0..1 across the canvas) so it scales to any size.
function isMark(sx, sy, N) {
  const n = N * SS;
  const cx = (n - 1) / 2;
  const cy = (n - 1) / 2;
  const dx = sx - cx;
  const dy = sy - cy;
  const r = Math.hypot(dx, dy);
  const u = n; // 1.0 == full canvas width
  const ring = 0.34 * u;
  const ringHalf = 0.028 * u;
  const barHalf = 0.022 * u;
  const gap = 0.10 * u;
  const arm = 0.30 * u;
  const dot = 0.052 * u;
  if (Math.abs(r - ring) <= ringHalf) return true;            // outer ring
  if (Math.abs(dx) <= barHalf && r >= gap && r <= arm) return true; // vertical
  if (Math.abs(dy) <= barHalf && r >= gap && r <= arm) return true; // horizontal
  if (r <= dot) return true;                                  // center dot
  return false;
}

function renderRGBA(N) {
  const buf = Buffer.alloc(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let hits = 0;
      for (let oy = 0; oy < SS; oy++) {
        for (let ox = 0; ox < SS; ox++) {
          if (isMark(x * SS + ox, y * SS + oy, N)) hits++;
        }
      }
      const t = hits / (SS * SS); // mark coverage 0..1
      const i = (y * N + x) * 4;
      buf[i] = Math.round(NAVY[0] + (GOLD[0] - NAVY[0]) * t);
      buf[i + 1] = Math.round(NAVY[1] + (GOLD[1] - NAVY[1]) * t);
      buf[i + 2] = Math.round(NAVY[2] + (GOLD[2] - NAVY[2]) * t);
      buf[i + 3] = 0xff; // opaque (correct for maskable icons)
    }
  }
  return buf;
}

// ---- minimal PNG encoder (RGBA, no filtering) -----------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(N, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0);
  ihdr.writeUInt32BE(N, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10,11,12 = compression/filter/interlace = 0
  const stride = N * 4;
  const raw = Buffer.alloc((stride + 1) * N);
  for (let y = 0; y < N; y++) {
    raw[y * (stride + 1)] = 0; // filter type 0 (none)
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

async function main() {
  await mkdir(resolve(ROOT, 'public/assets'), { recursive: true });
  await mkdir(resolve(ROOT, 'resources'), { recursive: true });
  const targets = [
    [192, 'public/assets/icon-192.png'],
    [512, 'public/assets/icon-512.png'],
    [1024, 'resources/icon.png'],
  ];
  for (const [size, rel] of targets) {
    const png = encodePNG(size, renderRGBA(size));
    await writeFile(resolve(ROOT, rel), png);
    console.log(`  wrote ${rel.padEnd(30)} ${size}x${size}  ${png.length} bytes`);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
