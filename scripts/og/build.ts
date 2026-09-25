/**
 * Builds the social link-preview image, public/og.jpg (1200×630).
 *
 *   pnpm og:build
 *
 * Composes an SVG from the game tiles (public/art) and the logo, then
 * rasterises it with macOS QuickLook (qlmanage) — no extra dependencies.
 * Run `pnpm art:build` first if the tiles changed.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(HERE, '../../public');
const W = 1200;
const H = 630;
const TILES = ['chess', 'uno', 'connect-four', 'scrabble', 'snakes-ladders', 'ludo', 'crossword', 'memory-match', 'tetris'];
const FONT = `font-family="'Arial Rounded MT Bold', 'Helvetica Neue', Arial, sans-serif" font-weight="700"`;

const dataUri = (file: string) =>
  `data:image/svg+xml;base64,${fs.readFileSync(path.join(PUBLIC, file)).toString('base64')}`;

function tileGrid(): string {
  const size = 132;
  const gap = 18;
  return TILES.map((id, i) => {
    const x = (i % 3) * (size + gap);
    const y = Math.floor(i / 3) * (size + gap);
    return `<image href="${dataUri(`art/${id}.svg`)}" x="${x}" y="${y}" width="${size}" height="${size}"/>`;
  }).join('');
}

// QuickLook renders SVG user units at 1.5625× (it assumes 72dpi → 112.5dpi),
// so declare a smaller intrinsic size to land on exactly W px wide.
const QL_SCALE = 1.5625;
// QuickLook also renders into a square; draw on a W×W canvas with the design
// in the middle band so a centred crop lands exactly on it.
const BAND = (W - H) / 2;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W / QL_SCALE}" height="${W / QL_SCALE}" viewBox="0 0 ${W} ${W}">
<g transform="translate(0 ${BAND})">
<defs>
  <radialGradient id="warm" cx="0.12" cy="0" r="0.8"><stop offset="0" stop-color="#f0a83a" stop-opacity=".28"/><stop offset="1" stop-color="#f0a83a" stop-opacity="0"/></radialGradient>
  <radialGradient id="tomato" cx="1" cy="1" r="0.7"><stop offset="0" stop-color="#e85d4c" stop-opacity=".22"/><stop offset="1" stop-color="#e85d4c" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="#0c1916"/>
<rect width="${W}" height="${H}" fill="url(#warm)"/>
<rect width="${W}" height="${H}" fill="url(#tomato)"/>
<image href="${dataUri('favicon.svg')}" x="72" y="92" width="84" height="80"/>
<text x="72" y="264" font-size="82" fill="#f3efe6" ${FONT}>Noodle Quest</text>
<text x="72" y="338" font-size="38" fill="#f0a83a" ${FONT}>Brain games &amp; board games</text>
<text x="72" y="384" font-size="38" fill="#f0a83a" ${FONT}>for the whole family</text>
<text x="72" y="472" font-size="26" fill="#9bb5ab" ${FONT}>50+ games · play together on one device</text>
<text x="72" y="512" font-size="26" fill="#9bb5ab" ${FONT}>weekly family puzzle · lo-fi beats</text>
<g transform="translate(700 100) rotate(-6 216 216)">${tileGrid()}</g>
</g>
</svg>`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nq-og-'));
const src = path.join(tmp, 'og.svg');
fs.writeFileSync(src, svg);
execFileSync('qlmanage', ['-t', '-s', String(W), '-o', tmp, src], { stdio: 'ignore' });
const png = path.join(tmp, 'og.svg.png');
execFileSync('sips', ['--cropToHeightWidth', String(H), String(W), png], { stdio: 'ignore' });
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '86', png, '--out', path.join(PUBLIC, 'og.jpg')], { stdio: 'ignore' });
fs.rmSync(tmp, { recursive: true, force: true });
console.log('Wrote public/og.jpg');
