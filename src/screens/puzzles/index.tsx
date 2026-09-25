import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { Grid3x3, Search, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useAuth } from '@/contexts/AuthContext';
import { WeeklyPuzzleCard } from '@/components/puzzles/WeeklyPuzzleCard';

interface FamilyPuzzleSummary {
  id: string;
  title: string;
  wordCount: number;
  creatorName: string;
  creatorAvatar: string;
  mine: boolean;
}

function FamilyPuzzleRow({ puzzle }: { puzzle: FamilyPuzzleSummary }) {
  const navigate = useNavigate();
  const { player } = useAuth();
  const remove = useMutation(api.puzzles.deleteFamilyPuzzle);
  const [confirming, setConfirming] = useState(false);

  const play = (kind: 'crossword' | 'wordsearch') => navigate(`/puzzles/family/${puzzle.id}/${kind}`);
  const handleDelete = async () => {
    if (!player) return;
    await remove({ sessionToken: player.sessionToken, puzzleId: puzzle.id as Id<'family_puzzles'> });
  };

  return (
    <li className="bg-card rounded-2xl border border-white/5 p-4">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl leading-none mt-0.5" aria-hidden>{puzzle.creatorAvatar}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base truncate">{puzzle.title}</h3>
          <p className="text-xs text-text-muted">by {puzzle.creatorName} · {puzzle.wordCount} words</p>
        </div>
        {puzzle.mine && !confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${puzzle.title}`}
            className="p-2 -m-1 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
      {confirming ? (
        <div className="flex items-center gap-2" role="group" aria-label="Confirm delete">
          <span className="text-sm text-text-muted flex-1">Delete this puzzle and its times?</span>
          <button type="button" onClick={() => setConfirming(false)} className="px-3 py-2 rounded-xl bg-surface text-sm font-semibold">
            Keep
          </button>
          <button type="button" onClick={handleDelete} className="px-3 py-2 rounded-xl bg-danger text-bg text-sm font-bold">
            Delete
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => play('crossword')}
            className="flex items-center justify-center gap-1.5 bg-accent text-bg font-bold py-2.5 rounded-xl text-sm active:scale-95"
          >
            <Grid3x3 size={14} aria-hidden /> Crossword
          </button>
          <button
            type="button"
            onClick={() => play('wordsearch')}
            className="flex items-center justify-center gap-1.5 bg-surface border border-white/10 text-text font-bold py-2.5 rounded-xl text-sm hover:bg-card-hover active:scale-95"
          >
            <Search size={14} aria-hidden /> Word search
          </button>
        </div>
      )}
    </li>
  );
}

export function PuzzleCorner() {
  const navigate = useNavigate();
  const { player } = useAuth();
  const puzzles = useQuery(
    api.puzzles.listFamilyPuzzles,
    player ? { sessionToken: player.sessionToken } : 'skip',
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-5 pb-8 max-w-2xl mx-auto">
        <header>
          <h1 className="text-2xl font-bold">🧩 Puzzle corner</h1>
          <p className="text-sm text-text-muted">One shared puzzle a week, plus puzzles made from your family's own words.</p>
        </header>

        <WeeklyPuzzleCard />

        <button
          type="button"
          onClick={() => navigate('/puzzles/new')}
          className="w-full flex items-center gap-3 rounded-2xl border border-dashed border-accent/40 bg-accent/5 hover:bg-accent/10 p-4 text-left transition-all active:scale-[0.99]"
        >
          <Sparkles size={22} className="text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="font-bold text-sm">Make a puzzle from your words</p>
            <p className="text-xs text-text-muted">Holidays, pets, birthdays, spelling lists — anything goes.</p>
          </div>
        </button>

        <section aria-labelledby="family-puzzles">
          <h2 id="family-puzzles" className="text-base font-bold mb-3">Family-made puzzles</h2>
          {puzzles === undefined ? (
            <div className="h-24 rounded-2xl bg-card/50 animate-pulse" aria-busy="true" />
          ) : puzzles.length === 0 ? (
            <p className="text-sm text-text-muted bg-card/50 rounded-2xl p-4">
              No family puzzles yet. Make the first one — it'll show up here for everyone.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {puzzles.map(p => <FamilyPuzzleRow key={p.id} puzzle={p} />)}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
