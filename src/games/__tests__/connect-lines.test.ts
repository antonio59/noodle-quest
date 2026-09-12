/**
 * Connect Lines generation regression tests.
 *
 * The random rotation scramble could land already-solved (line pieces have
 * 2-fold symmetry), so the game would mount in a completed state and award
 * a free win. buildPuzzle now nudges one rotatable tile when that happens.
 */
import { describe, it, expect } from 'vitest';
import { buildPuzzle, isSolved } from '../connect-lines';

describe('buildPuzzle', () => {
  it('produces a solved reference board and an unsolved scramble for many seeds', () => {
    for (const size of [5, 6, 7]) {
      for (let seed = 1; seed <= 150; seed++) {
        const { solved, scrambled } = buildPuzzle(size, seed);
        expect(isSolved(solved), `size ${size} seed ${seed}: reference board not solved`).toBe(true);
        expect(
          isSolved(scrambled),
          `size ${size} seed ${seed}: scramble is already solved — player gets a free win`,
        ).toBe(false);
      }
    }
  });

  it('scramble differs from the solved board', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { solved, scrambled } = buildPuzzle(5, seed);
      const differs = solved.tiles.some((row, r) =>
        row.some((t, c) => t.rotation !== scrambled.tiles[r][c].rotation)
      );
      expect(differs, `seed ${seed}: scramble identical to solution`).toBe(true);
    }
  });
});
