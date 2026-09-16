/**
 * 2048 core logic — pure functions. Board is a 4×4 grid of numbers (0 = empty).
 */

export const SIZE = 4;
export type Grid = number[][];
export type Dir = 'left' | 'right' | 'up' | 'down';

export function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

/** Slide one row left, merging equal neighbours once each. Returns the row + points earned. */
export function slideRow(row: number[]): { row: number[]; gained: number } {
  const cells = row.filter(v => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < cells.length; i++) {
    if (i + 1 < cells.length && cells[i] === cells[i + 1]) {
      out.push(cells[i] * 2);
      gained += cells[i] * 2;
      i++; // each tile merges at most once per move
    } else {
      out.push(cells[i]);
    }
  }
  while (out.length < SIZE) out.push(0);
  return { row: out, gained };
}

function transpose(g: Grid): Grid {
  return g[0].map((_, c) => g.map(r => r[c]));
}

function reverseRows(g: Grid): Grid {
  return g.map(r => r.slice().reverse());
}

function sameGrid(a: Grid, b: Grid): boolean {
  return a.every((row, r) => row.every((v, c) => v === b[r][c]));
}

/** Apply a move; returns the new grid, points gained, and whether anything moved. */
export function move(grid: Grid, dir: Dir): { grid: Grid; gained: number; moved: boolean } {
  let work = grid;
  if (dir === 'up' || dir === 'down') work = transpose(work);
  if (dir === 'right' || dir === 'down') work = reverseRows(work);

  let gained = 0;
  const slid = work.map(row => {
    const { row: out, gained: g } = slideRow(row);
    gained += g;
    return out;
  });

  let next = slid;
  if (dir === 'right' || dir === 'down') next = reverseRows(next);
  if (dir === 'up' || dir === 'down') next = transpose(next);

  return { grid: next, gained, moved: !sameGrid(grid, next) };
}

/** Random empty cell gets a 2 (90%) or 4 (10%). Returns new grid, or same grid if full. */
export function spawnTile(grid: Grid, rand: () => number = Math.random): Grid {
  const empty: [number, number][] = [];
  grid.forEach((row, r) => row.forEach((v, c) => { if (v === 0) empty.push([r, c]); }));
  if (empty.length === 0) return grid;
  const [r, c] = empty[Math.floor(rand() * empty.length)];
  const next = grid.map(row => row.slice());
  next[r][c] = rand() < 0.9 ? 2 : 4;
  return next;
}

export function hasMoves(grid: Grid): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) return true;
      if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return true;
      if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return true;
    }
  }
  return false;
}

export function maxTile(grid: Grid): number {
  return Math.max(0, ...grid.flat());
}

export function newGame(rand: () => number = Math.random): Grid {
  return spawnTile(spawnTile(emptyGrid(), rand), rand);
}
