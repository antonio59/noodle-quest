/**
 * Sudoku puzzle-data regression tests.
 *
 * The original dataset was catastrophically broken: 6 of 15 puzzles were
 * unsolvable, 4 had multiple solutions, 4 had stored solutions that
 * contradicted the givens, and stage selection pinned players to one
 * puzzle per difficulty band forever. These tests verify every stored
 * puzzle is solvable with a unique solution equal to the stored one, and
 * that all 15 puzzles are reachable through stage progression.
 */
import { describe, it, expect } from 'vitest';
import { PUZZLES, parsePuzzle, isSolvedGrid, getPuzzleIndex } from '../sudoku';

/** Backtracking solver; returns the number of solutions found (capped at limit). */
function countSolutions(grid: number[][], limit = 2): number {
  let found = 0;
  const g = grid.map(r => [...r]);
  function solve(): boolean {
    if (found >= limit) return true;
    let br = -1, bc = -1;
    outer: for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (g[r][c] === 0) { br = r; bc = c; break outer; }
      }
    }
    if (br === -1) { found++; return found >= limit; }
    for (let v = 1; v <= 9; v++) {
      let ok = true;
      for (let i = 0; i < 9 && ok; i++) {
        if (g[br][i] === v || g[i][bc] === v) ok = false;
      }
      const rr = 3 * Math.floor(br / 3), cc = 3 * Math.floor(bc / 3);
      for (let r = 0; r < 3 && ok; r++)
        for (let c = 0; c < 3 && ok; c++)
          if (g[rr + r][cc + c] === v) ok = false;
      if (!ok) continue;
      g[br][bc] = v;
      if (solve()) return true;
      g[br][bc] = 0;
    }
    return false;
  }
  solve();
  return found;
}

describe('sudoku puzzle data', () => {
  it('has 15 puzzles in 3 difficulty bands', () => {
    expect(PUZZLES).toHaveLength(15);
  });

  it.each(PUZZLES.map((_, i) => i))('puzzle %i is well-formed and uniquely solvable', (i) => {
    const [pStr, sStr] = PUZZLES[i];
    expect(pStr).toMatch(/^[0-9]{81}$/);
    expect(sStr).toMatch(/^[1-9]{81}$/);

    const puzzle = parsePuzzle(pStr);
    const solution = parsePuzzle(sStr);

    // Stored solution is a valid completed grid.
    expect(isSolvedGrid(solution), `puzzle ${i}: stored solution is not a valid sudoku`).toBe(true);

    // Every given agrees with the stored solution.
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (puzzle[r][c] !== 0) {
          expect(puzzle[r][c], `puzzle ${i}: given (${r},${c}) contradicts stored solution`).toBe(solution[r][c]);
        }
      }
    }

    // The puzzle has exactly one solution — never unwinnable or ambiguous.
    expect(countSolutions(puzzle), `puzzle ${i}: does not have a unique solution`).toBe(1);
  });

  it.each(PUZZLES.map((_, i) => i))('puzzle %i clue count matches its difficulty band', (i) => {
    const clues = PUZZLES[i][0].split('').filter(ch => ch !== '0').length;
    if (i < 5) expect(clues).toBeGreaterThanOrEqual(36);       // easy
    else if (i < 10) expect(clues).toBeGreaterThanOrEqual(30); // medium
    else expect(clues).toBeLessThanOrEqual(30);                // hard
  });
});

describe('getPuzzleIndex stage mapping', () => {
  it('early stages use easy puzzles, mid medium, late hard', () => {
    for (const stage of [1, 2, 3]) expect(getPuzzleIndex(stage)).toBeLessThan(5);
    for (const stage of [4, 5, 6, 7]) expect(getPuzzleIndex(stage)).toBeGreaterThanOrEqual(5);
    for (const stage of [4, 5, 6, 7]) expect(getPuzzleIndex(stage)).toBeLessThan(10);
    for (const stage of [8, 9, 10, 20]) expect(getPuzzleIndex(stage)).toBeGreaterThanOrEqual(10);
  });

  it('every puzzle is reachable via play rotation and each stage maps into range', () => {
    const reached = new Set<number>();
    for (let stage = 1; stage <= 30; stage++) {
      for (let plays = 0; plays < 5; plays++) {
        const idx = getPuzzleIndex(stage, plays);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(PUZZLES.length);
        reached.add(idx);
      }
    }
    expect(reached.size).toBe(PUZZLES.length);
  });

  it('repeated plays of the same stage cycle through the band', () => {
    const seen = new Set<number>();
    for (let plays = 0; plays < 5; plays++) seen.add(getPuzzleIndex(1, plays));
    expect(seen.size).toBe(5);
  });
});

describe('isSolvedGrid', () => {
  it('accepts a valid completed grid and rejects invalid ones', () => {
    const solution = parsePuzzle(PUZZLES[0][1]);
    expect(isSolvedGrid(solution)).toBe(true);

    // Any zero makes it incomplete.
    const incomplete = solution.map(r => [...r]);
    incomplete[4][4] = 0;
    expect(isSolvedGrid(incomplete)).toBe(false);

    // A duplicate in a column is invalid even if rows look fine.
    const broken = solution.map(r => [...r]);
    broken[0][0] = broken[1][0];
    expect(isSolvedGrid(broken)).toBe(false);
  });
});
