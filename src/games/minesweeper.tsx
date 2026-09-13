import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { GameProps } from '@/types';
import { scaleFromLast } from '@/lib/endless-stage';
import { playMove, playCapture, playLose } from '@/lib/feedback';

type Phase = 'ready' | 'playing' | 'won' | 'lost';

interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
}

const CONFIG: Record<number, { size: number; mines: number }> = {
  1: { size: 6, mines: 5 },
  2: { size: 7, mines: 7 },
  3: { size: 8, mines: 10 },
  4: { size: 8, mines: 12 },
  5: { size: 9, mines: 15 },
  6: { size: 9, mines: 18 },
  7: { size: 10, mines: 20 },
};

// Classic minesweeper number colours (1–8 adjacent mines).
const NUMBER_COLORS = [
  '', 'text-sky-400', 'text-emerald-400', 'text-red-400', 'text-violet-400',
  'text-amber-400', 'text-teal-400', 'text-rose-400', 'text-text-muted',
];

function neighbors(i: number, size: number): number[] {
  const r = Math.floor(i / size), c = i % size;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) out.push(nr * size + nc);
    }
  }
  return out;
}

// Mines are placed after the first tap so the opening move is always safe —
// the tapped cell and its neighbours are kept clear.
function buildBoard(size: number, mines: number, safeIdx: number): Cell[] {
  const forbidden = new Set([safeIdx, ...neighbors(safeIdx, size)]);
  const cells: Cell[] = Array.from({ length: size * size }, () => ({
    mine: false, revealed: false, flagged: false, adjacent: 0,
  }));
  const candidates = cells.map((_, i) => i).filter(i => !forbidden.has(i));
  let placed = 0;
  while (placed < mines && candidates.length > 0) {
    const pick = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
    cells[pick].mine = true;
    placed++;
  }
  for (let i = 0; i < cells.length; i++) {
    cells[i].adjacent = neighbors(i, size).filter(n => cells[n].mine).length;
  }
  return cells;
}

function floodReveal(cells: Cell[], start: number, size: number): number {
  let revealed = 0;
  const stack = [start];
  while (stack.length > 0) {
    const i = stack.pop()!;
    const cell = cells[i];
    if (cell.revealed || cell.flagged) continue;
    cell.revealed = true;
    revealed++;
    if (cell.adjacent === 0 && !cell.mine) {
      for (const n of neighbors(i, size)) {
        if (!cells[n].revealed && !cells[n].flagged) stack.push(n);
      }
    }
  }
  return revealed;
}

