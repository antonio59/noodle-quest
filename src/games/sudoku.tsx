import { useState, useCallback, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import type { GameProps } from '@/types';

// Puzzle format: 81-char string, '0' = empty. [puzzle, solution]
// Exported for tests — sudoku-data.test.ts verifies every pair.
export const PUZZLES: Array<[string, string]> = [
  // Easy
  ['600200947004096510729510008010873060047650000060100790070000420500020009092380006',
   '651238947384796512729514638915873264247659381863142795178965423536421879492387156'],
  ['000085460089000120530002070005126090003000256000309000301090602090230510802460937',
   '127985463689743125534612879475126398913874256268359741341597682796238514852461937'],
  ['010000089608020043900080100071502308062000417003017600200030074140070900706905820',
   '314756289658129743927384165471562398562893417893417652289631574145278936736945821'],
  ['000020460009005000106000008094002080018904670703060249382790010460583000900041830',
   '537829461849615327126437958694372185218954673753168249382796514461583792975241836'],
  ['540819007007000506820760401078246903000007000000008170760080025400030760090072810',
   '546819237917423586823765491178246953239157648654398172761984325482531769395672814'],
  // Medium
  ['108026000700000005069510780817400206004300050036001000000000027940070000000608900',
   '158726394723849615469513782817495236294367158536281479681934527945172863372658941'],
  ['000840000070500030000000601700002800060070020903601040042100009301460087600008304',
   '135846972276519438489723651714352896568974123923681745842137569391465287657298314'],
  ['005000004040000000092030810410090003000000000300604107920048370070200908604070501',
   '135782694846159732792436815417895263268317459359624187921548376573261948684973521'],
  ['075600029100000080480031706000300010040908200000070000000802500002103047010007602',
   '375684129126759483489231756857326914643918275291475368734862591562193847918547632'],
  ['000700000001026000830000020000300089210078560389000100040250090100800052003040801',
   '462783915951426738837195624675314289214978563389562147748251396196837452523649871'],
  // Hard
  ['080000900005309000700280000000400010400637000060910080000000603001062009000053700',
   '184576932625349178739281564597428316418637295263915487872194653351762849946853721'],
  ['010960085003040107800030000000002900490800000000009051050300009000001030000000724',
   '214967385563248197879135462187652943495813276326479851758324619642791538931586724'],
  ['000087906602040780007250004000003507060000002403900000030000000200030000009500600',
   '354187926612349785897256314128463597965871432473925861531694278246738159789512643'],
  ['030049010000803409900000030014300096000700040000000501007108600800004000650000000',
   '238649715175823469946571832714385296569712348382496571497158623823964157651237984'],
  ['007100520000400060620030019070040090006012004500800000009000200100080905060000000',
   '847196523913425867625738419271543698386912754594867132459371286132684975768259341'],
];

export function parsePuzzle(s: string): number[][] {
  return Array.from({ length: 9 }, (_, r) =>
    Array.from({ length: 9 }, (_, c) => parseInt(s[r * 9 + c], 10))
  );
}

/** A grid is solved when every row, column, and 3×3 box is a permutation of 1-9. */
export function isSolvedGrid(grid: number[][]): boolean {
  const ok = (cells: number[]) => {
    const seen = new Set(cells);
    return cells.every(v => v >= 1 && v <= 9) && seen.size === 9;
  };
  for (let i = 0; i < 9; i++) {
    if (!ok(grid[i])) return false;
    if (!ok(grid.map(row => row[i]))) return false;
    const br = 3 * Math.floor(i / 3), bc = 3 * (i % 3);
    const box: number[] = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) box.push(grid[br + r][bc + c]);
    if (!ok(box)) return false;
  }
  return true;
}

export function getPuzzleIndex(stage: number, playsInBand = 0): number {
  const difficulty = stage <= 3 ? 0 : stage <= 7 ? 1 : 2; // 0=easy, 1=medium, 2=hard
  const offset = difficulty * 5;
  // Each band has 5 puzzles but the early bands span fewer stages, so stage
  // alone can't reach them all — rotate by how often the band was played.
  return offset + ((stage + playsInBand) % 5);
}

function difficultyBand(stage: number): number {
  return stage <= 3 ? 0 : stage <= 7 ? 1 : 2;
}

