// Board & word games.
import { C } from './palette.js';
import { cellGrid, letterTile, star, text, type Tile } from './shapes.js';

const unoCard = (rot: number, fill: string, label: string) => `
<g transform="rotate(${rot} 48 78)">
  <rect x="33" y="22" width="30" height="46" rx="6" fill="${C.cream}"/>
  <rect x="36" y="25" width="24" height="40" rx="4" fill="${fill}"/>
  <ellipse cx="48" cy="45" rx="9" ry="14" fill="${C.cream}" transform="rotate(25 48 45)"/>
  ${text(48, 51, 16, fill, label)}
</g>`;

const disc = (cx: number, cy: number, top: string, side: string) =>
  `<ellipse cx="${cx}" cy="${cy + 3}" rx="12" ry="8" fill="${side}"/>`
  + `<ellipse cx="${cx}" cy="${cy}" rx="12" ry="8" fill="${top}"/>`
  + `<ellipse cx="${cx}" cy="${cy}" rx="7" ry="4.5" fill="none" stroke="${C.cream}" stroke-opacity=".55" stroke-width="1.5"/>`;

export const BOARD_TILES: Record<string, Tile> = {
  chess: {
    category: 'board',
    draw: () => `
<rect x="30" y="70" width="36" height="8" rx="3" fill="${C.cream}"/>
<path d="M36 70 L41 44 H55 L60 70 Z" fill="${C.cream}"/>
<rect x="36" y="39" width="24" height="7" rx="3.5" fill="${C.gold}"/>
<circle cx="48" cy="31" r="8.5" fill="${C.cream}"/>
<rect x="45.5" y="10" width="5" height="15" rx="2" fill="${C.gold}"/>
<rect x="41" y="14.5" width="14" height="5" rx="2" fill="${C.gold}"/>`,
  },
  checkers: {
    category: 'board',
    draw: () => `
<rect x="15" y="33" width="66" height="51" rx="6" fill="${C.gold}"/>
${cellGrid(18, 36, 15, 0, [
  [C.cream, C.ink, C.cream, C.ink],
  [C.ink, C.cream, C.ink, C.cream],
  [C.cream, C.ink, C.cream, C.ink],
], 0)}
${disc(38, 44, C.tomato, '#a8412f')}
${disc(60, 66, C.cream, '#c9b89a')}
${disc(60, 57, C.cream, '#c9b89a')}
<path d="M52 49 l2.5 -9 5.5 5 5.5 -5 2.5 9 z" fill="${C.gold}" stroke="${C.ink}" stroke-width="1.2"/>`,
  },
  'connect-four': {
    category: 'board',
    draw: () => {
      const cells = [
        [C.ink, C.ink, C.gold, C.ink],
        [C.ink, C.tomato, C.gold, C.ink],
        [C.gold, C.tomato, C.tomato, C.gold],
      ];
      const discs = cells.flatMap((row, r) =>
        row.map((fill, c) => `<circle cx="${29 + c * 12.7}" cy="${38 + r * 13}" r="5.2" fill="${fill}"/>`)).join('');
      return `
<rect x="17" y="27" width="62" height="46" rx="8" fill="${C.sky}"/>
${discs}
<rect x="13" y="72" width="8" height="10" rx="2" fill="${C.sky}"/>
<rect x="75" y="72" width="8" height="10" rx="2" fill="${C.sky}"/>
<circle cx="61" cy="18" r="6" fill="${C.tomato}"/>`;
    },
  },
  'score-four': {
    category: 'board',
    draw: () => {
      const rod = (x: number, base: number) => `<rect x="${x - 1.5}" y="22" width="3" height="${base - 22}" rx="1.5" fill="${C.cream}"/>`;
      const bead = (x: number, y: number, fill: string) => `<ellipse cx="${x}" cy="${y}" rx="7.5" ry="6" fill="${fill}"/>`;
      return `
<path d="M48 58 L82 68 L48 80 L14 68 Z" fill="${C.sky}"/>
${rod(28, 66)}${rod(48, 74)}${rod(68, 66)}
${bead(28, 59, C.tomato)}${bead(28, 47, C.gold)}
${bead(48, 67, C.gold)}${bead(48, 55, C.tomato)}${bead(48, 43, C.gold)}
${bead(68, 59, C.tomato)}`;
    },
  },
  'tic-tac-toe': {
    category: 'board',
    draw: () => `
<path d="M38 18 V78 M58 18 V78 M18 38 H78 M18 58 H78" stroke="${C.cream}" stroke-width="4.5" fill="none"/>
<path d="M22 22 L34 34 M34 22 L22 34 M62 62 L74 74 M74 62 L62 74" stroke="${C.tomato}" stroke-width="5" fill="none"/>
<circle cx="48" cy="48" r="6.5" stroke="${C.gold}" stroke-width="5" fill="none"/>
<circle cx="68" cy="28" r="6.5" stroke="${C.gold}" stroke-width="5" fill="none"/>`,
  },
  ludo: {
    category: 'board',
    draw: () => `
<rect x="15" y="15" width="66" height="66" rx="9" fill="${C.cream}"/>
<rect x="19" y="19" width="24" height="24" rx="5" fill="${C.tomato}"/>
<rect x="53" y="19" width="24" height="24" rx="5" fill="${C.sky}"/>
<rect x="19" y="53" width="24" height="24" rx="5" fill="${C.mint}"/>
<rect x="53" y="53" width="24" height="24" rx="5" fill="${C.gold}"/>
<path d="M42 42 H54 L48 48 Z" fill="${C.sky}"/>
<path d="M54 42 V54 L48 48 Z" fill="${C.gold}"/>
<path d="M42 54 H54 L48 48 Z" fill="${C.mint}"/>
<path d="M42 42 V54 L48 48 Z" fill="${C.tomato}"/>
${[[31, 31], [65, 31], [31, 65], [65, 65]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${C.cream}"/>`).join('')}`,
  },
  'snakes-ladders': {
    category: 'board',
    draw: () => `
