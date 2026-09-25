// Pass & play for checkers: two people share one device, no AI. Seat 1
// plays Red (Red moves first), seat 2 plays Black. The board never flips:
// it's lying on the table between them, Red at the bottom.
import type { GameResult, LocalSeat } from '@/types';
import { seatAt } from '@/lib/pass-and-play';
import { TurnBanner } from '@/components/pass-and-play/TurnBanner';
import { allMoves, otherColor, type Board, type Color } from './logic';

export const COLOR_SEAT: Readonly<Record<Color, number>> = { red: 1, black: 2 };
export const COLOR_LABEL: Readonly<Record<Color, string>> = { red: 'Red', black: 'Black' };

/** "Mia's turn (Red)" — the seat to move, for screen-reader labels. */
export function turnLabel(seats: readonly LocalSeat[], turn: Color): string {
  return `${seatAt(seats, COLOR_SEAT[turn]).name}'s turn (${COLOR_LABEL[turn]})`;
}

/**
 * The round's result once `mover` has finished a move, or null while play
 * goes on. Whoever is left to move with no legal move — including having
 * no pieces at all — loses. There's no draw rule in this implementation.
 */
export function localResult(board: Board, mover: Color, seats: readonly LocalSeat[]): GameResult | null {
  if (allMoves(board, otherColor(mover)).length > 0) return null;
  const winnerSeat = COLOR_SEAT[mover];
  return { score: 0, stars: 0, summary: `${seatAt(seats, winnerSeat).name} wins!`, winnerSeat };
}

interface LocalScoreboardProps {
  seats: readonly LocalSeat[];
  turn: Color;
  counts: Readonly<Record<Color, number>>;
}

/** Whose turn it is, plus each seat's name, colour and pieces left. */
export function LocalScoreboard({ seats, turn, counts }: LocalScoreboardProps) {
  return (
    <div className="flex flex-col items-center gap-2 mb-2">
      <TurnBanner seats={seats} turnSeat={COLOR_SEAT[turn]} pieceLabel={COLOR_LABEL[turn]} />
      <div className="flex gap-2 text-xs items-center flex-wrap justify-center">
        {(['red', 'black'] as const).map(color => {
          const seat = seatAt(seats, COLOR_SEAT[color]);
          return (
            <span
              key={color}
              className={`bg-card rounded-lg px-3 py-1.5 font-bold ${color === turn ? 'text-accent' : 'text-text-muted'}`}
            >
              {seat.avatar} {seat.name} ({COLOR_LABEL[color]}): {counts[color]}
            </span>
          );
        })}
      </div>
    </div>
  );
}
