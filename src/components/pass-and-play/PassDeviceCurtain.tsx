import type { LocalSeat } from '@/types';

interface PassDeviceCurtainProps {
  seat: LocalSeat;
  /** e.g. "Dad played a Red 7" — what happened since this player last looked. */
  recap?: string;
  onReady: () => void;
}

/**
 * Covers a hidden-information game (cards, tile racks) between turns so the
 * next player can take the device without anyone seeing their hand.
 */
export function PassDeviceCurtain({ seat, recap, onReady }: PassDeviceCurtainProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Pass the device to ${seat.name}`}
      className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 p-6 bg-bg/95 backdrop-blur-xl text-center"
    >
      <div className="text-7xl animate-[celebrate_0.4s_ease]" aria-hidden>{seat.avatar}</div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-text-muted">Pass to</p>
        <p className="font-display text-3xl font-bold text-text">{seat.name}</p>
      </div>
      {recap && <p className="text-sm text-text-dim max-w-xs">{recap}</p>}
      <p className="text-xs text-text-muted">No peeking, everyone else 🙈</p>
      <button
        type="button"
        onClick={onReady}
        autoFocus
        className="bg-accent text-bg font-bold px-8 py-3.5 rounded-2xl text-lg hover:opacity-90 active:scale-95 transition-all"
      >
        I'm {seat.name} — show me
      </button>
    </div>
  );
}