<g transform="rotate(-18 48 48)">
  <rect x="30" y="14" width="5" height="68" rx="2.5" fill="${C.gold}"/>
  <rect x="55" y="14" width="5" height="68" rx="2.5" fill="${C.gold}"/>
  ${[22, 34, 46, 58, 70].map(y => `<rect x="33" y="${y}" width="24" height="4.5" rx="2" fill="${C.gold}"/>`).join('')}
</g>
<path d="M22 74 C 30 62, 48 78, 56 64 S 70 42, 76 30" fill="none" stroke="${C.mint}" stroke-width="9"/>
<circle cx="77" cy="28" r="7" fill="${C.mint}"/>
<circle cx="79" cy="26" r="1.8" fill="${C.ink}"/>
<path d="M83 30 l5 2 m-5 -2 l4 4" stroke="${C.tomato}" stroke-width="1.6" fill="none"/>`,
  },
  uno: {
    category: 'board',
    draw: () => unoCard(-20, C.sky, '2') + unoCard(0, C.gold, '7') + unoCard(20, C.tomato, '+2'),
  },
  scrabble: {
    category: 'board',
    draw: () => `
${letterTile(13, 30, 23, 'F')}${letterTile(36.5, 26, 23, 'U')}${letterTile(60, 30, 23, 'N')}
${text(32, 51, 6, C.ink, '4')}${text(55.5, 47, 6, C.ink, '1')}${text(79, 51, 6, C.ink, '1')}
<path d="M10 58 H86 L80 70 H16 Z" fill="${C.gold}"/>`,
  },
  crossword: {
    category: 'board',
    draw: () => {
      const { ink: K, cream: W, gold: G } = C;
      return `
<rect x="15" y="15" width="66" height="66" rx="8" fill="${C.inkSoft}"/>
${cellGrid(18, 18, 11.2, 1.5, [
  [W, W, W, K, W],
  [W, K, W, K, W],
  [G, G, G, G, G],
  [W, K, W, K, W],
  [W, W, W, W, K],
], 2)}
${text(46.5, 51.5, 8.5, C.ink, 'C')}${text(59.2, 51.5, 8.5, C.ink, 'A')}${text(71.9, 51.5, 8.5, C.ink, 'T')}`;
    },
  },
  wordsearch: {
    category: 'board',
    draw: () => {
      const rows = ['QWIG', 'CATS', 'BLOP', 'ZEMU'];
      const letters = rows.flatMap((row, r) =>
        [...row].map((ch, c) => text(24 + c * 11, 31 + r * 12, 9, C.ink, ch))).join('');
      return `
<rect x="14" y="16" width="56" height="56" rx="8" fill="${C.cream}"/>
<rect x="18" y="34" width="46" height="11" rx="5.5" fill="${C.mint}"/>
${letters}
<circle cx="62" cy="58" r="13" fill="${C.cream}" fill-opacity=".25" stroke="${C.gold}" stroke-width="6"/>
<path d="M72 68 L82 78" stroke="${C.gold}" stroke-width="8"/>`;
    },
  },
  'word-guess': {
    category: 'board',
    draw: () => {
      const row = (y: number, word: string, fills: string[]) => [...word].map((ch, i) =>
        letterTile(12 + i * 15, y, 13, ch, fills[i], C.cream)).join('');
      const { inkSoft: X, gold: Y, mint: G } = C;
      return row(28, 'CRANE', [X, Y, X, G, X]) + row(45, 'SMILE', [G, G, G, G, G]) +
        [0, 1, 2, 3, 4].map(i => `<rect x="${12 + i * 15}" y="62" width="13" height="13" rx="2.6" fill="none" stroke="${C.cream}" stroke-opacity=".5" stroke-width="1.5"/>`).join('');
    },
  },
  bingo: {
    category: 'board',
    draw: () => `
