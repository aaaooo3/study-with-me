import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public');

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idatData = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function drawIcon(size, { padding = 0, background = '#2f6f4f' } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const [br, bg, bb] = hexToRgb(background);
  const radius = size * 0.22;
  const inset = padding;

  const insideRoundedRect = (x, y) => {
    const minX = inset;
    const minY = inset;
    const maxX = size - inset;
    const maxY = size - inset;
    if (x < minX || x >= maxX || y < minY || y >= maxY) return false;
    const cornerCheck = (cx, cy) => (x - cx) * (x - cx) + (y - cy) * (y - cy) <= radius * radius;
    if (x < minX + radius && y < minY + radius) return cornerCheck(minX + radius, minY + radius);
    if (x > maxX - radius && y < minY + radius) return cornerCheck(maxX - radius, minY + radius);
    if (x < minX + radius && y > maxY - radius) return cornerCheck(minX + radius, maxY - radius);
    if (x > maxX - radius && y > maxY - radius) return cornerCheck(maxX - radius, maxY - radius);
    return true;
  };

  // distance from point to segment, for drawing a checkmark
  const distToSegment = (px, py, ax, ay, bx, by) => {
    const abx = bx - ax;
    const aby = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)));
    const cx = ax + t * abx;
    const cy = ay + t * aby;
    return Math.hypot(px - cx, py - cy);
  };

  const s = size;
  const checkThickness = s * 0.075;
  // checkmark points (short leg then long leg)
  const p1 = [s * 0.28, s * 0.52];
  const p2 = [s * 0.44, s * 0.68];
  const p3 = [s * 0.74, s * 0.32];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      if (!insideRoundedRect(x, y)) {
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 0;
        continue;
      }
      const d1 = distToSegment(x, y, p1[0], p1[1], p2[0], p2[1]);
      const d2 = distToSegment(x, y, p2[0], p2[1], p3[0], p3[1]);
      const onCheck = d1 <= checkThickness || d2 <= checkThickness;
      if (onCheck) {
        rgba[idx] = 255;
        rgba[idx + 1] = 255;
        rgba[idx + 2] = 255;
        rgba[idx + 3] = 255;
      } else {
        rgba[idx] = br;
        rgba[idx + 1] = bg;
        rgba[idx + 2] = bb;
        rgba[idx + 3] = 255;
      }
    }
  }
  return rgba;
}

for (const size of [192, 512]) {
  const rgba = drawIcon(size, { padding: 0 });
  writeFileSync(join(outDir, `icon-${size}.png`), encodePNG(size, size, rgba));
}

// maskable icon needs more padding so the safe zone isn't clipped
const maskableRgba = drawIcon(512, { padding: 512 * 0.1 });
writeFileSync(join(outDir, 'icon-maskable-512.png'), encodePNG(512, 512, maskableRgba));

// apple touch icon (no transparency, iOS ignores alpha and shows black)
const appleRgba = drawIcon(180, { padding: 0 });
writeFileSync(join(outDir, 'apple-touch-icon.png'), encodePNG(180, 180, appleRgba));

console.log('Icons generated in public/');
