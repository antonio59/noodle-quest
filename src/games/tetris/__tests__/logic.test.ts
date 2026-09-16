import { describe, it, expect } from 'vitest';
import {
  COLS,
  ROWS,
  emptyBoard,
  pieceCells,
  collides,
  mergePiece,
  clearLines,
  scoreForClear,
  tickMsForLevel,
  levelForLines,
  nextFromBag,
  spawnPiece,
  rotatePiece,
  dropDistance,
  isTopOut,
  PIECE_IDS,
  type Piece,
} from '../logic';

const p = (id: Piece['id'], x = 3, y = 0, rot = 0): Piece => ({ id, x, y, rot });

describe('board + pieces', () => {
  it('creates an empty 10x20 board', () => {
    const b = emptyBoard();
    expect(b).toHaveLength(ROWS);
    expect(b[0]).toHaveLength(COLS);
    expect(b.flat().every(c => c === null)).toBe(true);
  });

  it('pieceCells returns 4 cells per piece', () => {
    for (const id of PIECE_IDS) {
      expect(pieceCells(p(id))).toHaveLength(4);
    }
  });

  it('collides with walls and floor', () => {
    const b = emptyBoard();
    expect(collides(b, p('I', -3, 0))).toBe(true); // off left edge
    expect(collides(b, p('I', COLS - 1, 0))).toBe(true); // off right edge
    expect(collides(b, p('O', 0, ROWS - 1))).toBe(true); // below floor
    expect(collides(b, p('O', 0, 0))).toBe(false);
  });

  it('collides with locked cells', () => {
    const b = emptyBoard();
    b[ROWS - 1][0] = '#fff';
    // O piece occupying (0,ROWS-1) after dropping to bottom
    const piece: Piece = { id: 'O', x: -1, y: ROWS - 2, rot: 0 };
    expect(collides(b, piece)).toBe(true);
  });
});

describe('line clears', () => {
  it('clears a full row and shifts down', () => {
    const b = emptyBoard();
    b[ROWS - 1] = Array(COLS).fill('#fff');
    b[ROWS - 2][4] = '#abc';
    const { board, cleared } = clearLines(b);
    expect(cleared).toBe(1);
    expect(board[ROWS - 1][4]).toBe('#abc'); // the lone block dropped a row
    expect(board[ROWS - 1].filter(Boolean)).toHaveLength(1);
  });

  it('clears multiple rows at once', () => {
    const b = emptyBoard();
    b[ROWS - 1] = Array(COLS).fill('#fff');
    b[ROWS - 2] = Array(COLS).fill('#fff');
    b[ROWS - 3] = Array(COLS).fill('#fff');
    const { cleared } = clearLines(b);
    expect(cleared).toBe(3);
  });

  it('scores by clear size and level', () => {
    expect(scoreForClear(1, 0)).toBe(40);
    expect(scoreForClear(4, 0)).toBe(1200);
    expect(scoreForClear(4, 2)).toBe(3600);
    expect(scoreForClear(0, 5)).toBe(0);
  });
});

describe('bag randomizer', () => {
  it('deals each of the 7 pieces exactly once per bag', () => {
    const bag: Piece['id'][] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 7; i++) seen.add(nextFromBag(bag));
    expect(seen.size).toBe(7);
    expect([...seen].sort()).toEqual([...PIECE_IDS].sort());
  });

  it('refills the bag when empty', () => {
    const bag: Piece['id'][] = [];
    const draws = Array.from({ length: 14 }, () => nextFromBag(bag));
    expect(draws).toHaveLength(14);
    for (const d of draws) expect(PIECE_IDS).toContain(d);
  });
});

describe('movement', () => {
  it('spawned pieces are not colliding on an empty board', () => {
    for (const id of PIECE_IDS) {
      expect(collides(emptyBoard(), spawnPiece(id))).toBe(false);
    }
  });

  it('rotation succeeds in open space and cycles through 4 states', () => {
    const b = emptyBoard();
    let piece = p('T', 4, 5);
    for (let i = 0; i < 4; i++) {
      const next = rotatePiece(b, piece, 1);
      expect(next).not.toBeNull();
      piece = next!;
    }
    expect(piece.rot).toBe(0);
  });

  it('wall kick lets a piece rotate near the left wall', () => {
    const b = emptyBoard();
    // I vertical at x=-1 would be off-board; rotating from horizontal at wall.
    const piece = p('I', 0, 5, 1); // vertical: cells at x=2
    const kicked = rotatePiece(b, piece, 1);
    expect(kicked).not.toBeNull();
    expect(collides(b, kicked!)).toBe(false);
  });

  it('returns null when no rotation fits', () => {
    const b = emptyBoard();
    // Surround a T piece so every kick position collides.
    const piece = p('T', 4, 5);
    for (let y = 4; y <= 8; y++)
      for (let x = 3; x <= 7; x++) b[y][x] = '#fff';
    // Carve out only the piece's own cells.
    for (const [x, y] of pieceCells(piece)) b[y][x] = null;
    expect(rotatePiece(b, piece, 1)).toBeNull();
  });

  it('dropDistance reaches the floor', () => {
    const b = emptyBoard();
    const piece = p('O', 4, 0);
    // O occupies y..y+1 → falls until bottom row is ROWS-1
    expect(dropDistance(b, piece)).toBe(ROWS - 2);
  });

  it('dropDistance stops on a stack', () => {
    const b = emptyBoard();
    b[ROWS - 1][5] = '#fff'; // blocker under the piece's column
    const piece = p('O', 4, 0); // cells at x=5,6
    expect(dropDistance(b, piece)).toBe(ROWS - 3);
  });

  it('mergePiece locks the piece color into the board', () => {
    const b = emptyBoard();
    const merged = mergePiece(b, p('I', 0, ROWS - 2, 0)); // horizontal I on bottom row
    expect(merged[ROWS - 1].slice(0, 4).every(c => c !== null)).toBe(true);
  });

  it('isTopOut detects spawn collision', () => {
    const b = emptyBoard();
    // Fill the spawn zone.
    for (let x = 0; x < COLS; x++) b[0][x] = '#fff';
    expect(isTopOut(b, spawnPiece('T'))).toBe(true);
    expect(isTopOut(emptyBoard(), spawnPiece('T'))).toBe(false);
  });
});

describe('levels', () => {
  it('levels up every 10 lines', () => {
    expect(levelForLines(0)).toBe(0);
    expect(levelForLines(9)).toBe(0);
    expect(levelForLines(10)).toBe(1);
    expect(levelForLines(25)).toBe(2);
  });

  it('tick gets faster with level and floors at 120ms', () => {
    expect(tickMsForLevel(0)).toBe(800);
    expect(tickMsForLevel(5)).toBe(500);
    expect(tickMsForLevel(50)).toBe(120);
  });
});
