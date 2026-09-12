import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { GameProps } from '@/types';
import {
  TRACK, RED_STRETCH, BLUE_STRETCH, GREEN_STRETCH, YELLOW_STRETCH,
  SAFE_POSITIONS, RED_ENTRY, BLUE_ENTRY, GREEN_ENTRY, YELLOW_ENTRY,
  HOME, STRETCH_START,
  rollDie, advance, getMovableIndices, capturedIndices, chooseAiMove, posCoord,
  entryFor, stretchFor, sidesForCount, nextSeat,
  type Side,
} from './logic';
import { playDice, playMove, playCapture } from '@/lib/feedback';

const C = 26;
const N = 15;
const W = C * N;

const RED_SPOTS:    [number, number][] = [[1.7,1.7],[3.3,1.7],[1.7,3.3],[3.3,3.3]];
const GREEN_SPOTS:  [number, number][] = [[10.7,1.7],[12.3,1.7],[10.7,3.3],[12.3,3.3]];
const YELLOW_SPOTS: [number, number][] = [[1.7,10.7],[3.3,10.7],[1.7,12.3],[3.3,12.3]];
const BLUE_SPOTS:   [number, number][] = [[10.7,10.7],[12.3,10.7],[10.7,12.3],[12.3,12.3]];

const SIDE_COLOR: Record<Side, string> = {
  red: '#ef4444', green: '#22c55e', yellow: '#eab308', blue: '#3b82f6',
};
const SIDE_LIGHT: Record<Side, string> = {
  red: '#fca5a5', green: '#86efac', yellow: '#fde047', blue: '#93c5fd',
};
const SIDE_SPOTS: Record<Side, [number, number][]> = {
  red: RED_SPOTS, green: GREEN_SPOTS, yellow: YELLOW_SPOTS, blue: BLUE_SPOTS,
};
const SIDE_LABEL: Record<Side, string> = {
  red: 'Red', green: 'Green', yellow: 'Yellow', blue: 'Blue',
};

// Small px offsets when multiple pieces share one track square
const STACK_OFF: [number, number][] = [[-4,-4],[4,-4],[-4,4],[4,4]];

function emptyPieces(n: number): number[][] {
  return Array.from({ length: n }, () => [-1, -1, -1, -1]);
}

