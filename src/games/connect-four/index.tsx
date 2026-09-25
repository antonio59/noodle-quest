import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameProps, GameResult, LocalSeat } from '@/types';
import {
  ROWS, COLS, initBoard, cloneBoard, dropPiece, getWinLine, isFull, bestMove,
  type Board, type Color,
} from './logic';
import { playPlace } from '@/lib/feedback';
import { seatAt } from '@/lib/pass-and-play';
import { TurnBanner } from '@/components/pass-and-play/TurnBanner';
import { GameArt } from '@/components/GameArt';

/** Pause on the finished board before pass & play hands over to the result screen. */
const LOCAL_END_DELAY_MS = 900;

/** Pass & play: seat 1 drops red, seat 2 drops yellow. */
const seatOf = (color: Color): number => (color === 'red' ? 1 : 2);
const COLOR_LABEL: Record<Color, string> = { red: 'Red', yellow: 'Yellow' };

/** Drop-preview tints (arrow, ghost fill, ghost ring) per disc colour. */
const GHOST: Record<Color, { arrow: string; fill: string; ring: string }> = {
  red: { arrow: '#ef4444', fill: 'rgba(239,68,68,0.3)', ring: 'rgba(239,68,68,0.6)' },
  yellow: { arrow: '#fbbf24', fill: 'rgba(251,191,36,0.3)', ring: 'rgba(251,191,36,0.6)' },
};

function localResult(seats: readonly LocalSeat[], winnerSeat: number): GameResult {
  const summary = winnerSeat === 0 ? "It's a draw!" : `${seatAt(seats, winnerSeat).name} wins!`;
  return { score: 0, stars: 0, summary, winnerSeat };
}

