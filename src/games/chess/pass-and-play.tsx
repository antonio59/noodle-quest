// Pass & play for chess: two people share one device, no AI. Seat 1 plays
// White (White moves first), seat 2 plays Black. The board never flips:
// it's lying on the table between them, White at the bottom.
import type { Chess } from 'chess.js';
import type { GameResult, LocalSeat } from '@/types';
import { seatAt } from '@/lib/pass-and-play';
import { TurnBanner } from '@/components/pass-and-play/TurnBanner';

type Side = 'w' | 'b';

export const COLOR_SEAT: Readonly<Record<Side, number>> = { w: 1, b: 2 };
export const COLOR_LABEL: Readonly<Record<Side, string>> = { w: 'White', b: 'Black' };

/** "🦊 Mia" — the person playing `side`. */
export function seatTag(seats: readonly LocalSeat[], side: Side): string {
  const seat = seatAt(seats, COLOR_SEAT[side]);
  return `${seat.avatar} ${seat.name}`;
}

/** "Mia's turn (White)" — the seat to move, for screen-reader labels. */
export function turnLabel(seats: readonly LocalSeat[], turn: Side): string {
  return `${seatAt(seats, COLOR_SEAT[turn]).name}'s turn (${COLOR_LABEL[turn]})`;
}

/**
 * The round's result once the game is over, or null while play goes on.
 * Checkmate wins for the side that delivered it; stalemate, threefold
 * repetition, insufficient material and the 50-move rule are all draws.
 */
export function localResult(game: Chess, seats: readonly LocalSeat[]): GameResult | null {
  if (!game.isGameOver()) return null;
  if (!game.isCheckmate()) return { score: 0, stars: 0, summary: "It's a draw!", winnerSeat: 0 };
  // The side left to move is the one that got mated.
  const winnerSeat = COLOR_SEAT[game.turn() === 'w' ? 'b' : 'w'];
  return { score: 0, stars: 0, summary: `${seatAt(seats, winnerSeat).name} wins!`, winnerSeat };
}

interface LocalTurnHeaderProps {
  seats: readonly LocalSeat[];
  turn: Side;
  inCheck: boolean;
}

/** Whose turn it is, plus a check warning for whichever side is on move. */
export function LocalTurnHeader({ seats, turn, inCheck }: LocalTurnHeaderProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
      <TurnBanner seats={seats} turnSeat={COLOR_SEAT[turn]} pieceLabel={COLOR_LABEL[turn]} />
      {inCheck && (
        <span className="flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold bg-red-900/40 text-red-400 ring-1 ring-red-500/40">
          <span className="animate-pulse" aria-hidden>⚠️</span> Check!
        </span>
      )}
    </div>
  );
}
