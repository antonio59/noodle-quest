// Table pieces shared by the solo/online game and pass & play, so both
// modes deal from the same-looking deck, hand and colour picker.
import { COLORS, type UnoCard, type UnoColor } from './logic';
import { COLOR_HEX, SYMBOL_DISPLAY, cardName, colorName } from './display';

/** An opponent's hand as a fan of card backs — only the count is shown. */
export function FaceDownHand({ count }: { count: number }) {
  return (
    <div className="relative flex items-center justify-center flex-shrink-0 h-16">
      {Array.from({ length: Math.min(count, 7) }).map((_, i, arr) => (
        <div
          key={i}
          className="absolute w-10 h-14 rounded-md shadow-md"
          style={{
            background: 'linear-gradient(135deg, #2d1b69, #1a1a2e)',
            border: '1px solid #4a3f8a',
            left: `calc(50% + ${(i - (arr.length - 1) / 2) * 14}px - 20px)`,
            transform: `rotate(${(i - (arr.length - 1) / 2) * 3}deg)`,
            zIndex: i,
          }}
        />
      ))}
      {count > 7 && (
        <span
          className="absolute text-[10px] text-white/60 font-bold"
          style={{ zIndex: 10, bottom: 2, right: 'calc(50% - 40px)' }}
        >
          +{count - 7}
        </span>
      )}
    </div>
  );
}

interface TablePilesProps {
  deckCount: number;
  drawDisabled: boolean;
  onDraw: () => void;
  topCard: UnoCard | undefined;
  color: UnoColor;
}

/** Draw pile beside the discard's top card and the colour in play. */
export function TablePiles({ deckCount, drawDisabled, onDraw, topCard, color }: TablePilesProps) {
  return (
    <div className="flex-1 flex items-center justify-center gap-6 py-2">
      <button
        onClick={onDraw}
        disabled={drawDisabled}
        className="relative w-16 h-24 sm:w-20 sm:h-28 rounded-lg shadow-lg flex flex-col items-center justify-center text-white font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: 'linear-gradient(135deg, #2d1b69, #1a1a2e)', border: '2px solid #6366f1' }}
      >
        <span className="text-xs opacity-70">DRAW</span>
        <span className="text-sm font-bold">{deckCount}</span>
      </button>

      <div className="flex flex-col items-center gap-1">
        <div
          className="w-20 h-28 sm:w-24 sm:h-32 rounded-xl shadow-xl flex flex-col items-center justify-center text-white font-bold border-4 relative"
          style={{
            background: COLOR_HEX[color],
            borderColor: 'rgba(255,255,255,0.3)',
          }}
        >
          <span className="text-2xl sm:text-3xl drop-shadow-lg">
            {topCard && (topCard.type === 'wild' ? '🌟' : topCard.type === 'wild4' ? '🌟+4' : SYMBOL_DISPLAY[topCard.symbol])}
          </span>
          {topCard && topCard.type !== 'wild' && topCard.type !== 'wild4' && (
            <span className="text-[10px] opacity-80 mt-1">{topCard.color.toUpperCase()}</span>
          )}
        </div>
        <div
          className="w-8 h-8 rounded-full border-2 border-white/30 shadow-md"
          style={{ background: COLOR_HEX[color] }}
        />
      </div>
    </div>
  );
}

/** Colour choice after playing a wild. */
export function ColorPicker({ onChoose }: { onChoose: (color: UnoColor) => void }) {
  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl p-4 shadow-2xl flex flex-col items-center gap-3">
        <span className="text-sm font-bold text-text">Choose a color</span>
        <div className="grid grid-cols-2 gap-2">
          {COLORS.map(color => (
            <button
              key={color}
              onClick={() => onChoose(color)}
              className="w-16 h-16 rounded-xl font-bold text-white text-sm shadow-lg transition-all hover:scale-110 active:scale-95"
              style={{ background: COLOR_HEX[color] }}
            >
              {colorName(color)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The bouncing "UNO!" call when the hand on show is down to one card. */
export function UnoCallout() {
  return (
    <div className="flex-shrink-0 text-center">
      <span className="inline-block bg-yellow-400 text-black font-black text-xl px-4 py-1 rounded-full shadow-lg animate-bounce tracking-widest">
        UNO!
      </span>
    </div>
  );
}

interface HandFanProps {
  /** Whose hand this is, e.g. "Your hand" or "Mia's hand". */
  label: string;
  hand: UnoCard[];
  isPlayable: (card: UnoCard) => boolean;
  /** Blocks every card, e.g. while the AI is thinking. */
  locked?: boolean;
  highlightId?: number | null;
  onPlay: (card: UnoCard) => void;
}

/** A face-up hand; playable cards lift and glow. */
export function HandFan({ label, hand, isPlayable, locked = false, highlightId = null, onPlay }: HandFanProps) {
  return (
    <div role="group" aria-label={label} className="w-full flex flex-col items-center gap-1 flex-shrink-0">
      <span className="text-[10px] text-text-muted">
        {label} · {hand.length} card{hand.length !== 1 ? 's' : ''}
      </span>
      <div className="w-full flex justify-center items-end gap-0.5 px-1 overflow-x-auto max-h-32 pb-1">
        {hand.map(card => {
          const playable = isPlayable(card);
          const isHighlighted = highlightId === card.id;
          const isWild = card.type === 'wild' || card.type === 'wild4';

          return (
            <button
              key={card.id}
              onClick={() => onPlay(card)}
              disabled={!playable || locked}
              aria-label={cardName(card)}
              className="flex-shrink-0 w-11 rounded-lg shadow-md flex flex-col items-center justify-center text-white font-bold transition-all border-2 relative"
              style={{
                height: 64,
                background: isWild
                  ? 'linear-gradient(135deg, #ef4444 25%, #3b82f6 25%, #3b82f6 50%, #22c55e 50%, #22c55e 75%, #eab308 75%)'
                  : COLOR_HEX[card.color],
                borderColor: playable ? '#fff' : 'rgba(255,255,255,0.15)',
                opacity: playable ? 1 : 0.55,
                transform: isHighlighted ? 'scale(1.12)' : playable ? 'translateY(-6px)' : 'none',
                cursor: playable ? 'pointer' : 'not-allowed',
                boxShadow: playable ? '0 0 8px rgba(255,255,255,0.35)' : undefined,
              }}
            >
              <span className="text-base drop-shadow-md leading-none">
                {isWild ? (card.type === 'wild4' ? '+4' : '🌟') : SYMBOL_DISPLAY[card.symbol]}
              </span>
              {!isWild && card.type === 'action' && (
                <span className="text-[7px] opacity-80 mt-0.5">
                  {card.color.slice(0, 3).toUpperCase()}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Floating nudge to draw when nothing in hand can be played. */
export function DrawPrompt({ onDraw }: { onDraw: () => void }) {
  return (
    <button
      onClick={onDraw}
      className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-accent text-bg font-bold px-4 py-2 rounded-xl text-sm shadow-lg animate-pulse z-40"
    >
      Draw a card
    </button>
  );
}
