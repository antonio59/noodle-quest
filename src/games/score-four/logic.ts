// Pure Score Four (3D Connect Four, 4×4×4) rules and AI. No React or
// rendering concerns — unit-testable in isolation.
//
// The board is 4×4×4. Players drop beads onto one of 16 vertical rods
// (x, z); beads stack upward along y. First to line up 4 in any straight
// line — along an axis, a face diagonal, or a space diagonal — wins.

export type Player = 1 | 2;
export type Cell = Player | 0;
export const N = 4;

/** Flat board indexed [x + z*4 + y*16]; y is the vertical (gravity) axis. */
export type Board = Cell[];

export type AILevel = 'easy' | 'medium' | 'hard';

export function idx(x: number, y: number, z: number): number {
  return x + z * N + y * N * N;
}

export function newBoard(): Board {
  return new Array<Cell>(N * N * N).fill(0);
}

/** All 76 winning lines, precomputed as flat-index quadruples. */
export const LINES: number[][] = (() => {
  const lines: number[][] = [];
  const dirs = [
    // Axis-aligned
    [1, 0, 0], [0, 1, 0], [0, 0, 1],
    // Face diagonals
    [1, 1, 0], [1, -1, 0], [1, 0, 1], [1, 0, -1], [0, 1, 1], [0, 1, -1],
    // Space diagonals
    [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
  ];
  for (const [dx, dy, dz] of dirs) {
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) {
        for (let z = 0; z < N; z++) {
          const ex = x + dx * (N - 1);
          const ey = y + dy * (N - 1);
          const ez = z + dz * (N - 1);
          if (ex < 0 || ex >= N || ey < 0 || ey >= N || ez < 0 || ez >= N) continue;
          lines.push([0, 1, 2, 3].map(i => idx(x + dx * i, y + dy * i, z + dz * i)));
        }
      }
    }
  }
  return lines;
})();

/** Lowest empty y on rod (x, z), or -1 if the rod is full. */
export function landingY(b: Board, x: number, z: number): number {
  for (let y = 0; y < N; y++) {
    if (b[idx(x, y, z)] === 0) return y;
  }
  return -1;
}

/** Drop in place. Returns the landing y, or -1 if the rod is full. */
export function drop(b: Board, x: number, z: number, player: Player): number {
  const y = landingY(b, x, z);
  if (y >= 0) b[idx(x, y, z)] = player;
  return y;
}

export interface Rod { x: number; z: number; }

export function legalRods(b: Board): Rod[] {
  const rods: Rod[] = [];
  // Centre-out ordering helps alpha-beta pruning.
  const order = [1, 2, 0, 3];
  for (const x of order) {
    for (const z of order) {
      if (landingY(b, x, z) >= 0) rods.push({ x, z });
    }
  }
  return rods;
}

export function isFull(b: Board): boolean {
  return legalRods(b).length === 0;
}

/** The winning line (flat indices) for `player`, or null. */
export function winningLine(b: Board, player: Player): number[] | null {
  for (const line of LINES) {
    if (line.every(i => b[i] === player)) return line;
  }
  return null;
}

function other(p: Player): Player {
  return p === 1 ? 2 : 1;
}

// ── Evaluation ─────────────────────────────────────────────────────────
// Window scoring over all 76 lines, from `me`'s perspective. Lines
// containing both players are dead.

export function evaluate(b: Board, me: Player): number {
  const opp = other(me);
  let score = 0;
  for (const line of LINES) {
    let mine = 0;
    let theirs = 0;
    for (const i of line) {
      if (b[i] === me) mine++;
      else if (b[i] === opp) theirs++;
    }
    if (mine > 0 && theirs > 0) continue;
    if (mine === 3) score += 50;
    else if (mine === 2) score += 8;
    else if (mine === 1) score += 1;
    else if (theirs === 3) score -= 60;
    else if (theirs === 2) score -= 8;
    else if (theirs === 1) score -= 1;
  }
  return score;
}

// ── Search ─────────────────────────────────────────────────────────────

const WIN_SCORE = 100000;

function negamax(b: Board, depth: number, alpha: number, beta: number, player: Player): number {
  const rods = legalRods(b);
  if (rods.length === 0) return 0; // draw

  // Immediate win for the side to move dominates everything.
  for (const { x, z } of rods) {
    const y = drop(b, x, z, player);
    const won = winningLine(b, player) !== null;
    b[idx(x, y, z)] = 0;
    if (won) return WIN_SCORE + depth;
  }

  if (depth <= 0) return evaluate(b, player);

  let best = -Infinity;
  for (const { x, z } of rods) {
    const y = drop(b, x, z, player);
    const v = -negamax(b, depth - 1, -beta, -alpha, other(player));
    b[idx(x, y, z)] = 0;
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

const AI_CONFIG: Record<AILevel, { depth: number; blunderChance: number }> = {
  easy: { depth: 1, blunderChance: 0.35 },
  medium: { depth: 2, blunderChance: 0.1 },
  hard: { depth: 4, blunderChance: 0 },
};

/**
 * Choose a rod for `player`. Like the 2D game: every level takes an
 * immediate win, easy/medium occasionally blunder so kids can win.
 */
export function bestRod(board: Board, player: Player, difficulty: AILevel): Rod | null {
  const b = [...board];
  const rods = legalRods(b);
  if (rods.length === 0) return null;

  for (const rod of rods) {
    const y = drop(b, rod.x, rod.z, player);
    const won = winningLine(b, player) !== null;
    b[idx(rod.x, y, rod.z)] = 0;
    if (won) return rod;
  }

  const { depth, blunderChance } = AI_CONFIG[difficulty];
  if (Math.random() < blunderChance) {
    // A blunder is a mediocre move, not a suicidal one: never pick a rod
    // that hands the opponent an immediate win (unless every rod does).
    const safe = rods.filter(rod => {
      const y = drop(b, rod.x, rod.z, player);
      let loses = false;
      for (const or of legalRods(b)) {
        const oy = drop(b, or.x, or.z, other(player));
        if (winningLine(b, other(player)) !== null) loses = true;
        b[idx(or.x, oy, or.z)] = 0;
        if (loses) break;
      }
      b[idx(rod.x, y, rod.z)] = 0;
      return !loses;
    });
    const pool = safe.length > 0 ? safe : rods;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  let best = rods[0];
  let bestScore = -Infinity;
  for (const rod of rods) {
    const y = drop(b, rod.x, rod.z, player);
    const v = -negamax(b, depth - 1, -Infinity, Infinity, other(player));
    b[idx(rod.x, y, rod.z)] = 0;
    if (v > bestScore) {
      bestScore = v;
      best = rod;
    }
  }
  return best;
}
