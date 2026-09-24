import { ArrowLeft, RotateCcw, Share2, Check } from 'lucide-react';
import type { LocalSeat } from '@/types';
import { Confetti } from '@/components/Confetti';
import { SEAT_COLORS, describeMatch, seatAt, type MatchTally } from '@/lib/pass-and-play';

interface MatchResultProps {
  gameName: string;
  gameEmoji: string;
  seats: readonly LocalSeat[];
  winnerSeat: number | undefined;
  tally: MatchTally;
  shareState: 'idle' | 'sharing' | 'shared' | 'failed';
  onShare: (() => void) | null;
  onRematch: () => void;
  onDone: () => void;
}

export function MatchResult({
  gameName, gameEmoji, seats, winnerSeat, tally, shareState, onShare, onRematch, onDone,
}: MatchResultProps) {
  const winner = winnerSeat ? seatAt(seats, winnerSeat) : null;
  const rounds = Object.values(tally).reduce((a, b) => a + b, 0);

  return (
    <div className="h-full overflow-y-auto flex flex-col items-center justify-center p-5">
      {winner && <Confetti count={40} />}
      <div className="w-full max-w-sm rounded-3xl p-6 border border-accent/25 bg-accent/8 text-center">
        <div className="text-6xl mb-2 animate-[celebrate_0.4s_ease]" aria-hidden>
          {winner ? winner.avatar : '🤝'}
        </div>
        <h2 className="font-display text-2xl font-bold text-accent mb-1">
          {winner ? `${winner.name} wins!` : "It's a draw!"}
        </h2>
        <p className="text-text-muted text-sm mb-5">
          {gameEmoji} {describeMatch(seats, winnerSeat, gameName)}
        </p>

        {rounds > 0 && (
          <div className="bg-surface/60 rounded-2xl p-3 mb-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
              Tonight's tally
            </h3>
            <ul className="flex flex-col gap-1.5">
              {seats.map((s, i) => (
                <li key={s.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: SEAT_COLORS[i % SEAT_COLORS.length] }}
                    aria-hidden
                  />
                  <span aria-hidden>{s.avatar}</span>
                  <span className="flex-1 text-left font-semibold truncate">{s.name}</span>
                  <span className="font-display font-bold text-accent tabular-nums">
                    {tally[s.name] ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            type="button"
            onClick={onRematch}
            className="flex items-center justify-center gap-1.5 bg-accent text-bg font-bold py-3 rounded-2xl hover:opacity-90 active:scale-95 text-sm"
          >
            <RotateCcw size={15} /> Rematch
          </button>
          <button
            type="button"
            onClick={onShare ?? undefined}
            disabled={!onShare || shareState === 'sharing' || shareState === 'shared'}
            className="flex items-center justify-center gap-1.5 bg-card hover:bg-card-hover text-text font-bold py-3 rounded-2xl active:scale-95 text-sm disabled:opacity-60"
          >
            {shareState === 'shared'
              ? <><Check size={15} /> Posted</>
              : <><Share2 size={15} /> Tell the family</>}
          </button>
        </div>
        {shareState === 'failed' && (
          <p className="text-xs text-danger mb-2" role="status">Couldn't post that — try again?</p>
        )}

        <button
          type="button"
          onClick={onDone}
          className="w-full text-text-muted text-sm hover:text-text transition-colors py-2 flex items-center justify-center gap-1"
        >
          <ArrowLeft size={13} /> Back to Board games
        </button>
      </div>
    </div>
  );
}