function ConnectFourGame({ stage, onScore, onProgress, onMessage, onEnd, aiDifficulty, multiplayerState, onMultiplayerMove, localSeats }: GameProps) {
  const isOnline = !!multiplayerState;
  // Pass & play: two people share this device and take turns; no AI.
  const isLocal = !multiplayerState && (localSeats?.length ?? 0) >= 2;
  const seats = localSeats ?? [];
  const myColor: 'red' | 'yellow' = isOnline
    ? (multiplayerState.playerNumber === 1 ? 'red' : 'yellow')
    : 'red';
  const otherColor: 'red' | 'yellow' = myColor === 'red' ? 'yellow' : 'red';

  const [board, setBoard] = useState<Board>(initBoard);
  const [turn, setTurn] = useState<'red' | 'yellow'>('red');
  const [winner, setWinner] = useState<Color | 'draw' | null>(null);
  const [winLine, setWinLine] = useState<number[][] | null>(null);
  const [started, setStarted] = useState(false);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const difficulty = aiDifficulty || 'medium';

  const endedRef = useRef(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter(x => x !== id);
      if (!endedRef.current) fn();
    }, delay);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  // The final onEnd must fire even though the game is already marked ended
  // (that flag is what stops further turns); unmount still cancels it.
  const scheduleEnd = useCallback((result: GameResult, delay: number) => {
    const id = setTimeout(() => onEnd(result), delay);
    timeoutsRef.current.push(id);
  }, [onEnd]);

  useEffect(() => {
    endedRef.current = false;
    return () => {
      endedRef.current = true;
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    const bs = multiplayerState.boardState as { board?: Board; last?: { row: number; col: number; color: 'red' | 'yellow' } } | null | undefined;
    if (bs && Array.isArray(bs.board)) {
      setBoard(bs.board);
      setTurn(multiplayerState.currentPlayer === 1 ? 'red' : 'yellow');
      if (bs.last) {
        const wl = getWinLine(bs.board, bs.last.row, bs.last.col, bs.last.color);
        if (wl) {
          setWinLine(wl);
          setWinner(bs.last.color);
          if (!endedRef.current) {
            endedRef.current = true;
            const won = bs.last.color === myColor;
            onEnd({
              score: won ? 120 : 10,
              stars: won ? 3 : 1,
              summary: won ? 'You connected four!' : 'Opponent connected four.',
            });
          }
        } else if (isFull(bs.board)) {
          setWinner('draw');
          if (!endedRef.current) {
            endedRef.current = true;
            onEnd({ score: 40, stars: 2, summary: "It's a draw!" });
          }
        }
      }
    }
  }, [isOnline, multiplayerState, myColor, onEnd]);

  const handleDrop = (col: number) => {
    if (endedRef.current || winner || board[0][col]) return;

    if (isOnline) {
      if (turn !== myColor) return;
      const nb = cloneBoard(board);
      const row = dropPiece(nb, col, myColor);
      if (row < 0) return;
      setBoard(nb);
      playPlace();
      const wl = getWinLine(nb, row, col, myColor);
      if (wl) setWinLine(wl);
      const iWon = !!wl;
      const drew = !iWon && isFull(nb);
      const serverWinner = iWon ? multiplayerState.playerNumber : drew ? 0 : undefined;
      onMultiplayerMove?.({
        boardState: { board: nb, last: { row, col, color: myColor } },
        winner: serverWinner,
      });
      setTurn(otherColor);
      if (iWon) setWinner(myColor);
      else if (drew) setWinner('draw');
      return;
    }

    if (isLocal) {
      dropLocal(col);
      return;
    }

    if (turn !== 'red') return;
    const nb = cloneBoard(board);
    const row = dropPiece(nb, col, 'red');
    if (row < 0) return;
    setBoard(nb);
    playPlace();

    const wl = getWinLine(nb, row, col, 'red');
    if (wl) {
      setWinLine(wl);
      setWinner('red');
      onScore(120);
      onProgress(1);
      onMessage('You connected four!');
      endedRef.current = true;
      scheduleEnd({ score: 120, stars: 3, summary: 'You connected four in a row! Well done!' }, 800);
      return;
    }
    if (isFull(nb)) {
      setWinner('draw');
      onMessage("It's a draw!");
      endedRef.current = true;
      scheduleEnd({ score: 40, stars: 2, summary: "It's a draw — the board is full!" }, 800);
      return;
    }

    setTurn('yellow');
    onMessage('AI thinking...');
    schedule(() => {
      if (endedRef.current) return;
      const aiC = bestMove(nb, 'yellow', difficulty);
      const nb2 = cloneBoard(nb);
      const aiR = dropPiece(nb2, aiC, 'yellow');
      setBoard(nb2);
      playPlace();
      if (aiR >= 0) {
        const aiWl = getWinLine(nb2, aiR, aiC, 'yellow');
        if (aiWl) {
          setWinLine(aiWl);
          setWinner('yellow');
          onMessage('AI connected four!');
          endedRef.current = true;
          scheduleEnd({ score: 10, stars: 1, summary: 'The AI connected four first. Try again!' }, 1000);
          return;
        }
      }
      if (isFull(nb2)) {
        setWinner('draw');
        onMessage("It's a draw!");
        endedRef.current = true;
        scheduleEnd({ score: 40, stars: 2, summary: "It's a draw — the board is full!" }, 800);
        return;
      }
      setTurn('red');
      onMessage('Your turn!');
    }, 400);
  };

  // Pass & play: whoever's seat it is drops a disc of their colour.
  const dropLocal = (col: number) => {
    const nb = cloneBoard(board);
    const row = dropPiece(nb, col, turn);
    if (row < 0) return;
    setBoard(nb);
    playPlace();
    const wl = getWinLine(nb, row, col, turn);
    if (wl) {
      setWinLine(wl);
      setWinner(turn);
      endLocal(seatOf(turn));
    } else if (isFull(nb)) {
      setWinner('draw');
      endLocal(0);
    } else {
      setTurn(turn === 'red' ? 'yellow' : 'red');
    }
  };

  // One round per mount — play.tsx owns the tally and rematch. Not routed
  // through schedule(), which drops callbacks once endedRef is set.
  const endLocal = (winnerSeat: number) => {
    if (endedRef.current) return;
    endedRef.current = true;
    const id = setTimeout(() => onEnd(localResult(seats, winnerSeat)), LOCAL_END_DELAY_MS);
    timeoutsRef.current.push(id);
  };

  // In pass & play it's always "my" turn: the device is handed to whoever's up.
  const isMyTurn = isLocal || (isOnline ? turn === myColor : turn === 'red');
  const inputDisabled = !!winner || !isMyTurn;
  const myChip = myColor === 'red' ? '🔴' : '🟡';
  const otherChip = otherColor === 'red' ? '🔴' : '🟡';

  const isWinCell = (r: number, c: number) => winLine?.some(([wr, wc]) => wr === r && wc === c) ?? false;
  // Pass & play previews the colour about to drop; solo/online always red.
  const ghost = GHOST[isLocal ? turn : 'red'];
  const discLabel = (cell: Color | null): string => {
    if (!cell) return 'empty';
    if (isLocal) return `${seatAt(seats, seatOf(cell)).name}'s ${cell} disc`;
    return cell === 'red' ? 'your disc' : 'opponent disc';
  };

  // The seat picker already served as pass & play's start screen.
  if (!started && !isLocal) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
        <GameArt gameId="connect-four" emoji="🔴" size={80} />
        <h2 className="text-2xl font-bold">Connect Four</h2>
        <p className="text-text-muted text-sm text-center max-w-xs">
          Drop discs to connect 4 in a row — horizontally, vertically, or diagonally!
        </p>
        <div className="bg-card rounded-xl p-4 flex gap-6 text-sm">
          <div className="text-center">
            <div className="text-2xl mb-1">🔴</div>
            <div className="text-text-muted">You</div>
          </div>
          <div className="text-text-muted self-center">vs</div>
          <div className="text-center">
            <div className="text-2xl mb-1">🟡</div>
            <div className="text-text-muted">AI ({difficulty})</div>
          </div>
        </div>
        <button
          onClick={() => setStarted(true)}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 transition-all"
        >
          Start Game
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center p-3">
      {isLocal ? (
        <div className="mb-3">
          {winner ? (
            <p role="status" className={`text-lg font-bold ${winner === 'draw' ? 'text-warning' : 'text-accent'}`}>
              {winner === 'draw' ? "It's a draw!" : `🎉 ${localResult(seats, seatOf(winner)).summary}`}
            </p>
          ) : (
            <TurnBanner seats={seats} turnSeat={seatOf(turn)} pieceLabel={COLOR_LABEL[turn]} />
          )}
        </div>
      ) : isOnline ? (
        <div className="flex gap-2 mb-3 text-xs items-center flex-wrap justify-center">
          <span className={`bg-card rounded-lg px-3 py-1.5 font-bold ${isMyTurn ? 'text-accent' : 'text-text-muted'}`}>
            You: {myChip}
          </span>
          <span className="bg-card rounded-lg px-3 py-1.5 text-text-muted">
            {multiplayerState?.opponentAvatar} {multiplayerState?.opponentName}: {otherChip}
          </span>
          <span className={`font-bold ${isMyTurn ? 'text-success animate-pulse' : 'text-text-muted'}`}>
            {isMyTurn ? 'Your turn' : 'Waiting...'}
          </span>
        </div>
      ) : (
        <div className="flex gap-3 mb-3 text-sm">
          <span className="bg-card rounded-lg px-3 py-1.5 text-danger font-bold">You: 🔴</span>
          <span className="bg-card rounded-lg px-3 py-1.5 text-warning font-bold">AI: 🟡</span>
          <span className={`bg-card rounded-lg px-3 py-1.5 text-xs font-bold ${turn === 'red' && !winner ? 'text-accent animate-pulse' : 'text-text-muted'}`}>
            {winner ? (winner === 'draw' ? "It's a draw!" : winner === 'red' ? '🎉 You win!' : '🤖 AI wins!') : (turn === 'red' ? 'Your turn' : 'AI thinking...')}
          </span>
        </div>
      )}

      <div className="bg-[#1a3a6a] p-2 rounded-xl">
        {/* Column drop arrows + ghost disc preview */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {Array.from({ length: COLS }, (_, c) => {
            // Find where the ghost piece would land in this column
            let ghostRow = -1;
            if (hoverCol === c && !inputDisabled && !board[0][c]) {
              for (let r = ROWS - 1; r >= 0; r--) {
                if (!board[r][c]) { ghostRow = r; break; }
              }
            }
            return (
              <button
                key={`arrow-${c}`}
                onClick={() => handleDrop(c)}
                onMouseEnter={() => setHoverCol(c)}
                onMouseLeave={() => setHoverCol(null)}
                disabled={inputDisabled || !!board[0][c]}
                aria-label={`Drop disc in column ${c + 1}`}
                className="h-6 flex items-center justify-center text-sm transition-all disabled:opacity-0"
                style={{
                  color: hoverCol === c && !inputDisabled ? ghost.arrow : '#ffffff40',
                  transform: hoverCol === c && !inputDisabled ? 'translateY(-2px)' : 'none',
                }}
              >
                ▼
              </button>
            );
          })}
        </div>

        {/* Board */}
        <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Connect Four board">
          {board.map((row, r) =>
            row.map((cell, c) => {
              const win = isWinCell(r, c);
              // Ghost piece: where the next disc would land in hovered column
              let ghostRow = -1;
              if (hoverCol === c && !inputDisabled && !board[0][c]) {
                for (let gr = ROWS - 1; gr >= 0; gr--) {
                  if (!board[gr][c]) { ghostRow = gr; break; }
                }
              }
              const isGhost = !cell && r === ghostRow && hoverCol === c;
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => handleDrop(c)}
                  onMouseEnter={() => setHoverCol(c)}
                  onMouseLeave={() => setHoverCol(null)}
                  disabled={inputDisabled}
                  aria-label={`Column ${c + 1}, row ${r + 1}: ${discLabel(cell)}`}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: cell === 'red'
                      ? win ? '#ef4444' : '#dc2626'
                      : cell === 'yellow'
                      ? win ? '#fbbf24' : '#d97706'
                      : isGhost ? ghost.fill
                      : hoverCol === c && !inputDisabled && !board[0][c] ? '#1e3a5a' : '#0f1d3a',
                    boxShadow: win
                      ? cell === 'red' ? '0 0 12px #ef4444, 0 0 24px #ef444460' : '0 0 12px #fbbf24, 0 0 24px #fbbf2460'
                      : isGhost ? `inset 0 0 0 2px ${ghost.ring}`
                      : cell
                      ? 'inset 0 -2px 4px rgba(0,0,0,0.3)'
                      : 'inset 0 2px 4px rgba(0,0,0,0.5)',
                    transform: win ? 'scale(1.08)' : 'scale(1)',
                  }}
                />
              );
            })
          )}
        </div>
      </div>

      {winner && !isOnline && !isLocal && (
        <button
          onClick={() => {
            setBoard(initBoard());
            setTurn('red');
            setWinner(null);
            setWinLine(null);
            endedRef.current = false;
          }}
          className="mt-3 bg-accent text-bg font-bold px-6 py-2.5 rounded-xl hover:opacity-90 active:scale-95 text-sm"
        >
          {winner === 'draw' ? 'Draw — Play Again' : winner === 'red' ? '🎉 You Win! Play Again' : '😅 AI Wins — Try Again'}
        </button>
      )}
    </div>
  );
}

export default ConnectFourGame;