export default function Minesweeper({ stage, onScore, onProgress, onEnd, onMessage, paused }: GameProps) {
  const config = useMemo(() => scaleFromLast(stage, CONFIG, {
    size: 0.02, mines: 0.1,
  }, {
    size: 10, mines: 28,
  }), [stage]);
  const totalSafe = config.size * config.size - config.mines;
  const parTime = config.size * config.size * 2;

  const [phase, setPhase] = useState<Phase>('ready');
  const [board, setBoard] = useState<Cell[] | null>(null);
  const [flagMode, setFlagMode] = useState(false);
  const [flagsUsed, setFlagsUsed] = useState(0);
  const [revealedSafe, setRevealedSafe] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const endedRef = useRef(false);
  const scoreRef = useRef(0);
  const revealedRef = useRef(0);
  const boardRef = useRef<Cell[] | null>(null);
  const elapsedRef = useRef(0);
  const onEndRef = useRef(onEnd);
  const onScoreRef = useRef(onScore);
  const onProgressRef = useRef(onProgress);
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);
  useEffect(() => { onScoreRef.current = onScore; }, [onScore]);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { revealedRef.current = revealedSafe; }, [revealedSafe]);
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);

  // Game clock — freezes while the app reports itself paused.
  useEffect(() => {
    if (phase !== 'playing' || paused) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase, paused]);

  const finish = useCallback((won: boolean) => {
    if (endedRef.current) return;
    endedRef.current = true;
    const base = revealedRef.current * 5;
    const timeBonus = won ? Math.max(0, parTime - elapsedRef.current) : 0;
    const finalScore = base + (won ? config.mines * 15 + timeBonus : 0);
    setPhase(won ? 'won' : 'lost');
    if (!won) playLose();
    const stars = won ? (elapsedRef.current <= parTime ? 3 : 2) : 1;
    const summary = won
      ? `Board cleared in ${elapsedRef.current}s with ${config.mines} mines! Brilliant deduction! 🕵️`
      : `Boom! You revealed ${revealedRef.current} safe squares before hitting a mine. Flag suspicious cells!`;
    onEndRef.current({ score: finalScore, stars, summary });
  }, [config.mines, parTime]);

  const reveal = useCallback((idx: number) => {
    if (phase !== 'playing' || endedRef.current) return;
    // First tap builds the board with that cell guaranteed safe.
    const current = boardRef.current ?? buildBoard(config.size, config.mines, idx);
    const cell = current[idx];
    if (cell.revealed || cell.flagged) return;

    const next = current.map(c => ({ ...c }));
    if (next[idx].mine) {
      next.forEach(c => { if (c.mine) c.revealed = true; });
      next[idx].revealed = true;
      setBoard(next);
      boardRef.current = next;
      onMessageRef.current('💥 Boom! That was a mine.');
      finish(false);
      return;
    }

    const count = floodReveal(next, idx, config.size);
    const newRevealed = revealedRef.current + count;
    setBoard(next);
    boardRef.current = next;
    setRevealedSafe(newRevealed);
    onScoreRef.current(count * 5);
    onProgressRef.current(newRevealed / totalSafe);
    playMove();
    if (count > 4) onMessageRef.current(`Nice! ${count} squares opened up.`);

    if (newRevealed >= totalSafe) finish(true);
  }, [phase, config.size, config.mines, totalSafe, finish]);

  const toggleFlag = useCallback((idx: number) => {
    if (phase !== 'playing' || endedRef.current) return;
    const current = boardRef.current;
    if (!current || current[idx].revealed) return;
    const next = current.map(c => ({ ...c }));
    next[idx].flagged = !next[idx].flagged;
    setBoard(next);
    boardRef.current = next;
    setFlagsUsed(f => f + (next[idx].flagged ? 1 : -1));
    playMove();
  }, [phase]);

  const handleCell = useCallback((idx: number) => {
    if (flagMode) toggleFlag(idx);
    else reveal(idx);
  }, [flagMode, toggleFlag, reveal]);

  const startGame = useCallback(() => {
    endedRef.current = false;
    scoreRef.current = 0;
    setBoard(null); // built lazily on the first tap
    setFlagMode(false);
    setFlagsUsed(0);
    setRevealedSafe(0);
    setElapsed(0);
    setPhase('playing');
    onProgressRef.current(0);
  }, [config.size, config.mines]);

  if (phase === 'ready') {
    return (
      <div className="flex flex-col h-full min-h-[350px] items-center justify-center gap-5 px-4">
        <div className="text-6xl">💣</div>
        <h2 className="text-xl font-bold text-text">Minesweeper</h2>
        <div className="bg-card rounded-2xl p-4 w-full max-w-xs space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Board</span>
            <span className="font-bold text-text">{config.size}×{config.size}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Mines</span>
            <span className="font-bold text-danger">{config.mines}</span>
          </div>
        </div>
        <p className="text-text-muted text-sm text-center max-w-xs">
          Tap squares to reveal them. Numbers count nearby mines — switch to
          🚩 Flag mode (or right-click) to mark them!
        </p>
        <button
          onClick={startGame}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 transition-all"
        >
          Start Game
        </button>
      </div>
    );
  }

  // Before the first tap the board is all-hidden cells.
  const cells = board ?? Array.from({ length: config.size * config.size }, () => ({
    mine: false, revealed: false, flagged: false, adjacent: 0,
  }));

  return (
    <div className="h-full flex flex-col items-center p-3 gap-3">
      {/* Status bar */}
      <div className="flex items-center gap-2 w-full max-w-sm">
        <div className="flex-1 bg-card rounded-xl px-3 py-2 text-sm font-bold flex items-center gap-1.5">
          <span aria-hidden>💣</span>
          <span className="text-text">{Math.max(0, config.mines - flagsUsed)}</span>
        </div>
        <button
          onClick={() => setFlagMode(f => !f)}
          aria-pressed={flagMode}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
            flagMode
              ? 'bg-warning/20 text-warning border-warning/40'
              : 'bg-card text-text-muted border-white/5 hover:text-text'
          }`}
        >
          {flagMode ? '🚩 Flagging' : '⛏️ Digging'}
        </button>
        <div className="flex-1 bg-card rounded-xl px-3 py-2 text-sm font-bold text-right">
          <span className={elapsed > parTime ? 'text-danger' : 'text-text'}>⏱ {elapsed}s</span>
        </div>
      </div>

      {/* Board */}
      <div
        role="grid"
        aria-label={`Minesweeper board, ${config.size} by ${config.size}`}
        className={`grid gap-1 w-full flex-shrink-0 ${phase === 'lost' ? 'opacity-90' : ''}`}
        style={{
          gridTemplateColumns: `repeat(${config.size}, minmax(0, 1fr))`,
          maxWidth: Math.min(config.size * 44, 430),
        }}
      >
        {cells.map((cell, i) => {
          const row = Math.floor(i / config.size) + 1;
          const col = (i % config.size) + 1;
          const label = cell.flagged
            ? `Row ${row}, column ${col}: flagged`
            : cell.revealed
              ? cell.mine
                ? `Row ${row}, column ${col}: mine`
                : cell.adjacent === 0
                  ? `Row ${row}, column ${col}: empty`
                  : `Row ${row}, column ${col}: ${cell.adjacent} adjacent mines`
              : `Row ${row}, column ${col}: hidden`;
          return (
            <button
              key={i}
              onClick={() => handleCell(i)}
              onContextMenu={e => { e.preventDefault(); toggleFlag(i); }}
              aria-label={label}
              disabled={phase !== 'playing'}
              className={`game-cell aspect-square rounded-md flex items-center justify-center font-black transition-all select-none ${
                cell.revealed
                  ? cell.mine
                    ? 'bg-danger/80 text-bg text-base'
                    : 'bg-surface border border-white/5 text-sm'
                  : 'bg-card hover:bg-card-hover border border-white/10 active:scale-90 text-sm'
              }`}
            >
              {cell.revealed
                ? cell.mine
                  ? '💣'
                  : cell.adjacent > 0
                    ? <span className={NUMBER_COLORS[cell.adjacent]}>{cell.adjacent}</span>
                    : ''
                : cell.flagged ? '🚩' : ''}
            </button>
          );
        })}
      </div>

      <p className="text-text-muted text-xs text-center">
        {phase === 'won' && '🎉 Board cleared!'}
        {phase === 'lost' && '💥 You hit a mine!'}
        {phase === 'playing' && `${revealedSafe}/${totalSafe} safe squares revealed`}
      </p>
    </div>
  );
}
