// Pure Connect Four rules and AI. No React or rendering concerns —
// unit-testable in isolation.

export type Color = 'red' | 'yellow';
export type Cell = Color | null;
export type Board = Cell[][];
export type AILevel = 'easy' | 'medium' | 'hard';

export const ROWS = 6;
export const COLS = 7;

// Center-first ordering: stronger moves first, which also speeds up
// alpha-beta pruning considerably.
const MOVE_ORDER = [3, 2, 4, 1, 5, 0, 6];

export function initBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

export function cloneBoard(b: Board): Board {
  return b.map(r => [...r]);
}

/** Lowest empty row in a column, or -1 if the column is full. */
export function landingRow(b: Board, col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!b[r][col]) return r;
  }
  return -1;
}

/** Drop a piece in place. Returns the row it landed in, or -1 if full. */
export function dropPiece(b: Board, col: number, color: Color): number {
  const r = landingRow(b, col);
  if (r >= 0) b[r][col] = color;
  return r;
}

export function legalMoves(b: Board): number[] {
  return MOVE_ORDER.filter(c => b[0][c] === null);
}

export function isFull(b: Board): boolean {
  return b[0].every(c => c !== null);
}

/** The winning 4+ line through (row, col) for `color`, or null. */
export function getWinLine(b: Board, row: number, col: number, color: string): number[][] | null {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    const line: number[][] = [[row, col]];
    for (const sign of [1, -1]) {
      for (let i = 1; i < 4; i++) {
        const r = row + dr * i * sign;
        const c = col + dc * i * sign;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS || b[r][c] !== color) break;
        line.push([r, c]);
      }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

export function checkWin(b: Board, row: number, col: number, color: string): boolean {
  return getWinLine(b, row, col, color) !== null;
}

function other(color: Color): Color {
  return color === 'red' ? 'yellow' : 'red';
}

// ── Evaluation ─────────────────────────────────────────────────────────
// Scores the position for `me` by sliding a 4-cell window across every
// row, column, and diagonal. Windows containing both colors are dead.

function scoreWindow(a: Cell, b2: Cell, c: Cell, d: Cell, me: Color): number {
  let mine = 0;
  let theirs = 0;
  for (const cell of [a, b2, c, d]) {
    if (cell === me) mine++;
    else if (cell !== null) theirs++;
  }
  if (mine > 0 && theirs > 0) return 0;
  if (mine === 3) return 60;
  if (mine === 2) return 12;
  if (theirs === 3) return -70;
  if (theirs === 2) return -12;
  return 0;
}

export function evaluate(b: Board, me: Color): number {
  let score = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c + 3 < COLS) score += scoreWindow(b[r][c], b[r][c + 1], b[r][c + 2], b[r][c + 3], me);
      if (r + 3 < ROWS) score += scoreWindow(b[r][c], b[r + 1][c], b[r + 2][c], b[r + 3][c], me);
      if (r + 3 < ROWS && c + 3 < COLS) score += scoreWindow(b[r][c], b[r + 1][c + 1], b[r + 2][c + 2], b[r + 3][c + 3], me);
      if (r + 3 < ROWS && c - 3 >= 0) score += scoreWindow(b[r][c], b[r + 1][c - 1], b[r + 2][c - 2], b[r + 3][c - 3], me);
    }
  }

  // Center control is worth extra: pieces in the middle column join the
  // most possible windows.
  for (let r = 0; r < ROWS; r++) {
    if (b[r][3] === me) score += 6;
    else if (b[r][3] !== null) score -= 6;
  }

  return score;
}

// ── Search ─────────────────────────────────────────────────────────────

const WIN_SCORE = 100000;

/** Negamax with alpha-beta pruning, from the perspective of `color` to move. */
function negamax(b: Board, depth: number, alpha: number, beta: number, color: Color): number {
  const moves = legalMoves(b);
  if (moves.length === 0) return 0; // draw

  // If the side to move can win at once, that dominates everything.
  // Adding remaining depth prefers faster wins / slower losses.
  for (const c of moves) {
    const r = landingRow(b, c);
    b[r][c] = color;
    const win = checkWin(b, r, c, color);
    b[r][c] = null;
    if (win) return WIN_SCORE + depth;
  }

  if (depth <= 0) return evaluate(b, color);

  let best = -Infinity;
  for (const c of moves) {
    const r = landingRow(b, c);
    b[r][c] = color;
    const v = -negamax(b, depth - 1, -beta, -alpha, other(color));
    b[r][c] = null;
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

const AI_CONFIG: Record<AILevel, { depth: number; blunderChance: number }> = {
  easy: { depth: 2, blunderChance: 0.35 },
  medium: { depth: 4, blunderChance: 0.1 },
  hard: { depth: 7, blunderChance: 0 },
};

/**
 * Choose a column for `color`. Difficulty controls search depth and an
 * occasional deliberate blunder so easy/medium stay beatable — but even
 * a blunder takes an immediate win when one is on the board.
 */
export function bestMove(board: Board, color: Color, difficulty: AILevel): number {
  const b = cloneBoard(board);
  const moves = legalMoves(b);
  if (moves.length === 0) return -1;

  // Always take an immediate win, even on easy.
  for (const c of moves) {
    const r = landingRow(b, c);
    b[r][c] = color;
    const win = checkWin(b, r, c, color);
    b[r][c] = null;
    if (win) return c;
  }

  const { depth, blunderChance } = AI_CONFIG[difficulty];
  if (Math.random() < blunderChance) {
    // A blunder is a mediocre move, not a suicidal one: never pick a column
    // that hands the opponent an immediate win (unless every column does).
    const safe = moves.filter(c => {
      const r = landingRow(b, c);
      b[r][c] = color;
      let loses = false;
      for (const oc of legalMoves(b)) {
        const or = landingRow(b, oc);
        b[or][oc] = other(color);
        if (checkWin(b, or, oc, other(color))) loses = true;
        b[or][oc] = null;
        if (loses) break;
      }
      b[r][c] = null;
      return !loses;
    });
    const pool = safe.length > 0 ? safe : moves;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  let bestCol = moves[0];
  let best = -Infinity;
  for (const c of moves) {
    const r = landingRow(b, c);
    b[r][c] = color;
    const v = -negamax(b, depth - 1, -Infinity, Infinity, other(color));
    b[r][c] = null;
    if (v > best) {
      best = v;
      bestCol = c;
    }
  }
  return bestCol;
}
