/**
 * Bookworm timeout-scoring regression test.
 *
 * The countdown interval captured `totalScore` from the render in which the
 * effect ran, so a player who scored points and then ran out of time got a
 * final onEnd report of score 0. The fix mirrors the score into a ref.
 *
 * This test renders the real game, finds an actual dictionary word on the
 * generated board, submits it, then runs the clock out and asserts the
 * reported score is the earned one — not 0.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act } from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import BookwormGame, { DICTIONARY } from '../bookworm';

const COLS = 7;
const ROWS = 7;

// All proper prefixes of dictionary words, for DFS pruning.
const PREFIXES = (() => {
  const s = new Set<string>();
  for (const w of DICTIONARY) for (let i = 1; i < w.length; i++) s.add(w.slice(0, i));
  return s;
})();

/** Find a path of adjacent cells spelling a dictionary word (len >= 3). */
function findWordPath(board: string[][]): [number, number][] | null {
  const dirs = [-1, 0, 1];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const path: [number, number][] = [[r, c]];
      const seen = new Set([`${r},${c}`]);
      let word = board[r][c];
      const dfs = (): [number, number][] | null => {
        if (word.length >= 3 && DICTIONARY.has(word)) return [...path];
        if (word.length >= 7 || !PREFIXES.has(word)) return null;
        const [pr, pc] = path[path.length - 1];
        for (const dr of dirs) {
          for (const dc of dirs) {
            if (dr === 0 && dc === 0) continue;
            const nr = pr + dr, nc = pc + dc;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || seen.has(`${nr},${nc}`)) continue;
            seen.add(`${nr},${nc}`);
            path.push([nr, nc]);
            const saved = word;
            word += board[nr][nc];
            const hit = dfs();
            if (hit) return hit;
            word = saved;
            path.pop();
            seen.delete(`${nr},${nc}`);
          }
        }
        return null;
      };
      const hit = dfs();
      if (hit) return hit;
    }
  }
  return null;
}

describe('Bookworm timeout scoring', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000); // fixed seed for buildBoard(Date.now())
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('reports the earned score when the clock runs out', async () => {
    const onEnd = vi.fn();
    const onScore = vi.fn();
    const { container, getByRole, getAllByRole } = render(
      <BookwormGame stage={1} onEnd={onEnd} onScore={onScore} onProgress={vi.fn()} onMessage={vi.fn()} />,
    );

    await act(async () => {
      fireEvent.click(getByRole('button', { name: /start reading/i }));
    });

    // Read the rendered 7x7 board (cell buttons are the aspect-square tiles).
    const cellButtons = Array.from(container.querySelectorAll('button.aspect-square'));
    expect(cellButtons).toHaveLength(ROWS * COLS);
    const board: string[][] = [];
    for (let r = 0; r < ROWS; r++) {
      const row: string[] = [];
      for (let c = 0; c < COLS; c++) row.push(cellButtons[r * COLS + c].textContent!.toUpperCase());
      board.push(row);
    }

    const path = findWordPath(board);
    expect(path, 'no dictionary word path found on generated board').not.toBeNull();

    await act(async () => {
      for (const [r, c] of path!) {
        fireEvent.click(cellButtons[r * COLS + c]);
      }
    });
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /submit/i }));
    });

    const gained = (onScore.mock.calls as number[][]).reduce((s, c) => s + (c[0] as number), 0);
    expect(gained).toBeGreaterThan(0);
    expect(onEnd).not.toHaveBeenCalled();

    // Run the clock out (stage 1 limit is 180s).
    await act(async () => {
      vi.advanceTimersByTime(181_000);
    });

    expect(onEnd).toHaveBeenCalledTimes(1);
    const result = onEnd.mock.calls[0][0] as { score: number; stars: number; summary: string };
    expect(result.score).toBe(gained); // was 0 before the stale-closure fix
    expect(result.stars).toBeGreaterThanOrEqual(0);
    expect(result.stars).toBeLessThanOrEqual(3);
  });
});
