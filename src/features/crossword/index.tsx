import { useEffect, useMemo, useRef, useState } from 'react';
import { generateCrossword } from '@/lib/puzzle-engine/crossword/generator';
import { EN_GB_CORE_WORDS, EN_GB_CORE_CLUES } from '@/data/words/en-gb-core';
import { CrosswordGrid } from './CrosswordGrid';
import { useCrossword } from './use-crossword';
import type { GameProps } from '@/types';
import type { FixedPuzzle } from '@/lib/fixed-puzzles';
import { RefreshCw, Eye, CheckCircle } from 'lucide-react';

function makePuzzleId() {
  return `crossword_${Date.now()}`;
}

function crosswordCfg(stage: number) {
  return {
    gridSize: Math.min(18, 7 + Math.floor((stage - 1) * 0.6)),
    maxWords: Math.min(22, 5 + stage),
    targetDifficulty: Math.min(3, 1 + Math.floor((stage - 1) / 3)) as 1 | 2 | 3,
  };
}

interface CrosswordProps extends Partial<GameProps> {
  /** Same grid for everyone (weekly / family puzzle): no reshuffle, no reveal. */
  fixed?: FixedPuzzle;
}

export default function CrosswordGame({ stage = 1, onScore, onProgress, onEnd, fixed }: CrosswordProps) {
  const stageCfg = crosswordCfg(stage);
  const cfg = fixed ? { ...stageCfg, gridSize: fixed.gridSize, maxWords: fixed.maxWords } : stageCfg;
  const words = fixed?.words ?? EN_GB_CORE_WORDS;
  const clues = fixed?.clues ?? EN_GB_CORE_CLUES;
  const [puzzleId, setPuzzleId] = useState(() => fixed?.key ?? makePuzzleId());
  const [seed, setSeed] = useState(() => fixed?.seed ?? Date.now());
  const startedAtRef = useRef<number>(Date.now());
  const lastFilledRef = useRef<number>(0);
  const endedRef = useRef(false);

  const puzzle = useMemo(() => {
    return generateCrossword(words, clues, {
      gridSize: cfg.gridSize,
      seed,
      maxWords: cfg.maxWords,
      minCrossings: 1,
      targetDifficulty: cfg.targetDifficulty,
      locale: 'en-GB',
    });
  }, [words, clues, seed, cfg.gridSize, cfg.maxWords, cfg.targetDifficulty]);

  const {
    grid,
    activeWordId,
    setActiveWordId,
    activeCell,
    completed,
    inputRefs,
    numberMap,
    cellToWords,
    focusCell,
    handleKey,
    setCellValue,
    checkSolution,
    revealCell,
  } = useCrossword(puzzle, puzzleId);

  const across = puzzle.words.filter(w => w.direction === 'across');
  const down = puzzle.words.filter(w => w.direction === 'down');

  const { totalCells, filledCells, fillProgress } = useMemo(() => {
    let total = 0;
    let filled = 0;
    for (const w of puzzle.words) {
      for (let i = 0; i < w.word.length; i++) {
        const r = w.direction === 'across' ? w.row : w.row + i;
        const c = w.direction === 'across' ? w.col + i : w.col;
        total++;
        if (grid[r]?.[c]?.value) filled++;
      }
    }
    return { totalCells: total, filledCells: filled, fillProgress: total > 0 ? filled / total : 0 };
  }, [grid, puzzle.words]);

  useEffect(() => {
    if (totalCells === 0) return;

    const delta = filledCells - lastFilledRef.current;
    if (delta > 0 && onScore) onScore(delta * 5);
    lastFilledRef.current = filledCells;

    if (onProgress) onProgress(filledCells / totalCells);

    if (completed && !endedRef.current && onEnd) {
      endedRef.current = true;
      const elapsedSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      const perCell = elapsedSec / totalCells;
      const stars = perCell < 5 ? 3 : perCell < 10 ? 2 : 1;
      onEnd({
        score: filledCells * 5 + 50,
        stars,
        summary: `Solved in ${elapsedSec}s!`,
      });
    }
  }, [totalCells, filledCells, completed, onScore, onProgress, onEnd]);

  const handleNewGame = () => {
    setPuzzleId(makePuzzleId());
    setSeed(Date.now());
    startedAtRef.current = Date.now();
    lastFilledRef.current = 0;
    endedRef.current = false;
  };

  // Active clue for callout
  const activeWord = activeWordId ? puzzle.words.find(w => w.id === activeWordId) : null;

  return (
    <div className="h-full flex flex-col p-3 overflow-hidden gap-2">
      {/* Top HUD */}
      <div className="flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-text">
            {filledCells}
            <span className="text-text-muted font-normal"> / {totalCells} cells</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={checkSolution}
              className="flex items-center gap-1.5 bg-accent text-bg font-semibold px-3 py-1.5 rounded-lg text-xs hover:opacity-90 active:scale-95 transition"
            >
              <CheckCircle size={13} />
              Check
            </button>
            {!fixed && (
              <>
                <button
                  onClick={() => { if (activeCell) revealCell(activeCell.r, activeCell.c); }}
                  className="flex items-center gap-1.5 bg-card hover:bg-card-hover text-text px-3 py-1.5 rounded-lg text-xs transition"
                  title="Reveal selected cell"
                >
                  <Eye size={13} />
                  Reveal
                </button>
                <button
                  onClick={handleNewGame}
                  className="flex items-center gap-1.5 bg-card hover:bg-card-hover text-text px-2.5 py-1.5 rounded-lg text-xs transition"
                  title="New game"
                >
                  <RefreshCw size={12} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-card rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${fillProgress * 100}%` }}
          />
        </div>

        {/* Active clue callout */}
        {activeWord ? (
          <div className="flex items-baseline gap-2 bg-accent/10 ring-1 ring-accent/25 rounded-lg px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent flex-shrink-0">
              {activeWord.number}{activeWord.direction === 'across' ? 'A' : 'D'}
            </span>
            <span className="text-xs text-text leading-snug">{activeWord.clue}</span>
          </div>
        ) : (
          <div className="h-8 flex items-center px-3 bg-card/50 rounded-lg">
            <span className="text-xs text-text-muted">Tap a cell to see its clue</span>
          </div>
        )}
      </div>

      {completed && (
        <div className="flex-shrink-0 flex items-center justify-center gap-2 p-2.5 bg-success/15 ring-1 ring-success/30 rounded-xl">
          <span className="text-xl">🎉</span>
          <span className="text-success font-bold text-sm">Crossword Complete!</span>
        </div>
      )}

      {/* Board + clues */}
      <div className="flex-1 grid gap-3 lg:grid-cols-[1fr_280px] overflow-hidden min-h-0">
        {/* Board */}
        <div className="overflow-auto flex items-start justify-center p-1">
          <div className="w-full max-w-full" style={{ maxWidth: `${puzzle.gridSize * 2.5}rem` }}>
            <CrosswordGrid
              puzzle={puzzle}
              grid={grid}
              activeWordId={activeWordId}
              activeCell={activeCell}
              numberMap={numberMap}
              cellToWords={cellToWords}
              inputRefs={inputRefs}
              onCellClick={(r, c) => {
                const ids = cellToWords.get(`${r},${c}`) ?? [];
                if (ids.length > 1 && activeWordId === ids[0]) {
                  setActiveWordId(ids[1]);
                } else {
                  setActiveWordId(ids[0] ?? null);
                }
                focusCell(r, c);
              }}
              onKeyDown={handleKey}
              onChange={setCellValue}
            />
          </div>
        </div>

        {/* Clues panel */}
        <div className="overflow-auto">
          <div className="bg-card rounded-xl p-3 space-y-4">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2 flex items-center gap-1.5">
                <span className="inline-block w-3 h-0.5 bg-accent rounded" />
                Across
              </h3>
              <ul className="space-y-1">
                {across.map(w => (
                  <li key={w.id}>
                    <button
                      type="button"
                      aria-current={activeWordId === w.id}
                      className={`w-full text-left text-xs cursor-pointer rounded-lg px-2 py-1.5 transition ${
                        activeWordId === w.id
                          ? 'bg-accent/15 text-accent ring-1 ring-accent/30'
                          : 'hover:bg-card-hover text-text'
                      }`}
                      onClick={() => {
                        setActiveWordId(w.id);
                        focusCell(w.row, w.col);
                      }}
                    >
                      <span className="font-bold mr-1.5 text-accent/80">{w.number}.</span>
                      {w.clue}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2 flex items-center gap-1.5">
                <span className="inline-block w-3 h-0.5 bg-accent rounded" />
                Down
              </h3>
              <ul className="space-y-1">
                {down.map(w => (
                  <li key={w.id}>
                    <button
                      type="button"
                      aria-current={activeWordId === w.id}
                      className={`w-full text-left text-xs cursor-pointer rounded-lg px-2 py-1.5 transition ${
                        activeWordId === w.id
                          ? 'bg-accent/15 text-accent ring-1 ring-accent/30'
                          : 'hover:bg-card-hover text-text'
                      }`}
                      onClick={() => {
                        setActiveWordId(w.id);
                        focusCell(w.row, w.col);
                      }}
                    >
                      <span className="font-bold mr-1.5 text-accent/80">{w.number}.</span>
                      {w.clue}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
