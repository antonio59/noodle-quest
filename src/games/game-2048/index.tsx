import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { GameProps } from '@/types';
import { scaleFromLast } from '@/lib/endless-stage';
import { playMove, playCapture, playLose, playWin } from '@/lib/feedback';
import { SIZE, emptyGrid, newGame, move, spawnTile, hasMoves, maxTile, type Grid, type Dir } from './logic';

type Phase = 'ready' | 'playing' | 'won' | 'lost';

const CONFIG: Record<number, { target: number }> = {
  1: { target: 64 },
  2: { target: 128 },
  3: { target: 256 },
  4: { target: 512 },
  5: { target: 1024 },
  6: { target: 2048 },
};

/** Tile colours climb the noodle palette — low tiles are card-toned, big tiles glow. */
function tileStyle(v: number): { bg: string; fg: string } {
  const map: Record<number, [string, string]> = {
    2: ['#23423b', '#f3efe6'],
    4: ['#2d5349', '#f3efe6'],
    8: ['#3ecf8e', '#0c1916'],
    16: ['#f0a83a', '#0c1916'],
    32: ['#e8853d', '#0c1916'],
    64: ['#e85d4c', '#fff6f0'],
    128: ['#f5c542', '#0c1916'],
    256: ['#ffd166', '#0c1916'],
    512: ['#c084fc', '#1a0b2e'],
    1024: ['#a78bfa', '#1a0b2e'],
    2048: ['#fbbf24', '#0c1916'],
  };
  const [bg, fg] = map[v] ?? ['#fbbf24', '#0c1916'];
  return { bg, fg };
}

