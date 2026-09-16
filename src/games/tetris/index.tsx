import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { GameProps } from '@/types';
import { scaleFromLast } from '@/lib/endless-stage';
import { playMove, playPlace, playCapture, playLose, playWin } from '@/lib/feedback';
import {
  COLS, ROWS, emptyBoard, pieceCells, collides, mergePiece, clearLines,
  scoreForClear, tickMsForLevel, levelForLines, nextFromBag, spawnPiece,
  rotatePiece, dropDistance, isTopOut, PIECE_COLORS,
  type Board, type Piece, type PieceId,
} from './logic';

type Phase = 'ready' | 'playing' | 'won' | 'lost';

const CONFIG: Record<number, { target: number; level: number }> = {
  1: { target: 8, level: 0 },
  2: { target: 10, level: 1 },
  3: { target: 12, level: 2 },
  4: { target: 15, level: 3 },
  5: { target: 18, level: 4 },
};

export default function Tetris({ stage, onScore, onProgress, onEnd, onMessage, paused }: GameProps) {
  const config = useMemo(() => scaleFromLast(stage, CONFIG, {
    target: 0.15, level: 0.2,
  }, {
    target: 40, level: 11,
  }), [stage]);

  const [phase, setPhase] = useState<Phase>('ready');
  const [board, setBoard] = useState<Board>(() => emptyBoard());
  const [piece, setPiece] = useState<Piece | null>(null);
  const [nextId, setNextId] = useState<PieceId>('T');
  const [lines, setLines] = useState(0);
  const [clearedFlash, setClearedFlash] = useState<number[]>([]);

  const bagRef = useRef<PieceId[]>([]);
  const boardRef = useRef<Board>(board);
  const pieceRef = useRef<Piece | null>(piece);
  const linesRef = useRef(0);
  const scoreRef = useRef(0);
  const endedRef = useRef(false);
  const phaseRef = useRef<Phase>(phase);
  const pausedRef = useRef(paused);
  const onEndRef = useRef(onEnd);
  const onScoreRef = useRef(onScore);
  const onProgressRef = useRef(onProgress);
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);
  useEffect(() => { onScoreRef.current = onScore; }, [onScore]);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { pieceRef.current = piece; }, [piece]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const level = levelForLines(lines) + config.level;
  const ghostDrop = piece ? dropDistance(board, piece) : 0;

  const finish = useCallback((won: boolean) => {
    if (endedRef.current) return;
    endedRef.current = true;
    const total = linesRef.current;
    const stars = won ? (scoreRef.current >= config.target * 120 ? 3 : 2) : total > 0 ? 1 : 0;
    const summary = won
      ? `${total} lines cleared — beautiful stacking! 🧱`
      : `Stack reached the top after ${total} line${total === 1 ? '' : 's'}. Keep the well flat and watch the next piece!`;
    if (won) playWin(); else playLose();
    onEndRef.current({ score: scoreRef.current, stars, summary });
  }, [config.target]);

  const lockPiece = useCallback((p: Piece) => {
    const merged = mergePiece(boardRef.current, p);
    const { board: clearedBoard, cleared } = clearLines(merged);
    if (cleared > 0) {
      const rows = merged.map((r, i) => r.every(c => c !== null) ? i : -1).filter(i => i >= 0);
      setClearedFlash(rows);
      setTimeout(() => setClearedFlash([]), 220);
      const pts = scoreForClear(cleared, levelForLines(linesRef.current) + config.level);
      scoreRef.current += pts;
      onScoreRef.current(pts);
      linesRef.current += cleared;
      setLines(linesRef.current);
      onProgressRef.current(Math.min(1, linesRef.current / config.target));
      playCapture();
      if (cleared === 4) onMessageRef.current('🌟 Tetris! Four lines at once!');
      else if (cleared >= 2) onMessageRef.current(`${cleared} lines!`);
    } else {
      playPlace();
    }
    boardRef.current = clearedBoard;
    setBoard(clearedBoard);

    if (linesRef.current >= config.target) {
      finish(true);
      return;
    }
    const next = spawnPiece(nextFromBag(bagRef.current));
    setNextId(bagRef.current.length > 0 ? bagRef.current[bagRef.current.length - 1] : 'T');
    if (isTopOut(clearedBoard, next)) {
      setPiece(null);
      pieceRef.current = null;
      finish(false);
      return;
    }
    pieceRef.current = next;
    setPiece(next);
  }, [config.level, config.target, finish]);

  const tryMove = useCallback((dx: number, dy: number): boolean => {
    const p = pieceRef.current;
    if (!p || phaseRef.current !== 'playing' || pausedRef.current) return false;
    if (collides(boardRef.current, p, dx, dy)) return false;
    const next = { ...p, x: p.x + dx, y: p.y + dy };
    pieceRef.current = next;
    setPiece(next);
    return true;
  }, []);

  const softDrop = useCallback(() => {
    if (!tryMove(0, 1)) {
      const p = pieceRef.current;
      if (p) lockPiece(p);
    } else {
      scoreRef.current += 1;
      onScoreRef.current(1);
    }
  }, [tryMove, lockPiece]);

  const hardDrop = useCallback(() => {
    const p = pieceRef.current;
    if (!p || phaseRef.current !== 'playing' || pausedRef.current) return;
    const d = dropDistance(boardRef.current, p);
    const landed = { ...p, y: p.y + d };
    scoreRef.current += d * 2;
    onScoreRef.current(d * 2);
    lockPiece(landed);
  }, [lockPiece]);

  const rotate = useCallback(() => {
    const p = pieceRef.current;
    if (!p || phaseRef.current !== 'playing' || pausedRef.current) return;
    const next = rotatePiece(boardRef.current, p, 1);
    if (next) {
      pieceRef.current = next;
      setPiece(next);
      playMove();
    }
  }, []);

  // Gravity — freezes while paused.
  useEffect(() => {
    if (phase !== 'playing' || paused) return;
    const id = setInterval(() => {
      const p = pieceRef.current;
      if (!p) return;
      if (collides(boardRef.current, p, 0, 1)) lockPiece(p);
      else {
        const next = { ...p, y: p.y + 1 };
        pieceRef.current = next;
        setPiece(next);
      }
    }, tickMsForLevel(level));
    return () => clearInterval(id);
  }, [phase, paused, level, lockPiece]);

  // Keyboard controls.
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (pausedRef.current) return;
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); if (tryMove(-1, 0)) playMove(); break;
        case 'ArrowRight': e.preventDefault(); if (tryMove(1, 0)) playMove(); break;
        case 'ArrowDown': e.preventDefault(); softDrop(); break;
        case 'ArrowUp': case 'x': case 'X': e.preventDefault(); rotate(); break;
        case 'z': case 'Z': {
          e.preventDefault();
          const p = pieceRef.current;
          if (p) {
            const next = rotatePiece(boardRef.current, p, -1);
            if (next) { pieceRef.current = next; setPiece(next); playMove(); }
          }
          break;
        }
        case ' ': e.preventDefault(); hardDrop(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, tryMove, softDrop, hardDrop, rotate]);

  const startGame = useCallback(() => {
    bagRef.current = [];
    endedRef.current = false;
    scoreRef.current = 0;
    linesRef.current = 0;
    const b = emptyBoard();
    boardRef.current = b;
    setBoard(b);
    setLines(0);
    setClearedFlash([]);
    const first = nextFromBag(bagRef.current);
    setNextId(bagRef.current[bagRef.current.length - 1] ?? 'T');
    const spawned = spawnPiece(first);
    pieceRef.current = spawned;
    setPiece(spawned);
    onProgressRef.current(0);
    setPhase('playing');
  }, []);



  if (phase === 'ready') {
    return (
      <div className="flex flex-col h-full min-h-[350px] items-center justify-center gap-5 px-4">
        <div className="text-6xl" aria-hidden>🧱</div>
        <h2 className="text-xl font-bold text-text">Tetris</h2>
        <div className="bg-card rounded-2xl p-4 w-full max-w-xs space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Goal</span>
            <span className="font-bold text-text">Clear {config.target} lines</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Speed</span>
            <span className="font-bold text-warning">Level {config.level + 1}</span>
          </div>
        </div>
        <p className="text-text-muted text-sm text-center max-w-xs">
          Stack the falling blocks — a full row vanishes! Rotate with ↻,
          slam pieces down with ⤓.
        </p>
        <button
          onClick={startGame}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 transition"
        >
          Start Game
        </button>
      </div>
    );
  }

  // Compose the visible board: locked cells + ghost + active piece.
  const ghostCells = new Map<string, string>();
  const activeCells = new Map<string, string>();
  if (piece) {
    for (const [x, y] of pieceCells(piece, 0, ghostDrop)) {
      if (y >= 0) ghostCells.set(`${x},${y}`, PIECE_COLORS[piece.id]);
    }
    for (const [x, y] of pieceCells(piece)) {
      if (y >= 0) activeCells.set(`${x},${y}`, PIECE_COLORS[piece.id]);
    }
  }

  return (
    <div className="h-full flex flex-col items-center p-3 gap-2 select-none">
      {/* Status bar */}
      <div className="flex items-center gap-2 w-full max-w-sm">
        <div className="flex-1 bg-card rounded-xl px-3 py-1.5 text-xs font-bold text-center">
          <span className="text-text-muted">Lines </span>
          <span className="text-text">{lines}/{config.target}</span>
        </div>
        <div className="flex-1 bg-card rounded-xl px-3 py-1.5 text-xs font-bold text-center">
          <span className="text-text-muted">Level </span>
          <span className="text-warning">{level + 1}</span>
        </div>
        {/* Next piece */}
        <div className="bg-card rounded-xl px-2.5 py-1.5 flex items-center gap-1.5">
          <span className="text-[10px] text-text-muted font-semibold">Next</span>
          <NextPreview id={nextId} />
        </div>
      </div>

      {/* Board */}
      <div
        role="grid"
        aria-label={`Tetris board — ${lines} of ${config.target} lines cleared`}
        className="game-board relative bg-surface/60 rounded-xl border border-white/10 overflow-hidden flex-shrink"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
          aspectRatio: `${COLS}/${ROWS}`,
          height: 'min(58dvh, 460px)',
        }}
      >
        {board.map((row, y) =>
          row.map((cell, x) => {
            const key = `${x},${y}`;
            const active = activeCells.get(key);
            const ghost = !active && !cell ? ghostCells.get(key) : undefined;
            const flashing = clearedFlash.includes(y);
            return (
              <div
                key={key}
                aria-hidden
                className={flashing ? 'animate-pulse' : ''}
                style={{
                  background: active ?? cell ?? undefined,
                  boxShadow: active || cell
                    ? 'inset 0 0 0 1px rgba(255,255,255,0.18), inset 0 -3px 0 rgba(0,0,0,0.22)'
                    : ghost
                      ? `inset 0 0 0 1px ${ghost}55`
                      : 'inset 0 0 0 0.5px rgba(255,255,255,0.04)',
                }}
              />
            );
          }),
        )}
        {phase === 'lost' && (
          <div className="absolute inset-0 bg-bg/60 flex items-center justify-center">
            <span className="text-4xl" aria-hidden>🧱</span>
          </div>
        )}
      </div>

      {/* Touch controls */}
      <div className="w-full max-w-sm grid grid-cols-5 gap-2 flex-shrink-0" role="group" aria-label="Block controls">
        <TouchBtn label="Move left" onPress={() => { if (tryMove(-1, 0)) playMove(); }}>◀</TouchBtn>
        <TouchBtn label="Rotate" onPress={rotate}>↻</TouchBtn>
        <TouchBtn label="Move right" onPress={() => { if (tryMove(1, 0)) playMove(); }}>▶</TouchBtn>
        <TouchBtn label="Soft drop" onPress={softDrop}>⬇</TouchBtn>
        <TouchBtn label="Hard drop" accent onPress={hardDrop}>⤓</TouchBtn>
      </div>

      <p className="text-text-muted text-[10px] text-center flex-shrink-0">
        {phase === 'playing' ? '← → move · ↑ rotate · ␣ drop' : phase === 'won' ? '🎉 Target reached!' : '💥 Stack topped out!'}
      </p>
    </div>
  );
}