export default function SudokuGame({ stage, onScore, onProgress, onEnd, onMessage }: GameProps) {
  // Count plays per difficulty band so repeated visits cycle all 5 puzzles.
  const [playsInBand] = useState(() => {
    const key = `nq-sudoku-band-${difficultyBand(stage)}`;
    const n = parseInt(localStorage.getItem(key) ?? '0', 10) || 0;
    localStorage.setItem(key, String(n + 1));
    return n;
  });
  const puzzleIdx = useMemo(() => getPuzzleIndex(stage, playsInBand), [stage, playsInBand]);
  const [puzzle, solution] = PUZZLES[puzzleIdx] ?? PUZZLES[0];

  const initialGrid = useMemo(() => parsePuzzle(puzzle), [puzzle]);
  const solutionGrid = useMemo(() => parsePuzzle(solution), [solution]);

  const [grid, setGrid] = useState<number[][]>(() => initialGrid.map(r => [...r]));
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [checkCount, setCheckCount] = useState(0);
  const [startTime] = useState(() => Date.now());
  const [complete, setComplete] = useState(false);

  const endedRef = useRef(false);
  const onEndRef = useRef(onEnd);
  const onScoreRef = useRef(onScore);
  const onProgressRef = useRef(onProgress);
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);
  useEffect(() => { onScoreRef.current = onScore; }, [onScore]);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  useEffect(() => {
    endedRef.current = false;
    return () => { endedRef.current = true; };
  }, []);

  useEffect(() => {
    onMessageRef.current('Fill in the grid — each row, column and 3×3 box uses 1–9 once.');
  }, []);

  const isFixed = useCallback((r: number, c: number) => initialGrid[r][c] !== 0, [initialGrid]);

  const filledCount = useMemo(() => grid.flat().filter(v => v !== 0).length, [grid]);
  const totalEmpty  = useMemo(() => initialGrid.flat().filter(v => v === 0).length, [initialGrid]);

  useEffect(() => {
    onProgressRef.current(Math.min((filledCount - (81 - totalEmpty)) / totalEmpty, 1));
  }, [filledCount, totalEmpty]);

  const handleCellClick = useCallback((r: number, c: number) => {
    if (complete) return;
    setSelected([r, c]);
  }, [complete]);

  const handleNumber = useCallback((num: number) => {
    if (!selected || complete) return;
    const [r, c] = selected;
    if (isFixed(r, c)) return;

    const newGrid = grid.map(row => [...row]);
    newGrid[r][c] = num;
    setGrid(newGrid);
    setErrors(new Set()); // clear errors on new input

    // Check if puzzle complete: every row, column, and box holds 1–9.
    // Rule-based (not a string match) so any valid completion wins even
    // if it differs from the stored solution.
    const isSolved = isSolvedGrid(newGrid);
    if (isSolved) {
      setComplete(true);
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const penaltyPerCheck = 30;
      const timePenalty = Math.floor(elapsed / 10);
      const score = Math.max(100, 500 - timePenalty - checkCount * penaltyPerCheck);
      onScoreRef.current(score);
      onProgressRef.current(1);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      const stars = elapsed < 180 ? 3 : elapsed < 360 ? 2 : 1;
      onMessageRef.current('🎉 Puzzle complete!');
      if (!endedRef.current) {
        endedRef.current = true;
        onEndRef.current({ score, stars, summary: `Completed Sudoku in ${timeStr}! Score: ${score}` });
      }
    }
  }, [selected, complete, isFixed, grid, solutionGrid, startTime, checkCount]);

  const handleErase = useCallback(() => {
    if (!selected || complete) return;
    const [r, c] = selected;
    if (isFixed(r, c)) return;
    const newGrid = grid.map(row => [...row]);
    newGrid[r][c] = 0;
    setGrid(newGrid);
    setErrors(new Set());
  }, [selected, complete, isFixed, grid]);

  const handleCheck = useCallback(() => {
    const newErrors = new Set<string>();
    grid.forEach((row, r) => row.forEach((val, c) => {
      if (val !== 0 && !isFixed(r, c) && val !== solutionGrid[r][c]) {
        newErrors.add(`${r},${c}`);
      }
    }));
    setErrors(newErrors);
    setCheckCount(n => n + 1);
    onMessageRef.current(newErrors.size === 0 ? '✓ No mistakes so far!' : `⚠️ ${newErrors.size} error${newErrors.size > 1 ? 's' : ''} found`);
  }, [grid, isFixed, solutionGrid]);

  const difficultyLabel = stage <= 3 ? 'Easy' : stage <= 7 ? 'Medium' : 'Hard';

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(36);
  useLayoutEffect(() => {
    const update = () => {
      if (gridContainerRef.current) {
        const w = gridContainerRef.current.clientWidth;
        setCellSize(Math.min(36, Math.floor(w / 9)));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (gridContainerRef.current) ro.observe(gridContainerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="h-full flex flex-col items-center p-3 gap-2 select-none">
      <div className="flex justify-between items-center w-full max-w-sm">
        <span className="text-xs text-text-muted font-bold">{difficultyLabel} · Stage {stage}</span>
        <span className="text-xs text-text-muted">{filledCount - (81 - totalEmpty)}/{totalEmpty} filled</span>
        <button onClick={handleCheck} disabled={complete}
          className="text-xs px-2.5 py-1 rounded-lg bg-accent/15 text-accent font-bold disabled:opacity-40">
          Check
        </button>
      </div>

      {/* Grid — responsive: measure container, cap cell at 36px */}
      <div ref={gridContainerRef} className="w-full max-w-sm">
      <div className="grid grid-cols-9 border-2 border-white/20 rounded-xl overflow-hidden mx-auto"
        style={{ gap: 0, width: cellSize * 9 }}>
        {grid.map((row, r) =>
          row.map((val, c) => {
            const isSelected = selected?.[0] === r && selected?.[1] === c;
            const sameRow    = selected?.[0] === r;
            const sameCol    = selected?.[1] === c;
            const sameBox    = selected && Math.floor(selected[0] / 3) === Math.floor(r / 3) && Math.floor(selected[1] / 3) === Math.floor(c / 3);
            const isErr      = errors.has(`${r},${c}`);
            const fixed      = isFixed(r, c);
            const highlight  = selected && !isSelected && (sameRow || sameCol || sameBox);
            const sameNum    = selected && val !== 0 && val === grid[selected[0]][selected[1]];

            const borderR = (c + 1) % 3 === 0 && c < 8 ? '2px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.06)';
            const borderB = (r + 1) % 3 === 0 && r < 8 ? '2px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.06)';

            return (
              <button key={`${r}-${c}`} type="button" onClick={() => handleCellClick(r, c)}
                aria-label={`Row ${r + 1}, column ${c + 1}${fixed ? `, given ${val}` : val ? `, ${val}` : ', empty'}`}
                aria-pressed={isSelected}
                className="game-cell flex items-center justify-center cursor-pointer transition-all duration-75"
                style={{
                  width: cellSize, height: cellSize,
                  fontSize: `${Math.max(0.6, cellSize / 36)}rem`,
                  fontWeight: fixed ? '700' : '500',
                  borderRight: borderR,
                  borderBottom: borderB,
                  background: isSelected ? 'rgba(167,139,250,0.35)' : isErr ? 'rgba(239,68,68,0.25)' : sameNum ? 'rgba(167,139,250,0.2)' : highlight ? 'rgba(167,139,250,0.08)' : 'transparent',
                  color: isErr ? '#ef4444' : fixed ? 'white' : val !== 0 ? '#f0a83a' : 'transparent',
                }}>
                {val || ''}
              </button>
            );
          })
        )}
      </div>
      </div>

      {/* Number pad */}
      <div className="flex gap-1.5 flex-wrap justify-center max-w-sm">
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} onClick={() => handleNumber(n)} disabled={complete}
            className="w-10 h-10 rounded-xl font-bold text-base bg-card text-text active:scale-90 transition-all disabled:opacity-40"
            style={{ border: '2px solid rgba(255,255,255,0.08)' }}>
            {n}
          </button>
        ))}
        <button onClick={handleErase} disabled={complete}
          className="w-10 h-10 rounded-xl text-sm bg-card text-text-muted active:scale-90 transition-all disabled:opacity-40"
          style={{ border: '2px solid rgba(255,255,255,0.08)' }}>
          ⌫
        </button>
      </div>

      {complete && (
        <div className="text-center text-emerald-400 font-bold text-lg animate-pulse">
          🎉 Puzzle Complete!
        </div>
      )}
    </div>
  );
}
