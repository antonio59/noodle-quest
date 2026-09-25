/**
 * Builds the illustrated game tiles in public/art/<gameId>.svg.
 *
 *   pnpm art:build
 *
 * Each tile is a category-tinted rounded square with a soft highlight and a
 * flat foreground drawn in tiles.ts. Edit the palette or a drawing there and
 * re-run — the SVGs are generated, don't hand-edit them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORY_BG } from './palette.js';
import { TILES } from './tiles.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../public/art');

function tile(bg: [string, string], foreground: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient>
<filter id="lift" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="2.5" stdDeviation="0.6" flood-color="#0b1a16" flood-opacity=".35"/></filter>
<clipPath id="tile"><rect width="96" height="96" rx="24"/></clipPath>
</defs>
<rect width="96" height="96" rx="24" fill="url(#bg)"/>
<circle cx="18" cy="8" r="48" fill="#fff" opacity=".07" clip-path="url(#tile)"/>
<g filter="url(#lift)" stroke-linecap="round" stroke-linejoin="round">${foreground}</g>
</svg>
`;
}

fs.mkdirSync(OUT, { recursive: true });
for (const [id, { category, draw }] of Object.entries(TILES)) {
  fs.writeFileSync(path.join(OUT, `${id}.svg`), tile(CATEGORY_BG[category], draw()));
}
console.log(`Wrote ${Object.keys(TILES).length} tiles to ${path.relative(process.cwd(), OUT)}`);
