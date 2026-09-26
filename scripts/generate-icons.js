// Dependency-free generator for the shared MindFlow brand mark.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const SUPERSAMPLE = 4;
const SIZES = [16, 48, 128];
const OUTPUTS = [
  path.join(ROOT, 'public', 'icons'),
  path.join(ROOT, 'zotero', 'chrome', 'content', 'icons'),
];

const COLORS = {
  background: [239, 244, 247],
  branch: [105, 127, 142],
  outline: [82, 111, 130],
  node: [250, 252, 253],
  center: [78, 119, 140],
};

function roundedRectDistance(x, y, halfSize, radius) {
  const qx = Math.abs(x - 0.5) - halfSize + radius;
  const qy = Math.abs(y - 0.5) - halfSize + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
    + Math.min(Math.max(qx, qy), 0) - radius;
}

function distanceToSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function sampleMark(x, y) {
  const cardDistance = roundedRectDistance(x, y, 0.48, 0.19);
  if (cardDistance > 0) return [0, 0, 0, 0];

  let color = COLORS.background;
  const center = [0.5, 0.5];
  const nodes = [[0.245, 0.245], [0.245, 0.755], [0.755, 0.245], [0.755, 0.755]];
  for (const [nx, ny] of nodes) {
    if (distanceToSegment(x, y, ...center, nx, ny) < 0.042) color = COLORS.branch;
  }

  for (const [nx, ny] of nodes) {
    const distance = Math.hypot(x - nx, y - ny);
    if (distance < 0.088) color = COLORS.outline;
    if (distance < 0.061) color = COLORS.node;
  }

  if (Math.hypot(x - center[0], y - center[1]) < 0.133) color = COLORS.outline;
  if (Math.hypot(x - center[0], y - center[1]) < 0.101) color = COLORS.center;
  return [...color, 255];
}

function makePNG(size) {
  const scale = SUPERSAMPLE;
  const highSize = size * scale;
  const high = Buffer.alloc(highSize * highSize * 4);

  for (let y = 0; y < highSize; y++) {
    for (let x = 0; x < highSize; x++) {
      const pixel = sampleMark((x + 0.5) / highSize, (y + 0.5) / highSize);
      const offset = (y * highSize + x) * 4;
      for (let channel = 0; channel < 4; channel++) high[offset + channel] = pixel[channel];
    }
  }

  const scanlineLength = 1 + size * 4;
  const raw = Buffer.alloc(scanlineLength * size);
  for (let y = 0; y < size; y++) {
    const rowOffset = y * scanlineLength;
    raw[rowOffset] = 0;
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0, 0];
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const source = (((y * scale + sy) * highSize) + x * scale + sx) * 4;
          for (let channel = 0; channel < 4; channel++) sum[channel] += high[source + channel];
        }
      }
      const samples = scale * scale;
      const alpha = Math.round(sum[3] / samples);
      const rgb = sum[3] > 0
        ? sum.slice(0, 3).map(value => Math.round(value / sum[3] * 255))
        : COLORS.background;
      const target = rowOffset + 1 + x * 4;
      raw[target] = rgb[0];
      raw[target + 1] = rgb[1];
      raw[target + 2] = rgb[2];
      raw[target + 3] = alpha;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', zlib.deflateSync(raw)),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeChunk(type, data) {
  const buffer = Buffer.alloc(12 + data.length);
  buffer.writeUInt32BE(data.length, 0);
  buffer.write(type, 4);
  data.copy(buffer, 8);
  buffer.writeUInt32BE(crc32(buffer.subarray(4, 8 + data.length)), 8 + data.length);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index++) {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  CRC_TABLE[index] = value >>> 0;
}

for (const output of OUTPUTS) {
  fs.mkdirSync(output, { recursive: true });
  for (const size of SIZES) {
    fs.writeFileSync(path.join(output, `icon${size}.png`), makePNG(size));
    console.log(`Generated ${path.relative(ROOT, output)}/icon${size}.png (${size}x${size})`);
  }
}
