import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ASSETS_DIR = path.resolve(process.cwd(), 'assets');

// CRC32 table for PNG chunks
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc(height * (1 + stride));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + stride);
    raw[rowStart] = 0; // filter None
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function sdRoundedRect(px, py, halfW, halfH, r) {
  const qx = Math.abs(px) - halfW + r;
  const qy = Math.abs(py) - halfH + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h);
}

/**
 * Signed distance to a circular arc with rounded caps.
 * Starts at startAngleRad, sweeps clockwise by sweepRad.
 */
function sdArc(px, py, radius, startAngleRad, sweepRad) {
  let angle = Math.atan2(py, px) - startAngleRad;
  while (angle < 0) angle += Math.PI * 2;
  while (angle >= Math.PI * 2) angle -= Math.PI * 2;

  if (angle <= sweepRad) {
    return Math.abs(Math.hypot(px, py) - radius);
  }
  const endAngle = startAngleRad + sweepRad;
  const dStart = Math.hypot(px - radius * Math.cos(startAngleRad), py - radius * Math.sin(startAngleRad));
  const dEnd = Math.hypot(px - radius * Math.cos(endAngle), py - radius * Math.sin(endAngle));
  return Math.min(dStart, dEnd);
}

function blendPixel(buf, idx, r, g, b, a) {
  if (a <= 0) return;
  const srcA = clamp(a, 0, 1);
  const dstA = buf[idx + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;
  buf[idx] = Math.round((r * srcA + buf[idx] * dstA * (1 - srcA)) / outA);
  buf[idx + 1] = Math.round((g * srcA + buf[idx + 1] * dstA * (1 - srcA)) / outA);
  buf[idx + 2] = Math.round((b * srcA + buf[idx + 2] * dstA * (1 - srcA)) / outA);
  buf[idx + 3] = Math.round(outA * 255);
}

function renderBrandPNG({
  size,
  bgColor = null,
  showSquircle = true,
  emblemScale = 1.0,
  monochrome = false,
}) {
  const buf = Buffer.alloc(size * size * 4);
  const aa = 1.25 / size; // ~1.25px anti-aliasing in normalized coords

  // Normalized geometry (centered at 0,0 in [-0.5, 0.5])
  const squircleHalf = 0.48 * emblemScale;
  const squircleRadius = 0.12 * emblemScale;
  const borderWidth = 0.008 * emblemScale;

  const trackR = 0.29 * emblemScale;
  const strokeHalf = 0.031 * emblemScale;
  const arcStart = -Math.PI / 2;
  const arcSweep = Math.PI * 2 * 0.68;

  // Checkmark segments matching BrandLogo viewBox (38.5,51.5 -> 46.5,59.5 -> 62.5,42.5)
  const s = emblemScale;
  const c1x = -0.115 * s;
  const c1y = 0.015 * s;
  const c2x = -0.035 * s;
  const c2y = 0.095 * s;
  const c3x = 0.125 * s;
  const c3y = -0.075 * s;
  const checkHalf = 0.035 * s;

  for (let y = 0; y < size; y++) {
    const py = (y + 0.5) / size - 0.5;
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) / size - 0.5;
      const idx = (y * size + x) * 4;

      if (bgColor) {
        buf[idx] = bgColor[0];
        buf[idx + 1] = bgColor[1];
        buf[idx + 2] = bgColor[2];
        buf[idx + 3] = 255;
      }

      if (showSquircle && !monochrome) {
        const dSq = sdRoundedRect(px, py, squircleHalf, squircleHalf, squircleRadius);
        const sqAlpha = 1 - smoothstep(-aa, aa, dSq);
        blendPixel(buf, idx, 11, 12, 14, sqAlpha); // #0B0C0E

        // Subtle inner border rgba(255, 255, 255, 0.08)
        const dBorder = Math.abs(dSq + borderWidth * 0.5) - borderWidth * 0.5;
        const borderAlpha = (1 - smoothstep(-aa, aa, dBorder)) * 0.08;
        blendPixel(buf, idx, 255, 255, 255, borderAlpha);
      }

      // Circular track
      const dTrack = Math.abs(Math.hypot(px, py) - trackR) - strokeHalf;
      const trackAlpha = 1 - smoothstep(-aa, aa, dTrack);
      if (monochrome) {
        blendPixel(buf, idx, 255, 255, 255, trackAlpha * 0.35);
      } else {
        blendPixel(buf, idx, 34, 37, 42, trackAlpha); // #22252A
      }

      // 68% Emerald arc
      const dArc = sdArc(px, py, trackR, arcStart, arcSweep) - strokeHalf;
      const arcAlpha = 1 - smoothstep(-aa, aa, dArc);
      if (monochrome) {
        blendPixel(buf, idx, 255, 255, 255, arcAlpha);
      } else {
        blendPixel(buf, idx, 16, 185, 129, arcAlpha); // #10B981
      }

      // White rounded checkmark
      const dCheck =
        Math.min(
          sdSegment(px, py, c1x, c1y, c2x, c2y),
          sdSegment(px, py, c2x, c2y, c3x, c3y)
        ) - checkHalf;
      const checkAlpha = 1 - smoothstep(-aa, aa, dCheck);
      blendPixel(buf, idx, 255, 255, 255, checkAlpha);
    }
  }

  return encodePNG(size, size, buf);
}

fs.mkdirSync(ASSETS_DIR, { recursive: true });

const outputs = [
  {
    file: 'icon.png',
    opts: { size: 1024, bgColor: [5, 6, 8], showSquircle: true, emblemScale: 0.96 },
  },
  {
    file: 'adaptive-icon.png',
    opts: { size: 1024, bgColor: null, showSquircle: false, emblemScale: 0.66 },
  },
  {
    file: 'splash-icon.png',
    opts: { size: 512, bgColor: null, showSquircle: false, emblemScale: 0.72 },
  },
  {
    file: 'notification-icon.png',
    opts: { size: 96, bgColor: null, showSquircle: false, emblemScale: 0.86, monochrome: true },
  },
];

for (const { file, opts } of outputs) {
  const png = renderBrandPNG(opts);
  const outPath = path.join(ASSETS_DIR, file);
  fs.writeFileSync(outPath, png);
  console.log(`Generated ${file} (${opts.size}x${opts.size}, ${png.length} bytes)`);
}
