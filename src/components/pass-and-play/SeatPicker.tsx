import { useState } from 'react';
import { ArrowLeft, Plus, X } from 'lucide-react';
import type { LocalSeat } from '@/types';
import { GameArt } from '@/components/GameArt';
import { GUEST_AVATARS, MAX_GUEST_NAME, SEAT_COLORS, seatListError } from '@/lib/pass-and-play';

interface SeatPickerProps {
  gameId: string;
  gameName: string;
  gameEmoji: string;
  min: number;
  max: number;
  /** The signed-in player; takes seat 1 by default. */
  me: LocalSeat | null;
  /** Everyone in the family, for one-tap seating. */
  family: readonly LocalSeat[];
  onStart: (seats: LocalSeat[]) => void;
  onCancel: () => void;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function SeatPicker({ gameId, gameName, gameEmoji, min, max, me, family, onStart, onCancel }: SeatPickerProps) {
  const [seats, setSeats] = useState<LocalSeat[]>(() => (me ? [me] : []));
  const [guestName, setGuestName] = useState('');

  const isSeated = (name: string) => seats.some(s => sameName(s.name, name));
  const full = seats.length >= max;
  const error = seatListError(seats, min, max);

  const toggle = (person: LocalSeat) => {
    if (isSeated(person.name)) {
      setSeats(prev => prev.filter(s => !sameName(s.name, person.name)));
    } else if (!full) {
      setSeats(prev => [...prev, person]);
    }
  };

  const addGuest = () => {
    const name = guestName.trim().slice(0, MAX_GUEST_NAME);
    if (!name || full || isSeated(name)) return;
    const avatar = GUEST_AVATARS[seats.length % GUEST_AVATARS.length];
    setSeats(prev => [...prev, { name, avatar }]);
    setGuestName('');
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center p-6 max-w-sm mx-auto">
        <GameArt gameId={gameId} emoji={gameEmoji} size={72} className="mb-2" />
        <h2 className="text-2xl font-bold">{gameName}</h2>
        <p className="text-text-muted text-sm mb-5 text-center">
          Pass & play — share this device and take turns.
        </p>

        {/* Turn order */}
        <section aria-label="Players in turn order" className="w-full mb-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">
            Turn order · {seats.length}/{max}
          </h3>
          <ol className="flex flex-col gap-1.5">
            {seats.map((s, i) => (
              <li
                key={s.name}
                className="flex items-center gap-2.5 bg-card rounded-xl px-3 py-2 border-l-4"
                style={{ borderLeftColor: SEAT_COLORS[i % SEAT_COLORS.length] }}
              >
                <span className="text-xs font-bold text-text-muted w-4">{i + 1}</span>
                <span className="text-xl" aria-hidden>{s.avatar}</span>
                <span className="font-semibold text-sm flex-1 truncate">{s.name}</span>
                <button
                  type="button"
                  onClick={() => toggle(s)}
                  aria-label={`Remove ${s.name}`}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-card-hover"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
            {Array.from({ length: Math.max(0, min - seats.length) }, (_, i) => (
              <li
                key={`empty-${i}`}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 border border-dashed border-white/15 text-sm text-text-muted italic"
              >
                <span className="text-xs font-bold not-italic w-4">{seats.length + i + 1}</span>
                Tap someone below
              </li>
            ))}
          </ol>
        </section>

        {/* Family roster */}
        {family.length > 0 && (
        <section aria-label="Family" className="w-full mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">Family</h3>
          <div className="flex flex-wrap gap-2">
            {family.map(p => {
              const seated = isSeated(p.name);
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => toggle(p)}
                  disabled={!seated && full}
                  aria-pressed={seated}
                  className={`flex items-center gap-1.5 rounded-full pl-2 pr-3 py-1.5 text-sm font-semibold transition-all active:scale-95 disabled:opacity-40 ${
                    seated ? 'bg-accent text-bg' : 'bg-card text-text hover:bg-card-hover'
                  }`}
                >
                  <span aria-hidden>{p.avatar}</span>
                  {p.name}
                </button>
              );
            })}
          </div>
        </section>
        )}

        {/* Guest */}
        <form
          className="w-full flex gap-2 mb-6"
          onSubmit={e => { e.preventDefault(); addGuest(); }}
        >
          <label className="sr-only" htmlFor="guest-name">Guest name</label>
          <input
            id="guest-name"
            value={guestName}
            onChange={e => setGuestName(e.target.value)}
            maxLength={MAX_GUEST_NAME}
            placeholder="Add a guest…"
            disabled={full}
            className="flex-1 min-w-0 bg-card rounded-xl px-3 py-2.5 text-base text-text placeholder-text-muted outline-none focus:ring-2 ring-accent/50 disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={full || !guestName.trim()}
            aria-label="Add guest"
            className="px-3.5 rounded-xl bg-card text-text hover:bg-card-hover disabled:opacity-40 active:scale-95"
          >
            <Plus size={18} />
          </button>
        </form>

        <button
          type="button"
          onClick={() => onStart(seats)}
          disabled={error !== null}
          className="w-full bg-accent text-bg font-bold py-3.5 rounded-2xl text-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:active:scale-100"
        >
          Let's play
        </button>
        <p className="text-xs text-text-muted mt-2 h-4" role="status">{error ?? ''}</p>

        <button
          type="button"
          onClick={onCancel}
          className="text-text-muted text-sm hover:text-text transition-colors mt-3 flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Back to Games
        </button>
      </div>
    </div>
  );
}
