// Dependency-free generator for the MindFlow MapGraph (星轨拓扑) icon set.
// Renders clean, transparent-background icons with optical padding.
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
  branch: [2, 132, 199],        // #0284C7
  center: [2, 132, 199],        // #0284C7
  centerDark: [3, 105, 161],    // #0369A1
  nodeN: [2, 132, 199],         // #0284C7
  nodeNE: [6, 182, 212],        // #06B6D4
  nodeE: [14, 165, 233],        // #0EA5E9
  nodeSE: [99, 102, 241],       // #6366F1
  nodeS: [2, 132, 199],         // #0284C7
  nodeSW: [139, 92, 246],       // #8B5CF6
  nodeW: [14, 165, 233],        // #0EA5E9
  nodeNW: [6, 182, 212],        // #06B6D4
  white: [255, 255, 255],
};

function distanceToSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

const NODES = [
  { pos: [0.5, 0.225], r: 0.058, color: COLORS.nodeN },
  { pos: [0.680, 0.320], r: 0.048, color: COLORS.nodeNE },
  { pos: [0.775, 0.5], r: 0.058, color: COLORS.nodeE },
  { pos: [0.680, 0.680], r: 0.048, color: COLORS.nodeSE },
  { pos: [0.5, 0.775], r: 0.058, color: COLORS.nodeS },
  { pos: [0.320, 0.680], r: 0.048, color: COLORS.nodeSW },
  { pos: [0.225, 0.5], r: 0.058, color: COLORS.nodeW },
  { pos: [0.320, 0.320], r: 0.048, color: COLORS.nodeNW },
];

function sampleMark(x, y) {
  const center = [0.5, 0.5];
  let hit = false;
  let color = [0, 0, 0];

  // 1. Branch connection lines
  for (const node of NODES) {
    if (distanceToSegment(x, y, center[0], center[1], node.pos[0], node.pos[1]) < 0.024) {
      color = COLORS.branch;
      hit = true;
    }
  }

  // 2. Satellite nodes
  for (const node of NODES) {
    const dist = Math.hypot(x - node.pos[0], y - node.pos[1]);
    if (dist < node.r + 0.016) {
      color = COLORS.white;
      hit = true;
    }
    if (dist < node.r) {
      color = node.color;
      hit = true;
    }
  }

  // 3. Central core node
  const centerDist = Math.hypot(x - center[0], y - center[1]);
  if (centerDist < 0.125 + 0.018) {
    color = COLORS.white;
    hit = true;
  }
  if (centerDist < 0.125) {
    const ct = (x - (center[0] - 0.125)) / 0.25;
    color = [
      Math.round(COLORS.center[0] * (1 - ct) + COLORS.centerDark[0] * ct),
      Math.round(COLORS.center[1] * (1 - ct) + COLORS.centerDark[1] * ct),
      Math.round(COLORS.center[2] * (1 - ct) + COLORS.centerDark[2] * ct),
    ];
    hit = true;
  }

  // 4. Inner white network motif
  const p1 = [0.46, 0.54];
  const p2 = [0.5, 0.5];
  const p3 = [0.54, 0.46];

  if (distanceToSegment(x, y, p1[0], p1[1], p2[0], p2[1]) < 0.014 ||
      distanceToSegment(x, y, p2[0], p2[1], p3[0], p3[1]) < 0.014) {
    color = COLORS.white;
    hit = true;
  }
  if (Math.hypot(x - p1[0], y - p1[1]) < 0.022 ||
      Math.hypot(x - p2[0], y - p2[1]) < 0.028 ||
      Math.hypot(x - p3[0], y - p3[1]) < 0.022) {
    color = COLORS.white;
    hit = true;
  }

  return hit ? [...color, 255] : [0, 0, 0, 0];
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
        : [0, 0, 0];
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
