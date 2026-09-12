import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameProps } from '@/types';

// Define AI difficulty levels
const DIFFICULTY_LEVELS = {
  easy: { enterChance: 0.4, ladderChance: 0.6, snakeAvoidChance: 0.5 },
  medium: { enterChance: 0.8, ladderChance: 0.9, snakeAvoidChance: 0.8 },
  hard: { enterChance: 1.0, ladderChance: 1.0, snakeAvoidChance: 1.0 },
};

const BOARD_SIZE = 100;

// Snakes: head -> tail (go back)
const SNAKES: Record<number, number> = {
  16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78,
};
// Ladders: bottom -> top (go forward)
const LADDERS: Record<number, number> = {
  1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91,
};

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function getCellPos(cell: number): { row: number; col: number } {
  const zeroBased = cell - 1;
  const row = 9 - Math.floor(zeroBased / 10);
  const col = row % 2 === 1 ? zeroBased % 10 : 9 - (zeroBased % 10);
  return { row, col };
}

// Simple AI: prefer ladders > avoid snakes > exact finish > random
function aiMove(aiPos: number, difficulty: 'easy' | 'medium' | 'hard'): number {
  const { ladderChance, snakeAvoidChance } = DIFFICULTY_LEVELS[difficulty];

  if (aiPos === 0) return rollDie();

  if (Math.random() < ladderChance) {
    for (const [bottom, top] of Object.entries(LADDERS)) {
      const b = parseInt(bottom);
      if (b > aiPos && b - aiPos <= 6) return b - aiPos;
      if (top > aiPos && top - aiPos <= 6) return top - aiPos;
    }
  }

  // Avoid snakes: pick any roll 1..6 that doesn't land on a snake head
  if (Math.random() < snakeAvoidChance) {
    const safeRolls: number[] = [];
    for (let r = 1; r <= 6; r++) {
      const dest = aiPos + r;
      if (dest <= BOARD_SIZE && !SNAKES[dest]) safeRolls.push(r);
    }
    if (safeRolls.length > 0) return safeRolls[Math.floor(Math.random() * safeRolls.length)];
  }

  if (BOARD_SIZE - aiPos <= 6) return BOARD_SIZE - aiPos;
  return rollDie();
}

