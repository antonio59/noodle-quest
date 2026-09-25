import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Check } from 'lucide-react';
import type { GameProps } from '@/types';
import { TurnBanner } from '@/components/pass-and-play/TurnBanner';
import {
  SIZE,
  buildTilePool, scorePlacement,
  generateAiMoves, pickAiMove, buildScoreBreakdown,
  setActiveWordSet,
  type ScoreBreakdown,
} from './logic';
import { ScrabbleBoard } from './Board';
import { ScrabbleHud } from './Hud';
import { TileRack } from './Rack';
import { StartScreen } from './StartScreen';
import { evaluatePlacement } from './placement';
import { LocalCurtain, localIntro, localSeatBadge, localSeatName, useLocalTurns } from './local';
import {
  DICTIONARIES, fetchDictionary, getPreferredDictionary, setPreferredDictionary,
  isDictVariant, type DictStatus, type DictVariant,
} from './dictionary';


function occupancy(board: (string | null)[][]): number {
  let n = 0;
  for (const row of board) for (const cell of row) if (cell) n++;
  return n;
}

function cloneBoard(board: (string | null)[][]): (string | null)[][] {
  return board.map(row => [...row]);
}
function ScrabbleGame({ stage, onScore, onProgress, onMessage, onEnd, aiDifficulty = 'medium', numPlayers, multiplayerState, onMultiplayerMove, localSeats }: GameProps) {
  const isOnline = !!multiplayerState;
  const isHost = isOnline && multiplayerState.playerNumber === 1;
  // Pass & play: every seat is a person on this device — no AI, and each
  // rack stays behind a curtain until its owner has the device.
  const isLocal = !isOnline && (localSeats?.length ?? 0) >= 2;
  const tableSeats = useMemo(() => (isLocal ? localSeats ?? [] : []), [isLocal, localSeats]);
  // Clamp to 2..4; default 2. In online mode, seats = roster size (min 2).
  const SEATS = isOnline
    ? Math.max(2, Math.min(4, multiplayerState?.players?.length || 2))
    : Math.max(2, Math.min(4, (isLocal ? tableSeats.length : numPlayers) ?? 2));

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
  const [dictStatus, setDictStatus] = useState<DictStatus>('loading');
  const endedRef = useRef(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Board we just dispatched, held until the server snapshot is at least as
  // full. Convex can re-emit the pre-move document while makeMove is in
  // flight; applying that would make the submitted word vanish.
  const pendingOnlineBoardRef = useRef<(string | null)[][] | null>(null);

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

  // The seat whose rack this device shows: ours online, seat 0 against the
  // AI, and whoever's turn it is in pass & play.
  const mySeat = isOnline ? (multiplayerState.playerNumber - 1) : isLocal ? currentSeat : 0;

  // Seat 0 is only "You" offline; online it's whichever seat we occupy.
  const seatLabel = (i: number): string => {
    if (isLocal) return localSeatName(tableSeats, i);
    if (i === mySeat) return 'You';
    if (isOnline) {
      const other = multiplayerState?.players?.find(p => p.seat === i + 1);
      return (other?.name ?? 'Opponent').split(/\s+/)[0];
    }
    return SEATS > 2 ? `AI ${i}` : 'AI';
  };

  const maxRounds = 6 + stage * 6; // each seat plays maxRounds turns
  const targetScore = stage * 30;
  // Every turn change re-covers the device, so the key must be unique per turn.
  const local = useLocalTurns({ enabled: isLocal, seats: tableSeats, turnKey: `${round}:${currentSeat}`, onEnd });
  const isHumanTurn = currentSeat === mySeat && local.handVisible;
  const playerRack = racks[mySeat] ?? [];

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
      isLocal
        ? `${seatLabel(0)} goes first — place tiles to make a word`
        : SEATS > 2
          ? `Your turn — ${SEATS - 1} AI opponents (target ${targetScore})`
          : `Your turn — place tiles to make a word (target ${targetScore})`,
    );
  // intentionally only on mount

  }, []);

  // Online: host asks the server to deal — the bag order and opponent
  // racks are server-secret; we only ever see our own rack.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!isOnline || !onMultiplayerMove || !isHost || seededRef.current) return;
    const bs = multiplayerState?.boardState as { racks?: unknown } | null | undefined;
    if (bs && bs.racks) return;
    seededRef.current = true;
    onMultiplayerMove({ action: 'deal', dict: dictVariant });
  }, [isOnline, onMultiplayerMove, isHost, multiplayerState, dictVariant]);

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
    // Don't yank tiles the player is still arranging this turn.
    if (placedCells.size > 0) return;
    if (pendingOnlineBoardRef.current) {
      const pending = pendingOnlineBoardRef.current;
      if (!Array.isArray(bs.board) || occupancy(bs.board) < occupancy(pending)) return;
      pendingOnlineBoardRef.current = null;
    }
    // Everyone validates against the host's dictionary choice.
    if (isDictVariant(bs.dict)) {
      setDictVariant(cur => (cur === bs.dict ? cur : bs.dict as DictVariant));
    }
    if (bs.board) setBoard(cloneBoard(bs.board));
    if (bs.racks) setRacks(bs.racks.map(rack => [...rack]));
    if (bs.pool) setPool([...bs.pool]);
    if (bs.scores) setScores([...bs.scores]);
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
  }, [isOnline, serverBoardState, serverWinner, myPlayerNumber, mySeat, onEnd, placedCells.size]);

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
    if (isLocal) {
      local.finish(finalScores);
      return;
    }
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
  }, [targetScore, onEnd, schedule, isLocal, local.finish]);

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
  const findPlayerPlay = () => evaluatePlacement(board, placedKeys, lockedCells, isFirstMove);

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
    const seat = mySeat;
    const newScores = scores.map((s, i) => (i === seat ? s + result.score : s));
    const committed = cloneBoard(board);
    if (isOnline) pendingOnlineBoardRef.current = committed;
    setScores(newScores);
    onScore(result.score);
    setLastWord(`${seatLabel(seat)} played "${result.word}" for ${result.score}`);
    setScoreBreakdown(result.breakdown ?? null);
    onMessage(`+${result.score} for "${result.word}"!`);

    const newLocked = new Set(lockedCells);
    for (const k of placedKeys) newLocked.add(k);
    setLockedCells(newLocked);
    setPlacedCells(new Map());
    setIsFirstMove(false);

    if (isOnline && onMultiplayerMove && multiplayerState) {
      // Send the depleted rack — the server validates the play and refills
      // from its hidden pool (our local `pool` is just placeholders).
      const nextSeat = (seat + 1) % SEATS;
      const myNewScore = newScores[seat] ?? 0;
      const iWon = myNewScore >= targetScore && stage >= 0;
      const depletedRacks = racks.map((rack, i) => (i === seat ? [...playerRack] : rack));
      setRacks(depletedRacks);
      onMultiplayerMove({
        boardState: {
          board: committed,
          racks: depletedRacks,
          scores: newScores,
          isFirstMove: false,
          lastWord: `P${multiplayerState.playerNumber} played "${result.word}" for ${result.score}`,
          dict: dictVariant,
        },
        winner: iWon ? multiplayerState.playerNumber : undefined,
      });
      if (iWon && !endedRef.current) {
        endedRef.current = true;
        onEnd({ score: myNewScore, stars: 3, summary: `You won Scrabble with ${myNewScore} pts!` });
      }
      return;
    }

    const { rack: newRack, pool: newPool } = drawUpTo7(playerRack, pool);
    const newRacks = racks.map((rack, i) => (i === seat ? newRack : rack));
    setRacks(newRacks);
    setPool(newPool);

    advanceSeat(newScores);
  };

  // AI turn — runs whenever currentSeat points at a non-human seat.
  useEffect(() => {
    // Online opponents drive their own turns; in pass & play every seat is a person.
    if (isOnline || isLocal) return;
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
    const letters: string[] = [];
    const cleared = cloneBoard(board);
    for (const key of placedKeys) {
      const [r, c] = key.split(',').map(Number);
      if (cleared[r][c]) {
        letters.push(cleared[r][c]!);
        cleared[r][c] = null;
      }
    }
    setBoard(cleared);
    setRacks(prev => prev.map((rack, i) => (i === mySeat ? [...rack, ...letters] : rack)));
    setPlacedCells(new Map());
    setSelectedTile(null);
    setScoreBreakdown(null);
    onMessage(isLocal ? `${seatLabel(mySeat)} passed` : 'You passed your turn');
    setLastWord(`${seatLabel(mySeat)} passed`);
    if (isOnline && onMultiplayerMove) {
      const restoredRacks = racks.map((rack, i) => (i === mySeat ? [...rack, ...letters] : rack));
      onMultiplayerMove({
        boardState: {
          board: cleared,
          racks: restoredRacks,
          scores,
          isFirstMove,
          lastWord: 'Opponent passed',
          dict: dictVariant,
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
      <StartScreen
        intro={isLocal ? localIntro(maxRounds) : (
          <>
            Build words on the board using letter tiles. First to reach{' '}
            <span className="text-accent font-bold">{targetScore} pts</span> wins!
          </>
        )}
        dictVariant={dictVariant}
        dictStatus={dictStatus}
        onChooseDictionary={chooseDictionary}
        onUseFallback={() => setDictStatus('fallback')}
        onStart={() => setStarted(true)}
      />
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
    <div className="relative h-full w-full flex flex-col items-center px-2 pt-1 pb-2 gap-1 overflow-hidden">
      {/* ── Top HUD ── */}
      <ScrabbleHud
        scores={scores}
        labels={scores.map((_, i) => (isLocal ? localSeatBadge(tableSeats, i) : seatLabel(i)))}
        mySeat={mySeat}
        currentSeat={currentSeat}
        round={round}
        maxRounds={maxRounds}
        bagCount={pool.length}
        targetScore={isLocal ? undefined : targetScore}
        isHumanTurn={isHumanTurn}
        turnIndicator={isLocal ? <TurnBanner seats={tableSeats} turnSeat={currentSeat + 1} /> : undefined}
        lastWord={lastWord}
      />

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
      <TileRack
        tiles={playerRack}
        selected={selectedTile}
        disabled={!isHumanTurn}
        hidden={!local.handVisible}
        onSelect={handleRackClick}
      />

      {local.showCurtain && (
        <LocalCurtain
          seats={tableSeats}
          seat={currentSeat}
          lastMove={lastWord}
          scores={scores}
          onReady={() => { setSelectedTile(null); local.reveal(); }}
        />
      )}
    </div>
  );
}

export default ScrabbleGame;

