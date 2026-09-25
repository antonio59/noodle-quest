import { useState, useEffect, useRef } from 'react';
import type { GameProps, GameResult, LocalSeat } from '@/types';
import { checkWinner, bestMove, type Cell, type Player, type WinLine } from './logic';
import { playMove } from '@/lib/feedback';
import { seatAt } from '@/lib/pass-and-play';
import { TurnBanner } from '@/components/pass-and-play/TurnBanner';
import { GameArt } from '@/components/GameArt';

/** Pause on the finished board before pass & play hands over to the result screen. */
const LOCAL_END_DELAY_MS = 900;

/** Pass & play: seat 1 plays X, seat 2 plays O. */
const seatOf = (mark: Player): number => (mark === 'X' ? 1 : 2);

function localResult(seats: readonly LocalSeat[], winnerSeat: number): GameResult {
  const summary = winnerSeat === 0 ? "It's a draw!" : `${seatAt(seats, winnerSeat).name} wins!`;
  return { score: 0, stars: 0, summary, winnerSeat };
}

function TicTacToeGame({ stage, onScore, onProgress, onMessage, onEnd, aiDifficulty, multiplayerState, onMultiplayerMove, localSeats }: GameProps & { aiDifficulty?: 'easy' | 'medium' | 'hard' }) {
  const isOnline = !!multiplayerState;
  // Pass & play: two people share this device and take turns; no AI.
  const isLocal = !multiplayerState && (localSeats?.length ?? 0) >= 2;
  const seats = localSeats ?? [];
  // In online play seat 1 plays X, seat 2 plays O; local uses X vs AI.
  const myMark: Player = isOnline ? (multiplayerState.playerNumber === 1 ? 'X' : 'O') : 'X';
  const otherMark: Player = myMark === 'X' ? 'O' : 'X';

  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<Player>('X');
  const [winner, setWinner] = useState<Cell | 'draw' | null>(null);
  const [winLine, setWinLine] = useState<WinLine>(null);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const targetWins = stage <= 3 ? stage : 3 + Math.floor(stage / 2);
  const MAX_LOSSES = 3;
  const endedRef = useRef(false);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => () => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
  }, []);

  const human: Player = 'X';
  const ai: Player = 'O';
  const difficulty = aiDifficulty || 'medium';

  // Sync from server boardState in online mode.
  useEffect(() => {
    if (!isOnline) return;
    const bs = multiplayerState.boardState as { board?: Cell[] } | null | undefined;
    if (bs && Array.isArray(bs.board) && bs.board.length === 9) {
      const incoming = bs.board as Cell[];
      setBoard(incoming);
      // Seat whose turn it is, mapped to mark.
      const currentMark: Player = multiplayerState.currentPlayer === 1 ? 'X' : 'O';
      setTurn(currentMark);
      const { result, line } = checkWinner(incoming);
      if (result) {
        setWinner(result);
        setWinLine(line);
        if (!endedRef.current) {
          endedRef.current = true;
          const won = result === myMark;
          const stars = result === 'draw' ? 2 : won ? 3 : 1;
          const summary = result === 'draw' ? "It's a draw!" : won ? 'You won!' : 'You lost this round.';
          onEnd({ score: won ? 100 : result === 'draw' ? 50 : 10, stars, summary });
        }
      }
    } else if (bs === null || bs === undefined) {
      // First-time init from server: empty board, seat 1 (X) moves first.
      setBoard(Array(9).fill(null));
      setTurn('X');
    }
  }, [isOnline, multiplayerState, myMark, onEnd]);

  const handleCell = (i: number) => {
    if (board[i] || winner) return;

    if (isOnline) {
      if (turn !== myMark) return;
      const next = [...board];
      next[i] = myMark;
      setBoard(next);
      playMove();
      const { result, line } = checkWinner(next);
      if (result) setWinLine(line);
      // Dispatch to server; server relays to opponent and the useEffect above
      // will reconcile when the query updates.
      const serverWinner = result === 'draw' ? 0 : result === myMark ? multiplayerState.playerNumber : result ? (multiplayerState.playerNumber === 1 ? 2 : 1) : undefined;
      onMultiplayerMove?.({ boardState: { board: next }, winner: serverWinner });
      // Optimistic local turn flip (server will re-confirm).
      setTurn(otherMark);
      return;
    }

    if (isLocal) {
      playLocal(i);
      return;
    }

    if (turn !== human) return;
    const next = [...board];
    next[i] = human;
    setBoard(next);
    playMove();
    const { result, line } = checkWinner(next);
    if (result) {
      setWinLine(line);
      handleResult(result, next);
    } else {
      setTurn(ai);
      onMessage('Thinking...');
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
      aiTimerRef.current = setTimeout(() => {
        const aiIdx = bestMove(next, ai, difficulty);
        const afterAi = [...next];
        afterAi[aiIdx] = ai;
        setBoard(afterAi);
        const { result: aiResult, line: aiLine } = checkWinner(afterAi);
        if (aiResult) {
          setWinLine(aiLine);
          handleResult(aiResult, afterAi);
        } else {
          setTurn(human);
          onMessage('Your turn!');
        }
      }, 400);
    }
  };

  // Pass & play: whoever's seat it is taps a cell; marks simply alternate.
  const playLocal = (i: number) => {
    const next = [...board];
    next[i] = turn;
    setBoard(next);
    playMove();
    const { result, line } = checkWinner(next);
    if (!result) {
      setTurn(turn === 'X' ? 'O' : 'X');
      return;
    }
    setWinLine(line);
    setWinner(result);
    endLocal(result === 'draw' ? 0 : seatOf(result));
  };

  // One round per mount — play.tsx owns the tally and rematch.
  const endLocal = (winnerSeat: number) => {
    if (endedRef.current) return;
    endedRef.current = true;
    endTimerRef.current = setTimeout(() => onEnd(localResult(seats, winnerSeat)), LOCAL_END_DELAY_MS);
  };

  const handleResult = (result: Cell | 'draw', finalBoard: Cell[]) => {
    setWinner(result);
    const newGames = gamesPlayed + 1;
    setGamesPlayed(newGames);
    if (result === human) {
      const newWins = wins + 1;
      setWins(newWins);
      onScore(100);
      onProgress(newWins / targetWins);
      if (newWins >= targetWins) {
        const stars = losses === 0 ? 3 : losses <= 1 ? 2 : 1;
        onEnd({ score: newWins * 100, stars, summary: `You won ${newWins} games!` });
      } else {
        onMessage(`Win ${newWins}/${targetWins}! Tap Play Again to continue.`);
      }
    } else if (result === ai) {
      const newLosses = losses + 1;
      setLosses(newLosses);
      if (newLosses >= MAX_LOSSES) {
        onMessage('AI won the match!');
        onEnd({ score: wins * 100, stars: 1, summary: `AI won the match — ${wins} wins vs ${newLosses} losses.` });
      } else {
        onMessage(`You lost — ${newLosses}/${MAX_LOSSES} losses. Tap Play Again.`);
      }
    } else {
      onMessage("It's a draw! Tap Play Again.");
    }
  };

  const resetBoard = () => {
    if (aiTimerRef.current) {
      clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }
    setBoard(Array(9).fill(null));
    setTurn('X');
    setWinner(null);
    setWinLine(null);
    onMessage('Your turn! (X)');
  };

  // In pass & play it's always "my" turn: the device is handed to whoever's up.
  const isMyTurn = isLocal || (isOnline ? turn === myMark : turn === human);
  const inputDisabled = !!winner || !isMyTurn;
  // The seat picker already served as pass & play's start screen.
  if (!started && !isLocal) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
        <GameArt gameId="tic-tac-toe" emoji="⭕" size={80} />
        <h2 className="text-2xl font-bold">Tic-Tac-Toe</h2>
        <div className="bg-card rounded-xl p-4 max-w-xs w-full space-y-2 text-sm">
          <div className="flex items-center gap-2"><span>✖️</span><span className="text-text-muted">You are X — get 3 in a row to win</span></div>
          <div className="flex items-center gap-2"><span>🏆</span><span className="text-text-muted">Target: <span className="text-accent">{targetWins} {targetWins === 1 ? 'win' : 'wins'}</span> to complete the stage</span></div>
          <div className="flex items-center gap-2"><span>🤖</span><span className="text-text-muted capitalize">AI difficulty: <span className="text-accent">{difficulty}</span></span></div>
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
    <div className="h-full flex flex-col items-center justify-center p-4 gap-1">
      {isLocal ? (
        <div className="mb-3">
          {winner ? (
            <p role="status" className={`text-lg font-bold ${winner === 'draw' ? 'text-warning' : 'text-accent'}`}>
              {winner === 'draw' ? "It's a draw!" : `🎉 ${localResult(seats, seatOf(winner)).summary}`}
            </p>
          ) : (
            <TurnBanner seats={seats} turnSeat={seatOf(turn)} pieceLabel={turn} />
          )}
        </div>
      ) : isOnline ? (
        <div className="flex gap-3 mb-3 text-sm items-center">
          <span className={`bg-card rounded-lg px-3 py-1.5 font-bold ${isMyTurn ? 'text-accent' : 'text-text-muted'}`}>
            You: {myMark}
          </span>
          <span className="text-text-dim text-xs">vs</span>
          <span className="bg-card rounded-lg px-3 py-1.5 text-text-muted">
            {multiplayerState?.opponentAvatar} {multiplayerState?.opponentName}: {otherMark}
          </span>
          <span className={`text-xs font-bold ${isMyTurn ? 'text-success animate-pulse' : 'text-text-dim'}`}>
            {isMyTurn ? 'Your turn' : 'Waiting...'}
          </span>
        </div>
      ) : (
        <div className="flex gap-3 mb-3 text-sm items-center">
          <span className="bg-card rounded-lg px-3 py-1.5 text-accent font-bold">
            Wins: {wins}/{targetWins}
          </span>
          <div className="flex gap-1">
            {Array.from({ length: targetWins }, (_, i) => (
              <div key={i} className={`w-3 h-3 rounded-full border ${i < wins ? 'bg-accent border-accent' : 'border-text-dim bg-transparent'}`} />
            ))}
          </div>
          {losses > 0 && <span className="text-xs text-red-400">❌ {losses}/{MAX_LOSSES}</span>}
        </div>
      )}

      {/* Turn indicator (pass & play shows the TurnBanner instead) */}
      {!winner && !isLocal && (
        <div className={`text-xs font-bold mb-1 px-3 py-1 rounded-full transition-all ${
          isMyTurn ? 'bg-accent/20 text-accent' : 'bg-card text-text-muted'
        }`}>
          {isOnline ? (isMyTurn ? 'Your turn' : 'Waiting...') : (isMyTurn ? 'Your turn (X)' : 'AI thinking...')}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 p-3 bg-card rounded-2xl mb-3 game-board" role="grid" aria-label="Tic-tac-toe board">
        {board.map((cell, i) => {
          const isWinCell = winLine?.includes(i) ?? false;
          const cellName = `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}`;
          return (
            <button
              key={i}
              onClick={() => handleCell(i)}
              disabled={!!cell || inputDisabled}
              aria-label={cell ? `${cellName}: ${cell}` : `${cellName}: empty`}
              className={`game-cell w-20 h-20 rounded-xl text-4xl font-bold flex items-center justify-center transition-all active:scale-90 ${
                !cell && !inputDisabled ? 'hover:bg-card-hover' : ''
              } ${isWinCell ? 'ring-2 ring-success bg-success/20' : cell ? '' : 'bg-card-hover/50'}`}
              style={{
                boxShadow: cell ? 'none' : '0 2px 0 rgba(0,0,0,0.2)',
                color: cell === 'X' ? '#f0a83a' : cell === 'O' ? '#f87171' : undefined,
                transform: isWinCell ? 'scale(1.05)' : undefined,
              }}
            >
              {cell || ''}
            </button>
          );
        })}
      </div>

      {winner && !isOnline && !isLocal && (
        <div className="flex flex-col items-center gap-2">
          <div className={`text-lg font-bold ${winner === human ? 'text-accent' : winner === 'draw' ? 'text-warning' : 'text-danger'}`}>
            {winner === 'draw' ? "It's a draw!" : winner === human ? '🎉 You Win!' : '🤖 AI Wins!'}
          </div>
          <button onClick={resetBoard} className="bg-accent text-bg font-bold px-6 py-2.5 rounded-xl hover:opacity-90 active:scale-95 text-sm">
            Play Again
          </button>
        </div>
      )}
      {winner && isOnline && (
        <div className="text-center">
          <p className="text-lg font-bold mb-1">
            {winner === 'draw' ? "It's a draw!" : winner === myMark ? 'You Win! 🎉' : 'You lost this round.'}
          </p>
        </div>
      )}
    </div>
  );
}

export default TicTacToeGame;

