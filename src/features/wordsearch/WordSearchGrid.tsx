import type { WSPlacement } from '@/lib/puzzle-engine/wordsearch/types';

export interface FoundWordOverlay {
  word: string;
  cells: [number, number][];
  color: string;
}

interface WordSearchGridProps {
  grid: string[][];
  gridSize: number;
  cellStateFor: (r: number, c: number) => { selected: boolean; found: boolean };
  foundOverlays: FoundWordOverlay[];
  onMouseDown: (r: number, c: number) => void;
  onMouseEnter: (r: number, c: number) => void;
  onMouseUp: () => void;
  onTouchStart: (r: number, c: number) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

const CELL_REM = 2.25;
const GAP_REM = 0.125;
// Horizontal room the board never gets on a phone: page + board padding.
const CHROME_REM = 3.25;

// Cells shrink to fit narrow screens (max CELL_REM); pills use the same vars.
const CELL = 'var(--ws-cell)';
const STEP = 'var(--ws-step)';

export function WordSearchGrid({
  grid,
  gridSize,
  cellStateFor,
  foundOverlays,
  onMouseDown,
  onMouseEnter,
  onMouseUp,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: WordSearchGridProps) {
  const gapsRem = (gridSize - 1) * GAP_REM;
  const sizing = {
    '--ws-cell': `min(${CELL_REM}rem, calc((100vw - ${CHROME_REM + gapsRem}rem) / ${gridSize}))`,
    '--ws-step': `calc(var(--ws-cell) + ${GAP_REM}rem)`,
    width: `calc(${STEP} * ${gridSize} - ${GAP_REM}rem)`,
    height: `calc(${STEP} * ${gridSize} - ${GAP_REM}rem)`,
  } as React.CSSProperties;

  return (
    <div
      className="relative select-none touch-none"
      style={sizing}
      onMouseLeave={onMouseUp}
      onMouseUp={onMouseUp}
      onTouchEnd={onTouchEnd}
    >
      {/* Found-word pill overlay (behind letters) */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {foundOverlays.map(ov => (
          <WordPill key={ov.word} overlay={ov} />
        ))}
      </div>

      {/* Letter grid */}
      <div
        className="grid relative z-10"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, ${CELL})`,
          gridAutoRows: CELL,
          gap: `${GAP_REM}rem`,
        }}
      >
        {grid.map((row, r) =>
          row.map((ch, c) => {
            const state = cellStateFor(r, c);
            return (
              <div
                key={`${r}-${c}`}
                data-r={r}
                data-c={c}
                onMouseDown={() => onMouseDown(r, c)}
                onMouseEnter={() => onMouseEnter(r, c)}
                onTouchStart={() => onTouchStart(r, c)}
                onTouchMove={onTouchMove}
                className={[
                  'flex items-center justify-center font-bold uppercase cursor-pointer rounded-md transition-all duration-75 relative',
                  state.found
                    ? 'text-white font-extrabold'
                    : state.selected
                      ? 'bg-accent text-white ring-2 ring-white/60 scale-105 shadow-lg shadow-accent/30 z-20'
                      : 'bg-[#142824] text-teal-200 hover:bg-[#23423b] hover:text-white',
                ].join(' ')}
                style={{ fontSize: '0.9rem', letterSpacing: '0.05em' }}
              >
                {ch}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function WordPill({ overlay }: { overlay: FoundWordOverlay }) {
  const cells = overlay.cells;
  if (cells.length === 0) return null;

  const [sr, sc] = cells[0];
  const [er, ec] = cells[cells.length - 1];

  // Positions in grid steps; the CSS vars turn steps into length.
  const dx = ec - sc;
  const dy = er - sr;
  const steps = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <div
      className="absolute rounded-full"
      style={{
        left: `calc(${STEP} * ${(sc + ec) / 2} + ${CELL} / 2)`,
        top: `calc(${STEP} * ${(sr + er) / 2} + ${CELL} / 2)`,
        width: `calc(${STEP} * ${steps} + ${CELL} * 0.88)`,
        height: `calc(${CELL} * 0.86)`,
        transform: `translate(-50%, -50%) rotate(${angle}deg)`,
        background: overlay.color,
        opacity: 0.82,
        boxShadow: `0 0 8px ${overlay.color}88`,
      }}
    />
  );
}
