import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '@/types';
import { RotateCw, Sparkles } from 'lucide-react';
import { GameArt } from '@/components/GameArt';

/**
 * Connect Lines: tap tiles to rotate their pipe segments. The puzzle is
 * solved when every pipe connection matches its neighbour (no dead ends).
 * The shape of each cell is fixed; only its rotation changes.
 */

type Shape = 'empty' | 'end' | 'line' | 'elbow' | 'tee' | 'cross';

// Each shape has a canonical set of connected directions (in unrotated form).
// Directions are 0=up, 1=right, 2=down, 3=left.
const CANONICAL: Record<Shape, number[]> = {
  empty: [],
  end: [2], // stub pointing down
  line: [0, 2],
  elbow: [1, 2], // right + down
  tee: [0, 1, 2],
  cross: [0, 1, 2, 3],
};

function rotate(dirs: number[], r: number): number[] {
  return dirs.map(d => (d + r) % 4);
}

function connections(shape: Shape, rotation: number): Set<number> {
  return new Set(rotate(CANONICAL[shape], rotation));
}

interface Tile {
  shape: Shape;
  rotation: number; // 0..3
}

interface Puzzle {
  rows: number;
  cols: number;
  tiles: Tile[][];
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a solved puzzle: build a spanning tree over the grid, derive the
 * shape of each tile from its tree neighbours, then scramble rotations so
 * the player has to fix them.
 */
export function buildPuzzle(size: number, seed: number): { solved: Puzzle; scrambled: Puzzle } {
  const rng = mulberry32(seed);
  const rows = size;
  const cols = size;
  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  // adjacency: for each cell, which of U/R/D/L are connected in the tree.
  const adj: Set<number>[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => new Set<number>()),
  );

  const stack: [number, number][] = [];
  const startR = Math.floor(rng() * rows);
  const startC = Math.floor(rng() * cols);
  visited[startR][startC] = true;
  stack.push([startR, startC]);

  // DFS with random neighbour order produces a spanning tree with winding paths.
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const dirs = [0, 1, 2, 3].sort(() => rng() - 0.5);
    let advanced = false;
    for (const d of dirs) {
      const nr = r + (d === 0 ? -1 : d === 2 ? 1 : 0);
      const nc = c + (d === 1 ? 1 : d === 3 ? -1 : 0);
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (visited[nr][nc]) continue;
      visited[nr][nc] = true;
      adj[r][c].add(d);
      adj[nr][nc].add((d + 2) % 4);
      stack.push([nr, nc]);
      advanced = true;
      break;
    }
    if (!advanced) stack.pop();
  }

  // Pick the canonical shape whose unrotated direction set matches (as a multiset of size).
  const shapeFromDirs = (dirs: Set<number>): { shape: Shape; rotation: number } => {
    const n = dirs.size;
    if (n === 0) return { shape: 'empty', rotation: 0 };
    if (n === 4) return { shape: 'cross', rotation: 0 };
    // Try every rotation and match against canonical shape with matching degree.
    const candidates: Shape[] =
      n === 1 ? ['end'] : n === 2 ? ['line', 'elbow'] : ['tee'];
    for (const shape of candidates) {
      for (let rot = 0; rot < 4; rot++) {
        const rotated = new Set(rotate(CANONICAL[shape], rot));
        if (rotated.size === dirs.size && [...rotated].every(d => dirs.has(d))) {
          return { shape, rotation: rot };
        }
      }
    }
    // Fallback — should never hit.
    return { shape: 'cross', rotation: 0 };
  };

  const solvedTiles: Tile[][] = [];
  const scrambledTiles: Tile[][] = [];
  for (let r = 0; r < rows; r++) {
    const solvedRow: Tile[] = [];
    const scrRow: Tile[] = [];
    for (let c = 0; c < cols; c++) {
      const { shape, rotation } = shapeFromDirs(adj[r][c]);
      solvedRow.push({ shape, rotation });
      const randRot = shape === 'cross' ? 0 : Math.floor(rng() * 4);
      scrRow.push({ shape, rotation: randRot });
    }
    solvedTiles.push(solvedRow);
    scrambledTiles.push(scrRow);
  }

  const scrambledPuzzle: Puzzle = { rows, cols, tiles: scrambledTiles };
  // A random scramble can land already-solved (line tiles are symmetric) —
  // nudge one rotatable tile so the player never gets a free win.
  if (isSolved(scrambledPuzzle)) {
    outer: for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = scrambledTiles[r][c];
        if (t.shape !== 'empty' && t.shape !== 'cross') {
          t.rotation = (t.rotation + 1) % 4;
          break outer;
        }
      }
    }
  }

  return { solved: { rows, cols, tiles: solvedTiles }, scrambled: scrambledPuzzle };
}

