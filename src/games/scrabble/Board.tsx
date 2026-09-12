// SVG board renderer for Scrabble. Pure presentation: all game state and
// click handling come in via props.
import { TILE_SCORES, BONUS_MAP, type BonusType } from './logic';

// ── SVG board dimensions ──────────────────────────────────────────────
const BCS = 28;   // cell size in SVG user-units
const BLABEL = 13; // space reserved for A–O / 1–15 coordinate labels
const SVG_BOARD = BLABEL + 15 * BCS; // total SVG width & height (= 433)
const COL_LETTERS_BOARD = 'ABCDEFGHIJKLMNO'.split('');
// Solid bonus-square fills (no transparency — much easier to read on a small board)
const BONUS_FILL: Record<BonusType, string> = {
  TW: '#991b1b', // deep red
  DW: '#9f1239', // deep rose
  TL: '#1e3a8a', // deep blue
  DL: '#075985', // ocean blue
  ST: '#78350f', // amber/brown
};

interface ScrabbleBoardProps {
  board: (string | null)[][];
  placedKeys: Set<string>;
  isHumanTurn: boolean;
  onCellClick: (r: number, c: number) => void;
}

export function ScrabbleBoard({ board, placedKeys, isHumanTurn, onCellClick }: ScrabbleBoardProps) {
  return (
    <div className="flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center p-1">
      <svg
        viewBox={`0 0 ${SVG_BOARD} ${SVG_BOARD}`}
        style={{ maxWidth: '100%', maxHeight: '100%' }}
        className="rounded-lg"
      >
        {/* Outer background */}
        <rect width={SVG_BOARD} height={SVG_BOARD} fill="#0a0818" rx={4} />

        {/* Column labels A–O */}
        {COL_LETTERS_BOARD.map((l, c) => (
          <text
            key={`cl-${c}`}
            x={BLABEL + c * BCS + BCS / 2}
            y={BLABEL / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#e85d4c"
            fontSize={7}
            fontWeight="bold"
            fontFamily="system-ui"
          >{l}</text>
        ))}

        {/* Row labels 1–15 */}
        {Array.from({ length: 15 }, (_, r) => (
          <text
            key={`rl-${r}`}
            x={BLABEL / 2}
            y={BLABEL + r * BCS + BCS / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#e85d4c"
            fontSize={7}
            fontWeight="bold"
            fontFamily="system-ui"
          >{r + 1}</text>
        ))}

        {/* Board cells */}
        {board.map((row, r) => row.map((_cell, c) => {
          const key = `${r},${c}`;
          const cell = board[r][c];
          const bonus = BONUS_MAP.get(key);
          const isPlaced = placedKeys.has(key);
          const isLocked = !isPlaced && !!cell;
          const x = BLABEL + c * BCS;
          const y = BLABEL + r * BCS;

          const cellFill = cell
            ? isPlaced ? '#f59e0b' : '#c8a97e'
            : bonus
              ? BONUS_FILL[bonus]
              : '#1e1a4a';

          return (
            <g
              role="button"
              aria-label={`Row ${r + 1}, column ${c + 1}${cell ? `: ${cell}` : ''}`}
              key={key}
              onClick={() => isHumanTurn && onCellClick(r, c)}
              style={{ cursor: isHumanTurn ? 'pointer' : 'default' }}
            >
              {/* Cell background */}
              <rect
                x={x + 0.5}
                y={y + 0.5}
                width={BCS - 1}
                height={BCS - 1}
                rx={1.5}
                fill={cellFill}
              />

              {/* Bonus label when empty */}
              {!cell && bonus && (
                <text
                  x={x + BCS / 2}
                  y={y + BCS / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="rgba(255,255,255,0.92)"
                  fontSize={bonus === 'ST' ? 12 : 5.5}
                  fontWeight="bold"
                  fontFamily="system-ui"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {bonus === 'ST' ? '★' : bonus}
                </text>
              )}

              {/* Tile rendering */}
              {cell && (
                <>
                  {/* Shadow layer */}
                  <rect
                    x={x + 2}
                    y={y + 2.5}
                    width={BCS - 3}
                    height={BCS - 3}
                    rx={2}
                    fill={isPlaced ? '#b45309' : '#8a6640'}
                    style={{ pointerEvents: 'none' }}
                  />
                  {/* Tile face */}
                  <rect
                    x={x + 1.5}
                    y={y + 1.5}
                    width={BCS - 3}
                    height={BCS - 3.5}
                    rx={2}
                    fill={isPlaced ? '#fbbf24' : '#dfc09a'}
                    style={{ pointerEvents: 'none' }}
                  />
                  {/* Letter */}
                  <text
                    x={x + BCS / 2 - 0.5}
                    y={y + BCS / 2 - 0.5}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={isLocked ? '#3b2204' : '#1a1100'}
                    fontSize={BCS * 0.46}
                    fontWeight="900"
                    fontFamily="system-ui"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >{cell}</text>
                  {/* Score subscript */}
                  <text
                    x={x + BCS - 3}
                    y={y + BCS - 2.5}
                    textAnchor="end"
                    dominantBaseline="auto"
                    fill={isLocked ? '#5c3d1a' : '#3b2800'}
                    fontSize={BCS * 0.22}
                    fontWeight="bold"
                    fontFamily="system-ui"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >{TILE_SCORES[cell]}</text>
                  {/* Placed-this-turn accent ring */}
                  {isPlaced && (
                    <rect
                      x={x + 0.5}
                      y={y + 0.5}
                      width={BCS - 1}
                      height={BCS - 1}
                      rx={1.5}
                      fill="none"
                      stroke="#f0a83a"
                      strokeWidth={1.5}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                </>
              )}
            </g>
          );
        }))}

        {/* Grid lines */}
        {Array.from({ length: 16 }, (_, i) => (
          <line
            key={`vl${i}`}
            x1={BLABEL + i * BCS} y1={BLABEL}
            x2={BLABEL + i * BCS} y2={BLABEL + 15 * BCS}
            stroke="rgba(0,0,0,0.4)" strokeWidth={0.5}
            style={{ pointerEvents: 'none' }}
          />
        ))}
        {Array.from({ length: 16 }, (_, i) => (
          <line
            key={`hl${i}`}
            x1={BLABEL} y1={BLABEL + i * BCS}
            x2={BLABEL + 15 * BCS} y2={BLABEL + i * BCS}
            stroke="rgba(0,0,0,0.4)" strokeWidth={0.5}
            style={{ pointerEvents: 'none' }}
          />
        ))}

        {/* Board border */}
        <rect
          x={BLABEL} y={BLABEL}
          width={15 * BCS} height={15 * BCS}
          fill="none" stroke="#4338ca" strokeWidth={1.5}
          style={{ pointerEvents: 'none' }}
        />
      </svg>
    </div>
  );
}
