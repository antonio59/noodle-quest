// Game-art palette: the kitchen-table brand (teal ink, noodle gold,
// tomato) pushed a little brighter so small tiles read at a glance.

export const C = {
  cream: '#fff4e0',
  gold: '#f7c35f',
  tomato: '#ef6a55',
  mint: '#62d9a0',
  sky: '#86c9f0',
  berry: '#f08fb0',
  ink: '#16302a',
  inkSoft: '#2b4a42',
} as const;

export type Category =
  | 'memory' | 'focus' | 'flexibility' | 'motor'
  | 'social' | 'sequence' | 'board' | 'breathe';

/** Tile background gradient (top → bottom) per category. */
export const CATEGORY_BG: Record<Category, [string, string]> = {
  memory: ['#2f6f8f', '#1b4257'],
  focus: ['#c9772b', '#8a4b17'],
  flexibility: ['#3f8f5e', '#22573a'],
  motor: ['#b8566e', '#7a3346'],
  social: ['#d0644f', '#8f3a2c'],
  sequence: ['#7d8f3a', '#4d5a1f'],
  board: ['#3d8073', '#1f4d45'],
  breathe: ['#3a8fa3', '#1f5a68'],
};

/** Rounded-sans stack for the few tiles with letters or digits. */
export const FONT = `font-family="Fredoka, Nunito, 'Arial Rounded MT Bold', Verdana, sans-serif" font-weight="700"`;
