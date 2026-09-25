// Pass & play UNO: two people share one device. Only the seat whose turn it
// is sees their hand face-up; whenever the device changes hands a curtain
// covers the table until the next person says they're holding it.
import type { GameProps, LocalSeat } from '@/types';
import { seatAt } from '@/lib/pass-and-play';
import { TurnBanner } from '@/components/pass-and-play/TurnBanner';
import { PassDeviceCurtain } from '@/components/pass-and-play/PassDeviceCurtain';
import { canPlay, type UnoCard } from './logic';
import { ColorPicker, DrawPrompt, FaceDownHand, HandFan, TablePiles, UnoCallout } from './cards';
import { handOf, otherSeat, topOf } from './local-rules';
import { useLocalUno } from './useLocalUno';

interface LocalUnoProps {
  /** Seat 1 plays first. */
  seats: LocalSeat[];
  onEnd: GameProps['onEnd'];
}

/** The other seat's hand, face-down: just a name and a count. */
function OtherHandCount({ seat, count }: { seat: LocalSeat; count: number }) {
  return (
    <div className="flex items-center gap-1.5 bg-card rounded-lg px-2 py-1 text-xs">
      <span aria-hidden>{seat.avatar}</span>
      <span className="text-text-muted">{`${seat.name} · ${count} card${count !== 1 ? 's' : ''}`}</span>
      {count === 1 && (
        <span className="text-[10px] font-black text-yellow-400 animate-bounce">UNO!</span>
      )}
    </div>
  );
}

export function LocalUno({ seats, onEnd }: LocalUnoProps) {
  const { state, play, chooseColor, draw, reveal } = useLocalUno(seats, onEnd);
  const { table, curtain, pendingWild, winner, message } = state;

  const turn = table.turn;
  const hand = handOf(table, turn);
  const otherCount = handOf(table, otherSeat(turn)).length;
  const topCard = topOf(table);
  const canAct = !curtain && !pendingWild && !winner;
  const matches = (card: UnoCard) => !!topCard && canPlay(card, topCard, table.color);
  const canDraw = canAct && !hand.some(matches);

  return (
    <div className="relative h-full flex flex-col items-center justify-between p-2 select-none overflow-hidden">
      <div className="w-full flex items-center justify-between gap-2 flex-shrink-0">
        <TurnBanner seats={seats} turnSeat={turn} />
        <OtherHandCount seat={seatAt(seats, otherSeat(turn))} count={otherCount} />
      </div>

      <FaceDownHand count={otherCount} />

      <TablePiles
        deckCount={table.deck.length}
        drawDisabled={!canDraw}
        onDraw={draw}
        topCard={topCard}
        color={table.color}
      />

      <div className="text-center text-xs py-1 min-h-[20px]">
        <span className="text-text-muted">{message}</span>
      </div>

      {pendingWild && <ColorPicker onChoose={chooseColor} />}

      {canAct && hand.length === 1 && <UnoCallout />}

      {/* Behind the curtain the hand isn't rendered at all — only its backs. */}
      {curtain ? (
        <FaceDownHand count={hand.length} />
      ) : (
        <HandFan
          label={`${seatAt(seats, turn).name}'s hand`}
          hand={hand}
          isPlayable={card => canAct && matches(card)}
          onPlay={play}
        />
      )}

      {canDraw && <DrawPrompt onDraw={draw} />}

      {curtain && (
        <PassDeviceCurtain seat={seatAt(seats, curtain.seat)} recap={curtain.recap} onReady={reveal} />
      )}
    </div>
  );
}
