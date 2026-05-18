/**
 * Genera icon-192.png e icon-512.png a partir de icon.svg usando sharp.
 * Uso: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir  = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dir, '../public/icons/icon.svg');
const outDir  = join(__dir, '../public/icons');
mkdirSync(outDir, { recursive: true });

const svg = readFileSync(svgPath);

for (const size of [192, 512]) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(outDir, `icon-${size}.png`));
  console.log(`✓ icon-${size}.png`);
}