<g transform="rotate(-8 36 42)">
  <rect x="14" y="16" width="42" height="50" rx="6" fill="${C.cream}"/>
  ${[0, 1, 2].flatMap(r => [0, 1, 2].map(c =>
    `<circle cx="${24 + c * 11}" cy="${30 + r * 12}" r="4" fill="${(r + c) % 2 === 0 ? C.gold : C.inkSoft}" fill-opacity="${(r + c) % 2 === 0 ? 1 : 0.25}"/>`)).join('')}
</g>
<circle cx="60" cy="58" r="20" fill="${C.tomato}"/>
<circle cx="60" cy="58" r="11" fill="${C.cream}"/>
${text(60, 63.5, 14, C.ink, '7')}`,
  },
  bookworm: {
    category: 'board',
    draw: () => `
<path d="M12 72 Q30 64 48 70 Q66 64 84 72 V80 Q66 72 48 78 Q30 72 12 80 Z" fill="${C.tomato}"/>
<path d="M16 68 Q31 61 48 66 V74 Q31 69 16 76 Z" fill="${C.cream}"/>
<path d="M80 68 Q65 61 48 66 V74 Q65 69 80 76 Z" fill="${C.cream}"/>
<circle cx="46" cy="60" r="7" fill="${C.mint}"/>
<circle cx="50" cy="49" r="7" fill="${C.mint}"/>
<circle cx="54" cy="38" r="7" fill="${C.mint}"/>
<circle cx="56" cy="25" r="10" fill="${C.mint}"/>
<circle cx="53" cy="23" r="2" fill="${C.ink}"/><circle cx="60" cy="23" r="2" fill="${C.ink}"/>
<circle cx="50.5" cy="28" r="2" fill="${C.berry}"/><circle cx="62.5" cy="28" r="2" fill="${C.berry}"/>`,
  },
  'connect-lines': {
    category: 'board',
    draw: () => `
<path d="M18 34 H38 Q48 34 48 44 V58 Q48 68 58 68 H78" stroke="${C.cream}" stroke-width="10" fill="none"/>
<path d="M62 18 V30 Q62 40 72 40 H80" stroke="${C.sky}" stroke-width="10" fill="none"/>
<circle cx="18" cy="34" r="7" fill="${C.gold}"/>
<circle cx="78" cy="68" r="7" fill="${C.gold}"/>
<circle cx="48" cy="51" r="4" fill="${C.mint}"/>`,
  },
  '2048': {
    category: 'board',
    draw: () => `
<rect x="18" y="18" width="28" height="28" rx="6" fill="${C.tomato}"/>
<rect x="50" y="18" width="28" height="28" rx="6" fill="${C.tomato}"/>
${text(32, 36, 10, C.cream, '1024')}${text(64, 36, 10, C.cream, '1024')}
<rect x="18" y="50" width="60" height="28" rx="6" fill="${C.gold}"/>
${text(48, 70, 17, C.ink, '2048')}`,
  },
  minesweeper: {
    category: 'board',
    draw: () => {
      const { cream: W, sky: S } = C;
      return `
${cellGrid(17, 17, 19, 2.5, [[W, W, S], [W, W, S], [S, S, S]], 4)}
${text(26.5, 32.5, 12, C.sky, '1')}${text(48, 32.5, 12, C.mint, '2')}${text(26.5, 54, 12, C.sky, '1')}
<circle cx="48" cy="47.5" r="6" fill="${C.ink}"/>
<path d="M48 38 V57 M38.5 47.5 H57.5 M41.3 40.8 L54.7 54.2 M54.7 40.8 L41.3 54.2" stroke="${C.ink}" stroke-width="2.2"/>
<circle cx="46" cy="45.5" r="1.6" fill="${C.cream}"/>
<path d="M68 23 V37" stroke="${C.ink}" stroke-width="2"/>
<path d="M68.5 23 L76 27 L68.5 31 Z" fill="${C.tomato}"/>
${star(69.5, 69.5, 6, C.gold)}`;
    },
  },
};
