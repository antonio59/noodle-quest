// Validates and scores the tiles a player has laid this turn. Pure: the
// board, this turn's tiles and the locked tiles all come in as arguments.
import {
  SIZE, CENTER,
  scorePlacement, validateAndScoreCrossWords, buildScoreBreakdown, getActiveWordSet,
  type Direction, type ScoreBreakdown,
} from './logic';

export interface PlacementResult {
  valid: boolean;
  word: string;
  cells: [number, number][];
  score: number;
  reason?: string;
  breakdown?: ScoreBreakdown;
}

/** Validate the player's current placement and return the main word + score (or invalid). */
export function evaluatePlacement(
  board: (string | null)[][],
  placedKeys: ReadonlySet<string>,
  lockedCells: ReadonlySet<string>,
  isFirstMove: boolean,
): PlacementResult {
  const cells = Array.from(placedKeys).map(k => k.split(',').map(Number) as [number, number]);
  if (cells.length === 0) return { valid: false, word: '', cells: [], score: 0, reason: 'Place at least one tile' };

  const rows = cells.map(c => c[0]);
  const cols = cells.map(c => c[1]);
  const sameRow = rows.every(r => r === rows[0]);
  const sameCol = cols.every(c => c === cols[0]);
  if (!sameRow && !sameCol) return { valid: false, word: '', cells: [], score: 0, reason: 'Tiles must be in a straight line' };

  let dir: Direction;
  let wordCells: [number, number][];
  let word: string;

  if (cells.length === 1) {
    const [r, c] = cells[0];

    // Horizontal word through this cell
    let hsc = c;
    while (hsc > 0 && board[r][hsc - 1]) hsc--;
    const hCells: [number, number][] = [];
    let hwc = hsc;
    while (hwc < SIZE && board[r][hwc]) { hCells.push([r, hwc]); hwc++; }

    // Vertical word through this cell
    let vsr = r;
    while (vsr > 0 && board[vsr - 1][c]) vsr--;
    const vCells: [number, number][] = [];
    let vwr = vsr;
    while (vwr < SIZE && board[vwr][c]) { vCells.push([vwr, c]); vwr++; }

    if (hCells.length < 2 && vCells.length < 2) {
      return { valid: false, word: '', cells: [], score: 0, reason: 'Word must be at least 2 letters' };
    }

    if (hCells.length >= vCells.length) {
      dir = 'H';
      wordCells = hCells;
    } else {
      dir = 'V';
      wordCells = vCells;
    }
    word = wordCells.map(([rr, cc]) => board[rr][cc]).join('');
  } else {
    dir = sameRow ? 'H' : 'V';
    const sorted = sameRow
      ? [...cells].sort((a, b) => a[1] - b[1])
      : [...cells].sort((a, b) => a[0] - b[0]);

    // Contiguous (allowing existing tiles in between)
    if (sameRow) {
      for (let c = sorted[0][1]; c <= sorted[sorted.length - 1][1]; c++) {
        if (!board[sorted[0][0]][c]) return { valid: false, word: '', cells: [], score: 0, reason: 'Tiles must form one word' };
      }
    } else {
      for (let r = sorted[0][0]; r <= sorted[sorted.length - 1][0]; r++) {
        if (!board[r][sorted[0][1]]) return { valid: false, word: '', cells: [], score: 0, reason: 'Tiles must form one word' };
      }
    }

    // Expand to include existing tiles flanking the placement
    let sr = sorted[0][0], sc = sorted[0][1];
    if (sameRow) while (sc > 0 && board[sr][sc - 1]) sc--;
    else while (sr > 0 && board[sr - 1][sc]) sr--;

    wordCells = [];
    let wr = sr, wc = sc;
    if (sameRow) while (wc < SIZE && board[wr][wc]) { wordCells.push([wr, wc]); wc++; }
    else while (wr < SIZE && board[wr][wc]) { wordCells.push([wr, wc]); wr++; }

    word = wordCells.map(([r, c]) => board[r][c]).join('');
  }
  if (word.length < 2) return { valid: false, word: '', cells: [], score: 0, reason: 'Word must be at least 2 letters' };
  if (!getActiveWordSet().has(word)) return { valid: false, word, cells: wordCells, score: 0, reason: `"${word}" is not in the dictionary` };

  // First move must touch center
  if (isFirstMove && !wordCells.some(([r, c]) => r === CENTER && c === CENTER)) {
    return { valid: false, word, cells: wordCells, score: 0, reason: 'First word must cross the center star' };
  }
  // Subsequent moves: at least one new tile must be adjacent to a previously-locked tile
  if (!isFirstMove) {
    const touches = cells.some(([r, c]) =>
      (r > 0 && lockedCells.has(`${r - 1},${c}`)) ||
      (r < SIZE - 1 && lockedCells.has(`${r + 1},${c}`)) ||
      (c > 0 && lockedCells.has(`${r},${c - 1}`)) ||
      (c < SIZE - 1 && lockedCells.has(`${r},${c + 1}`))
    );
    if (!touches) return { valid: false, word, cells: wordCells, score: 0, reason: 'New tiles must connect to existing words' };
  }

  // Validate cross-words formed by new tiles
  const newCellsArr = cells.map(([r, c]) => ({ r, c, letter: board[r][c]! }));
  const crossBonus = validateAndScoreCrossWords(board, newCellsArr, dir);
  if (crossBonus < 0) return { valid: false, word, cells: wordCells, score: 0, reason: 'Invalid cross-word formed' };

  const newCellSet = new Set(cells.map(([r, c]) => `${r},${c}`));
  const mainScore = scorePlacement(board, wordCells, newCellSet);
  const all7Bonus = cells.length === 7 ? 50 : 0;
  const breakdown = buildScoreBreakdown(board, wordCells, newCellSet, crossBonus, all7Bonus);
  return { valid: true, word, cells: wordCells, score: mainScore + crossBonus + all7Bonus, breakdown };
}
