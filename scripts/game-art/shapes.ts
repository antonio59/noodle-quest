// Small drawing helpers shared by the tile files.
import { C, FONT, type Category } from './palette.js';

export interface Tile {
  category: Category;
  draw: () => string;
}

export const text = (x: number, y: number, size: number, fill: string, s: string) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="middle" ${FONT}>${s}</text>`;

/** A lettered tile (Scrabble / word games). */
export const letterTile = (x: number, y: number, size: number, letter: string, fill: string = C.cream, ink: string = C.ink) =>
  `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.2}" fill="${fill}"/>`
  + text(x + size / 2, y + size * 0.72, size * 0.62, ink, letter);

/** Five-point star centred on (cx, cy). */
export function star(cx: number, cy: number, r: number, fill: string): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const rad = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    return `${(cx + rr * Math.cos(rad)).toFixed(1)},${(cy + rr * Math.sin(rad)).toFixed(1)}`;
  });
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
}

/** Grid of square cells; `fills[r][c]` gives each cell's colour. */
export function cellGrid(x: number, y: number, cell: number, gap: number, fills: string[][], radius = 2): string {
  return fills.flatMap((row, r) => row.map((fill, c) =>
    `<rect x="${x + c * (cell + gap)}" y="${y + r * (cell + gap)}" width="${cell}" height="${cell}" rx="${radius}" fill="${fill}"/>`,
  )).join('');
}
