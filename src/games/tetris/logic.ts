/**
 * Block-drop (Tetris) core logic — pure functions, no React.
 * Board is a 10×20 grid of cell colors (null = empty).
 */

export const COLS = 10;
export const ROWS = 20;

export type Board = (string | null)[][];

export type PieceId = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export interface Piece {
  id: PieceId;
  /** Rotation index 0–3. */
  rot: number;
  /** Board position of the piece's 4×4 (or 3×3) bounding box. */
  x: number;
  y: number;
}

/** Each rotation is a list of [x, y] cells inside the bounding box. */
const SHAPES: Record<PieceId, [number, number][][]> = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
};

export const PIECE_COLORS: Record<PieceId, string> = {
  I: '#38bdf8', // sky
  O: '#f5c542', // gold
  T: '#c084fc', // violet
  S: '#3ecf8e', // green
  Z: '#ef5b5b', // red
  J: '#60a5fa', // blue
  L: '#f0a83a', // noodle gold
};

export const PIECE_IDS: PieceId[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<string | null>(COLS).fill(null));
}

/** Absolute board cells occupied by a piece at a given position/rotation. */
export function pieceCells(p: Piece, dx = 0, dy = 0, rot = p.rot): [number, number][] {
  return SHAPES[p.id][rot & 3].map(([cx, cy]) => [p.x + dx + cx, p.y + dy + cy]);
}

export function collides(board: Board, p: Piece, dx = 0, dy = 0, rot = p.rot): boolean {
  for (const [x, y] of pieceCells(p, dx, dy, rot)) {
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y >= 0 && board[y][x] !== null) return true;
  }
  return false;
}

/** Lock a piece into the board, returning a new board. */
export function mergePiece(board: Board, p: Piece): Board {
  const next = board.map(row => row.slice());
  const color = PIECE_COLORS[p.id];
  for (const [x, y] of pieceCells(p)) {
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) next[y][x] = color;
  }
  return next;
}

/** Remove full rows; returns new board + cleared row count. */
export function clearLines(board: Board): { board: Board; cleared: number } {
  const kept = board.filter(row => row.some(c => c === null));
  const cleared = ROWS - kept.length;
  if (cleared === 0) return { board, cleared: 0 };
  const fresh = Array.from({ length: cleared }, () => Array<string | null>(COLS).fill(null));
  return { board: [...fresh, ...kept.map(r => r.slice())], cleared };
}

/** Points per line clear at a given level (classic-ish, family scale). */
export function scoreForClear(cleared: number, level: number): number {
  const table = [0, 40, 100, 300, 1200];
  return (table[Math.min(cleared, 4)] ?? 0) * (level + 1);
}

/** Gravity interval in ms for a level; faster as levels climb, floor at 120ms. */
export function tickMsForLevel(level: number): number {
  return Math.max(120, 800 - level * 60);
}

/** Level advances every 10 lines. */
export function levelForLines(lines: number): number {
  return Math.floor(lines / 10);
}

/**
 * 7-bag randomizer: returns the next piece id, mutating `bag` (refills
 * with a shuffled 7-piece set when empty). Fairer than pure random —
 * guarantees each piece appears once per bag.
 */
export function nextFromBag(bag: PieceId[], rand: () => number = Math.random): PieceId {
  if (bag.length === 0) {
    const fresh = PIECE_IDS.slice();
    for (let i = fresh.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
    }
    bag.push(...fresh);
  }
  return bag.pop()!;
}

/** Spawn a piece centred at the top of the board. */
export function spawnPiece(id: PieceId): Piece {
  return { id, rot: 0, x: Math.floor((COLS - 4) / 2), y: -1 };
}

/**
 * Rotate with simple wall kicks: try the rotation in place, then nudge
 * ±1 and ±2 on x, and one step up (floor kick). Returns the rotated
 * piece or null if nothing fits.
 */
export function rotatePiece(board: Board, p: Piece, dir: 1 | -1 = 1): Piece | null {
  const rot = (p.rot + dir + 4) & 3;
  for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]] as const) {
    const cand: Piece = { ...p, x: p.x + dx, y: p.y + dy, rot };
    if (!collides(board, cand)) return cand;
  }
  return null;
}

/** Distance the piece can fall before colliding — for ghost + hard drop. */
export function dropDistance(board: Board, p: Piece): number {
  let d = 0;
  while (!collides(board, p, 0, d + 1)) d++;
  return d;
}

/** True when a freshly spawned piece immediately overlaps — game over. */
export function isTopOut(board: Board, p: Piece): boolean {
  return collides(board, p);
}
