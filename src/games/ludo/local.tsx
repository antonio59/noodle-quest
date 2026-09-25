// Pass & play for Ludo: 2–4 people share this device. Seats map to the
// board's colours in order (sidesForCount), every seat is human, and one
// round ends when the first seat gets all 4 pieces home — play.tsx owns
// the result screen and rematch.
import type { GameResult, LocalSeat } from '@/types';
import { seatAt } from '@/lib/pass-and-play';
import { TurnBanner } from '@/components/pass-and-play/TurnBanner';

/** Stable empty table so memoised callbacks don't churn outside pass & play. */
export const NO_SEATS: readonly LocalSeat[] = [];

/** True when this mount is a pass & play table rather than solo or online. */
export function isLocalTable(localSeats: readonly LocalSeat[] | undefined, isOnline: boolean): boolean {
  return !isOnline && (localSeats?.length ?? 0) >= 2;
}

/** onEnd payload for a pass & play round: nothing scored, just who won. */
export function localWinResult(seats: readonly LocalSeat[], winnerSeat: number): GameResult {
  return { score: 0, stars: 0, summary: `${seatAt(seats, winnerSeat).name} wins!`, winnerSeat };
}

/** "🦊 Mia" — avatar + name, so people can find their progress row. */
export function localSeatLabel(seats: readonly LocalSeat[], seat: number): string {
  const { avatar, name } = seatAt(seats, seat);
  return `${avatar} ${name}`;
}

/** Screen-reader summary of the board for the seat whose turn it is. */
export function localBoardLabel(
  seats: readonly LocalSeat[],
  turnSeat: number,
  sideLabel: string,
  homeCount: number,
): string {
  return `Ludo board. ${seatAt(seats, turnSeat).name}'s turn (${sideLabel}), ${homeCount} of 4 pieces home.`;
}

interface LocalTurnBarProps {
  seats: readonly LocalSeat[];
  turnSeat: number;
  /** Board colour for the seat, e.g. "Red". */
  sideLabel: string;
  /** They've rolled and must choose which piece to move. */
  picking: boolean;
}

/** Whose turn it is, plus a nudge once they've rolled and must pick a piece. */
export function LocalTurnBar({ seats, turnSeat, sideLabel, picking }: LocalTurnBarProps) {
  return (
    <div className="w-full max-w-[400px] flex items-center justify-center gap-2 px-1 flex-wrap">
      <TurnBanner seats={seats} turnSeat={turnSeat} pieceLabel={sideLabel} />
      {picking && (
        <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-yellow-400/20 text-yellow-300 ring-1 ring-yellow-400/40">
          <span className="animate-bounce">👆</span> Pick a piece
        </span>
      )}
    </div>
  );
}