export default function Game2048({ stage, onScore, onProgress, onEnd, onMessage, paused }: GameProps) {
  const config = useMemo(() => scaleFromLast(stage, CONFIG, { target: 0.5 }, { target: 4096 }), [stage]);

  const [phase, setPhase] = useState<Phase>('ready');
  const [grid, setGrid] = useState<Grid>(() => emptyGrid());
  const [moves, setMoves] = useState(0);

  const gridRef = useRef<Grid>(grid);
  const scoreRef = useRef(0);
  const movesRef = useRef(0);
  const endedRef = useRef(false);
  const phaseRef = useRef<Phase>(phase);
  const pausedRef = useRef(paused);
  const wonOnceRef = useRef(false);
  const onEndRef = useRef(onEnd);
  const onScoreRef = useRef(onScore);
  const onProgressRef = useRef(onProgress);
  const onMessageRef = useRef(onMessage);
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);
  useEffect(() => { onScoreRef.current = onScore; }, [onScore]);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  const finish = useCallback((won: boolean) => {
    if (endedRef.current) return;
    endedRef.current = true;
    const big = maxTile(gridRef.current);
    const stars = won ? (scoreRef.current >= config.target * 6 ? 3 : 2) : big >= config.target / 4 ? 1 : 0;
    const summary = won
      ? `You built the ${config.target} tile in ${movesRef.current} moves — brilliant merging! ✨`
      : `Board full! Your biggest tile was ${big}. Keep your biggest tile in a corner!`;
    if (won) playWin(); else playLose();
    onEndRef.current({ score: scoreRef.current, stars, summary });
  }, [config.target]);

  const doMove = useCallback((dir: Dir) => {
    if (phaseRef.current !== 'playing' || pausedRef.current || endedRef.current) return;
    const { grid: next, gained, moved } = move(gridRef.current, dir);
    if (!moved) return;
    const withSpawn = spawnTile(next);
    gridRef.current = withSpawn;
    setGrid(withSpawn);
    movesRef.current += 1;
    setMoves(movesRef.current);
    if (gained > 0) {
      scoreRef.current += gained;
      onScoreRef.current(gained);
      playCapture();
    } else {
      playMove();
    }
    const big = maxTile(withSpawn);
    onProgressRef.current(Math.min(1, Math.log2(Math.max(2, big)) / Math.log2(config.target)));
    if (big >= config.target && !wonOnceRef.current) {
      wonOnceRef.current = true;
      onMessageRef.current(`🎉 ${config.target}!`);
      setPhase('won');
      finish(true);
      return;
    }
    if (!hasMoves(withSpawn)) {
      setPhase('lost');
      finish(false);
    }
  }, [config.target, finish]);

  // Keyboard
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      const dirs: Record<string, Dir> = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
        a: 'left', d: 'right', w: 'up', s: 'down',
      };
      const dir = dirs[e.key];
      if (dir) { e.preventDefault(); doMove(dir); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, doMove]);

  // Swipe
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }, [doMove]);

  const startGame = useCallback(() => {
    endedRef.current = false;
    wonOnceRef.current = false;
    scoreRef.current = 0;
    movesRef.current = 0;
    const g = newGame();
    gridRef.current = g;
    setGrid(g);
    setMoves(0);
    onProgressRef.current(0);
    setPhase('playing');
  }, []);

  if (phase === 'ready') {
    return (
      <div className="flex flex-col h-full min-h-[350px] items-center justify-center gap-5 px-4">
        <div className="text-6xl" aria-hidden>🔢</div>
        <h2 className="text-xl font-bold text-text">2048</h2>
        <div className="bg-card rounded-2xl p-4 w-full max-w-xs space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Goal</span>
            <span className="font-bold text-text">Build the {config.target} tile</span>
          </div>
        </div>
        <p className="text-text-muted text-sm text-center max-w-xs">
          Swipe or use arrow keys — matching tiles merge and double!
          Big merges earn big points.
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

  return (
    <div className="h-full flex flex-col items-center p-3 gap-3">
      <div className="flex items-center gap-2 w-full max-w-sm">
        <div className="flex-1 bg-card rounded-xl px-3 py-1.5 text-xs font-bold text-center">
          <span className="text-text-muted">Best tile </span>
          <span className="text-accent">{maxTile(grid)}</span>
        </div>
        <div className="flex-1 bg-card rounded-xl px-3 py-1.5 text-xs font-bold text-center">
          <span className="text-text-muted">Target </span>
          <span className="text-warning">{config.target}</span>
        </div>
        <div className="flex-1 bg-card rounded-xl px-3 py-1.5 text-xs font-bold text-center">
          <span className="text-text-muted">Moves </span>
          <span className="text-text">{moves}</span>
        </div>
      </div>

      <div
        role="grid"
        aria-label={`2048 board — best tile ${maxTile(grid)} of ${config.target}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="game-board bg-surface/60 rounded-2xl border border-white/10 p-2 flex-shrink touch-none"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
          gap: 8,
          width: 'min(92vw, 380px)',
          aspectRatio: '1',
        }}
      >
        {grid.flat().map((v, i) => {
          const { bg, fg } = tileStyle(v);
          return (
            <div
              key={i}
              aria-hidden
              className="rounded-xl flex items-center justify-center font-black transition duration-100"
              style={{
                background: v ? bg : 'rgba(255,255,255,0.04)',
                color: fg,
                fontSize: v >= 1024 ? '1.35rem' : v >= 128 ? '1.6rem' : '1.9rem',
              }}
            >
              {v || ''}
            </div>
          );
        })}
      </div>

      {/* Direction pad for non-swipe players */}
      <div className="grid grid-cols-3 gap-1.5 w-40 flex-shrink-0" role="group" aria-label="Slide controls">
        <span />
        <DirBtn label="Slide up" onPress={() => doMove('up')}>▲</DirBtn>
        <span />
        <DirBtn label="Slide left" onPress={() => doMove('left')}>◀</DirBtn>
        <DirBtn label="Slide down" onPress={() => doMove('down')}>▼</DirBtn>
        <DirBtn label="Slide right" onPress={() => doMove('right')}>▶</DirBtn>
      </div>

      <p className="text-text-muted text-[10px] text-center flex-shrink-0">
        {phase === 'playing' ? 'Swipe or use arrow keys' : phase === 'won' ? '🎉 Target tile built!' : '🧱 No moves left!'}
      </p>
    </div>
  );
}

function DirBtn({ children, label, onPress }: { children: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onPress}
      className="game-cell bg-card text-text border border-white/10 rounded-xl py-2.5 text-base font-black active:scale-90 transition-transform"
    >
      {children}
    </button>
  );
}
