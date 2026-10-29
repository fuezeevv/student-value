import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const publicDir = path.join(projectRoot, "public");
const appDir = path.join(projectRoot, "src", "app");

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Canonical Brand Mark with navy contrast disk
const brandSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <circle cx="24" cy="24" r="24" fill="#0b1222"/>
  <path d="M5 29C4 16 17 4 31 7C43 10 42 20 31 23C21 26 15 22 12 32C10 38 6 36 5 29Z" fill="#3378ff"/>
  <path d="M12 34C14 23 25 29 34 20C41 13 46 23 40 33C35 42 20 46 12 39C10 37 11 36 12 34Z" fill="#dcecff"/>
  <path d="M32 30C38 28 43 30 40 35C38 40 31 43 25 42C21 41 27 32 32 30Z" fill="#9b304d"/>
</svg>`;

// Maskable Brand Mark (with 18% safe-zone margin for Android adaptive icon clipping)
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" fill="#0b1222"/>
  <g transform="translate(8, 8)">
    <circle cx="24" cy="24" r="23" fill="#111c30"/>
    <path d="M5 29C4 16 17 4 31 7C43 10 42 20 31 23C21 26 15 22 12 32C10 38 6 36 5 29Z" fill="#3378ff"/>
    <path d="M12 34C14 23 25 29 34 20C41 13 46 23 40 33C35 42 20 46 12 39C10 37 11 36 12 34Z" fill="#dcecff"/>
    <path d="M32 30C38 28 43 30 40 35C38 40 31 43 25 42C21 41 27 32 32 30Z" fill="#9b304d"/>
  </g>
</svg>`;

// 1. Write SVG icons
fs.writeFileSync(path.join(publicDir, "icon.svg"), brandSvg, "utf8");
fs.writeFileSync(path.join(appDir, "icon.svg"), brandSvg, "utf8");
console.log("✓ Saved icon.svg (public & src/app)");

// 2. Generate PNGs at multiple sizes
const svgBuffer = Buffer.from(brandSvg);
const maskableBuffer = Buffer.from(maskableSvg);

const png16 = await sharp(svgBuffer).resize(16, 16).png().toBuffer();
const png32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
const png48 = await sharp(svgBuffer).resize(48, 48).png().toBuffer();
const png180 = await sharp(svgBuffer).resize(180, 180).png().toBuffer();
const png192 = await sharp(svgBuffer).resize(192, 192).png().toBuffer();
const png512 = await sharp(svgBuffer).resize(512, 512).png().toBuffer();

const maskable192 = await sharp(maskableBuffer).resize(192, 192).png().toBuffer();
const maskable512 = await sharp(maskableBuffer).resize(512, 512).png().toBuffer();

// Save Apple Touch Icon (180x180)
fs.writeFileSync(path.join(publicDir, "apple-icon.png"), png180);
fs.writeFileSync(path.join(appDir, "apple-icon.png"), png180);
console.log("✓ Saved apple-icon.png (180x180, public & src/app)");

// Save standard & maskable PWA icons
fs.writeFileSync(path.join(publicDir, "icon-192.png"), png192);
fs.writeFileSync(path.join(publicDir, "icon-512.png"), png512);
fs.writeFileSync(path.join(publicDir, "icon-maskable-192.png"), maskable192);
fs.writeFileSync(path.join(publicDir, "icon-maskable-512.png"), maskable512);
console.log("✓ Saved icon-192/512 and icon-maskable-192/512 (Android adaptive)");

// 3. Create Multi-Resolution ICO file (16x16, 32x32, 48x48)
function createMultiIco(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // icon type
  header.writeUInt16LE(count, 4); // image count

  let currentOffset = 6 + count * 16;
  const dirEntries = [];
  const buffers = [];

  for (const { size, buffer } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // width
    entry.writeUInt8(size === 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(buffer.length, 8); // image size
    entry.writeUInt32LE(currentOffset, 12); // file offset

    dirEntries.push(entry);
    buffers.push(buffer);
    currentOffset += buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...buffers]);
}

const multiIco = createMultiIco([
  { size: 16, buffer: png16 },
  { size: 32, buffer: png32 },
  { size: 48, buffer: png48 },
]);

fs.writeFileSync(path.join(publicDir, "favicon.ico"), multiIco);
fs.writeFileSync(path.join(appDir, "favicon.ico"), multiIco);
console.log("✓ Saved multi-resolution favicon.ico (16, 32, 48px, public & src/app)");

// 4. Generate OpenGraph Image (1200x630)
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#070b14"/>
  <rect x="20" y="20" width="1160" height="590" rx="24" fill="#0b1222" stroke="#1d2d4c" stroke-width="2"/>
  
  <!-- Subtle decorative grid -->
  <g opacity="0.06" stroke="#dcecff" stroke-width="1">
    <line x1="80" y1="0" x2="80" y2="630"/>
    <line x1="200" y1="0" x2="200" y2="630"/>
    <line x1="400" y1="0" x2="400" y2="630"/>
    <line x1="800" y1="0" x2="800" y2="630"/>
    <line x1="1000" y1="0" x2="1000" y2="630"/>
    <line x1="0" y1="150" x2="1200" y2="150"/>
    <line x1="0" y1="315" x2="1200" y2="315"/>
    <line x1="0" y1="480" x2="1200" y2="480"/>
  </g>

  <!-- Brand Mark Icon -->
  <g transform="translate(100, 195) scale(5)">
    <circle cx="24" cy="24" r="24" fill="#142139"/>
    <path d="M5 29C4 16 17 4 31 7C43 10 42 20 31 23C21 26 15 22 12 32C10 38 6 36 5 29Z" fill="#3378ff"/>
    <path d="M12 34C14 23 25 29 34 20C41 13 46 23 40 33C35 42 20 46 12 39C10 37 11 36 12 34Z" fill="#dcecff"/>
    <path d="M32 30C38 28 43 30 40 35C38 40 31 43 25 42C21 41 27 32 32 30Z" fill="#9b304d"/>
  </g>

  <!-- Typography -->
  <text x="380" y="270" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="20" fill="#3378ff" letter-spacing="3">СПбПУ · 5130901/40102</text>
  <text x="380" y="345" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="64" fill="#ffffff">Student Value <tspan fill="#3378ff">1.984</tspan></text>
  <text x="380" y="415" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="400" font-size="26" fill="#8ca5cb">Работы, сроки и материалы вашей группы</text>
  <text x="380" y="455" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="400" font-size="22" fill="#58759f">Всё для ежедневной учёбы · studentvalue1984.eu.cc</text>
</svg>`;

const ogPng = await sharp(Buffer.from(ogSvg)).resize(1200, 630).png().toBuffer();
fs.writeFileSync(path.join(appDir, "opengraph-image.png"), ogPng);
fs.writeFileSync(path.join(publicDir, "og-image.png"), ogPng);
console.log("✓ Saved opengraph-image.png (1200x630, public & src/app)");

console.log("✨ All brand icons and favicons generated successfully!");
