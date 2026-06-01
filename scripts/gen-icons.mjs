// Generates app icons (PWA + native source) from the brand SVG using sharp.
// Run: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BLUE = "#243FF7";
const YELLOW = "#E2FF04";

const iconSvg = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="${BLUE}"/>
  <circle cx="512" cy="512" r="296" fill="${YELLOW}"/>
  <path d="M512 300 L702 716 L512 626 L322 716 Z" fill="${BLUE}"/>
</svg>`;

// Maskable icon: keep mark inside the safe zone (smaller mark, full-bleed blue).
const maskableSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="${BLUE}"/>
  <circle cx="512" cy="512" r="236" fill="${YELLOW}"/>
  <path d="M512 348 L664 680 L512 608 L360 680 Z" fill="${BLUE}"/>
</svg>`;

const splashSvg = (size) => `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${BLUE}"/>
  <g transform="translate(${size / 2 - 160}, ${size / 2 - 160})">
    <circle cx="160" cy="160" r="120" fill="${YELLOW}"/>
    <path d="M160 70 L235 235 L160 199 L85 235 Z" fill="${BLUE}"/>
  </g>
</svg>`;

async function png(svg, size, outPath) {
  const full = resolve(root, outPath);
  mkdirSync(dirname(full), { recursive: true });
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(full);
  console.log("wrote", outPath);
}

await Promise.all([
  // PWA / web icons
  png(iconSvg(192), 192, "client/public/icons/icon-192.png"),
  png(iconSvg(512), 512, "client/public/icons/icon-512.png"),
  png(maskableSvg, 512, "client/public/icons/maskable-512.png"),
  png(iconSvg(180), 180, "client/public/icons/apple-touch-icon.png"),
  png(iconSvg(32), 32, "client/public/favicon.png"),
  // Native source assets for `@capacitor/assets generate`
  png(iconSvg(1024), 1024, "resources/icon.png"),
  png(maskableSvg, 1024, "resources/icon-foreground.png"),
  png(splashSvg(2732), 2732, "resources/splash.png"),
  png(splashSvg(2732), 2732, "resources/splash-dark.png"),
]);

console.log("\nAll icons generated.");
