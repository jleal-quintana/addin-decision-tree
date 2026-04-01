/**
 * Generates placeholder PNG icons for the add-in.
 * Run with: node scripts/generate-icons.js
 *
 * Creates minimal valid PNGs with a decision tree icon (square + circle).
 * For production, replace with proper designed icons.
 */
const fs = require("fs");
const path = require("path");

// Minimal 1x1 white PNG as fallback
// In production, use a proper icon design tool
const sizes = [16, 32, 80];
const assetsDir = path.join(__dirname, "..", "assets");

// Create a minimal valid PNG file
function createMinimalPng(size) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);  // width
  ihdrData.writeUInt32BE(size, 4);  // height
  ihdrData.writeUInt8(8, 8);        // bit depth
  ihdrData.writeUInt8(2, 9);        // color type (RGB)
  ihdrData.writeUInt8(0, 10);       // compression
  ihdrData.writeUInt8(0, 11);       // filter
  ihdrData.writeUInt8(0, 12);       // interlace
  const ihdr = createChunk("IHDR", ihdrData);

  // IDAT chunk - simple uncompressed blue square
  const rawData = [];
  for (let y = 0; y < size; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < size; x++) {
      // Simple blue/white icon pattern
      const cx = size / 2;
      const cy = size / 2;
      const r = size * 0.35;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < r * r) {
        rawData.push(68, 114, 196); // #4472C4 blue
      } else {
        rawData.push(255, 255, 255); // white
      }
    }
  }

  const raw = Buffer.from(rawData);
  // Use zlib to deflate
  const zlib = require("zlib");
  const compressed = zlib.deflateSync(raw);
  const idat = createChunk("IDAT", compressed);

  // IEND chunk
  const iend = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type);
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

for (const size of sizes) {
  const png = createMinimalPng(size);
  const filename = `icon-${size}.png`;
  fs.writeFileSync(path.join(assetsDir, filename), png);
  console.log(`Generated ${filename} (${png.length} bytes)`);
}

// Also create logo-filled
const logo = createMinimalPng(80);
fs.writeFileSync(path.join(assetsDir, "logo-filled.png"), logo);
console.log("Generated logo-filled.png");
