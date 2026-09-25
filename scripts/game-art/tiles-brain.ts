// Brain games: memory, focus, flexibility, motor.
import { C } from './palette.js';
import { cellGrid, letterTile, star, text, type Tile } from './shapes.js';

const bubble = (cx: number, cy: number, r: number, stroke: string = C.cream) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${stroke}" fill-opacity=".18" stroke="${stroke}" stroke-width="3"/>`
  + `<path d="M${cx - r * 0.5} ${cy - r * 0.15} a${r * 0.55} ${r * 0.55} 0 0 1 ${r * 0.4} -${r * 0.4}" stroke="${C.cream}" stroke-width="2.4" fill="none"/>`;

export const BRAIN_TILES: Record<string, Tile> = {
  // ── Memory ───────────────────────────────────────────────────────
  anagram: {
    category: 'memory',
    draw: () => `
<g transform="rotate(-12 26 52)">${letterTile(14, 40, 24, 'T')}</g>
<g transform="rotate(6 48 38)">${letterTile(36, 26, 24, 'A')}</g>
<g transform="rotate(14 70 56)">${letterTile(58, 44, 24, 'C', C.gold)}</g>
<path d="M22 30 Q30 14 46 16" stroke="${C.mint}" stroke-width="3.5" fill="none"/>
<path d="M42 11 l5 5 -6 3" stroke="${C.mint}" stroke-width="3.5" fill="none"/>
<path d="M76 38 Q82 26 72 18" stroke="${C.mint}" stroke-width="3.5" fill="none"/>`,
  },
  'copy-cat': {
    category: 'memory',
    draw: () => `
<path d="M28 34 L30 16 L44 28 Z M68 34 L66 16 L52 28 Z" fill="${C.cream}"/>
<path d="M31 30 L32 21 L39 27 Z M65 30 L64 21 L57 27 Z" fill="${C.berry}"/>
<ellipse cx="48" cy="48" rx="24" ry="21" fill="${C.cream}"/>
<ellipse cx="39" cy="45" rx="3.5" ry="4.5" fill="${C.ink}"/>
<ellipse cx="57" cy="45" rx="3.5" ry="4.5" fill="${C.ink}"/>
<path d="M45 53 h6 l-3 3 z" fill="${C.berry}"/>
<path d="M48 56 q-4 5 -8 2 M48 56 q4 5 8 2" stroke="${C.ink}" stroke-width="2" fill="none"/>
<path d="M18 80 H40 M34 75 l6 5 -6 5 M78 80 H56 M62 75 l-6 5 6 5" stroke="${C.gold}" stroke-width="3.5" fill="none"/>`,
  },
  'dual-n-back': {
    category: 'memory',
    draw: () => {
      const { inkSoft: D, gold: G } = C;
      return `
${cellGrid(16, 24, 14, 3, [[D, D, D], [D, G, D], [D, D, D]], 3)}
<rect x="62" y="30" width="22" height="22" rx="11" fill="${C.cream}"/>
${text(73, 47, 16, C.ink, 'N')}
<path d="M66 60 q7 8 14 0" stroke="${C.mint}" stroke-width="3" fill="none"/>
<path d="M62 66 q11 12 22 0" stroke="${C.mint}" stroke-width="3" fill="none" opacity=".6"/>`;
    },
  },
  'fill-blank': {
    category: 'memory',
    draw: () => `
${letterTile(12, 34, 22, 'C')}
<rect x="37" y="34" width="22" height="22" rx="4.4" fill="none" stroke="${C.gold}" stroke-width="3" stroke-dasharray="4 3"/>
${letterTile(62, 34, 22, 'T')}
<g transform="rotate(35 58 66)">
  <rect x="50" y="56" width="10" height="30" rx="2" fill="${C.gold}"/>
  <path d="M50 86 L55 95 L60 86 Z" fill="${C.cream}"/>
  <rect x="50" y="52" width="10" height="6" rx="2" fill="${C.berry}"/>
</g>`,
  },
  'flag-match': {
    category: 'memory',
    draw: () => `
<rect x="20" y="18" width="4" height="62" rx="2" fill="${C.cream}"/>
<path d="M24 20 H48 L42 30 L48 40 H24 Z" fill="${C.tomato}"/>
<rect x="56" y="30" width="4" height="50" rx="2" fill="${C.cream}"/>
<path d="M60 32 H82 L76 41 L82 50 H60 Z" fill="${C.mint}"/>
<circle cx="48" cy="66" r="10" fill="${C.gold}"/>
<path d="M43 66 l4 4 7 -8" stroke="${C.ink}" stroke-width="3" fill="none"/>`,
  },
  'map-quiz': {
    category: 'memory',
    draw: () => `
<circle cx="46" cy="50" r="28" fill="${C.sky}"/>
<path d="M28 38 q8 -6 14 -2 q4 6 -2 10 q-6 2 -6 8 q-2 6 -8 2 q-2 -10 2 -18 z" fill="${C.mint}"/>
<path d="M52 30 q10 0 14 8 q2 8 -6 8 q-6 -2 -10 2 q-4 -8 2 -18 z" fill="${C.mint}"/>
<path d="M50 60 q8 -2 10 6 q-2 8 -10 6 z" fill="${C.mint}"/>
<path d="M68 16 a9 9 0 0 1 9 9 c0 7 -9 16 -9 16 s-9 -9 -9 -16 a9 9 0 0 1 9 -9 z" fill="${C.tomato}"/>
<circle cx="68" cy="25" r="3.2" fill="${C.cream}"/>`,
  },
  'memory-match': {
    category: 'memory',
    draw: () => `
<g transform="rotate(-10 34 50)">
  <rect x="16" y="24" width="34" height="46" rx="6" fill="${C.tomato}"/>
  <rect x="21" y="29" width="24" height="36" rx="4" fill="none" stroke="${C.cream}" stroke-width="2" stroke-dasharray="3 3"/>
  ${text(33, 53, 14, C.cream, '?')}
</g>
<g transform="rotate(8 62 50)">
  <rect x="46" y="22" width="34" height="46" rx="6" fill="${C.cream}"/>
  ${star(63, 45, 12, C.gold)}
</g>`,
  },
  'number-ninja': {
    category: 'memory',
    draw: () => `
<circle cx="48" cy="46" r="24" fill="${C.ink}"/>
<rect x="24" y="36" width="48" height="12" rx="4" fill="${C.tomato}"/>
<path d="M70 40 l14 -6 -4 10 z M70 44 l12 6 -10 2 z" fill="${C.tomato}"/>
<rect x="30" y="50" width="36" height="10" rx="5" fill="${C.cream}"/>
<path d="M36 55 h8 M52 55 h8" stroke="${C.ink}" stroke-width="3"/>
${text(24, 84, 12, C.gold, '3')}${text(48, 84, 12, C.gold, '7')}${text(72, 84, 12, C.gold, '1')}`,
  },
  sudoku: {
    category: 'memory',
    draw: () => {
      const n = [['5', '', '3'], ['', '9', ''], ['8', '', '1']];
      const nums = n.flatMap((row, r) => row.map((d, c) =>
        d ? text(29 + c * 19, 36 + r * 19, 12, r === 1 ? C.tomato : C.ink, d) : '')).join('');
      return `
<rect x="16" y="16" width="64" height="64" rx="9" fill="${C.cream}"/>
<path d="M38 18 V78 M57 18 V78 M18 38 H78 M18 57 H78" stroke="${C.sky}" stroke-width="2.5"/>
<rect x="38" y="38" width="19" height="19" fill="${C.gold}" opacity=".45"/>
${nums}`;
    },
  },

  // ── Focus ────────────────────────────────────────────────────────
  'attention-archery': {
    category: 'focus',
    draw: () => `
<circle cx="44" cy="52" r="28" fill="${C.cream}"/>
<circle cx="44" cy="52" r="20" fill="${C.tomato}"/>
<circle cx="44" cy="52" r="12" fill="${C.cream}"/>
<circle cx="44" cy="52" r="5" fill="${C.tomato}"/>
<path d="M46 50 L78 18" stroke="${C.ink}" stroke-width="3.5"/>
<path d="M72 14 l8 -2 -2 8 m-9 1 l7 -2 -2 7" fill="none" stroke="${C.gold}" stroke-width="3"/>`,
  },
  'breath-bubbles': {
    category: 'focus',
    draw: () => bubble(40, 54, 20) + bubble(68, 32, 12) + bubble(66, 66, 7) + bubble(30, 22, 6),
  },
  'color-rush': {
    category: 'focus',
    draw: () => `
<rect x="16" y="20" width="44" height="14" rx="7" fill="${C.tomato}"/>
<rect x="16" y="41" width="44" height="14" rx="7" fill="${C.gold}"/>
<rect x="16" y="62" width="44" height="14" rx="7" fill="${C.mint}"/>
<path d="M72 14 L58 48 H70 L62 82 L84 40 H72 L80 14 Z" fill="${C.cream}"/>`,
  },
  'echo-tap': {
    category: 'focus',
    draw: () => `
<ellipse cx="42" cy="66" rx="24" ry="9" fill="#a8412f"/>
<rect x="18" y="46" width="48" height="20" fill="${C.tomato}"/>
<path d="M18 46 v20 M66 46 v20 M26 50 l8 12 8 -12 8 12 8 -12" stroke="${C.cream}" stroke-width="2.2" fill="none"/>
<ellipse cx="42" cy="46" rx="24" ry="9" fill="${C.cream}"/>
<path d="M58 30 L74 14" stroke="${C.gold}" stroke-width="4"/><circle cx="76" cy="12" r="4.5" fill="${C.gold}"/>
<path d="M74 40 q6 6 0 12 M80 34 q11 12 0 24" stroke="${C.cream}" stroke-width="3" fill="none"/>`,
  },
  'focus-frenzy': {
    category: 'focus',
    draw: () => `
<circle cx="36" cy="40" r="15" fill="${C.gold}" opacity=".35"/>
<circle cx="36" cy="40" r="10" fill="${C.gold}"/>
<circle cx="33" cy="37" r="3" fill="${C.cream}"/>
<circle cx="66" cy="64" r="12" fill="${C.gold}" opacity=".35"/>
<circle cx="66" cy="64" r="8" fill="${C.gold}"/>
<circle cx="64" cy="62" r="2.4" fill="${C.cream}"/>
<circle cx="66" cy="28" r="7" fill="${C.inkSoft}"/>
<path d="M61.5 23.5 l9 9 M70.5 23.5 l-9 9" stroke="${C.tomato}" stroke-width="2.4"/>
<circle cx="30" cy="70" r="5" fill="${C.inkSoft}"/>`,
  },
  'go-no-go': {
    category: 'focus',
    draw: () => `
<rect x="32" y="12" width="32" height="70" rx="12" fill="${C.ink}"/>
<circle cx="48" cy="28" r="9" fill="${C.tomato}" opacity=".35"/>
<circle cx="48" cy="47" r="9" fill="${C.gold}" opacity=".35"/>
<circle cx="48" cy="66" r="9" fill="${C.mint}"/>
<circle cx="45" cy="63" r="2.5" fill="${C.cream}"/>
<path d="M26 66 h-8 M78 66 h-8" stroke="${C.mint}" stroke-width="3"/>`,
  },
  grounding: {
    category: 'focus',
    draw: () => {
      const petals = [0, 72, 144, 216, 288].map(a =>
        `<ellipse cx="48" cy="26" rx="9" ry="13" fill="${a % 144 === 0 ? C.berry : C.tomato}" transform="rotate(${a} 48 40)"/>`).join('');
      return `
<path d="M48 52 C48 64 46 72 48 84" stroke="${C.mint}" stroke-width="4" fill="none"/>
<path d="M48 70 q-14 -2 -18 -12 q12 -2 18 12 z M48 76 q12 -4 16 -14 q-12 0 -16 14 z" fill="${C.mint}"/>
${petals}
<circle cx="48" cy="40" r="8" fill="${C.gold}"/>`;
    },
  },
  'mirror-match': {
    category: 'focus',
    draw: () => {
      const { cream: W, sky: S, gold: G } = C;
      return `
${cellGrid(12, 30, 10, 2.5, [[W, S, W], [S, W, S], [W, W, G]], 2)}
${cellGrid(52, 30, 10, 2.5, [[W, S, W], [S, W, S], [G, W, W]], 2)}
<path d="M48 22 V74" stroke="${C.cream}" stroke-width="2.5" stroke-dasharray="4 4"/>
<circle cx="57" cy="60" r="10" fill="none" stroke="${C.tomato}" stroke-width="3"/>`;
    },
  },
  'patience-pop': {
    category: 'focus',
    draw: () => `
${bubble(34, 40, 13, C.cream)}
${bubble(62, 34, 11, C.mint)}
${bubble(56, 64, 14, C.cream)}
<circle cx="24" cy="70" r="11" fill="${C.cream}"/>
<path d="M24 62 V70 L29 74" stroke="${C.ink}" stroke-width="2.5" fill="none"/>`,
  },
  'quick-math': {
    category: 'focus',
    draw: () => {
      const cell = (x: number, y: number, fill: string, sym: string, ink: string) =>
        `<rect x="${x}" y="${y}" width="30" height="30" rx="8" fill="${fill}"/>` + text(x + 15, y + 23, 22, ink, sym);
      return cell(16, 16, C.cream, '+', C.ink) + cell(50, 16, C.gold, '−', C.ink)
        + cell(16, 50, C.tomato, '×', C.cream) + cell(50, 50, C.mint, '÷', C.ink);
    },
  },

  // ── Flexibility ──────────────────────────────────────────────────
  'cube-twist': {
    category: 'flexibility',
    draw: () => {
      const top = `<path d="M48 16 L78 31 L48 46 L18 31 Z" fill="${C.cream}"/><path d="M33 23.5 L63 38.5 M63 23.5 L33 38.5" stroke="${C.ink}" stroke-width="1.6" opacity=".4"/>`;
      const left = `<path d="M18 31 L48 46 V80 L18 65 Z" fill="${C.tomato}"/><path d="M33 38.5 V72.5 M18 48 L48 63" stroke="${C.ink}" stroke-width="1.6" opacity=".4"/>`;
      const right = `<path d="M78 31 L48 46 V80 L78 65 Z" fill="${C.sky}"/><path d="M63 38.5 V72.5 M78 48 L48 63" stroke="${C.ink}" stroke-width="1.6" opacity=".4"/>`;
      return `${top}${left}${right}<path d="M82 24 q6 10 -2 18" stroke="${C.gold}" stroke-width="3" fill="none"/><path d="M76 40 l4 3 3 -4" stroke="${C.gold}" stroke-width="3" fill="none"/>`;
    },
  },
  'flexibility-frames': {
    category: 'flexibility',
    draw: () => `
<rect x="22" y="30" width="24" height="24" rx="4" fill="${C.gold}"/>
<circle cx="64" cy="56" r="13" fill="${C.sky}"/>
<path d="M30 22 Q48 8 66 22" stroke="${C.cream}" stroke-width="4" fill="none"/>
<path d="M60 16 l7 6 -8 4" stroke="${C.cream}" stroke-width="4" fill="none"/>
<path d="M66 78 Q48 90 30 76" stroke="${C.cream}" stroke-width="4" fill="none"/>
<path d="M36 82 l-7 -6 8 -4" stroke="${C.cream}" stroke-width="4" fill="none"/>`,
  },
  'just-right': {
    category: 'flexibility',
    draw: () => `
<path d="M38 30 q8 -10 16 -2 q10 -4 12 8 q10 4 4 14 q4 10 -8 12 q-4 10 -14 4 q-10 6 -14 -4 q-12 -2 -8 -14 q-6 -10 4 -14 q0 -6 8 -4 z" fill="${C.tomato}"/>
<circle cx="74" cy="26" r="4" fill="${C.tomato}"/><circle cx="22" cy="70" r="3" fill="${C.tomato}"/>
<circle cx="50" cy="48" r="9" fill="${C.gold}"/>
<g transform="rotate(40 70 70)">
  <rect x="66" y="54" width="8" height="30" rx="3" fill="${C.cream}"/>
  <path d="M65 54 h10 l-2 -10 h-6 z" fill="${C.ink}"/>
</g>`,
  },
  'mistake-master': {
    category: 'flexibility',
    draw: () => `
<path d="M28 60 H68 L63 82 H33 Z" fill="${C.tomato}"/>
<rect x="25" y="56" width="46" height="8" rx="3" fill="#c55644"/>
<path d="M48 58 V34" stroke="${C.mint}" stroke-width="4"/>
<path d="M48 44 C36 44 26 38 24 26 C38 26 46 32 48 44 Z" fill="${C.mint}"/>
<path d="M48 38 C58 36 68 28 70 16 C56 18 50 26 48 38 Z" fill="${C.mint}"/>
<circle cx="48" cy="70" r="2.2" fill="${C.cream}"/>`,
  },
  'squish-lab': {
    category: 'flexibility',
    draw: () => `
<path d="M40 16 H56 V38 L74 72 Q76 80 68 80 H28 Q20 80 22 72 L40 38 Z" fill="${C.cream}"/>
<path d="M31 58 H65 L72 72 Q74 76 68 76 H28 Q22 76 24 72 Z" fill="${C.mint}"/>
<rect x="36" y="12" width="24" height="6" rx="3" fill="${C.gold}"/>
<circle cx="42" cy="66" r="3.5" fill="${C.cream}"/><circle cx="54" cy="70" r="2.5" fill="${C.cream}"/>
<circle cx="60" cy="30" r="3" fill="${C.mint}"/><circle cx="66" cy="20" r="4" fill="${C.mint}"/>`,
  },
  'stroop-challenge': {
    category: 'flexibility',
    draw: () => `
<rect x="12" y="24" width="72" height="34" rx="10" fill="${C.cream}"/>
${text(48, 50, 24, C.sky, 'RED')}
<circle cx="30" cy="72" r="7" fill="${C.tomato}"/>
<circle cx="48" cy="72" r="7" fill="${C.sky}" stroke="${C.cream}" stroke-width="3"/>
<circle cx="66" cy="72" r="7" fill="${C.gold}"/>`,
  },
  tetris: {
    category: 'flexibility',
    draw: () => {
      const sq = (x: number, y: number, fill: string) =>
        `<rect x="${x}" y="${y}" width="15" height="15" rx="3" fill="${fill}"/>`;
      return [
        sq(18, 64, C.sky), sq(33, 64, C.sky), sq(48, 64, C.gold), sq(63, 64, C.gold),
        sq(18, 49, C.sky), sq(48, 49, C.gold), sq(63, 49, C.tomato),
        sq(63, 34, C.tomato), sq(63, 19, C.tomato),
        sq(33, 22, C.cream), sq(18, 22, C.cream), sq(33, 37, C.cream), sq(48, 22, C.cream),
      ].join('');
    },
  },

  // ── Motor ────────────────────────────────────────────────────────
  'mole-mash': {
    category: 'motor',
    draw: () => `
<ellipse cx="42" cy="74" rx="26" ry="8" fill="${C.ink}"/>
<path d="M24 74 V56 Q24 36 42 36 Q60 36 60 56 V74 Z" fill="#b98556"/>
<circle cx="35" cy="52" r="2.6" fill="${C.ink}"/><circle cx="49" cy="52" r="2.6" fill="${C.ink}"/>
<ellipse cx="42" cy="59" rx="5" ry="3.5" fill="${C.berry}"/>
<path d="M38 64 h8" stroke="${C.cream}" stroke-width="2.5"/>
<g transform="rotate(-35 70 30)">
  <rect x="67" y="26" width="6" height="36" rx="2" fill="${C.gold}"/>
  <rect x="56" y="14" width="28" height="14" rx="4" fill="${C.cream}"/>
</g>
${star(20, 24, 6, C.gold)}`,
  },
  'pattern-painter': {
    category: 'motor',
    draw: () => `
${star(46, 48, 30, 'none').replace('fill="none"', `fill="none" stroke="${C.cream}" stroke-width="3.5" stroke-dasharray="5 5"`)}
<path d="M46 18 L55 36.5 L74.5 39" stroke="${C.gold}" stroke-width="5" fill="none"/>
<circle cx="74.5" cy="39" r="6" fill="${C.gold}"/>`,
  },
  'pixel-paint': {
    category: 'motor',
    draw: () => {
      const _ = 'transparent';
      const T = C.tomato;
      const P = C.berry;
      return cellGrid(15, 20, 9, 1, [
        [_, T, T, _, T, T, _],
        [T, P, T, T, T, T, T],
        [T, T, T, T, T, T, T],
        [_, T, T, T, T, T, _],
        [_, _, T, T, T, _, _],
        [_, _, _, T, _, _, _],
      ], 1.5) + `<rect x="68" y="66" width="14" height="14" rx="3" fill="${C.sky}"/>`;
    },
  },
  'steady-hands': {
    category: 'motor',
    draw: () => `
<path d="M16 72 C 30 72, 26 46, 44 46 S 58 24, 80 24" stroke="${C.cream}" stroke-width="16" fill="none"/>
<path d="M16 72 C 30 72, 26 46, 44 46 S 58 24, 80 24" stroke="${C.ink}" stroke-width="8" fill="none"/>
<circle cx="44" cy="46" r="6" fill="${C.gold}"/>
${star(80, 24, 7, C.mint)}`,
  },
};
