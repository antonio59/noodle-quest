import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameProps } from '@/types';
import {
  SIZE, initBoard, getJumps, allMoves, pieceTargets, applyMove,
  countPieces, bestMove, otherColor as opponentOf,
  type Board, type Color, type Pos,
} from './logic';
import { playMove, playCapture } from '@/lib/feedback';
import { useBoardCursor } from '@/hooks/useBoardCursor';
import { LocalScoreboard, localResult, turnLabel } from './pass-and-play';
import { GameArt } from '@/components/GameArt';

function CheckersGame({
  stage,
  onScore,
  onProgress,
  onMessage,
  onEnd,
  aiDifficulty,
  multiplayerState,
  onMultiplayerMove,
  localSeats,
}: GameProps) {
  const isOnline = !!multiplayerState;
  // Pass & play: both colours are people on this device — no AI at all.
  const isLocal = !isOnline && (localSeats?.length ?? 0) >= 2;
  const myColor: 'red' | 'black' = isOnline
    ? (multiplayerState.playerNumber === 1 ? 'red' : 'black')
    : 'red';
  const otherColor: 'red' | 'black' = myColor === 'red' ? 'black' : 'red';

  const [board, setBoard] = useState<Board>(initBoard);
  const [selected, setSelected] = useState<Pos | null>(null);
  const [targets, setTargets] = useState<Pos[]>([]);
  const [turn, setTurn] = useState<'red' | 'black'>('red');
  const [multiJumpPos, setMultiJumpPos] = useState<Pos | null>(null);
  const [started, setStarted] = useState(false);
  const [boardSize, setBoardSize] = useState(320);
  const diff = aiDifficulty || 'medium';

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

  useEffect(() => {
    endedRef.current = false;
    return () => {
      endedRef.current = true;
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const u = () => setBoardSize(Math.min(window.innerWidth - 24, 400));
    u();
    window.addEventListener('resize', u);
    return () => window.removeEventListener('resize', u);
  }, []);

  // Online sync: pull board + turn from server state.
  useEffect(() => {
    if (!isOnline) return;
    const bs = multiplayerState.boardState as { board?: Board } | null | undefined;
    if (bs && Array.isArray(bs.board)) {
      setBoard(bs.board);
      setTurn(multiplayerState.currentPlayer === 1 ? 'red' : 'black');
      setSelected(null);
      setTargets([]);
      setMultiJumpPos(null);
      // End-of-game detection: a side has 0 pieces or no legal moves.
      if (!endedRef.current) {
        const redMoves = allMoves(bs.board, 'red').length;
        const blackMoves = allMoves(bs.board, 'black').length;
        const redPieces = countPieces(bs.board, 'red');
        const blackPieces = countPieces(bs.board, 'black');
        const redDead = redPieces === 0 || redMoves === 0;
        const blackDead = blackPieces === 0 || blackMoves === 0;
        if (redDead || blackDead) {
          endedRef.current = true;
          const winnerColor: 'red' | 'black' = redDead ? 'black' : 'red';
          const won = winnerColor === myColor;
          onEnd({
            score: won ? 150 : 10,
            stars: won ? 3 : 1,
            summary: won ? 'You won the match!' : 'Opponent won this match.',
          });
        }
      }
    }
  }, [isOnline, multiplayerState, myColor, onEnd]);



  const handleEnd = useCallback(
    (b: Board): boolean => {
      if (endedRef.current) return true;
      const bk = countPieces(b, 'black'),
        rd = countPieces(b, 'red');
      if (bk === 0 || allMoves(b, 'black').length === 0) {
        endedRef.current = true;
        onScore(150);
        onProgress(1);
        onMessage('You win! All black pieces captured.');
        onEnd({ score: 150, stars: 3, summary: 'You captured all the AI pieces! Great game!' });
        return true;
      }
      if (rd === 0 || allMoves(b, 'red').length === 0) {
        endedRef.current = true;
        onScore(10);
        onProgress(0);
        onMessage('AI wins — no moves left.');
        onEnd({ score: 10, stars: 1, summary: 'The AI captured all your pieces. Better luck next time!' });
        return true;
      }
      return false;
    },
    [onScore, onProgress, onMessage, onEnd],
  );

  const doAiTurn = useCallback(
    (b: Board) => {
      onMessage('AI thinking...');

      schedule(() => {
        // The search picks a complete move (including any multi-jump
        // chain); we animate it hop by hop.
        const m = bestMove(b, 'black', diff);
        if (!m) {
          handleEnd(b);
          return;
        }
        let cur = b;
        const doHop = (i: number) => {
          if (endedRef.current) return;
          const isJump = Math.abs(m.path[i + 1][0] - m.path[i][0]) === 2;
          cur = applyMove(cur, m.path[i], m.path[i + 1]);
          setBoard(cur);
          if (isJump) playCapture(); else playMove();
          if (i + 2 < m.path.length) {
            schedule(() => doHop(i + 1), 350);
            return;
          }
          if (handleEnd(cur)) return;
          setTurn('red');
          onMessage('Your turn!');
        };
        schedule(() => doHop(0), 350);
      }, 400);
    },
    [diff, onMessage, handleEnd, schedule],
  );

  // Online-mode end-of-turn: dispatch the resulting board to the server.
  const finishOnlineTurn = useCallback((nb: Board) => {
    if (!isOnline) return;
    // Determine winner from the post-move board.
    const oppMoves = allMoves(nb, otherColor).length;
    const oppPieces = countPieces(nb, otherColor);
    const myPieces = countPieces(nb, myColor);
    let serverWinner: number | undefined;
    if (oppPieces === 0 || oppMoves === 0) {
      serverWinner = multiplayerState!.playerNumber;
    } else if (myPieces === 0) {
      serverWinner = multiplayerState!.playerNumber === 1 ? 2 : 1;
    }
    onMultiplayerMove?.({ boardState: { board: nb }, winner: serverWinner });
  }, [isOnline, myColor, otherColor, multiplayerState, onMultiplayerMove]);

  // Pass & play end-of-turn: end the round or hand the board to the other seat.
  const finishLocalTurn = useCallback((nb: Board, mover: Color) => {
    const result = localResult(nb, mover, localSeats ?? []);
    if (!result) {
      setTurn(opponentOf(mover));
      return;
    }
    if (endedRef.current) return;
    endedRef.current = true;
    onEnd(result);
  }, [localSeats, onEnd]);

  const handleClick = useCallback(
    (r: number, c: number) => {
      if (isLocal && endedRef.current) return;
      // Pass & play: whoever's turn it is moves, so any colour can be picked.
      const activeColor: 'red' | 'black' = isOnline ? myColor : isLocal ? turn : 'red';
      if (turn !== activeColor) return;
      const p = board[r][c];

      if (multiJumpPos) {
        if (targets.some(([tr, tc]) => tr === r && tc === c)) {
          const nb = applyMove(board, multiJumpPos, [r, c]);
          setBoard(nb);
          playCapture();
          const more = getJumps(nb, r, c);
          if (more.length > 0) {
            setMultiJumpPos([r, c]);
            setSelected([r, c]);
            setTargets(more);
            onMessage('Continue jumping!');
          } else {
            setSelected(null);
            setTargets([]);
            setMultiJumpPos(null);
            if (isOnline) {
              setTurn(otherColor);
              finishOnlineTurn(nb);
            } else if (isLocal) {
              finishLocalTurn(nb, activeColor);
            } else if (!handleEnd(nb)) {
              setTurn('black');
              doAiTurn(nb);
            }
          }
        }
        return;
      }

      if (p?.color === activeColor) {
        const t = pieceTargets(board, r, c, activeColor);
        setSelected([r, c]);
        setTargets(t);
        return;
      }

      if (selected && targets.some(([tr, tc]) => tr === r && tc === c)) {
        const nb = applyMove(board, selected, [r, c]);
        setBoard(nb);
        const isJump = Math.abs(r - selected[0]) === 2;
        if (isJump) playCapture(); else playMove();
        if (isJump) {
          const more = getJumps(nb, r, c);
          if (more.length > 0) {
            setMultiJumpPos([r, c]);
            setSelected([r, c]);
            setTargets(more);
            onMessage('Continue jumping!');
            return;
          }
        }
        setSelected(null);
        setTargets([]);
        if (isOnline) {
          setTurn(otherColor);
          finishOnlineTurn(nb);
        } else if (isLocal) {
          finishLocalTurn(nb, activeColor);
        } else if (!handleEnd(nb)) {
          setTurn('black');
          doAiTurn(nb);
        }
      }
    },
    [board, selected, targets, turn, multiJumpPos, onMessage, handleEnd, doAiTurn, isOnline, isLocal, myColor, otherColor, finishOnlineTurn, finishLocalTurn],
  );

  const describeSquare = useCallback((r: number, c: number): string => {
    const square = `${String.fromCharCode(97 + c)}${SIZE - r}`;
    const p = board[r][c];
    const what = p
      ? `${isLocal ? p.color : p.color === (isOnline ? myColor : 'red') ? 'your' : 'opponent'} ${p.king ? 'king' : 'piece'}`
      : 'empty';
    const isSel = selected?.[0] === r && selected?.[1] === c;
    const isTarget = targets.some(([tr, tc]) => tr === r && tc === c);
    return `${square}: ${what}${isSel ? ', selected' : ''}${isTarget ? ', available move' : ''}`;
  }, [board, selected, targets, isOnline, isLocal, myColor]);

  const boardCursor = useBoardCursor({
    rows: SIZE,
    cols: SIZE,
    onActivate: handleClick,
    describe: describeSquare,
    initial: [5, 2],
  });

  const cs = boardSize / SIZE;
  const redCount = countPieces(board, 'red');
  const blackCount = countPieces(board, 'black');
  const redCaptured = 12 - blackCount; // started with 12
  const blackCaptured = 12 - redCount;
  const activeColor: 'red' | 'black' = isOnline ? myColor : isLocal ? turn : 'red';
  const isMyTurn = turn === activeColor;
  const boardLabel = isLocal
    ? `Checkers board. Red has ${redCount} pieces, Black has ${blackCount}. ${turnLabel(localSeats ?? [], turn)}. Use arrow keys to move around the board, Enter to select and move.`
    : `Checkers board. You have ${redCount} pieces, opponent has ${blackCount}. ${isMyTurn ? 'Your turn. Use arrow keys to move around the board, Enter to select and move.' : 'Opponent is moving.'}`;
  const hint = isLocal
    ? (multiJumpPos ? 'Keep jumping!' : 'Tap a piece, then tap a square')
    : isMyTurn
      ? multiJumpPos
        ? 'Continue your jump!'
        : 'Your turn — tap a piece then tap a square'
      : isOnline
        ? 'Opponent is moving...'
        : 'AI is thinking...';
  // Pass & play skips the intro — the seat picker already set the table.
  if (!started && !isLocal) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
        <GameArt gameId="checkers" emoji="♟" size={80} />
        <h2 className="text-2xl font-bold">Checkers</h2>
        <div className="bg-card rounded-xl p-4 max-w-xs w-full space-y-2 text-sm">
          <div className="flex items-center gap-2"><span>🔴</span><span className="text-text-muted">You are Red — move diagonally forward</span></div>
          <div className="flex items-center gap-2"><span>⬆️</span><span className="text-text-muted">Jump over opponent pieces to capture them</span></div>
          <div className="flex items-center gap-2"><span>👑</span><span className="text-text-muted">Reach the far end to become a King</span></div>
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
    <div className="h-full flex flex-col items-center p-2">
      {isOnline ? (
        <div className="flex gap-2 mb-2 text-xs items-center flex-wrap justify-center">
          <span className={`bg-card rounded-lg px-3 py-1.5 font-bold ${isMyTurn ? 'text-accent' : 'text-text-muted'}`}>
            You ({myColor}): {myColor === 'red' ? redCount : blackCount}
          </span>
          <span className="bg-card rounded-lg px-3 py-1.5 text-text-muted">
            {multiplayerState?.opponentAvatar} {multiplayerState?.opponentName} ({otherColor}): {otherColor === 'red' ? redCount : blackCount}
          </span>
          <span className={`font-bold ${isMyTurn ? 'text-success animate-pulse' : 'text-text-dim'}`}>
            {isMyTurn ? 'Your turn' : 'Waiting...'}
          </span>
        </div>
      ) : isLocal ? (
        <LocalScoreboard seats={localSeats ?? []} turn={turn} counts={{ red: redCount, black: blackCount }} />
      ) : (
        <div className="flex gap-3 mb-2 text-sm items-center flex-wrap justify-center">
          <div className="bg-card rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span className="text-red-500 font-bold">You: {redCount}</span>
            {redCaptured > 0 && <span className="text-xs text-green-400">+{redCaptured} captured</span>}
          </div>
          <div className="bg-card rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span className="text-gray-400 font-bold">AI: {blackCount}</span>
            {blackCaptured > 0 && <span className="text-xs text-red-400">+{blackCaptured} captured</span>}
          </div>
          <span className={`bg-card rounded-lg px-3 py-1.5 text-xs font-bold ${turn === 'red' ? 'text-accent animate-pulse' : 'text-text-muted'}`}>
            {turn === 'red' ? 'Your turn (Red)' : 'AI thinking...'}
          </span>
        </div>
      )}

      <svg
        width={boardSize}
        height={boardSize}
        viewBox={`0 0 ${boardSize} ${boardSize}`}
        className="rounded-lg overflow-hidden shadow-lg"
        role="application"
        aria-roledescription="checkers board"
        aria-label={boardLabel}
        tabIndex={0}
        onKeyDown={boardCursor.onKeyDown}
        onFocus={boardCursor.onFocus}
        onBlur={boardCursor.onBlur}
      >
        {board.map((row, r) =>
          row.map((cell, c) => {
            const dark = (r + c) % 2 === 1;
            const isSel =
              selected?.[0] === r && selected?.[1] === c;
            const isTarget = targets.some(
              ([tr, tc]) => tr === r && tc === c,
            );
            return (
              <g
                key={`${r}-${c}`}
                onClick={() => handleClick(r, c)}
                style={{ cursor: isMyTurn ? 'pointer' : 'default' }}
              >
                <rect
                  x={c * cs}
                  y={r * cs}
                  width={cs}
                  height={cs}
                  fill={isSel ? '#FBBF24' : dark ? '#5c4033' : '#DEB887'}
                />
                {isTarget && !cell && (
                  <circle
                    cx={c * cs + cs / 2}
                    cy={r * cs + cs / 2}
                    r={cs * 0.15}
                    fill="rgba(34,197,94,0.6)"
                  />
                )}
                {isTarget && cell && (
                  <circle
                    cx={c * cs + cs / 2}
                    cy={r * cs + cs / 2}
                    r={cs * 0.42}
                    fill="none"
                    stroke="rgba(34,197,94,0.7)"
                    strokeWidth={3}
                  />
                )}
                {cell && (
                  <>
                    {/* Selection ring for selected piece */}
                    {isSel && (
                      <circle
                        cx={c * cs + cs / 2}
                        cy={r * cs + cs / 2}
                        r={cs * 0.44}
                        fill="none"
                        stroke="#FBBF24"
                        strokeWidth={3}
                        opacity={0.9}
                      />
                    )}
                    <circle
                      cx={c * cs + cs / 2}
                      cy={r * cs + cs / 2}
                      r={cs * 0.38}
                      fill={cell.color === 'red' ? '#DC2626' : '#1F2937'}
                      stroke={cell.color === 'red' ? '#991B1B' : '#111827'}
                      strokeWidth={2}
                    />
                    <circle
                      cx={c * cs + cs / 2}
                      cy={r * cs + cs / 2}
                      r={cs * 0.28}
                      fill={
                        cell.color === 'red'
                          ? 'rgba(255,255,255,0.15)'
                          : 'rgba(255,255,255,0.08)'
                      }
                    />
                    {cell.king && (
                      <>
                        <circle
                          cx={c * cs + cs / 2}
                          cy={r * cs + cs / 2}
                          r={cs * 0.24}
                          fill="none"
                          stroke="#FCD34D"
                          strokeWidth={2}
                        />
                        <text
                          x={c * cs + cs / 2}
                          y={r * cs + cs / 2}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={cs * 0.28}
                          fill="#FCD34D"
                          fontWeight="bold"
                          style={{
                            pointerEvents: 'none',
                            userSelect: 'none',
                          }}
                        >
                          ♛
                        </text>
                      </>
                    )}
                  </>
                )}
              </g>
            );
          }),
        )}
        {boardCursor.cursor && (
          <rect
            x={boardCursor.cursor[1] * cs + 1.5}
            y={boardCursor.cursor[0] * cs + 1.5}
            width={cs - 3}
            height={cs - 3}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={3}
            strokeDasharray="6 3"
            pointerEvents="none"
          />
        )}
      </svg>

      <span className="sr-only" role="status" aria-live="polite">{boardCursor.announce}</span>

      <div className="mt-2 text-xs text-text-muted text-center">{hint}</div>
    </div>
  );
}

export default CheckersGame;

