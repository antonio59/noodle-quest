import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, Timer } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '@/contexts/AuthContext';
import CrosswordGame from '@/features/crossword/index';
import WordSearchGame from '@/features/wordsearch/index';
import { Confetti } from '@/components/Confetti';
import { PuzzleBoard } from '@/components/puzzles/PuzzleBoard';
import { familyPuzzle, weeklyPuzzle, type FixedPuzzle, type PuzzleKind } from '@/lib/fixed-puzzles';
import { formatSolveTime, isOpenWeek, MIN_SOLVE_SECONDS } from '../../../convex/model/puzzles';

type Outcome =
  | { state: 'saving'; seconds: number }
  | { state: 'saved'; seconds: number; best: number; isNewBest: boolean }
  | { state: 'failed'; seconds: number; message: string };

const KIND_LABEL: Record<PuzzleKind, string> = { crossword: 'Crossword', wordsearch: 'Word search' };

function useElapsed(running: boolean): number {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  return Math.max(0, Math.floor((now - start) / 1000));
}

function PuzzleRun({ fixed, title }: { fixed: FixedPuzzle; title: string }) {
  const navigate = useNavigate();
  const { player } = useAuth();
  const submit = useMutation(api.puzzles.submitPuzzleTime);
  const startedAt = useRef(Date.now());
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const elapsed = useElapsed(outcome === null);

  const handleEnd = useCallback(async () => {
    const seconds = Math.max(MIN_SOLVE_SECONDS, Math.round((Date.now() - startedAt.current) / 1000));
    setOutcome({ state: 'saving', seconds });
    if (!player) return;
    try {
      const res = await submit({ sessionToken: player.sessionToken, puzzleKey: fixed.key, seconds });
      setOutcome('best' in res
        ? { state: 'saved', seconds, best: res.best, isNewBest: res.isNewBest }
        : { state: 'failed', seconds, message: res.error ?? "Couldn't save your time." });
    } catch {
      setOutcome({ state: 'failed', seconds, message: "Couldn't save your time — check your connection." });
    }
  }, [player, submit, fixed.key]);

  const Game = fixed.kind === 'crossword' ? CrosswordGame : WordSearchGame;
  const noop = useCallback(() => {}, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 p-3 bg-surface border-b border-white/5 flex-shrink-0">
        <button
          type="button"
          onClick={() => navigate('/puzzles')}
          className="flex items-center gap-1.5 text-text-muted hover:text-text bg-card hover:bg-card-hover px-3 py-2 rounded-xl text-sm font-semibold"
        >
          <ArrowLeft size={16} /> Puzzles
        </button>
        <div className="text-center min-w-0">
          <div className="font-semibold text-sm truncate">{title}</div>
          <div className="text-text-muted text-xs">{KIND_LABEL[fixed.kind]}</div>
        </div>
        <div className="flex items-center gap-1 font-display font-bold tabular-nums text-accent min-w-[64px] justify-end" aria-label="Time">
          <Timer size={14} aria-hidden /> {formatSolveTime(outcome?.seconds ?? elapsed)}
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <Game fixed={fixed} onEnd={handleEnd} onScore={noop} onProgress={noop} />

        {outcome && (
          <div className="absolute inset-0 z-30 overflow-y-auto bg-bg/90 backdrop-blur-md flex items-center justify-center p-5">
            {outcome.state === 'saved' && outcome.isNewBest && <Confetti count={40} />}
            <div className="w-full max-w-sm rounded-3xl p-6 border border-success/25 bg-card text-center space-y-4" role="dialog" aria-label="Puzzle solved">
              <div className="text-5xl" aria-hidden>🧩</div>
              <div>
                <h2 className="font-display text-2xl font-bold text-success">Solved in {formatSolveTime(outcome.seconds)}!</h2>
                <p className="text-sm text-text-muted mt-1">
                  {outcome.state === 'saving' && 'Saving your time…'}
                  {outcome.state === 'saved' && (outcome.isNewBest ? 'Your best time on this one.' : `Your best is still ${formatSolveTime(outcome.best)}.`)}
                  {outcome.state === 'failed' && outcome.message}
                </p>
              </div>
              <div className="text-left">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">Family times</h3>
                <PuzzleBoard puzzleKey={fixed.key} />
              </div>
              <button
                type="button"
                onClick={() => navigate('/puzzles')}
                className="w-full bg-accent text-bg font-bold py-3 rounded-2xl active:scale-95"
              >
                Back to Puzzle corner
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Message({ text }: { text: string }) {
  const navigate = useNavigate();
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-text-muted">{text}</p>
      <button type="button" onClick={() => navigate('/puzzles')} className="bg-accent text-bg font-bold px-6 py-2.5 rounded-xl">
        Back to Puzzle corner
      </button>
    </div>
  );
}

/** /puzzles/week/:week — the shared weekly puzzle. */
export function WeeklyPuzzlePlay() {
  const { week = '' } = useParams<{ week: string }>();
  const [openedAt] = useState(() => Date.now());
  const fixed = useMemo(() => weeklyPuzzle(week), [week]);
  if (!/^\d{4}-W\d{2}$/.test(week) || !isOpenWeek(week, openedAt)) {
    return <Message text="That week's puzzle has closed — try this week's instead." />;
  }
  return <PuzzleRun fixed={fixed} title="This week's family puzzle" />;
}

/** /puzzles/family/:id/:kind — a puzzle someone in the family made. */
export function FamilyPuzzlePlay() {
  const { id = '', kind } = useParams<{ id: string; kind: string }>();
  const { player } = useAuth();
  const puzzle = useQuery(
    api.puzzles.getFamilyPuzzle,
    player ? { sessionToken: player.sessionToken, puzzleId: id } : 'skip',
  );
  const validKind: PuzzleKind | null = kind === 'crossword' || kind === 'wordsearch' ? kind : null;
  const fixed = useMemo(
    () => (puzzle && validKind ? familyPuzzle(puzzle.id, puzzle.entries, validKind) : null),
    [puzzle, validKind],
  );

  if (!validKind) return <Message text="We don't know that kind of puzzle." />;
  if (puzzle === undefined) {
    return <div className="h-full flex items-center justify-center text-4xl animate-pulse" aria-busy="true">🧩</div>;
  }
  if (!puzzle || !fixed) return <Message text="That puzzle has been deleted." />;
  return <PuzzleRun fixed={fixed} title={`${puzzle.title} · by ${puzzle.creatorName}`} />;
}