/** True iff every connection between neighbouring tiles matches on both sides. */
export function isSolved(p: Puzzle): boolean {
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      const here = connections(p.tiles[r][c].shape, p.tiles[r][c].rotation);
      for (const d of [0, 1, 2, 3]) {
        const nr = r + (d === 0 ? -1 : d === 2 ? 1 : 0);
        const nc = c + (d === 1 ? 1 : d === 3 ? -1 : 0);
        const hasEdge = here.has(d);
        if (nr < 0 || nr >= p.rows || nc < 0 || nc >= p.cols) {
          if (hasEdge) return false; // pipe leads off the grid
          continue;
        }
        const neighbour = connections(p.tiles[nr][nc].shape, p.tiles[nr][nc].rotation);
        const neighbourHasEdge = neighbour.has((d + 2) % 4);
        if (hasEdge !== neighbourHasEdge) return false;
      }
    }
  }
  return true;
}

/** Count matched connections for progress reporting. */
function matchRatio(p: Puzzle): number {
  let total = 0;
  let matched = 0;
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      const here = connections(p.tiles[r][c].shape, p.tiles[r][c].rotation);
      for (const d of [0, 1, 2, 3]) {
        total++;
        const nr = r + (d === 0 ? -1 : d === 2 ? 1 : 0);
        const nc = c + (d === 1 ? 1 : d === 3 ? -1 : 0);
        const hasEdge = here.has(d);
        if (nr < 0 || nr >= p.rows || nc < 0 || nc >= p.cols) {
          if (!hasEdge) matched++;
          continue;
        }
        const neighbour = connections(p.tiles[nr][nc].shape, p.tiles[nr][nc].rotation);
        if (hasEdge === neighbour.has((d + 2) % 4)) matched++;
      }
    }
  }
  return total === 0 ? 0 : matched / total;
}

function stageSize(stage: number): number {
  return Math.min(16, 4 + Math.floor((stage - 1) / 1.5));
}

