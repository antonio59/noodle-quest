// Social, sequence and breathing activities.
import { C } from './palette.js';
import { type Tile } from './shapes.js';

export const CALM_TILES: Record<string, Tile> = {
  // ── Social ───────────────────────────────────────────────────────
  'emotion-volcano': {
    category: 'social',
    draw: () => `
<path d="M14 80 L38 36 H58 L82 80 Z" fill="${C.ink}"/>
<path d="M38 36 H58 L62 44 Q56 48 52 42 Q48 50 44 42 Q40 48 34 44 Z" fill="${C.gold}"/>
<path d="M42 30 Q40 20 46 14 M54 30 Q58 22 54 12" stroke="${C.cream}" stroke-width="3.5" fill="none" opacity=".7"/>
<circle cx="42" cy="62" r="2.6" fill="${C.cream}"/><circle cx="54" cy="62" r="2.6" fill="${C.cream}"/>
<path d="M42 70 q6 5 12 0" stroke="${C.cream}" stroke-width="2.6" fill="none"/>`,
  },
  'empathy-engine': {
    category: 'social',
    draw: () => `
<path d="M14 22 H56 Q62 22 62 28 V48 Q62 54 56 54 H30 L20 62 V54 H20 Q14 54 14 48 V28 Q14 22 20 22 Z" fill="${C.cream}"/>
<path d="M38 36 c0 -5 7 -6 8 -1 c1 -5 8 -4 8 1 c0 6 -8 10 -8 10 s-8 -4 -8 -10 z" fill="${C.tomato}" transform="translate(-8 -2)"/>
<path d="M82 44 H44 Q38 44 38 50 V66 Q38 72 44 72 H66 L76 80 V72 H76 Q82 72 82 66 V50 Q82 44 76 44 Z" fill="${C.gold}"/>
<circle cx="52" cy="58" r="2.6" fill="${C.ink}"/><circle cx="60" cy="58" r="2.6" fill="${C.ink}"/><circle cx="68" cy="58" r="2.6" fill="${C.ink}"/>`,
  },

  'feelings-faces': {
    category: 'social',
    draw: () => `
<circle cx="34" cy="38" r="18" fill="${C.gold}"/>
<circle cx="28" cy="34" r="2.6" fill="${C.ink}"/><circle cx="40" cy="34" r="2.6" fill="${C.ink}"/>
<path d="M26 42 q8 8 16 0" stroke="${C.ink}" stroke-width="2.8" fill="none"/>
<circle cx="64" cy="36" r="13" fill="${C.sky}"/>
<circle cx="60" cy="33" r="2.2" fill="${C.ink}"/><circle cx="68" cy="33" r="2.2" fill="${C.ink}"/>
<path d="M59 43 q5 -5 10 0" stroke="${C.ink}" stroke-width="2.4" fill="none"/>
<circle cx="54" cy="66" r="14" fill="${C.cream}"/>
<circle cx="49" cy="62" r="2.3" fill="${C.ink}"/><circle cx="59" cy="62" r="2.3" fill="${C.ink}"/>
<circle cx="54" cy="71" r="3.4" fill="${C.ink}"/>`,
  },

  // ── Sequence ─────────────────────────────────────────────────────
  'routine-roadmap': {
    category: 'sequence',
    draw: () => {
      const row = (y: number, done: boolean) =>
        `<rect x="30" y="${y}" width="10" height="10" rx="2.5" fill="${done ? C.mint : 'none'}" stroke="${C.mint}" stroke-width="2.5"/>`
        + (done ? `<path d="M32.5 ${y + 5} l2.5 2.5 4 -5" stroke="${C.ink}" stroke-width="2" fill="none"/>` : '')
        + `<rect x="46" y="${y + 3}" width="${done ? 22 : 16}" height="4" rx="2" fill="${C.inkSoft}"/>`;
      return `
<rect x="20" y="18" width="56" height="64" rx="8" fill="${C.cream}"/>
<rect x="36" y="12" width="24" height="12" rx="4" fill="${C.gold}"/>
${row(32, true)}${row(48, true)}${row(64, false)}`;
    },
  },
  'story-builder': {
    category: 'sequence',
    draw: () => `
<rect x="12" y="20" width="34" height="26" rx="4" fill="${C.cream}"/>
<rect x="50" y="20" width="34" height="26" rx="4" fill="${C.cream}"/>
<rect x="12" y="50" width="72" height="26" rx="4" fill="${C.cream}"/>
<circle cx="24" cy="36" r="5" fill="${C.gold}"/>
<path d="M18 44 l8 -6 6 4 8 -8 4 10 z" fill="${C.mint}"/>
<path d="M58 28 h14 q4 0 4 4 v4 q0 4 -4 4 h-8 l-4 3 v-3 q-2 0 -2 -4 v-4 q0 -4 0 -4 z" fill="${C.sky}"/>
<circle cx="30" cy="64" r="6" fill="${C.tomato}"/><circle cx="66" cy="64" r="6" fill="${C.sky}"/>
<path d="M40 64 q8 -8 16 0" stroke="${C.berry}" stroke-width="3" fill="none"/>
<text x="22" y="28" font-size="7" fill="${C.ink}" font-family="sans-serif" font-weight="700">1</text>`,
  },

  // ── Breathe ──────────────────────────────────────────────────────
  'calm-breathing': {
    category: 'breathe',
    draw: () => `
<circle cx="66" cy="26" r="9" fill="${C.gold}"/>
<path d="M12 46 q9 -9 18 0 t18 0 t18 0 t18 0" stroke="${C.cream}" stroke-width="5" fill="none"/>
<path d="M12 62 q9 -9 18 0 t18 0 t18 0 t18 0" stroke="${C.sky}" stroke-width="5" fill="none"/>
<path d="M12 78 q9 -9 18 0 t18 0 t18 0 t18 0" stroke="${C.cream}" stroke-width="5" fill="none" opacity=".6"/>`,
  },
  'box-breathing': {
    category: 'breathe',
    draw: () => `
<rect x="24" y="24" width="48" height="48" rx="8" fill="none" stroke="${C.cream}" stroke-width="5"/>
<circle cx="24" cy="24" r="6" fill="${C.gold}"/>
<path d="M36 17 h16 m-5 -4 l5 4 -5 4" fill="none" stroke="${C.gold}" stroke-width="3"/>
<path d="M79 36 v16 m-4 -5 l4 5 4 -5" fill="none" stroke="${C.gold}" stroke-width="3"/>
<circle cx="48" cy="48" r="9" fill="${C.mint}" opacity=".9"/>`,
  },
  'coherent-breathing': {
    category: 'breathe',
    draw: () => `
<path d="M14 48 C 24 20, 38 20, 48 48 S 72 76, 82 48" stroke="${C.cream}" stroke-width="6" fill="none"/>
<circle cx="31" cy="30" r="5" fill="${C.gold}"/>
<circle cx="65" cy="66" r="5" fill="${C.mint}"/>
<path d="M14 48 H82" stroke="${C.cream}" stroke-width="1.5" stroke-dasharray="3 4" opacity=".6"/>`,
  },
  'triangle-breathing': {
    category: 'breathe',
    draw: () => `
<path d="M48 18 L80 74 H16 Z" fill="none" stroke="${C.cream}" stroke-width="5"/>
<circle cx="48" cy="18" r="6" fill="${C.gold}"/>
<circle cx="80" cy="74" r="6" fill="${C.mint}"/>
<circle cx="16" cy="74" r="6" fill="${C.sky}"/>
<circle cx="48" cy="56" r="8" fill="${C.gold}" opacity=".6"/>`,
  },
};