function SnakesLaddersGame({ stage, onScore, onProgress, onMessage, onEnd, aiDifficulty, multiplayerState, onMultiplayerMove }: GameProps) {
  const isOnline = !!multiplayerState;
  const mySeat = isOnline ? multiplayerState.playerNumber : 1;
  const [playerPos, setPlayerPos] = useState(0);
  const [aiPos, setAiPos] = useState(0);
  const [turn, setTurn] = useState<'player' | 'ai'>('player');
  const [die, setDie] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [animating, setAnimating] = useState(false);
  const difficulty = aiDifficulty || 'medium';

  const endedRef = useRef(false);
  const [started, setStarted] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

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
      intervalsRef.current.forEach(clearInterval);
    };
  }, []);

  // Online sync: read positions[0]=seat1, positions[1]=seat2 and whose turn.
  // Dice come from the server: `action:'roll'` stores pendingRoll, then the
  // animated move commits positions + lastRoll to consume it.
  const positionsRef = useRef<number[]>([0, 0]);
  const processingRollRef = useRef(false);
  useEffect(() => {
    if (!isOnline) return;
    const bs = multiplayerState.boardState as {
      positions?: number[];
      lastRoll?: number;
      pendingRoll?: { seat: number; value: number };
    } | null | undefined;
    if (!bs) return;
    const positions = Array.isArray(bs.positions) && bs.positions.length >= 2
      ? bs.positions
      : [0, 0];
    positionsRef.current = [...positions];
    setPlayerPos(positions[mySeat - 1] ?? 0);
    setAiPos(positions[mySeat === 1 ? 1 : 0] ?? 0);
    setTurn(multiplayerState.currentPlayer === mySeat ? 'player' : 'ai');
    if (typeof bs.lastRoll === 'number') setDie(bs.lastRoll);

    // My pending server roll — animate it, then commit the result.
    const pending = bs.pendingRoll;
    if (pending && pending.seat === mySeat && !endedRef.current && !gameOver) {
      if (processingRollRef.current) return;
      processingRollRef.current = true;
      const d = pending.value;
      setDie(d);
      const start = positions[mySeat - 1] ?? 0;
      if (start + d > BOARD_SIZE) {
        onMessage(`Rolled ${d} — need exact roll to finish!`);
        commitMove(start, d);
      } else {
        moveToken(start, d, setPlayerPos, 'You', (finalPos) => commitMove(finalPos, d));
      }
    } else {
      processingRollRef.current = false;
    }

    const myPos = positions[mySeat - 1] ?? 0;
    const oppPos = positions[mySeat === 1 ? 1 : 0] ?? 0;
    if (!endedRef.current && (myPos >= BOARD_SIZE || oppPos >= BOARD_SIZE)) {
      endedRef.current = true;
      const won = myPos >= BOARD_SIZE;
      onEnd({
        score: won ? 80 : 10,
        stars: won ? 3 : 1,
        summary: won ? 'You reached 100 first!' : 'Opponent reached 100 first.',
      });
    }
  }, [isOnline, multiplayerState, mySeat, onEnd, onMessage, gameOver]);

  // Commit the resolved position; lastRoll consumes the pending server roll.
  const commitMove = (myNewPos: number, d: number) => {
    const positions = [...positionsRef.current];
    while (positions.length < 2) positions.push(0);
    positions[mySeat - 1] = myNewPos;
    const iWon = myNewPos >= BOARD_SIZE;
    onMultiplayerMove?.({
      boardState: { positions, lastRoll: d },
      winner: iWon ? mySeat : undefined,
    });
  };

  // Resolve snake/ladder chains (a ladder landing on a snake or vice versa)
  const resolveSquare = (pos: number): number => {
    const visited = new Set<number>();
    let cur = pos;
    while (!visited.has(cur)) {
      visited.add(cur);
      if (SNAKES[cur]) cur = SNAKES[cur];
      else if (LADDERS[cur]) cur = LADDERS[cur];
      else break;
    }
    return cur;
  };

  const moveToken = (
    currentPos: number,
    steps: number,
    setter: (p: number) => void,
    name: string,
    onComplete: (finalPos: number) => void,
  ) => {
    const target = currentPos + steps;
    if (target > BOARD_SIZE) {
      onComplete(currentPos);
      return;
    }

    setAnimating(true);
    let pos = currentPos;
    const interval = setInterval(() => {
      if (endedRef.current) {
        clearInterval(interval);
        intervalsRef.current = intervalsRef.current.filter(x => x !== interval);
        return;
      }
      pos++;
      if (pos > target) {
        clearInterval(interval);
        intervalsRef.current = intervalsRef.current.filter(x => x !== interval);
        const landed = target;
        const resolved = resolveSquare(landed);
        if (resolved !== landed) {
          if (SNAKES[landed]) onMessage(`${name} hit a snake! Going down...`);
          else if (LADDERS[landed]) onMessage(`${name} found a ladder! Going up!`);
          schedule(() => {
            setter(resolved);
            setAnimating(false);
            onComplete(resolved);
          }, 500);
        } else {
          setAnimating(false);
          onComplete(resolved);
        }
        return;
      }
      setter(pos);
    }, 100);
    intervalsRef.current.push(interval);
  };

  const resetGame = useCallback(() => {
    setPlayerPos(0);
    setAiPos(0);
    setTurn('player');
    setDie(null);
    setGameOver(false);
    setAnimating(false);
    onMessage('New round! Your turn.');
  }, [onMessage]);


  const handlePlayerWin = () => {
    setGameOver(true);
    onScore(80);
    onProgress(1);
    onMessage('You reached 100! You win! 🎉');
    endedRef.current = true;
    schedule(() => onEnd({ score: 80, stars: 3, summary: 'You reached square 100 first! Great climb!' }), 1000);
  };

  const handleAiWin = () => {
    setGameOver(true);
    onMessage('AI reached 100! You lose this round.');
    endedRef.current = true;
    schedule(() => onEnd({ score: 10, stars: 1, summary: 'The AI reached square 100 first. Watch out for those snakes!' }), 1000);
  };

  const aiTurn = () => {
    if (endedRef.current || gameOver) return;
    const d = aiMove(aiPos, difficulty);
    setDie(d);

    if (aiPos + d > BOARD_SIZE) {
      onMessage(`AI rolled ${d} — overshoots!`);
      setTurn('player');
      return;
    }

    moveToken(aiPos, d, setAiPos, 'AI', (finalPos) => {
      if (finalPos >= BOARD_SIZE) {
        handleAiWin();
      } else {
        setTurn('player');
      }
    });
  };

  const handleRoll = () => {
    if (endedRef.current || gameOver || turn !== 'player' || animating) return;

    if (isOnline) {
      // Server rolls; the reconcile effect animates + commits the result.
      onMultiplayerMove?.({ action: 'roll' });
      return;
    }

    const d = rollDie();
    setDie(d);

    if (playerPos + d > BOARD_SIZE) {
      onMessage(`Rolled ${d} — need exact roll to finish!`);
      setTurn('ai');
      schedule(aiTurn, 800);
      return;
    }

    moveToken(playerPos, d, setPlayerPos, 'You', (finalPos) => {
      if (finalPos >= BOARD_SIZE) {
        handlePlayerWin();
      } else {
        setTurn('ai');
        schedule(aiTurn, 800);
      }
    });
  };
  if (!started) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-6xl">🐍</div>
        <h2 className="text-2xl font-bold">Snakes & Ladders</h2>
        <p className="text-text-muted text-sm text-center max-w-xs">Roll the dice, climb ladders, avoid snakes. Reach square 100 first!</p>
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
      {isOnline ? (
        <div className="flex gap-2 mb-2 text-xs items-center flex-wrap justify-center">
          <span className={`bg-card rounded-lg px-3 py-1.5 font-bold ${turn === 'player' ? 'text-accent' : 'text-text-muted'}`}>
            🔴 You: {playerPos}
          </span>
          <span className="bg-card rounded-lg px-3 py-1.5 text-text-muted">
            🔵 {multiplayerState?.opponentAvatar} {multiplayerState?.opponentName}: {aiPos}
          </span>
          <span className={`font-bold ${turn === 'player' ? 'text-success animate-pulse' : 'text-text-dim'}`}>
            {turn === 'player' ? 'Your roll' : 'Waiting...'}
          </span>
        </div>
      ) : (
        <div className="flex gap-3 mb-2 text-sm">
          <span className="bg-card rounded-lg px-3 py-1.5 text-danger font-bold">You: {playerPos}</span>
          <span className="bg-card rounded-lg px-3 py-1.5 text-text-muted">AI: {aiPos}</span>
          <span className="bg-card rounded-lg px-3 py-1.5 text-accent text-xs">
            {turn === 'player' ? 'Your roll' : 'AI rolling...'}
          </span>
        </div>
      )}

      {/* Board */}
      <div className="grid grid-cols-10 gap-[2px] bg-card-hover p-1 rounded-lg mb-3">
        {Array.from({ length: BOARD_SIZE }, (_, i) => {
          const cell = i + 1;
          const isPlayer = playerPos === cell;
          const isAI = aiPos === cell;
          const isSnake = SNAKES[cell];
          const isLadder = LADDERS[cell];
          const pos = getCellPos(cell);
          const isDark = (pos.row + pos.col) % 2 === 0;

          return (
            <div
              key={cell}
              className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-[9px] sm:text-[10px] font-medium rounded-sm relative ${
                isDark ? 'bg-[#23423b]' : 'bg-[#3d3a60]'
              } ${cell === BOARD_SIZE ? 'ring-1 ring-accent' : ''}`}
            >
              <span className="text-text-muted/50 absolute top-0 left-0.5">{cell}</span>
              {isSnake && <span className="text-xs">🐍</span>}
              {isLadder && <span className="text-xs">🪜</span>}
              {isPlayer && !isAI && <span className="text-sm absolute">🔴</span>}
              {isAI && !isPlayer && <span className="text-sm absolute">🔵</span>}
              {isPlayer && isAI && <span className="text-sm absolute">🟣</span>}
            </div>
          );
        })}
      </div>

      {/* Progress bars */}
      <div className="w-full max-w-[320px] flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-red-400 font-bold w-6">You</span>
          <div className="flex-1 h-2 bg-card rounded-full overflow-hidden">
            <div className="h-full bg-red-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.round((playerPos / BOARD_SIZE) * 100)}%` }} />
          </div>
          <span className="text-text-muted w-8 text-right">{playerPos}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-blue-400 font-bold w-6">AI</span>
          <div className="flex-1 h-2 bg-card rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.round((aiPos / BOARD_SIZE) * 100)}%` }} />
          </div>
          <span className="text-text-muted w-8 text-right">{aiPos}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <SnakeDiceFace value={die} />
        <button
          onClick={handleRoll}
          disabled={gameOver || turn !== 'player' || animating}
          className="bg-accent text-bg font-bold px-6 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 disabled:opacity-30"
        >
          {turn === 'player' ? 'Roll!' : 'AI...'}
        </button>
      </div>

      <div className="mt-1 text-xs text-text-muted text-center">
        🪜 ladders go up · 🐍 snakes go down · reach 100 to win!
      </div>
    </div>
  );
}

function SnakeDiceFace({ value }: { value: number | null }) {
  const pipLayouts: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
  };
  const pips = value !== null ? (pipLayouts[value] || []) : [];
  return (
    <div className="w-14 h-14 bg-card rounded-xl flex items-center justify-center select-none border-2 border-white/10">
      {value === null ? (
        <span className="text-2xl">🎲</span>
      ) : (
        <svg width="48" height="48" viewBox="0 0 100 100">
          {pips.map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={10} fill="#e2e8f0" />
          ))}
        </svg>
      )}
    </div>
  );
}

export default SnakesLaddersGame;
