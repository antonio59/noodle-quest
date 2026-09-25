import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '@/contexts/AuthContext';
import { formatSolveTime } from '../../../convex/model/puzzles';

const MEDALS = ['🥇', '🥈', '🥉'];

interface PuzzleBoardProps {
  puzzleKey: string;
  /** Show at most this many rows (the rest are summarised). */
  limit?: number;
}

/** Family's fastest solves for one puzzle. */
export function PuzzleBoard({ puzzleKey, limit = 10 }: PuzzleBoardProps) {
  const { player } = useAuth();
  const rows = useQuery(
    api.puzzles.getPuzzleBoard,
    player ? { sessionToken: player.sessionToken, puzzleKey } : 'skip',
  );

  if (rows === undefined) {
    return <div className="h-16 rounded-xl bg-card/50 animate-pulse" aria-busy="true" />;
  }
  if (rows.length === 0) {
    return <p className="text-sm text-text-muted py-2">Nobody's solved it yet — be the first!</p>;
  }

  const shown = rows.slice(0, limit);
  return (
    <ol className="flex flex-col gap-1" aria-label="Fastest family solves">
      {shown.map((r, i) => (
        <li
          key={`${r.name}-${i}`}
          className={`flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-sm ${r.isMe ? 'bg-accent/12 ring-1 ring-accent/30' : 'bg-surface/60'}`}
        >
          <span className="w-5 text-center text-xs font-bold text-text-muted" aria-label={`Place ${i + 1}`}>
            {MEDALS[i] ?? i + 1}
          </span>
          <span className="text-lg leading-none" aria-hidden>{r.avatar}</span>
          <span className="flex-1 font-semibold truncate">{r.isMe ? `${r.name} (you)` : r.name}</span>
          <span className="font-display font-bold tabular-nums text-accent">{formatSolveTime(r.seconds)}</span>
        </li>
      ))}
      {rows.length > shown.length && (
        <li className="text-xs text-text-muted px-3">+{rows.length - shown.length} more</li>
      )}
    </ol>
  );
}
