// Pure Node.js PNG icon generator without external dependencies
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, drawPixel) {
  // RGBA buffer with 1 filter byte per scanline
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixel(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT chunk
  const idatChunk = makeChunk('IDAT', deflated);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4);
  data.copy(buf, 8);
  const crc = crc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

// Standard CRC32
function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

const table = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
  }
  table[i] = c;
}

// Icon design: Gradient blue rounded icon with modern mind map node connections
function drawMindMapIcon(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;
  const cx = 0.5, cy = 0.5;

  // Rounded rectangle background
  const r = 0.22;
  const dx = Math.max(Math.abs(nx - 0.5) - (0.5 - r), 0);
  const dy = Math.max(Math.abs(ny - 0.5) - (0.5 - r), 0);
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > r) {
    return [0, 0, 0, 0]; // Transparent outside
  }

  // Smooth antialiased border
  let alpha = 255;
  if (dist > r - 0.02) {
    alpha = Math.floor(255 * (1 - (dist - (r - 0.02)) / 0.02));
  }

  // Gradient background: from vibrant cyan #06b6d4 to brand blue #2563eb
  const grad = (nx + ny) * 0.5;
  let bgR = Math.floor(14 * (1 - grad) + 37 * grad);
  let bgG = Math.floor(165 * (1 - grad) + 99 * grad);
  let bgB = Math.floor(233 * (1 - grad) + 235 * grad);

  // Mind map nodes & branches:
  // Center node: (0.4, 0.5)
  // Child node 1: (0.75, 0.3)
  // Child node 2: (0.75, 0.7)
  const dCenter = Math.hypot(nx - 0.38, ny - 0.5);
  const dChild1 = Math.hypot(nx - 0.72, ny - 0.32);
  const dChild2 = Math.hypot(nx - 0.72, ny - 0.68);

  // Connection lines
  // Branch 1: from (0.38, 0.5) to (0.72, 0.32)
  // Branch 2: from (0.38, 0.5) to (0.72, 0.68)
  const inBranch1 = distToSegment(nx, ny, 0.38, 0.5, 0.72, 0.32) < 0.045;
  const inBranch2 = distToSegment(nx, ny, 0.38, 0.5, 0.72, 0.68) < 0.045;

  if (dCenter < 0.14 || dChild1 < 0.10 || dChild2 < 0.10 || inBranch1 || inBranch2) {
    return [255, 255, 255, alpha];
  }

  return [bgR, bgG, bgB, alpha];
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

const outDir = path.resolve('public/icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
  const png = createPNG(size, size, drawMindMapIcon);
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png (${size}x${size})`);
});
