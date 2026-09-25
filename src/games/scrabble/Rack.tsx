// The tile rack for whichever seat this device is showing.
import { TILE_SCORES } from './logic';

interface TileRackProps {
  tiles: string[];
  selected: number | null;
  disabled: boolean;
  /** Pass & play: nothing is rendered while the device changes hands. */
  hidden?: boolean;
  onSelect: (index: number) => void;
}

export function TileRack({ tiles, selected, disabled, hidden = false, onSelect }: TileRackProps) {
  if (hidden) return <div className="flex justify-center gap-1.5 flex-shrink-0 pt-1 h-12" aria-hidden />;
  return (
    <div className="flex justify-center gap-1.5 flex-shrink-0 pt-1">
      {tiles.map((tile, i) => {
        const pts = TILE_SCORES[tile];
        return (
          <button
            key={`${tile}-${i}`}
            onClick={() => onSelect(i)}
            disabled={disabled}
            aria-label={`Tile ${tile}, ${pts} point${pts === 1 ? '' : 's'}`}
            aria-pressed={selected === i}
            className={`relative w-10 h-11 rounded-lg font-bold text-base flex flex-col items-center justify-center transition-all shadow-sm ${
              selected === i
                ? 'bg-accent text-bg ring-2 ring-accent scale-110 -translate-y-1 shadow-lg'
                : 'bg-amber-200 text-amber-900 hover:bg-amber-300 hover:scale-105 hover:-translate-y-0.5 active:scale-95'
            } ${disabled ? 'opacity-60' : ''}`}
          >
            <span className="leading-none">{tile}</span>
            <span className={`text-[9px] leading-none mt-0.5 font-bold ${
              selected === i ? 'text-bg/80' : 'text-amber-700'
            }`}>
              {pts}
            </span>
          </button>
        );
      })}
      {tiles.length === 0 && (
        <span className="text-text-muted text-[10px] py-2">No tiles</span>
      )}
    </div>
  );
}
