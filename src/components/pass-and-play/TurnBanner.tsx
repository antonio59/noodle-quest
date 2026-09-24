import type { LocalSeat } from '@/types';
import { SEAT_COLORS, seatAt } from '@/lib/pass-and-play';

interface TurnBannerProps {
  seats: readonly LocalSeat[];
  /** 1-indexed seat whose turn it is. */
  turnSeat: number;
  /** Optional piece/colour label for the seat, e.g. "X" or "Red". */
  pieceLabel?: string;
}

/** "🦊 Mia's turn" strip for pass & play, tinted with the seat's colour. */
export function TurnBanner({ seats, turnSeat, pieceLabel }: TurnBannerProps) {
  const seat = seatAt(seats, turnSeat);
  const color = SEAT_COLORS[(turnSeat - 1) % SEAT_COLORS.length];
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold bg-card border-2"
      style={{ borderColor: color }}
    >
      <span className="text-lg leading-none" aria-hidden>{seat.avatar}</span>
      <span>{seat.name}'s turn</span>
      {pieceLabel && <span className="text-text-muted font-semibold">· {pieceLabel}</span>}
    </div>
  );
}