export default function ConnectLinesGame({ stage = 1, onScore, onProgress, onEnd, onMessage }: Partial<GameProps>) {
  const size = stageSize(stage);
  const [ready, setReady] = useState(true);
  const [seed, setSeed] = useState(() => Date.now() + stage * 1000);
  const { scrambled } = useMemo(() => buildPuzzle(size, seed), [size, seed]);
  const [puzzle, setPuzzle] = useState<Puzzle>(scrambled);
  const [moves, setMoves] = useState(0);
  const startedAtRef = useRef(Date.now());
  const endedRef = useRef(false);

  // Rebuild when stage or seed changes.
  useEffect(() => {
    setPuzzle(scrambled);
    setMoves(0);
    startedAtRef.current = Date.now();
    endedRef.current = false;
  }, [scrambled]);

  const solved = isSolved(puzzle);
  const progress = matchRatio(puzzle);

  useEffect(() => {
    onProgress?.(progress);
  }, [progress, onProgress]);

  useEffect(() => {
    if (solved && !endedRef.current) {
      endedRef.current = true;
      const elapsedSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      const par = size * size;
      // Fewer moves + faster = more stars.
      const moveRatio = moves / (par * 1.5);
      const stars = moveRatio < 1 && elapsedSec < par * 6 ? 3 : moveRatio < 1.5 ? 2 : 1;
      const base = size * size * 10;
      const bonus = Math.max(0, par * 5 - moves * 2);
      const score = base + bonus;
      onScore?.(score);
      onMessage?.(`Solved in ${moves} moves, ${elapsedSec}s`);
      onEnd?.({
        score,
        stars,
        summary: `Connected a ${size}×${size} grid in ${moves} moves and ${elapsedSec}s.`,
      });
    }
  }, [solved, size, moves, onEnd, onScore, onMessage]);

  const rotateTile = (r: number, c: number) => {
    if (solved) return;
    setPuzzle(prev => {
      const tiles = prev.tiles.map(row => row.slice());
      const t = tiles[r][c];
      if (t.shape === 'empty' || t.shape === 'cross') return prev;
      tiles[r][c] = { ...t, rotation: (t.rotation + 1) % 4 };
      return { ...prev, tiles };
    });
    setMoves(m => m + 1);
  };

  if (ready) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 p-6 text-center">
        <GameArt gameId="connect-lines" emoji="🔌" size={80} />
        <h2 className="text-2xl font-bold text-accent">Connect Lines</h2>
        <div className="bg-card rounded-2xl p-4 max-w-xs w-full space-y-3 text-sm text-text-muted">
          <p>🔄 <span className="text-text">Tap</span> a pipe tile to rotate it</p>
          <p>🔗 <span className="text-text">Connect</span> every pipe so no ends are left hanging</p>
          <p>⭐ <span className="text-text">Fewer rotations</span> = higher score!</p>
        </div>
        <div className="text-text-muted text-sm">{size}×{size} grid · Stage {stage}</div>
        <button
          onClick={() => { setReady(false); startedAtRef.current = Date.now(); }}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 transition-all"
        >
          Start Puzzle 🔌
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
        <div className="text-sm font-semibold">
          {size}×{size} · {moves} moves
        </div>
        <button
          onClick={() => setSeed(Date.now())}
          className="bg-card hover:bg-card-hover text-text px-3 py-1.5 rounded-lg text-xs font-semibold transition"
        >
          <RotateCw size={12} className="inline mr-1" /> New
        </button>
      </div>

      {solved && (
        <div className="mx-4 mb-2 text-center p-2 bg-success/20 rounded-lg flex-shrink-0">
          <span className="text-success font-bold text-sm">🎉 Connected! Great puzzle solving!</span>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center overflow-auto p-3">
        <div
          className="grid gap-0 bg-slate-900/40 p-2 rounded-xl"
          style={{ gridTemplateColumns: `repeat(${size}, 2.5rem)` }}
        >
          {puzzle.tiles.map((row, r) =>
            row.map((tile, c) => (
              <button
                key={`${r}-${c}`}
                onClick={() => rotateTile(r, c)}
                disabled={tile.shape === 'empty' || tile.shape === 'cross' || solved}
                className="aspect-square flex items-center justify-center"
                aria-label={`Rotate ${tile.shape} at row ${r + 1} column ${c + 1}`}
              >
                <PipeGlyph tile={tile} solved={solved} />
              </button>
            ))
          )}
        </div>
      </div>

      <div className="px-4 pb-3 text-center text-[11px] text-text-muted flex items-center justify-center gap-1 flex-shrink-0">
        <Sparkles size={11} /> Tap tiles to rotate. Match every connection.
      </div>
    </div>
  );
}

function PipeGlyph({ tile, solved }: { tile: Tile; solved: boolean }) {
  const connected = connections(tile.shape, tile.rotation);
  const color = solved ? '#10b981' : '#60a5fa';
  const thickness = 7;
  const half = 50;

  if (tile.shape === 'empty') {
    return <div className="w-full h-full" />;
  }

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {/* Hub */}
      <circle cx={half} cy={half} r={thickness / 1.2} fill={color} />
      {/* Arms */}
      {connected.has(0) && (
        <rect x={half - thickness / 2} y={0} width={thickness} height={half} fill={color} />
      )}
      {connected.has(1) && (
        <rect x={half} y={half - thickness / 2} width={half} height={thickness} fill={color} />
      )}
      {connected.has(2) && (
        <rect x={half - thickness / 2} y={half} width={thickness} height={half} fill={color} />
      )}
      {connected.has(3) && (
        <rect x={0} y={half - thickness / 2} width={half} height={thickness} fill={color} />
      )}
    </svg>
  );
}
