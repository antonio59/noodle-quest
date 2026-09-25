// Pass & play for Snakes & Ladders: 2–4 people share this device, one
// token per seat in the seat's colour with their avatar on it. One round
// ends when the first seat reaches 100 — play.tsx owns the result screen.
import type { GameResult, LocalSeat } from '@/types';
import { SEAT_COLORS, seatAt } from '@/lib/pass-and-play';
import { TurnBanner } from '@/components/pass-and-play/TurnBanner';

/** Stable empty table for solo and online mounts. */
export const NO_SEATS: readonly LocalSeat[] = [];

/** Names for SEAT_COLORS, shown in the turn banner. */
const SEAT_COLOR_NAMES = ['Gold', 'Red', 'Green', 'Blue'] as const;

// Where tokens sit when several share a square: diagonal first so two
// tokens don't hide each other, then the other corners.
const CORNERS = ['top-0 left-0', 'bottom-0 right-0', 'top-0 right-0', 'bottom-0 left-0'] as const;

export function seatColor(seat: number): string {
  return SEAT_COLORS[(seat - 1) % SEAT_COLORS.length];
}

function seatColorName(seat: number): string {
  return SEAT_COLOR_NAMES[(seat - 1) % SEAT_COLOR_NAMES.length];
}

/** True when this mount is a pass & play table rather than solo or online. */
export function isLocalTable(localSeats: readonly LocalSeat[] | undefined, isOnline: boolean): boolean {
  return !isOnline && (localSeats?.length ?? 0) >= 2;
}

/** onEnd payload for a pass & play round: nothing scored, just who won. */
export function localWinResult(seats: readonly LocalSeat[], winnerSeat: number): GameResult {
  return { score: 0, stars: 0, summary: `${seatAt(seats, winnerSeat).name} wins!`, winnerSeat };
}

/** Copy of `positions` with the 1-indexed `seat` moved to `pos`. */
export function withSeatAt(positions: readonly number[], seat: number, pos: number): number[] {
  return positions.map((p, i) => (i === seat - 1 ? pos : p));
}

interface LocalRaceHeaderProps {
  seats: readonly LocalSeat[];
  turnSeat: number;
}

export function LocalRaceHeader({ seats, turnSeat }: LocalRaceHeaderProps) {
  return (
    <div className="mb-2">
      <TurnBanner seats={seats} turnSeat={turnSeat} pieceLabel={seatColorName(turnSeat)} />
    </div>
  );
}

interface LocalRaceTokensProps {
  seats: readonly LocalSeat[];
  positions: readonly number[];
  cell: number;
}

/** Every seat's token on this square, offset so shared squares show them all. */
export function LocalRaceTokens({ seats, positions, cell }: LocalRaceTokensProps) {
  const here = positions.flatMap((pos, i) => (pos === cell ? [i + 1] : []));
  if (here.length === 0) return null;
  const solo = here.length === 1;
  return (
    <>
      {here.map((seat, k) => {
        const { name, avatar } = seatAt(seats, seat);
        return (
          <span
            key={seat}
            role="img"
            aria-label={`${name}'s token`}
            className={`absolute z-10 flex items-center justify-center rounded-full leading-none ring-1 ring-black/40 ${
              solo ? 'inset-0 m-auto w-5 h-5 text-[12px]' : `${CORNERS[k % CORNERS.length]} w-3.5 h-3.5 text-[8px]`
            }`}
            style={{ background: seatColor(seat) }}
          >
            {avatar}
          </span>
        );
      })}
    </>
  );
}

interface LocalRaceProgressProps {
  seats: readonly LocalSeat[];
  positions: readonly number[];
  turnSeat: number;
  goal: number;
}

/** One row per seat: avatar + name in their colour, progress bar, square. */
export function LocalRaceProgress({ seats, positions, turnSeat, goal }: LocalRaceProgressProps) {
  return (
    <div className="w-full max-w-[320px] flex flex-col gap-1">
      {positions.map((pos, i) => {
        const seat = i + 1;
        const { name, avatar } = seatAt(seats, seat);
        const color = seatColor(seat);
        return (
          <div key={seat} className={`flex items-center gap-2 text-xs ${seat === turnSeat ? '' : 'opacity-70'}`}>
            <span className="font-bold w-20 truncate" style={{ color }}>{avatar} {name}</span>
            <div className="flex-1 h-2 bg-card rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.round((pos / goal) * 100)}%`, background: color }} />
            </div>
            <span className="text-text-muted w-8 text-right">{pos}</span>
          </div>
        );
      })}
    </div>
  );
}
