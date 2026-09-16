import { describe, it, expect } from 'vitest';
import { SIZE, emptyGrid, slideRow, move, spawnTile, hasMoves, maxTile, newGame, type Grid } from '../logic';

describe('slideRow', () => {
  it('slides and merges once per tile', () => {
    expect(slideRow([2, 2, 0, 0])).toEqual({ row: [4, 0, 0, 0], gained: 4 });
    expect(slideRow([2, 2, 2, 0])).toEqual({ row: [4, 2, 0, 0], gained: 4 });
    expect(slideRow([4, 4, 4, 4])).toEqual({ row: [8, 8, 0, 0], gained: 16 });
    expect(slideRow([0, 2, 0, 2])).toEqual({ row: [4, 0, 0, 0], gained: 4 });
    expect(slideRow([2, 0, 4, 8])).toEqual({ row: [2, 4, 8, 0], gained: 0 });
  });
});

describe('move', () => {
  const g: Grid = [
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [4, 0, 4, 0],
    [0, 0, 0, 0],
  ];

  it('moves left with merges', () => {
    const r = move(g, 'left');
    expect(r.grid[0]).toEqual([4, 0, 0, 0]);
    expect(r.grid[2]).toEqual([8, 0, 0, 0]);
    expect(r.gained).toBe(12);
    expect(r.moved).toBe(true);
  });

  it('moves right', () => {
    const r = move(g, 'right');
    expect(r.grid[0]).toEqual([0, 0, 0, 4]);
    expect(r.grid[2]).toEqual([0, 0, 0, 8]);
  });

  it('moves up/down via transpose', () => {
    const col: Grid = [
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [4, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    expect(move(col, 'up').grid[0][0]).toBe(4);
    expect(move(col, 'up').grid[1][0]).toBe(4);
    expect(move(col, 'down').grid[SIZE - 1][0]).toBe(4);
    expect(move(col, 'down').grid[SIZE - 2][0]).toBe(4);
  });

  it('reports no movement when nothing changes', () => {
    const full: Grid = [
      [2, 4, 8, 16],
      [4, 8, 16, 32],
      [8, 16, 32, 64],
      [16, 32, 64, 128],
    ];
    expect(move(full, 'left').moved).toBe(false);
    expect(move(full, 'up').moved).toBe(false);
  });
});

describe('spawn + game over', () => {
  it('spawns a 2 or 4 in an empty cell', () => {
    const g = spawnTile(emptyGrid(), () => 0);
    const vals = g.flat().filter(v => v !== 0);
    expect(vals).toEqual([2]);
  });

  it('newGame starts with exactly two tiles', () => {
    expect(newGame().flat().filter(v => v !== 0)).toHaveLength(2);
  });

  it('hasMoves detects empty cells, merges, and lock-up', () => {
    expect(hasMoves(emptyGrid())).toBe(true);
    const mergeable: Grid = [
      [2, 2, 8, 16],
      [4, 8, 16, 32],
      [8, 16, 32, 64],
      [16, 32, 64, 128],
    ];
    expect(hasMoves(mergeable)).toBe(true); // horizontal 2+2 merge
    const stuck: Grid = [
      [2, 4, 8, 16],
      [4, 8, 16, 32],
      [8, 16, 32, 64],
      [16, 32, 64, 128],
    ];
    expect(hasMoves(stuck)).toBe(false);
  });

  it('maxTile finds the largest tile', () => {
    const g = emptyGrid();
    g[2][3] = 256;
    expect(maxTile(g)).toBe(256);
  });
});
