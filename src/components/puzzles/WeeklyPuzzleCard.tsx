import { useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { ChevronRight, Puzzle } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '@/contexts/AuthContext';
import { formatSolveTime, isoWeek, nextWeekStart, weeklyPuzzleKind } from '../../../convex/model/puzzles';

const KIND_LABEL = { crossword: 'Crossword', wordsearch: 'Word search' } as const;
const DAY_MS = 86_400_000;

function changesIn(now: number): string {
  const days = Math.ceil((nextWeekStart(now) - now) / DAY_MS);
  return days <= 1 ? 'New puzzle tomorrow' : `New puzzle in ${days} days`;
}

/** This week's shared family puzzle: who's solved it, and a way in. */
export function WeeklyPuzzleCard() {
  const navigate = useNavigate();
  const { player } = useAuth();
  const now = Date.now();
  const week = isoWeek(now);
  const kind = weeklyPuzzleKind(week);
  const rows = useQuery(
    api.puzzles.getPuzzleBoard,
    player ? { sessionToken: player.sessionToken, puzzleKey: `week:${week}` } : 'skip',
  ) ?? [];
  const mine = rows.find(r => r.isMe);
  const leader = rows[0];

  return (
    <button
      type="button"
      onClick={() => navigate(`/puzzles/week/${week}`)}
      className="w-full text-left rounded-2xl border border-success/25 bg-success/8 hover:bg-success/12 p-4 transition-all active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-success"
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-success/15 flex items-center justify-center flex-shrink-0">
          <Puzzle size={22} className="text-success" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-success uppercase tracking-widest">This week's family puzzle</p>
          <p className="text-sm font-bold">{KIND_LABEL[kind]} · same grid for everyone</p>
          <p className="text-xs text-text-muted mt-0.5">
            {leader
              ? `${leader.avatar} ${leader.isMe ? 'You lead' : `${leader.name} leads`} in ${formatSolveTime(leader.seconds)} · ${rows.length} solved`
              : 'Nobody has solved it yet'}
            {' · '}{changesIn(now)}
          </p>
        </div>
        <span className="flex items-center gap-0.5 text-xs font-bold text-success flex-shrink-0 self-center">
          {mine ? `Beat ${formatSolveTime(mine.seconds)}` : 'Play'} <ChevronRight size={14} aria-hidden />
        </span>
      </div>
      {rows.length > 0 && (
        <div className="flex -space-x-1.5 mt-3 pl-14" aria-hidden>
          {rows.slice(0, 8).map((r, i) => (
            <span key={`${r.name}-${i}`} className="w-7 h-7 rounded-full bg-card ring-2 ring-bg flex items-center justify-center text-sm">
              {r.avatar}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
