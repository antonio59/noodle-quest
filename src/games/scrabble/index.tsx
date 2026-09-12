import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Check } from 'lucide-react';
import type { GameProps } from '@/types';
import {
  TILE_SCORES, SIZE, CENTER, BONUS_MAP,
  buildTilePool, scorePlacement, validateAndScoreCrossWords,
  generateAiMoves, pickAiMove, buildScoreBreakdown,
  getActiveWordSet, setActiveWordSet,
  type Direction, type ScoreBreakdown,
} from './logic';
import { ScrabbleBoard } from './Board';
import {
  DICTIONARIES, fetchDictionary, getPreferredDictionary, setPreferredDictionary,
  isDictVariant, type DictVariant,
} from './dictionary';


// ── Component ──────────────────────────────────────────────────────────
// Seat 0 = local human. Seats 1..N-1 = AI opponents (until online relay is wired).
function ScrabbleGame({ stage, onScore, onProgress, onMessage, onEnd, aiDifficulty = 'medium', numPlayers, multiplayerState, onMultiplayerMove }: GameProps) {
  const isOnline = !!multiplayerState;
  const isHost = isOnline && multiplayerState.playerNumber === 1;
  const mySeat = isOnline ? (multiplayerState.playerNumber - 1) : 0;
  // Clamp to 2..4; default 2. In online mode, seats = roster size (min 2).
  const SEATS = isOnline
    ? Math.max(2, Math.min(4, multiplayerState?.players?.length || 2))
    : Math.max(2, Math.min(4, numPlayers ?? 2));

  const [board, setBoard] = useState<(string | null)[][]>(
    () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
  );
  // One rack per seat. Seat 0 is the human's.
  const [racks, setRacks] = useState<string[][]>(() => Array.from({ length: SEATS }, () => [] as string[]));
  const [pool, setPool] = useState<string[]>([]);
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [placedCells, setPlacedCells] = useState<Map<string, true>>(new Map());
  const [lockedCells, setLockedCells] = useState<Set<string>>(new Set());
  // One score per seat.
  const [scores, setScores] = useState<number[]>(() => Array.from({ length: SEATS }, () => 0));
  const [round, setRound] = useState(0); // completed full rounds
  const [currentSeat, setCurrentSeat] = useState(0);
  const [aiThinking, setAiThinking] = useState(false);
  const [started, setStarted] = useState(false);
  const [lastWord, setLastWord] = useState('');
  const [isFirstMove, setIsFirstMove] = useState(true);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(null);
  // Dictionary: which lexicon validates words, and whether it's ready.
  // The game must not be playable against the small embedded fallback —
  // that's how valid words end up rejected.
  const [dictVariant, setDictVariant] = useState<DictVariant>(getPreferredDictionary);
  const [dictStatus, setDictStatus] = useState<'loading' | 'ready' | 'error' | 'fallback'>('loading');
  const endedRef = useRef(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    let cancelled = false;
    setDictStatus('loading');
    fetchDictionary(dictVariant)
      .then(words => {
        if (cancelled) return;
        setActiveWordSet(words);
        setDictStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setDictStatus('error');
      });
    return () => { cancelled = true; };
  }, [dictVariant]);

  const chooseDictionary = (v: DictVariant) => {
    setPreferredDictionary(v);
    setDictVariant(v);
  };

  // Seat 0 is only "You" offline; online it's whichever seat we occupy.
  const seatLabel = (i: number): string => {
    if (i === mySeat) return 'You';
    if (isOnline) {
      const other = multiplayerState?.players?.find(p => p.seat === i + 1);
      return (other?.name ?? 'Opponent').split(/\s+/)[0];
    }
    return SEATS > 2 ? `AI ${i}` : 'AI';
  };

  const maxRounds = 6 + stage * 6; // each seat plays maxRounds turns
  const targetScore = stage * 30;
  const isHumanTurn = currentSeat === (isOnline ? mySeat : 0);
  const playerRack = racks[isOnline ? mySeat : 0] ?? [];
  const playerScore = scores[isOnline ? mySeat : 0] ?? 0;

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      if (!endedRef.current) fn();
    }, ms);
    timeoutsRef.current.push(id);
  }, []);

  useEffect(() => {
    endedRef.current = false;
    return () => {
      endedRef.current = true;
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, []);

  // Initial deal — one rack per seat. Offline only; online host seeds via effect below.
  useEffect(() => {
    if (isOnline) return;
    const fresh = buildTilePool();
    const dealt: string[][] = [];
    for (let i = 0; i < SEATS; i++) dealt.push(fresh.splice(0, 7));
    setRacks(dealt);
    setPool(fresh);
    onMessage(
      SEATS > 2
        ? `Your turn — ${SEATS - 1} AI opponents (target ${targetScore})`
        : `Your turn — place tiles to make a word (target ${targetScore})`,
    );
  // intentionally only on mount

  }, []);

  // Online: host seeds initial state once.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!isOnline || !onMultiplayerMove || !isHost || seededRef.current) return;
    const bs = multiplayerState?.boardState as { racks?: unknown } | null | undefined;
    if (bs && bs.racks) return;
    seededRef.current = true;
    const fresh = buildTilePool();
    const dealt: string[][] = [];
    for (let i = 0; i < SEATS; i++) dealt.push(fresh.splice(0, 7));
    const emptyBoard = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    const emptyScores = Array.from({ length: SEATS }, () => 0);
    onMultiplayerMove({
      boardState: {
        board: emptyBoard,
        racks: dealt,
        pool: fresh,
        scores: emptyScores,
        currentSeat: 0,
        isFirstMove: true,
        lastWord: '',
        dict: dictVariant,
        // Seeding the deal is not a turn. Without turnSeat the server
        // rotates play to seat 2, while boardState still says seat 1 —
        // the host is then locked out of its own first word.
        turnSeat: 1,
      },
    });
  }, [isOnline, onMultiplayerMove, isHost, multiplayerState, SEATS, dictVariant]);

  // Online: reconcile from server boardState.
  //
  // play.tsx rebuilds `multiplayerState` as a fresh object literal on every
  // render, so depending on it re-ran this effect on every parent render —
  // including the onScore/onMessage calls fired while submitting a word.
  // That overwrote the freshly played board with the pre-move server copy.
  // Depend on the server values themselves: they only change when the
  // server does.
  const serverBoardState = multiplayerState?.boardState;
  const serverWinner = multiplayerState?.winner;
  const myPlayerNumber = multiplayerState?.playerNumber;
  useEffect(() => {
    if (!isOnline) return;
    const bs = serverBoardState as {
      board?: (string | null)[][];
      racks?: string[][];
      pool?: string[];
      scores?: number[];
      currentSeat?: number;
      isFirstMove?: boolean;
      lastWord?: string;
      dict?: string;
    } | null | undefined;
    if (!bs || !bs.racks) return;
    // Everyone validates against the host's dictionary choice.
    if (isDictVariant(bs.dict)) {
      setDictVariant(cur => (cur === bs.dict ? cur : bs.dict as DictVariant));
    }
    if (bs.board) setBoard(bs.board);
    if (bs.racks) setRacks(bs.racks);
    if (bs.pool) setPool(bs.pool);
    if (bs.scores) setScores(bs.scores);
    if (typeof bs.currentSeat === 'number') setCurrentSeat(bs.currentSeat);
    if (typeof bs.isFirstMove === 'boolean') setIsFirstMove(bs.isFirstMove);
    if (typeof bs.lastWord === 'string') setLastWord(bs.lastWord);
    // Lock any occupied cells
    if (bs.board) {
      const locked = new Set<string>();
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        if (bs.board[r][c]) locked.add(`${r},${c}`);
      }
      setLockedCells(locked);
    }
    // Winner check
    if (serverWinner && !endedRef.current) {
      endedRef.current = true;
      const iWon = serverWinner === myPlayerNumber;
      const myScore = (bs.scores && bs.scores[mySeat]) || 0;
      onEnd({ score: myScore, stars: iWon ? 3 : 1, summary: iWon ? `You won Scrabble with ${myScore} pts!` : 'Opponent won Scrabble.' });
    }
  }, [isOnline, serverBoardState, serverWinner, myPlayerNumber, mySeat, onEnd]);

  const placedKeys = useMemo(() => new Set(placedCells.keys()), [placedCells]);

  const drawUpTo7 = useCallback((rack: string[], src: string[]): { rack: string[]; pool: string[] } => {
    const r = [...rack];
    const p = [...src];
    while (r.length < 7 && p.length > 0) r.push(p.shift()!);
    return { rack: r, pool: p };
  }, []);

  const finishGame = useCallback((finalScores: number[]) => {
    if (endedRef.current) return;
    endedRef.current = true;
    const mine = finalScores[0] ?? 0;
    const best = Math.max(...finalScores);
    const winners = finalScores.reduce<number[]>((acc, s, i) => (s === best ? [...acc, i] : acc), []);
    const iWon = winners.includes(0);
    const tied = iWon && winners.length > 1;

    let stars = 1;
    if (iWon && !tied) stars = mine >= targetScore ? 3 : 2;
    else if (tied) stars = 2;

    const opponentScores = finalScores.slice(1);
    const summary = iWon && !tied
      ? `You won with ${mine} vs ${opponentScores.join(', ')}!`
      : tied
        ? `Tied at ${mine}!`
        : `You scored ${mine} · best was ${best}.`;
    schedule(() => onEnd({ score: mine, stars, summary }), 800);
  }, [targetScore, onEnd, schedule]);

  const handleRackClick = (idx: number) => {
    if (!isHumanTurn) return;
    setSelectedTile(prev => prev === idx ? null : idx);
  };

  const handleBoardClick = (r: number, c: number) => {
    if (!isHumanTurn) return;
    const key = `${r},${c}`;
    if (lockedCells.has(key)) return;

    if (selectedTile === null) {
      // Pick up a placed tile (this turn only)
      if (board[r][c] && placedKeys.has(key)) {
        const letter = board[r][c]!;
        const newBoard = board.map(row => [...row]);
        newBoard[r][c] = null;
        setBoard(newBoard);
        setRacks(prev => prev.map((rack, i) => (i === mySeat ? [...rack, letter] : rack)));
        const newPlaced = new Map(placedCells);
        newPlaced.delete(key);
        setPlacedCells(newPlaced);
      }
      return;
    }
    if (board[r][c]) return;

    const letter = playerRack[selectedTile];
    const newBoard = board.map(row => [...row]);
    newBoard[r][c] = letter;
    setBoard(newBoard);
    setRacks(prev => prev.map((rack, i) => (i === mySeat ? rack.filter((_, j) => j !== selectedTile) : rack)));
    setSelectedTile(null);
    const newPlaced = new Map(placedCells);
    newPlaced.set(key, true);
    setPlacedCells(newPlaced);
  };

  // Validate the player's current placement and return the main word + score (or invalid)
  const findPlayerPlay = (): { valid: boolean; word: string; cells: [number, number][]; score: number; reason?: string; breakdown?: ScoreBreakdown } => {
    const cells = Array.from(placedKeys).map(k => k.split(',').map(Number) as [number, number]);
    if (cells.length === 0) return { valid: false, word: '', cells: [], score: 0, reason: 'Place at least one tile' };

    const rows = cells.map(c => c[0]);
    const cols = cells.map(c => c[1]);
    const sameRow = rows.every(r => r === rows[0]);
    const sameCol = cols.every(c => c === cols[0]);
    if (!sameRow && !sameCol) return { valid: false, word: '', cells: [], score: 0, reason: 'Tiles must be in a straight line' };

    let dir: Direction;
    let wordCells: [number, number][];
    let word: string;

    if (cells.length === 1) {
      const [r, c] = cells[0];

      // Horizontal word through this cell
      let hsc = c;
      while (hsc > 0 && board[r][hsc - 1]) hsc--;
      const hCells: [number, number][] = [];
      let hwc = hsc;
      while (hwc < SIZE && board[r][hwc]) { hCells.push([r, hwc]); hwc++; }

      // Vertical word through this cell
      let vsr = r;
      while (vsr > 0 && board[vsr - 1][c]) vsr--;
      const vCells: [number, number][] = [];
      let vwr = vsr;
      while (vwr < SIZE && board[vwr][c]) { vCells.push([vwr, c]); vwr++; }

      if (hCells.length < 2 && vCells.length < 2) {
        return { valid: false, word: '', cells: [], score: 0, reason: 'Word must be at least 2 letters' };
      }

      if (hCells.length >= vCells.length) {
        dir = 'H';
        wordCells = hCells;
      } else {
        dir = 'V';
        wordCells = vCells;
      }
      word = wordCells.map(([rr, cc]) => board[rr][cc]).join('');
    } else {
      dir = sameRow ? 'H' : 'V';
      const sorted = sameRow
        ? [...cells].sort((a, b) => a[1] - b[1])
        : [...cells].sort((a, b) => a[0] - b[0]);

      // Contiguous (allowing existing tiles in between)
      if (sameRow) {
        for (let c = sorted[0][1]; c <= sorted[sorted.length - 1][1]; c++) {
          if (!board[sorted[0][0]][c]) return { valid: false, word: '', cells: [], score: 0, reason: 'Tiles must form one word' };
        }
      } else {
        for (let r = sorted[0][0]; r <= sorted[sorted.length - 1][0]; r++) {
          if (!board[r][sorted[0][1]]) return { valid: false, word: '', cells: [], score: 0, reason: 'Tiles must form one word' };
        }
      }

      // Expand to include existing tiles flanking the placement
      let sr = sorted[0][0], sc = sorted[0][1];
      if (sameRow) while (sc > 0 && board[sr][sc - 1]) sc--;
      else while (sr > 0 && board[sr - 1][sc]) sr--;

      wordCells = [];
      let wr = sr, wc = sc;
      if (sameRow) while (wc < SIZE && board[wr][wc]) { wordCells.push([wr, wc]); wc++; }
      else while (wr < SIZE && board[wr][wc]) { wordCells.push([wr, wc]); wr++; }

      word = wordCells.map(([r, c]) => board[r][c]).join('');
    }
    if (word.length < 2) return { valid: false, word: '', cells: [], score: 0, reason: 'Word must be at least 2 letters' };
    if (!getActiveWordSet().has(word)) return { valid: false, word, cells: wordCells, score: 0, reason: `"${word}" is not in the dictionary` };

    // First move must touch center
    if (isFirstMove && !wordCells.some(([r, c]) => r === CENTER && c === CENTER)) {
      return { valid: false, word, cells: wordCells, score: 0, reason: 'First word must cross the center star' };
    }
    // Subsequent moves: at least one new tile must be adjacent to a previously-locked tile
    if (!isFirstMove) {
      const touches = cells.some(([r, c]) =>
        (r > 0 && lockedCells.has(`${r - 1},${c}`)) ||
        (r < SIZE - 1 && lockedCells.has(`${r + 1},${c}`)) ||
        (c > 0 && lockedCells.has(`${r},${c - 1}`)) ||
        (c < SIZE - 1 && lockedCells.has(`${r},${c + 1}`))
      );
      if (!touches) return { valid: false, word, cells: wordCells, score: 0, reason: 'New tiles must connect to existing words' };
    }

    // Validate cross-words formed by new tiles
    const newCellsArr = cells.map(([r, c]) => ({ r, c, letter: board[r][c]! }));
    const crossBonus = validateAndScoreCrossWords(board, newCellsArr, dir);
    if (crossBonus < 0) return { valid: false, word, cells: wordCells, score: 0, reason: 'Invalid cross-word formed' };

    const newCellSet = new Set(cells.map(([r, c]) => `${r},${c}`));
    const mainScore = scorePlacement(board, wordCells, newCellSet);
    const all7Bonus = cells.length === 7 ? 50 : 0;
    const breakdown = buildScoreBreakdown(board, wordCells, newCellSet, crossBonus, all7Bonus);
    return { valid: true, word, cells: wordCells, score: mainScore + crossBonus + all7Bonus, breakdown };
  };

  /** Advance to the next seat. Increments the round counter each time we
   *  wrap back to seat 0. Ends the game once everyone has finished maxRounds. */
  const advanceSeat = useCallback((finalScores: number[]) => {
    const next = (currentSeat + 1) % SEATS;
    const nextRound = next === 0 ? round + 1 : round;
    setCurrentSeat(next);
    if (next === 0) setRound(nextRound);
    onProgress(Math.min((nextRound + next / SEATS) / maxRounds, 1));
    if (nextRound >= maxRounds && next === 0) {
      finishGame(finalScores);
    }
  }, [currentSeat, round, SEATS, maxRounds, onProgress, finishGame]);

  const handleSubmit = () => {
    if (!isHumanTurn) return;
    const result = findPlayerPlay();
    if (!result.valid) {
      setScoreBreakdown(null);
      return;
    }
    const seat = isOnline ? mySeat : 0;
    const newScores = scores.map((s, i) => (i === seat ? s + result.score : s));
    setScores(newScores);
    onScore(result.score);
    setLastWord(`You played "${result.word}" for ${result.score}`);
    setScoreBreakdown(result.breakdown ?? null);
    onMessage(`+${result.score} for "${result.word}"!`);

    const newLocked = new Set(lockedCells);
    for (const k of placedKeys) newLocked.add(k);
    setLockedCells(newLocked);
    setPlacedCells(new Map());
    setIsFirstMove(false);

    const { rack: newRack, pool: newPool } = drawUpTo7(playerRack, pool);
    const newRacks = racks.map((rack, i) => (i === seat ? newRack : rack));
    setRacks(newRacks);
    setPool(newPool);

    if (isOnline && onMultiplayerMove && multiplayerState) {
      const nextSeat = (seat + 1) % SEATS;
      // Endgame: if my score >= targetScore, declare winner
      const myNewScore = newScores[seat] ?? 0;
      const iWon = myNewScore >= targetScore && stage >= 0; // simple target check
      onMultiplayerMove({
        boardState: {
          board,
          racks: newRacks,
          pool: newPool,
          scores: newScores,
          currentSeat: nextSeat,
          isFirstMove: false,
          lastWord: `P${multiplayerState.playerNumber} played "${result.word}" for ${result.score}`,
          dict: dictVariant,
          // currentSeat is 0-indexed; the server's turn is 1-indexed.
          // Send it explicitly so the two can never drift apart.
          turnSeat: nextSeat + 1,
        },
        winner: iWon ? multiplayerState.playerNumber : undefined,
      });
      if (iWon && !endedRef.current) {
        endedRef.current = true;
        onEnd({ score: myNewScore, stars: 3, summary: `You won Scrabble with ${myNewScore} pts!` });
      }
      return;
    }

    advanceSeat(newScores);
  };

  // AI turn — runs whenever currentSeat points at a non-human seat.
  useEffect(() => {
    if (isOnline) return; // Online: opponents drive their own turns
    if (isHumanTurn || endedRef.current) return;
    const seat = currentSeat;
    setAiThinking(true);
    setScoreBreakdown(null);
    onMessage(`AI ${seat} is thinking...`);

    schedule(() => {
      const seatRack = racks[seat] ?? [];
      const moves = generateAiMoves(board, seatRack, isFirstMove);
      const move = pickAiMove(moves, aiDifficulty);
      setAiThinking(false);

      if (!move) {
        onMessage(`AI ${seat} passes this turn`);
        setLastWord(`AI ${seat} passed`);
        setScoreBreakdown(null);
        advanceSeat(scores);
        return;
      }

      const newBoard = board.map(row => [...row]);
      const newLocked = new Set(lockedCells);
      const usedLetters: string[] = [];
      for (const nc of move.newCells) {
        newBoard[nc.r][nc.c] = nc.letter;
        newLocked.add(`${nc.r},${nc.c}`);
        usedLetters.push(nc.letter);
      }
      const depleted = [...seatRack];
      for (const l of usedLetters) {
        const idx = depleted.indexOf(l);
        if (idx >= 0) depleted.splice(idx, 1);
      }
      const { rack: refilled, pool: newPool } = drawUpTo7(depleted, pool);
      const newScores = scores.map((s, i) => (i === seat ? s + move.score : s));

      // Build breakdown for AI move too
      const aiNewCellSet = new Set(move.newCells.map(nc => `${nc.r},${nc.c}`));
      const aiCross = move.score - scorePlacement(board, move.cells, aiNewCellSet, new Map(move.newCells.map(nc => [`${nc.r},${nc.c}`, nc.letter]))) - (move.newCells.length === 7 ? 50 : 0);
      const aiBreakdown = buildScoreBreakdown(newBoard, move.cells, aiNewCellSet, aiCross, move.newCells.length === 7 ? 50 : 0);

      setBoard(newBoard);
      setLockedCells(newLocked);
      setRacks(prev => prev.map((rack, i) => (i === seat ? refilled : rack)));
      setPool(newPool);
      setScores(newScores);
      setLastWord(`AI ${seat} played "${move.word}" for ${move.score}`);
      setScoreBreakdown(aiBreakdown);
      onMessage(`AI ${seat} played "${move.word}" for ${move.score}`);
      setIsFirstMove(false);

      advanceSeat(newScores);
    }, 700);

  }, [currentSeat]);

  const handleClear = () => {
    if (!isHumanTurn) return;
    const letters: string[] = [];
    const newBoard = board.map(row => [...row]);
    for (const key of placedKeys) {
      const [r, c] = key.split(',').map(Number);
      if (newBoard[r][c]) {
        letters.push(newBoard[r][c]!);
        newBoard[r][c] = null;
      }
    }
    setBoard(newBoard);
    setRacks(prev => prev.map((rack, i) => (i === mySeat ? [...rack, ...letters] : rack)));
    setPlacedCells(new Map());
    setSelectedTile(null);
    setScoreBreakdown(null);
  };

  const handleShuffle = () => {
    if (!isHumanTurn) return;
    const shuffled = [...playerRack];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setRacks(prev => prev.map((rack, i) => (i === mySeat ? shuffled : rack)));
  };

  const handlePass = () => {
    if (!isHumanTurn) return;
    handleClear();
    onMessage('You passed your turn');
    setLastWord('You passed');
    setScoreBreakdown(null);
    if (isOnline && onMultiplayerMove) {
      const seat = mySeat;
      const nextSeat = (seat + 1) % SEATS;
      onMultiplayerMove({
        boardState: {
          board,
          racks,
          pool,
          scores,
          currentSeat: nextSeat,
          isFirstMove,
          lastWord: 'Opponent passed',
          dict: dictVariant,
          turnSeat: nextSeat + 1,
        },
      });
      return;
    }
    advanceSeat(scores);
  };

  // Live preview of current placement score
  let livePreview: { valid: false; reason?: string } | { valid: true; score: number; word: string; breakdown?: ScoreBreakdown } | null = null;
  if (placedKeys.size > 0) {
    const result = findPlayerPlay();
    if (!result.valid) livePreview = { valid: false, reason: result.reason };
    else livePreview = { valid: true, score: result.score, word: result.word, breakdown: result.breakdown };
  }

  if (!started && !isOnline) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-4 overflow-y-auto">
        <div className="text-5xl">🅰️</div>
        <h2 className="text-2xl font-bold">Scrabble</h2>
        <p className="text-text-muted text-sm text-center max-w-xs">
          Build words on the board using letter tiles. First to reach{' '}
          <span className="text-accent font-bold">{targetScore} pts</span> wins!
        </p>
        <div className="w-full max-w-xs bg-card rounded-2xl p-4 flex flex-col gap-2 ring-1 ring-white/10">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wide">How to play</span>
          <div className="flex flex-col gap-1.5 text-xs text-text-muted">
            <div className="flex items-start gap-2">
              <span className="text-amber-400 font-bold text-base leading-none mt-0.5">★</span>
              <span>First word must cross the <span className="text-text font-semibold">center star</span></span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">🔗</span>
              <span>Every word after must <span className="text-text font-semibold">connect</span> to an existing tile</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">🎯</span>
              <span>Use all 7 tiles in one move for a <span className="text-text font-semibold">+50 Bingo bonus!</span></span>
            </div>
          </div>
          <div className="border-t border-white/10 pt-2 mt-1">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wide block mb-1.5">Bonus squares</span>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              {[
                { label: 'TW', color: 'bg-red-700', desc: 'Triple Word' },
                { label: 'DW', color: 'bg-rose-500', desc: 'Double Word' },
                { label: 'TL', color: 'bg-blue-600', desc: 'Triple Letter' },
                { label: 'DL', color: 'bg-sky-500', desc: 'Double Letter' },
              ].map(b => (
                <div key={b.label} className="flex items-center gap-1.5">
                  <span className={`${b.color} text-white font-bold rounded px-1 py-0.5 text-[9px] min-w-[22px] text-center`}>{b.label}</span>
                  <span className="text-text-muted">{b.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Dictionary picker */}
        <div className="w-full max-w-xs" role="radiogroup" aria-label="Dictionary">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wide block mb-1.5">Dictionary</span>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(DICTIONARIES) as DictVariant[]).map(v => (
              <button
                key={v}
                onClick={() => chooseDictionary(v)}
                role="radio"
                aria-checked={dictVariant === v}
                title={DICTIONARIES[v].blurb}
                className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  dictVariant === v ? 'bg-accent-soft ring-1 ring-accent text-text' : 'bg-card hover:bg-card-hover text-text-muted'
                }`}
              >
                <span className="text-base" aria-hidden>{DICTIONARIES[v].flag}</span>
                {DICTIONARIES[v].label}
              </button>
            ))}
          </div>
        </div>

        {dictStatus === 'error' ? (
          <div className="w-full max-w-xs bg-danger/10 border border-danger/30 rounded-xl p-3 text-center space-y-2">
            <p className="text-xs text-text-muted">Couldn't download the dictionary — check your connection.</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => chooseDictionary(dictVariant)}
                className="bg-accent text-bg font-bold px-4 py-2 rounded-xl text-sm hover:opacity-90 active:scale-95"
              >
                Retry
              </button>
              <button
                onClick={() => setDictStatus('fallback')}
                title="A small built-in word list — many valid words will be rejected"
                className="bg-card hover:bg-card-hover text-text-muted font-semibold px-4 py-2 rounded-xl text-sm"
              >
                Use basic list
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setStarted(true)}
            disabled={dictStatus === 'loading'}
            className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-wait"
          >
            {dictStatus === 'loading' ? 'Loading dictionary…' : 'Start Game'}
          </button>
        )}
        {dictStatus === 'fallback' && (
          <p className="text-[10px] text-warning text-center max-w-xs">
            Playing with the basic built-in list — some valid words may be rejected.
          </p>
        )}
      </div>
    );
  }

  // Online games skip the start screen, so gate play behind the download
  // there too — otherwise words validate against the tiny fallback list.
  if (isOnline && (dictStatus === 'loading' || dictStatus === 'error')) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-5xl" aria-hidden>🅰️</div>
        {dictStatus === 'loading' ? (
          <p className="text-text-muted text-sm" role="status">Loading the {DICTIONARIES[dictVariant].label} dictionary…</p>
        ) : (
          <>
            <p className="text-text-muted text-sm">Couldn't download the dictionary — check your connection.</p>
            <button
              onClick={() => chooseDictionary(dictVariant)}
              className="bg-accent text-bg font-bold px-6 py-2.5 rounded-xl hover:opacity-90 active:scale-95"
            >
              Retry
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col items-center px-2 pt-1 pb-2 gap-1 overflow-hidden">
      {/* ── Top HUD ── */}
      <div className="w-full flex-shrink-0 flex flex-col gap-1">
        {/* Scores row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {scores.map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold ${
                  i === mySeat
                    ? 'bg-accent/15 text-accent ring-1 ring-accent/40'
                    : i === currentSeat
                      ? 'bg-danger/20 text-danger ring-1 ring-danger/40'
                      : 'bg-card text-text-muted'
                }`}
              >
                <span className="text-[10px] opacity-70">{seatLabel(i)}</span>
                <span className="text-sm">{s}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-text-muted">
            <span className="bg-card rounded-md px-1.5 py-0.5">
              Round <span className="text-text font-bold">{Math.min(round + 1, maxRounds)}</span>/{maxRounds}
            </span>
            <span className="bg-card rounded-md px-1.5 py-0.5">
              Bag: <span className="text-text font-bold">{pool.length}</span>
            </span>
          </div>
        </div>

        {/* Score progress bars — race to targetScore */}
        <div className="flex flex-col gap-0.5">
          {scores.map((s, i) => {
            const pct = Math.min(s / targetScore, 1);
            return (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-[9px] text-text-muted w-8 text-right shrink-0 truncate">{seatLabel(i)}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${i === mySeat ? 'bg-accent' : 'bg-red-400'}`}
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>
                <span className="text-[9px] text-text-muted w-8 shrink-0">{Math.round(pct * 100)}%</span>
              </div>
            );
          })}
        </div>

        {/* Turn indicator + last move */}
        <div className="flex items-center justify-between gap-2">
          <div className={`flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold ${
            isHumanTurn
              ? 'bg-accent/20 text-accent'
              : 'bg-card text-text-muted'
          }`}>
            {isHumanTurn ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                </span>
                Your turn
              </>
            ) : (
              <>
                <span className="animate-pulse">🤖</span>
                AI {currentSeat} is thinking...
              </>
            )}
          </div>
          {lastWord && (
            <span className="text-[10px] text-text-muted truncate max-w-[50%]">
              {lastWord}
            </span>
          )}
        </div>
      </div>

      {/* ── SVG Board ── */}
      <ScrabbleBoard board={board} placedKeys={placedKeys} isHumanTurn={isHumanTurn} onCellClick={handleBoardClick} />

      {/* ── Score preview / breakdown ── */}
      {livePreview && (
        <div className="flex-shrink-0 w-full">
          {livePreview.valid === true ? (
            <div className="flex items-center justify-between bg-accent/10 rounded-lg px-3 py-1 ring-1 ring-accent/30">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-accent">
                  {livePreview.word}
                </span>
                <span className="text-[10px] text-text-muted">
                  = {livePreview.score} pts
                </span>
              </div>
              {livePreview.breakdown && livePreview.breakdown.details.length > 0 && (
                <span className="text-[9px] text-text-muted truncate max-w-[50%]">
                  {livePreview.breakdown.details.join(' · ')}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center bg-danger/10 rounded-lg px-3 py-1 ring-1 ring-danger/20">
              <span className="text-[10px] text-danger">{livePreview.reason}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Last move breakdown (when not placing tiles) ── */}
      {placedKeys.size === 0 && scoreBreakdown && (
        <div className="flex-shrink-0 w-full bg-card/50 rounded-lg px-3 py-1 ring-1 ring-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-muted">
              <span className="font-bold text-text">{scoreBreakdown.word}</span>
              {' = '}
              {scoreBreakdown.mainWordScore > 0 && `${scoreBreakdown.mainWordScore}`}
              {scoreBreakdown.crossWordsScore > 0 && ` + ${scoreBreakdown.crossWordsScore} cross`}
              {scoreBreakdown.bingoBonus > 0 && ` + ${scoreBreakdown.bingoBonus} bingo`}
              {' = '}
              <span className="font-bold text-accent">{scoreBreakdown.total}</span>
            </span>
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center justify-center gap-2 flex-shrink-0 flex-wrap">
        {aiThinking ? (
          <span className="text-text-muted text-xs animate-pulse">🤖 AI thinking...</span>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={placedKeys.size < 1 || !isHumanTurn}
              className="bg-accent text-bg font-bold px-5 py-2 rounded-xl text-sm shadow-lg hover:shadow-xl disabled:opacity-30 disabled:shadow-none active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Check size={16} strokeWidth={3} />
              Submit
            </button>
            <button
              onClick={handleClear}
              disabled={placedKeys.size === 0 || !isHumanTurn}
              className="bg-card text-text font-semibold px-3 py-1.5 rounded-lg text-xs border border-text-muted/20 disabled:opacity-30 active:scale-95 transition-all hover:bg-card-hover"
            >
              Clear
            </button>
            <button
              onClick={handleShuffle}
              disabled={playerRack.length === 0 || !isHumanTurn}
              className="bg-card text-text-muted font-semibold px-3 py-1.5 rounded-lg text-xs disabled:opacity-30 active:scale-95 transition-all hover:bg-card-hover"
            >
              Shuffle
            </button>
            <button
              onClick={handlePass}
              disabled={!isHumanTurn}
              className="bg-transparent text-text-muted font-semibold px-3 py-1.5 rounded-lg text-xs border border-danger/30 hover:bg-danger/10 disabled:opacity-30 active:scale-95 transition-all"
            >
              Pass
            </button>
          </div>
        )}
      </div>

      {/* ── Tile rack ── */}
      <div className="flex justify-center gap-1.5 flex-shrink-0 pt-1">
        {playerRack.map((tile, i) => {
          const pts = TILE_SCORES[tile];
          return (
            <button
              key={`${tile}-${i}`}
              onClick={() => handleRackClick(i)}
              disabled={!isHumanTurn}
              aria-label={`Tile ${tile}, ${pts} point${pts === 1 ? '' : 's'}`}
              aria-pressed={selectedTile === i}
              className={`relative w-10 h-11 rounded-lg font-bold text-base flex flex-col items-center justify-center transition-all shadow-sm ${
                selectedTile === i
                  ? 'bg-accent text-bg ring-2 ring-accent scale-110 -translate-y-1 shadow-lg'
                  : 'bg-amber-200 text-amber-900 hover:bg-amber-300 hover:scale-105 hover:-translate-y-0.5 active:scale-95'
              } ${!isHumanTurn ? 'opacity-60' : ''}`}
            >
              <span className="leading-none">{tile}</span>
              <span className={`text-[9px] leading-none mt-0.5 font-bold ${
                selectedTile === i ? 'text-bg/80' : 'text-amber-700'
              }`}>
                {pts}
              </span>
            </button>
          );
        })}
        {playerRack.length === 0 && (
          <span className="text-text-muted text-[10px] py-2">No tiles</span>
        )}
      </div>
    </div>
  );
}

export default ScrabbleGame;