function TouchBtn({ children, label, onPress, accent }: {
  children: React.ReactNode;
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  const fnRef = useRef(onPress);
  useEffect(() => { fnRef.current = onPress; }, [onPress]);
  const repeatRef = useRef<number | undefined>(undefined);
  const stop = useCallback(() => {
    if (repeatRef.current) { clearInterval(repeatRef.current); repeatRef.current = undefined; }
  }, []);
  useEffect(() => stop, [stop]);
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={e => {
        e.preventDefault();
        fnRef.current();
        repeatRef.current = window.setInterval(() => fnRef.current(), 110);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className={`game-cell rounded-xl py-3 text-lg font-black active:scale-90 transition-transform touch-none ${
        accent
          ? 'bg-accent text-bg'
          : 'bg-card text-text border border-white/10'
      }`}
    >
      {children}
    </button>
  );
}

function NextPreview({ id }: { id: PieceId }) {
  // Render the piece's rotation-0 cells in a 4×2 mini grid.
  const cells = pieceCells({ id, rot: 0, x: 0, y: 0 });
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  return (
    <div
      aria-hidden
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 8px)',
        gridTemplateRows: 'repeat(2, 8px)',
        gap: 1,
      }}
    >
      {Array.from({ length: 8 }, (_, i) => {
        const x = i % 4, y = Math.floor(i / 4);
        return (
          <div
            key={i}
            style={{ background: set.has(`${x},${y}`) ? PIECE_COLORS[id] : 'transparent', borderRadius: 1 }}
          />
        );
      })}
    </div>
  );
}