function LudoGame({ stage: _stage, onScore, onProgress, onMessage, onEnd, aiDifficulty, numPlayers, multiplayerState, onMultiplayerMove }: GameProps) {
  const difficulty = aiDifficulty || 'medium';
  const isOnline = !!multiplayerState;

  const playerCount = isOnline
    ? Math.max(2, Math.min(4, multiplayerState?.players?.length || 2))
    : Math.max(2, Math.min(4, numPlayers ?? 2));

  const sides = useMemo(() => sidesForCount(playerCount), [playerCount]);
  const mySeat = isOnline ? multiplayerState.playerNumber : 1;
  const mySide = sides[mySeat - 1] ?? 'red';
  const isAiGame = !isOnline && playerCount === 2;
  const isHotSeat = !isOnline && playerCount > 2;

  const [allPieces, setAllPieces] = useState<number[][]>(() => emptyPieces(playerCount));
  const [turnSeat, setTurnSeat]   = useState(1);
  const [dice, setDice]           = useState<number|null>(null);
  const [pendingDice, setPendingDice] = useState<number|null>(null);
  const [movable, setMovable]     = useState<number[]>([]);
  const [over, setOver]           = useState(false);
  const [started, setStarted]     = useState(false);

  const piecesRef = useRef<number[][]>(emptyPieces(playerCount));
  const turnRef   = useRef(1);
  const overRef   = useRef(false);
  const endedRef  = useRef(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const rosterName = (seat: number): string => {
    if (isAiGame && seat === 2) return 'AI';
    if (isOnline) {
      const fromRoster = multiplayerState?.players?.find(p => p.seat === seat)?.name;
      if (fromRoster) return fromRoster;
      if (seat !== mySeat) return multiplayerState?.opponentName ?? `P${seat}`;
    }
    if (isHotSeat) return SIDE_LABEL[sides[seat - 1]];
    return seat === mySeat ? 'You' : SIDE_LABEL[sides[seat - 1]];
  };

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
    return () => { endedRef.current = true; timeoutsRef.current.forEach(clearTimeout); };
  }, []);

  useEffect(() => {
    onMessage('Roll a 6 to enter! Tap a glowing piece to move it.');
  }, [onMessage]);

  // Keep refs sized if playerCount changes (e.g. lobby → play).
  useEffect(() => {
    if (piecesRef.current.length !== playerCount) {
      const next = emptyPieces(playerCount);
      piecesRef.current = next;
      setAllPieces(next.map(p => [...p]));
    }
  }, [playerCount]);

  const isHumanControlling = (seat: number) => {
    if (isOnline) return seat === mySeat;
    if (isAiGame) return seat === 1;
    return true; // hot-seat: shared device plays every seat
  };

  const canAct = isHumanControlling(turnSeat) && !over;

  // ── Online sync ──────────────────────────────────────────────────────────
  // boardState carries seat-indexed relative piece arrays plus an explicit
  // turnSeat: bonus rolls on a 6 break the server's automatic turn
  // rotation, so the authoritative turn travels with the board.
  useEffect(() => {
    if (!isOnline) return;
    const bs = multiplayerState.boardState as
      | { pieces?: number[][]; lastRoll?: number; turnSeat?: number }
      | null
      | undefined;
    if (bs && Array.isArray(bs.pieces)) {
      const synced = sides.map((_, i) =>
        Array.isArray(bs.pieces![i]) ? [...bs.pieces![i]] : [-1, -1, -1, -1],
      );
      // Pad/truncate if roster length drifted from stored pieces.
      while (synced.length < playerCount) synced.push([-1, -1, -1, -1]);
      piecesRef.current = synced.slice(0, playerCount).map(p => [...p]);
      setAllPieces(piecesRef.current.map(p => [...p]));
      if (typeof bs.lastRoll === 'number') setDice(bs.lastRoll);
      const ts = bs.turnSeat ?? multiplayerState.currentPlayer;
      turnRef.current = ts;
      setTurnSeat(ts);
      if (!endedRef.current) {
        const winnerSeat = piecesRef.current.findIndex(p => p.every(x => x >= HOME));
        if (winnerSeat >= 0) {
          endedRef.current = true;
          overRef.current = true;
          setOver(true);
          const iWon = winnerSeat + 1 === mySeat;
          onEnd({
            score: iWon ? 100 : 10,
            stars: iWon ? 3 : 1,
            summary: iWon
              ? 'All 4 pieces home! You win!'
              : `${rosterName(winnerSeat + 1)} got all 4 pieces home.`,
          });
        }
      }
    } else {
      turnRef.current = multiplayerState.currentPlayer;
      setTurnSeat(multiplayerState.currentPlayer);
    }
  }, [isOnline, multiplayerState, onEnd, playerCount, sides, mySeat]);

  // Send full board to the server. keepTurn = I rolled a 6.
  const dispatchOnline = useCallback((pieces: number[][], d: number, keepTurn: boolean, actingSeat: number) => {
    if (!isOnline) return;
    const iWon = pieces[actingSeat - 1]?.every(p => p >= HOME) ?? false;
    onMultiplayerMove?.({
      boardState: {
        pieces: pieces.map(p => [...p]),
        lastRoll: d,
        turnSeat: keepTurn && !iWon ? actingSeat : nextSeat(actingSeat, playerCount),
      },
      winner: iWon ? actingSeat : undefined,
    });
  }, [isOnline, onMultiplayerMove, playerCount]);

  /** Apply captures against every other seat; returns whether anyone was hit. */
  const applyCaptures = (pieces: number[][], moverSeatIdx: number, moverRel: number): boolean => {
    const moverEntry = entryFor(sides[moverSeatIdx]);
    let hit = false;
    for (let s = 0; s < pieces.length; s++) {
      if (s === moverSeatIdx) continue;
      for (const pi of capturedIndices(moverRel, moverEntry, pieces[s], entryFor(sides[s]))) {
        pieces[s][pi] = -1;
        hit = true;
      }
    }
    return hit;
  };

  // ── AI turn (solo 2p only) ───────────────────────────────────────────────
  const doAi = useCallback(() => {
    if (endedRef.current || overRef.current || !isAiGame) return;
    const d = rollDie();
    setDice(d);

    const aiSeatIdx = 1;
    const humanSeatIdx = 0;
    const aiEntry = entryFor(sides[aiSeatIdx]);
    const humanEntry = entryFor(sides[humanSeatIdx]);
    const aiPieces = piecesRef.current[aiSeatIdx];
    const humanPieces = piecesRef.current[humanSeatIdx];

    const bestIdx = chooseAiMove(aiPieces, d, aiEntry, humanPieces, humanEntry, difficulty);

    if (bestIdx < 0) {
      onMessage(`AI rolled ${d} — no piece can move.`);
      turnRef.current = 1;
      setTurnSeat(1);
      return;
    }

    const next = piecesRef.current.map(p => [...p]);
    const np = advance(next[aiSeatIdx][bestIdx], d);
    next[aiSeatIdx][bestIdx] = np;
    const captured = applyCaptures(next, aiSeatIdx, np);
    piecesRef.current = next;
    setAllPieces(next.map(p => [...p]));

    if (captured) {
      playCapture();
      onMessage(`AI rolled ${d} — captured your piece!`);
    } else if (np >= HOME) {
      const hc = next[aiSeatIdx].filter(p => p >= HOME).length;
      onMessage(`AI piece reached home! (${hc}/4) 💙`);
    } else {
      const label = np >= STRETCH_START ? `home stretch ${np - STRETCH_START + 1}/6` : `sq ${np}`;
      onMessage(`AI rolled ${d} → ${label}`);
    }

    if (next[aiSeatIdx].every(p => p >= HOME)) {
      overRef.current = true; setOver(true);
      endedRef.current = true;
      schedule(() => onEnd({ score: 10, stars: 1, summary: 'AI got all 4 pieces home. Better luck next time!' }), 1500);
      return;
    }

    if (d === 6 && !overRef.current) {
      onMessage('AI rolled 6 — bonus!');
      schedule(doAi, 700);
      return;
    }
    turnRef.current = 1;
    setTurnSeat(1);
  }, [sides, difficulty, isAiGame, onMessage, onEnd, schedule]);

  // ── Move a piece for the seat that is currently acting ───────────────────
  const movePiece = useCallback((idx: number, d: number, actingSeat: number) => {
    const seatIdx = actingSeat - 1;
    const next = piecesRef.current.map(p => [...p]);
    const np = advance(next[seatIdx][idx], d);
    next[seatIdx][idx] = np;

    const captured = applyCaptures(next, seatIdx, np);
    piecesRef.current = next;
    setAllPieces(next.map(p => [...p]));

    const label = SIDE_LABEL[sides[seatIdx]];
    if (captured) {
      playCapture();
      onMessage(isHotSeat
        ? `${label} rolled ${d} — captured a piece!`
        : `Rolled ${d} — captured a piece!`);
    } else if (np >= HOME) {
      const hc = next[seatIdx].filter(p => p >= HOME).length;
      onMessage(`Piece ${hc}/4 home! 🎉`);
    } else {
      playMove();
      const dest = np >= STRETCH_START ? `home stretch ${np - STRETCH_START + 1}/6` : `sq ${np}`;
      onMessage(`Rolled ${d} → ${dest}`);
    }

    const won = next[seatIdx].every(p => p >= HOME);
    const bonus = d === 6 && !won;

    if (isOnline) {
      dispatchOnline(next, d, bonus, actingSeat);
    }

    if (won) {
      overRef.current = true; setOver(true);
      const iWon = isOnline ? actingSeat === mySeat : (isAiGame ? actingSeat === 1 : true);
      if (iWon || isHotSeat) {
        onScore(100); onProgress(1);
      }
      endedRef.current = true;
      const summary = isHotSeat
        ? `${SIDE_LABEL[sides[seatIdx]]} got all 4 pieces home!`
        : iWon
          ? 'All 4 pieces home! You win!'
          : 'Opponent got all 4 pieces home.';
      schedule(() => onEnd({
        score: iWon || isHotSeat ? 100 : 10,
        stars: iWon || isHotSeat ? 3 : 1,
        summary,
      }), 1000);
      return;
    }

    if (bonus && !overRef.current) {
      onMessage('Rolled 6 — bonus roll!');
      return;
    }

    const nxt = nextSeat(actingSeat, playerCount);
    turnRef.current = nxt;
    setTurnSeat(nxt);
    if (isAiGame && nxt === 2) schedule(doAi, 800);
  }, [sides, isOnline, isAiGame, isHotSeat, mySeat, playerCount, dispatchOnline, onMessage, onScore, onProgress, onEnd, schedule, doAi]);

  // ── Roll handler ─────────────────────────────────────────────────────────
  const handleRoll = () => {
    if (endedRef.current || overRef.current || !canAct || pendingDice !== null) return;
    const acting = turnSeat;
    const d = rollDie();
    setDice(d);
    playDice();

    const mv = getMovableIndices(piecesRef.current[acting - 1], d);
    if (mv.length === 0) {
      onMessage(`Rolled ${d} — no piece can move!`);
      if (isOnline) {
        dispatchOnline(piecesRef.current, d, false, acting);
      }
      const nxt = nextSeat(acting, playerCount);
      turnRef.current = nxt;
      setTurnSeat(nxt);
      if (isAiGame && nxt === 2) schedule(doAi, 800);
      return;
    }
    if (mv.length === 1) { movePiece(mv[0], d, acting); return; }
    setPendingDice(d);
    setMovable(mv);
    onMessage(`Rolled ${d} — tap a glowing piece to move!`);
  };

  const handlePieceClick = (idx: number) => {
    if (pendingDice === null || !movable.includes(idx)) return;
    const d = pendingDice;
    setPendingDice(null);
    setMovable([]);
    movePiece(idx, d, turnSeat);
  };

  // ── SVG helpers ──────────────────────────────────────────────────────────
  const cx = (col: number) => col * C + C / 2;
  const cy = (row: number) => row * C + C / 2;

  const stackedXY = (pos: number, entry: number, stretch: [number, number][], pieceIdx: number, seatPieces: number[]): [number, number] => {
    const [row, col] = posCoord(pos, entry, stretch);
    const bx = cx(col), by = cy(row);
    const rank = seatPieces.slice(0, pieceIdx).filter(p => p === pos).length;
    const [ox, oy] = STACK_OFF[rank % 4];
    return [bx + (rank > 0 ? ox : 0), by + (rank > 0 ? oy : 0)];
  };

  // Finished-token slots per side (center star quadrants)
  const homeX = 6 * C + (3 * C) / 2;
  const homeY = 6 * C + (3 * C) / 2;
  const SIDE_FIN: Record<Side, [number, number][]> = {
    red: [
      [homeX - C * 0.3, homeY - C * 0.55],
      [homeX + C * 0.3, homeY - C * 0.55],
      [homeX - C * 0.3, homeY - C * 0.2],
      [homeX + C * 0.3, homeY - C * 0.2],
    ],
    green: [
      [homeX + C * 0.2, homeY - C * 0.3],
      [homeX + C * 0.55, homeY - C * 0.3],
      [homeX + C * 0.2, homeY + C * 0.3],
      [homeX + C * 0.55, homeY + C * 0.3],
    ],
    yellow: [
      [homeX - C * 0.55, homeY - C * 0.3],
      [homeX - C * 0.2, homeY - C * 0.3],
      [homeX - C * 0.55, homeY + C * 0.3],
      [homeX - C * 0.2, homeY + C * 0.3],
    ],
    blue: [
      [homeX - C * 0.3, homeY + C * 0.2],
      [homeX + C * 0.3, homeY + C * 0.2],
      [homeX - C * 0.3, homeY + C * 0.55],
      [homeX + C * 0.3, homeY + C * 0.55],
    ],
  };

  // ── Board rendering ──────────────────────────────────────────────────────
  const renderBoard = () => {
    const el: React.ReactElement[] = [];

    el.push(
      <rect key="frame" x={0} y={0} width={W} height={W} fill="#0a0818" rx={10} />,
      <rect key="bg"    x={2} y={2} width={W-4} height={W-4} fill="#0e0c1f" rx={9} />,
    );

    const bases: { key: string; gx: number; gy: number; side: Side }[] = [
      { key: 'rb', gx: 0, gy: 0, side: 'red' },
      { key: 'gb', gx: 9, gy: 0, side: 'green' },
      { key: 'yb', gx: 0, gy: 9, side: 'yellow' },
      { key: 'bb', gx: 9, gy: 9, side: 'blue' },
    ];
    for (const b of bases) {
      const color = SIDE_COLOR[b.side];
      const spots = SIDE_SPOTS[b.side];
      const bpx = b.gx * C, bpy = b.gy * C;
      el.push(
        <rect key={`${b.key}o`} x={bpx+3} y={bpy+3} width={6*C-6} height={6*C-6}
          fill={color} fillOpacity={0.12} rx={10} stroke={color} strokeWidth={1.5} strokeOpacity={0.3} />,
        <rect key={`${b.key}i`} x={(b.gx+1)*C+5} y={(b.gy+1)*C+5} width={4*C-10} height={4*C-10}
          fill={color} fillOpacity={0.18} rx={8} stroke={color} strokeWidth={1.5} strokeOpacity={0.4} />,
      );
      for (let si = 0; si < 4; si++) {
        const [sc, sr] = spots[si];
        el.push(
          <circle key={`${b.key}sp${si}`} cx={cx(sc)} cy={cy(sr)} r={C*0.35}
            fill="rgba(0,0,0,0.28)" stroke={color} strokeWidth={1.5} strokeOpacity={0.55} />,
        );
      }
      el.push(
        <text key={`${b.key}l`} x={cx(b.gx+2.5)} y={cy(b.gy+4.7)}
          textAnchor="middle" dominantBaseline="central"
          fontSize={8} fill={color} fontWeight="bold" opacity={0.55}>{b.side.toUpperCase()}</text>,
      );
    }

    el.push(
      <rect key="arm-t" x={6*C} y={0}    width={3*C} height={6*C} fill="#111827" />,
      <rect key="arm-l" x={0}   y={6*C}  width={6*C} height={3*C} fill="#111827" />,
      <rect key="arm-c" x={6*C} y={6*C}  width={3*C} height={3*C} fill="#111827" />,
      <rect key="arm-r" x={9*C} y={6*C}  width={6*C} height={3*C} fill="#111827" />,
      <rect key="arm-b" x={6*C} y={9*C}  width={3*C} height={6*C} fill="#111827" />,
    );

    TRACK.forEach(([row, col], i) => {
      const isSafe = SAFE_POSITIONS.has(i);
      let fill = '#182038', stroke = isSafe ? '#3b6aaa' : '#2a3a5a', sw = isSafe ? 0.9 : 0.5;
      if (i === RED_ENTRY)    { fill = 'rgba(239,68,68,0.28)';  stroke = '#ef4444'; sw = 1; }
      if (i === GREEN_ENTRY)  { fill = 'rgba(34,197,94,0.28)';  stroke = '#22c55e'; sw = 1; }
      if (i === BLUE_ENTRY)   { fill = 'rgba(59,130,246,0.28)'; stroke = '#3b82f6'; sw = 1; }
      if (i === YELLOW_ENTRY) { fill = 'rgba(234,179,8,0.28)';  stroke = '#eab308'; sw = 1; }
      el.push(
        <rect key={`t${i}`} x={col*C+1} y={row*C+1} width={C-2} height={C-2}
          fill={fill} stroke={stroke} strokeWidth={sw} rx={3} />,
      );
      if (isSafe && i !== RED_ENTRY && i !== BLUE_ENTRY && i !== GREEN_ENTRY && i !== YELLOW_ENTRY) {
        el.push(
          <text key={`sf${i}`} x={cx(col)} y={cy(row)} textAnchor="middle" dominantBaseline="central"
            fontSize={9} fill="rgba(255,255,255,0.32)" style={{ userSelect:'none' }}>✦</text>,
        );
      }
    });

    const stretches = [
      { data: RED_STRETCH,    color: '#ef4444', op: 0.22 },
      { data: BLUE_STRETCH,   color: '#3b82f6', op: 0.22 },
      { data: GREEN_STRETCH,  color: '#22c55e', op: 0.18 },
      { data: YELLOW_STRETCH, color: '#eab308', op: 0.18 },
    ];
    for (const s of stretches) {
      s.data.forEach(([row, col], i) => {
        el.push(
          <rect key={`sr-${s.color}-${i}`} x={col*C+1} y={row*C+1} width={C-2} height={C-2}
            fill={s.color} fillOpacity={s.op} stroke={s.color} strokeWidth={0.8} rx={3} />,
          <text key={`sn-${s.color}-${i}`} x={cx(col)} y={cy(row)} textAnchor="middle" dominantBaseline="central"
            fontSize={7} fill={s.color} fillOpacity={0.7} fontWeight="bold">{i+1}</text>,
        );
      });
    }

    const mx = 6*C, my = 6*C, ms = 3*C;
    const hcx = mx+ms/2, hcy = my+ms/2;
    const tris = [
      { color:'#ef4444', pts:`${mx},${my} ${mx+ms},${my} ${hcx},${hcy}` },
      { color:'#22c55e', pts:`${mx+ms},${my} ${mx+ms},${my+ms} ${hcx},${hcy}` },
      { color:'#3b82f6', pts:`${mx},${my+ms} ${mx+ms},${my+ms} ${hcx},${hcy}` },
      { color:'#eab308', pts:`${mx},${my} ${mx},${my+ms} ${hcx},${hcy}` },
    ];
    for (const t of tris) {
      el.push(<polygon key={`tri-${t.color}`} points={t.pts} fill={t.color} fillOpacity={0.22} />);
    }
    el.push(
      <circle key="home-ring"  cx={hcx} cy={hcy} r={C*0.95} fill="#0e0c1f" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />,
      <circle key="home-inner" cx={hcx} cy={hcy} r={C*0.68} fill="rgba(251,191,36,0.1)" stroke="#f59e0b" strokeWidth={1.2} />,
      <text   key="home-star"  x={hcx} y={hcy+1} textAnchor="middle" dominantBaseline="central" fontSize={16} fill="#fbbf24">★</text>,
    );

    return el;
  };

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement;
    const idx = target.getAttribute('data-piece-idx');
    if (idx !== null) {
      handlePieceClick(Number(idx));
    }
  }, [handlePieceClick]);

  // ── Token rendering ──────────────────────────────────────────────────────
  const renderTokens = () => {
    const el: React.ReactElement[] = [];
    const r = C * 0.37;

    const drawToken = (
      id: string, tx: number, ty: number,
      color: string, light: string, label: string,
      isActive: boolean, isMovable: boolean,
      scale = 1.0,
      pieceIdx?: number,
    ) => {
      const tr = r * scale;
      const clickable = pieceIdx !== undefined;
      return [
        <circle key={`${id}-sh`} cx={tx+1} cy={ty+2} r={tr+1} fill="rgba(0,0,0,0.45)" style={{ pointerEvents:'none' }} />,
        ...(isMovable ? [
          <circle key={`${id}-pulse`} cx={tx} cy={ty} r={tr+5}
            fill="none" stroke={color} strokeWidth={2.5} opacity={0.65}
            style={{ animation:'ping 1s cubic-bezier(0,0,0.2,1) infinite', pointerEvents:'none' }} />,
        ] : isActive ? [
          <circle key={`${id}-glow`} cx={tx} cy={ty} r={tr+3.5}
            fill="none" stroke={color} strokeWidth={1.5} opacity={0.4} style={{ pointerEvents:'none' }} />,
        ] : []),
        <circle key={`${id}-body`} cx={tx} cy={ty} r={tr}
          fill={color}
          stroke={isMovable ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)'}
          strokeWidth={isMovable ? 2.2 : 1.4}
          style={{ cursor: clickable ? 'pointer' : 'default' }}
          {...(clickable ? { 'data-piece-idx': pieceIdx } : {})} />,
        <circle key={`${id}-hl`} cx={tx-tr*0.28} cy={ty-tr*0.3} r={tr*0.4}
          fill={light} opacity={0.42} style={{ pointerEvents:'none' }} />,
        <text key={`${id}-txt`} x={tx} y={ty+1} textAnchor="middle" dominantBaseline="central"
          fontSize={tr*0.88} fill="white" fontWeight="bold" style={{ pointerEvents:'none' }}>
          {label}
        </text>,
      ];
    };

    sides.forEach((side, seatIdx) => {
      const seat = seatIdx + 1;
      const pieces = allPieces[seatIdx] ?? [-1, -1, -1, -1];
      const entry = entryFor(side);
      const stretch = stretchFor(side);
      const spots = SIDE_SPOTS[side];
      const color = SIDE_COLOR[side];
      const light = SIDE_LIGHT[side];
      const fin = SIDE_FIN[side];
      const active = turnSeat === seat;
      const interactive = active && canAct && pendingDice !== null;
      let finCount = 0;

      pieces.forEach((pos, i) => {
        const id = `s${seat}-p${i}`;
        const isM = interactive && movable.includes(i);

        if (pos === -1) {
          const [sc, sr] = spots[i];
          el.push(...drawToken(id, cx(sc), cy(sr), color, light, String(i+1), active, isM, 1, isM ? i : undefined));
        } else if (pos >= HOME) {
          const [fx, fy] = fin[finCount++];
          el.push(...drawToken(id, fx, fy, color, light, '✓', false, false, 0.62));
        } else {
          const [tx, ty] = stackedXY(pos, entry, stretch, i, pieces);
          el.push(...drawToken(id, tx, ty, color, light, String(i+1), active, isM, 1, isM ? i : undefined));
        }
      });
    });

    return el;
  };

  // ── Computed stats ───────────────────────────────────────────────────────
  const homeCounts = allPieces.map(p => p.filter(x => x >= HOME).length);
  const pcts = allPieces.map(p =>
    Math.round(p.reduce((s, x) => s + (x < 0 ? 0 : x >= HOME ? HOME : x), 0) / (HOME * 4) * 100),
  );
  const myHome = homeCounts[mySeat - 1] ?? 0;
  const turnSide = sides[turnSeat - 1];
  const myPieces = allPieces[mySeat - 1] ?? [-1, -1, -1, -1];

  const introBlurb = isOnline
    ? `Race all 4 ${SIDE_LABEL[mySide].toLowerCase()} pieces home before the others!`
    : isHotSeat
      ? `Hot-seat ${playerCount}-player race — pass the device each turn!`
      : 'Race all 4 red pieces to the golden star home before the AI does!';

  // ── Intro screen ─────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 p-6 text-center">
        <div className="text-6xl select-none">🎲</div>
        <div>
          <h2 className="text-2xl font-bold mb-1">Ludo</h2>
          <p className="text-text-muted text-sm max-w-xs">{introBlurb}</p>
        </div>
        <div className="bg-card rounded-xl p-4 text-left max-w-xs w-full text-xs space-y-2 text-text-muted">
          {[
            ['🎲','Roll a 6 to move a piece from base onto the track'],
            ['🔢','Tap a glowing piece to move it when you have choices'],
            ['✦', 'Star squares are safe — pieces can\'t be captured there'],
            ['💥','Land on an opponent\'s piece to send it back to base'],
            ['🎁','Roll a 6 again for a bonus turn'],
            ['🏠','Get all 4 pieces to the center star to win!'],
          ].map(([icon, rule], idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 text-center">{icon}</span>
              <span>{rule}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => setStarted(true)}
          className="bg-accent text-bg font-bold px-10 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 transition-all"
        >
          Start Game
        </button>
      </div>
    );
  }

  const waitingLabel = isOnline
    ? `${rosterName(turnSeat)}'s turn…`
    : isAiGame
      ? 'AI rolling…'
      : `${SIDE_LABEL[turnSide]}'s turn`;

  // ── Game screen ───────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col items-center p-2 gap-1.5">
      {/* Status bar */}
      <div className="w-full max-w-[400px] flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: SIDE_COLOR[mySide] }} />
          <span className="text-xs font-bold truncate" style={{ color: SIDE_COLOR[mySide] }}>
            {isHotSeat ? SIDE_LABEL[mySide] : 'You'}
          </span>
          <span className="text-[11px] text-text-muted whitespace-nowrap">{myHome}/4 home</span>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-all ${
          pendingDice !== null
            ? 'bg-yellow-400/20 text-yellow-300 ring-1 ring-yellow-400/40'
            : canAct
              ? 'bg-accent/20 text-accent ring-1 ring-accent/40'
              : 'bg-card text-text-muted'
        }`}>
          {pendingDice !== null ? (
            <><span className="animate-bounce">👆</span> Pick a piece</>
          ) : canAct ? (
            <><span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span> {isHotSeat ? `${SIDE_LABEL[turnSide]}` : 'Your turn'}</>
          ) : (
            <><span className="animate-pulse">{isOnline || isHotSeat ? '⏳' : '🤖'}</span> {waitingLabel}</>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {playerCount === 2 ? (
            <>
              <span className="text-[11px] text-text-muted whitespace-nowrap">
                {homeCounts[mySeat === 1 ? 1 : 0]}/4 home
              </span>
              <span className="text-xs font-bold" style={{ color: SIDE_COLOR[sides[mySeat === 1 ? 1 : 0]] }}>
                {rosterName(mySeat === 1 ? 2 : 1)}
              </span>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: SIDE_COLOR[sides[mySeat === 1 ? 1 : 0]] }} />
            </>
          ) : (
            sides.map((side, i) => {
              const seat = i + 1;
              if (seat === mySeat && !isHotSeat) return null;
              return (
                <span
                  key={side}
                  title={`${rosterName(seat)} ${homeCounts[i]}/4`}
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background: SIDE_COLOR[side],
                    opacity: turnSeat === seat ? 1 : 0.45,
                    outline: turnSeat === seat ? `2px solid ${SIDE_COLOR[side]}` : undefined,
                    outlineOffset: 1,
                  }}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Board */}
      <div className="flex-shrink-0 w-full flex justify-center">
        <svg viewBox={`0 0 ${W} ${W}`} className="rounded-xl w-full h-auto shadow-2xl"
          style={{ maxWidth: 390, maxHeight: '52vh' }} onClick={handleSvgClick}
          role="img"
          aria-label={`Ludo board. You have ${myHome} of 4 pieces home. ${canAct ? 'Your turn.' : waitingLabel}`}>
          {renderBoard()}
          {renderTokens()}
        </svg>
      </div>

      {/* Dice + Roll */}
      <div className="flex items-center gap-3">
        <DiceFace value={dice} highlight={dice === 6} />
        <button
          onClick={handleRoll}
          disabled={over || !canAct || pendingDice !== null}
          className="bg-accent text-bg font-bold px-6 py-2.5 rounded-xl text-sm hover:opacity-90 active:scale-95 disabled:opacity-30 transition-all shadow-lg shadow-accent/25"
        >
          {pendingDice !== null ? 'Pick a piece ↑' : canAct ? 'Roll!' : isOnline || isHotSeat ? 'Waiting…' : 'AI thinking…'}
        </button>
      </div>

      {pendingDice !== null && movable.length > 1 && (
        <div className="flex gap-1.5 flex-wrap justify-center max-w-[400px]" role="group" aria-label="Choose a piece to move">
          {movable.map(i => {
            const actingPieces = allPieces[turnSeat - 1] ?? myPieces;
            const cur = actingPieces[i];
            const np = advance(cur, pendingDice);
            const dest = cur === -1
              ? 'enter the track'
              : np >= HOME
                ? 'reach home! 🎉'
                : np >= STRETCH_START
                  ? `home stretch ${np - STRETCH_START + 1}/6`
                  : `square ${np}`;
            return (
              <button
                key={i}
                onClick={() => handlePieceClick(i)}
                className="bg-card hover:bg-card-hover text-text text-xs font-semibold px-3 py-2 rounded-xl border border-accent/40 transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Piece {i + 1} → {dest}
              </button>
            );
          })}
        </div>
      )}

      {/* Progress bars */}
      <div className="w-full max-w-[400px] flex flex-col gap-1.5 px-1">
        {sides.map((side, i) => {
          const seat = i + 1;
          const label = seat === mySeat && !isHotSeat
            ? 'You'
            : rosterName(seat).slice(0, 8);
          return (
            <div key={side} className="flex items-center gap-2 text-xs">
              <span className="font-bold w-14 text-right truncate" style={{ color: SIDE_COLOR[side] }}>{label}</span>
              <div className="flex-1 h-2 bg-card rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pcts[i]}%`, background: SIDE_COLOR[side] }} />
              </div>
              <div className="flex gap-0.5 w-14 justify-end">
                {[0,1,2,3].map(j => (
                  <span key={j} className="w-3 h-3 rounded-full border transition-all"
                    style={{
                      background: j < homeCounts[i] ? SIDE_COLOR[side] : 'transparent',
                      borderColor: SIDE_COLOR[side],
                      opacity: j < homeCounts[i] ? 1 : 0.3,
                    }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-text-muted text-center">
        Roll 6 to enter · Tap glowing piece · Safe ✦ squares protect pieces · Get all 4 home to win
      </p>
    </div>
  );
}

function DiceFace({ value, highlight }: { value: number | null; highlight?: boolean }) {
  const pipLayouts: Record<number, [number, number][]> = {
    1: [[50,50]],
    2: [[28,28],[72,72]],
    3: [[28,28],[50,50],[72,72]],
    4: [[28,28],[72,28],[28,72],[72,72]],
    5: [[28,28],[72,28],[50,50],[28,72],[72,72]],
    6: [[28,22],[72,22],[28,50],[72,50],[28,78],[72,78]],
  };
  const pips = value !== null ? (pipLayouts[value] || []) : [];
  return (
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center select-none border-2 transition-all shadow-md ${
      highlight ? 'bg-accent/20 border-accent shadow-accent/30' : 'bg-card border-white/10'
    }`}>
      {value === null ? (
        <span className="text-3xl">🎲</span>
      ) : (
        <svg width="44" height="44" viewBox="0 0 100 100">
          <rect x={2} y={2} width={96} height={96} rx={14}
            fill={highlight ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.04)'} />
          {pips.map(([px, py], i) => (
            <circle key={i} cx={px} cy={py} r={10}
              fill={highlight ? '#f0a83a' : '#cbd5e1'} />
          ))}
        </svg>
      )}
    </div>
  );
}

export default LudoGame;
