import { useEffect, useMemo, useRef, useState } from 'react';
import { generateWordSearch } from '@/lib/puzzle-engine/wordsearch/generator';
import { EN_GB_CORE_WORDS } from '@/data/words/en-gb-core';
import { WordSearchGrid } from './WordSearchGrid';
import { useWordSearch } from './use-wordsearch';
import type { GameProps } from '@/types';
import type { FixedPuzzle } from '@/lib/fixed-puzzles';
import { Check, Sparkles, RefreshCw } from 'lucide-react';

function makePuzzleId() {
  return `wordsearch_${Date.now()}`;
}

function wordSearchCfg(stage: number) {
  const dirs: ('across' | 'down' | 'reverse' | 'diagonal')[] =
    stage <= 3 ? ['across', 'down']
    : stage <= 6 ? ['across', 'down', 'reverse']
    : ['across', 'down', 'reverse', 'diagonal'];
  return {
    gridSize: Math.min(22, 8 + Math.floor((stage - 1) * 0.7)),
    maxWords: Math.min(24, 5 + stage),
    directions: dirs,
  };
}

// Fixed puzzles are for everyone incl. young kids: no backwards words.
const FIXED_DIRECTIONS: ('across' | 'down' | 'diagonal')[] = ['across', 'down', 'diagonal'];

interface WordSearchProps extends Partial<GameProps> {
  /** Same grid for everyone (weekly / family puzzle): no reshuffle. */
  fixed?: FixedPuzzle;
}

export default function WordSearchGame({ stage = 1, onScore, onProgress, onEnd, fixed }: WordSearchProps) {
  const stageCfg = wordSearchCfg(stage);
  const cfg = fixed
    ? { gridSize: fixed.gridSize, maxWords: fixed.maxWords, directions: FIXED_DIRECTIONS }
    : stageCfg;
  const words = fixed?.words ?? EN_GB_CORE_WORDS;
  const [puzzleId, setPuzzleId] = useState(() => fixed?.key ?? makePuzzleId());
  const [seed, setSeed] = useState(() => fixed?.seed ?? Date.now());
  const startedAtRef = useRef<number>(Date.now());
  const lastScoreRef = useRef<number>(0);
  const endedRef = useRef(false);

  const puzzle = useMemo(() => {
    return generateWordSearch(words, {
      gridSize: cfg.gridSize,
      directions: cfg.directions,
      seed,
      maxWords: cfg.maxWords,
      // Shared letters let a family's whole word list fit.
      allowOverlap: !!fixed,
      locale: 'en-GB',
    });
  }, [words, fixed, seed, cfg.gridSize, cfg.maxWords, cfg.directions]);

  const {
    found,
    completed,
    gridRef,
    startSelection,
    extendSelection,
    endSelection,
    cellStateFor,
    foundOverlays,
    colorFor,
    remaining,
  } = useWordSearch(puzzle, puzzleId);

  useEffect(() => {
    const totalWords = puzzle.placements.length;
    const foundCount = found.size;
    if (totalWords === 0) return;

    const delta = foundCount - lastScoreRef.current;
    if (delta > 0 && onScore) onScore(delta * 20);
    lastScoreRef.current = foundCount;

    if (onProgress) onProgress(foundCount / totalWords);

    if (completed && !endedRef.current && onEnd) {
      endedRef.current = true;
      const elapsedSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      const perWord = elapsedSec / totalWords;
      const stars = perWord < 30 ? 3 : perWord < 60 ? 2 : 1;
      onEnd({
        score: foundCount * 20,
        stars,
        summary: `Found all ${totalWords} words in ${elapsedSec}s!`,
      });
    }
  }, [found, completed, puzzle.placements.length, onScore, onProgress, onEnd]);

  const handleNewGame = () => {
    setPuzzleId(makePuzzleId());
    setSeed(Date.now());
    startedAtRef.current = Date.now();
    lastScoreRef.current = 0;
    endedRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    const r = Number((el as HTMLElement).dataset.r);
    const c = Number((el as HTMLElement).dataset.c);
    if (!Number.isNaN(r) && !Number.isNaN(c)) {
      extendSelection(r, c);
    }
  };

  const totalWords = puzzle.placements.length;
  const foundCount = found.size;
  const progress = totalWords > 0 ? foundCount / totalWords : 0;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top HUD */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-accent" />
            <span className="text-sm font-bold text-text">
              {foundCount}
              <span className="text-text-muted font-normal"> / {totalWords} words</span>
            </span>
          </div>
          {!fixed && (
            <button
              onClick={handleNewGame}
              className="flex items-center gap-1.5 bg-card hover:bg-card-hover text-text px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            >
              <RefreshCw size={12} />
              New Game
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-card rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {completed && (
        <div className="mx-4 mb-2 flex items-center justify-center gap-2 p-2.5 bg-success/15 ring-1 ring-success/30 rounded-xl flex-shrink-0">
          <span className="text-xl">🎉</span>
          <span className="text-success font-bold text-sm">All words found!</span>
        </div>
      )}

      {/* Board + word list */}
      <div className="flex-1 grid gap-3 lg:grid-cols-[1fr_260px] overflow-hidden px-3 pb-3 min-h-0">
        {/* Board */}
        <div className="overflow-auto flex items-start justify-center">
          <div
            className="rounded-2xl p-2.5 shadow-xl ring-1 ring-white/10"
            style={{ background: '#0e0c22' }}
          >
            <div ref={gridRef}>
              <WordSearchGrid
                grid={puzzle.grid}
                gridSize={puzzle.gridSize}
                cellStateFor={cellStateFor}
                foundOverlays={foundOverlays}
                onMouseDown={startSelection}
                onMouseEnter={extendSelection}
                onMouseUp={endSelection}
                onTouchStart={startSelection}
                onTouchMove={handleTouchMove}
                onTouchEnd={endSelection}
              />
            </div>
          </div>
        </div>

        {/* Word list */}
        <div className="overflow-auto">
          <div className="bg-card rounded-xl p-3 h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Words to find
              </h3>
              <span className="text-[11px] text-text-muted">
                {remaining.length === 0 ? 'All done!' : `${remaining.length} left`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 content-start">
              {puzzle.placements.map(p => {
                const isFound = found.has(p.word);
                const color = isFound ? colorFor(p.word) : undefined;
                return (
                  <span
                    key={p.word}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                      isFound
                        ? 'text-white shadow-sm'
                        : 'bg-[#142824] text-teal-200 border border-white/5'
                    }`}
                    style={isFound ? { backgroundColor: color, boxShadow: `0 0 8px ${color}55` } : undefined}
                  >
                    {isFound && <Check size={10} strokeWidth={3} />}
                    <span className={isFound ? 'line-through opacity-80' : ''}>{p.word}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
