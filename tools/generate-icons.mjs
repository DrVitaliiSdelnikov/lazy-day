// Generate placeholder PWA icons as simple colored PNGs
// Run: node tools/generate-icons.mjs

import { writeFileSync } from 'fs';

function createPNG(size) {
  // Minimal valid PNG: colored square with "LD" text
  // Using raw PNG generation (no dependencies needed)

  const width = size;
  const height = size;

  // Create raw RGBA pixel data
  const pixels = Buffer.alloc(width * height * 4);

  // Background: #2F6FED (accent blue)
  const bgR = 0x2F, bgG = 0x6F, bgB = 0xED;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      // Simple circle mask
      const cx = width / 2, cy = height / 2, r = width * 0.42;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

      if (dist < r) {
        // Inside circle: accent color
        pixels[i] = bgR;
        pixels[i + 1] = bgG;
        pixels[i + 2] = bgB;
        pixels[i + 3] = 255;
      } else if (dist < r + 2) {
        // Anti-alias edge
        const alpha = Math.max(0, Math.min(255, Math.round((r + 2 - dist) * 127)));
        pixels[i] = bgR;
        pixels[i + 1] = bgG;
        pixels[i + 2] = bgB;
        pixels[i + 3] = alpha;
      } else {
        // Outside: transparent
        pixels[i] = 0;
        pixels[i + 1] = 0;
        pixels[i + 2] = 0;
        pixels[i + 3] = 0;
      }

      // Draw "L" letter (simple block letter in center)
      const letterSize = Math.floor(width * 0.3);
      const letterX = Math.floor(width * 0.35);
      const letterY = Math.floor(height * 0.3);
      const thick = Math.max(2, Math.floor(width * 0.06));

      const inVerticalBar = x >= letterX && x < letterX + thick && y >= letterY && y < letterY + letterSize;
      const inHorizontalBar = x >= letterX && x < letterX + letterSize && y >= letterY + letterSize - thick && y < letterY + letterSize;

      if ((inVerticalBar || inHorizontalBar) && dist < r) {
        pixels[i] = 255;
        pixels[i + 1] = 255;
        pixels[i + 2] = 255;
        pixels[i + 3] = 255;
      }
    }
  }

  return encodePNG(width, height, pixels);
}

function encodePNG(width, height, pixels) {
  // Minimal PNG encoder
  const { deflateSync } = await import('zlib').catch(() => require('zlib'));

  // Build raw image data with filter byte
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter: none
    pixels.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = deflateSync(rawData);

  // PNG structure
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const typeBuffer = Buffer.from(type);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const combined = Buffer.concat([typeBuffer, data]);
    const crc = crc32(combined);
    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc >>> 0);
    return Buffer.concat([length, combined, crcBuffer]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return crc ^ 0xFFFFFFFF;
}

// Generate
import('zlib').then(({ deflateSync: _deflateSync }) => {
  // Monkey-patch for ESM
  globalThis._deflateSync = _deflateSync;

  for (const size of [192, 512]) {
    const png = createPNGSync(size);
    writeFileSync(`public/icons/icon-${size}.png`, png);
    writeFileSync(`public/icons/icon-${size}-maskable.png`, png);
    console.log(`Generated icon-${size}.png`);
  }
});

function createPNGSync(size) {
  const { deflateSync } = require('zlib');

  const width = size, height = size;
  const pixels = Buffer.alloc(width * height * 4);
  const bgR = 0x2F, bgG = 0x6F, bgB = 0xED;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const cx = width / 2, cy = height / 2, r = width * 0.42;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

      if (dist < r) {
        pixels[i] = bgR; pixels[i+1] = bgG; pixels[i+2] = bgB; pixels[i+3] = 255;
      }

      // "L" letter
      const ls = Math.floor(width * 0.3);
      const lx = Math.floor(width * 0.35), ly = Math.floor(height * 0.3);
      const t = Math.max(2, Math.floor(width * 0.06));
      if (((x >= lx && x < lx+t && y >= ly && y < ly+ls) ||
           (x >= lx && x < lx+ls && y >= ly+ls-t && y < ly+ls)) && dist < r) {
        pixels[i] = 255; pixels[i+1] = 255; pixels[i+2] = 255; pixels[i+3] = 255;
      }
    }
  }

  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0;
    pixels.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = deflateSync(rawData);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const tb = Buffer.from(type);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const combined = Buffer.concat([tb, data]);
    const c = crc32(combined);
    const cb = Buffer.alloc(4); cb.writeUInt32BE(c >>> 0);
    return Buffer.concat([len, combined, cb]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;

  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}
