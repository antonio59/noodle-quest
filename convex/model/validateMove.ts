/**
 * Server-side move checks for online board games.
 * Validates board shape and that claimed wins match the submitted state.
 * Where previous board + last move are present, also checks legality.
 */

import { Chess } from "chess.js";
import {
  UNO_COLORS,
  isBingoCard,
  isBingoMarks,
  isCubeShape,
  isLegalLudoResult,
  isLegalSnakesResult,
  isOneCubeTwist,
  isProvableBingoWin,
  isScrabbleLetter,
  cubeIsSolved,
  isUnoCard,
  unoCanPlay,
  SCRABBLE_BOARD_SIZE,
  SNL_BOARD_SIZE,
  LUDO_HOME,
  type Cube,
  type UnoCard,
} from "./gameRules";

type Seat = number;

export type ValidateOpts = {
  previousBoardState?: unknown;
  playerCount?: number;
};

function isInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n);
}

function rejectForeignWinner(winner: unknown, seat: Seat): string | null {
  if (winner === undefined || winner === 0) return null;
  if (winner !== seat) return "Winner must be the mover.";
  return null;
}

/** Connect Four: 6×7 board of null | 'red' | 'yellow'. */
export function validateConnectFour(
  boardState: unknown,
  winner: unknown,
  seat: Seat,
): string | null {
  if (!boardState || typeof boardState !== "object") return "Missing board state.";
  const board = (boardState as { board?: unknown }).board;
  if (!Array.isArray(board) || board.length !== 6) return "Invalid board.";
  for (const row of board) {
    if (!Array.isArray(row) || row.length !== 7) return "Invalid board.";
    for (const cell of row) {
      if (cell !== null && cell !== "red" && cell !== "yellow") return "Invalid cell.";
    }
  }
  const foreign = rejectForeignWinner(winner, seat);
  if (foreign) return foreign;
  if (winner === undefined) return null;
  if (winner === 0) {
    const full = (board as (string | null)[][]).every(row => row.every(c => c !== null));
    return full ? null : "Board is not full.";
  }
  const color = seat === 1 ? "red" : "yellow";
  if (!hasConnectFourWin(board as (string | null)[][], color)) {
    return "Board does not show a win.";
  }
  return null;
}

function hasConnectFourWin(board: (string | null)[][], color: string): boolean {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      if (board[r][c] !== color) continue;
      for (const [dr, dc] of dirs) {
        let n = 1;
        for (let k = 1; k < 4; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= 6 || cc < 0 || cc >= 7 || board[rr][cc] !== color) break;
          n++;
        }
        if (n >= 4) return true;
      }
    }
  }
  return false;
}

/** Score Four: flat 64-cell board of 0|1|2. */
export function validateScoreFour(
  boardState: unknown,
  winner: unknown,
  seat: Seat,
): string | null {
  if (!boardState || typeof boardState !== "object") return "Missing board state.";
  const board = (boardState as { board?: unknown }).board;
  if (!Array.isArray(board) || board.length !== 64) return "Invalid board.";
  for (const cell of board) {
    if (cell !== 0 && cell !== 1 && cell !== 2) return "Invalid cell.";
  }
  const foreign = rejectForeignWinner(winner, seat);
  if (foreign) return foreign;
  if (winner === undefined) return null;
  if (winner === 0) {
    return (board as number[]).every(c => c !== 0) ? null : "Board is not full.";
  }
  if (!hasScoreFourWin(board as number[], seat as 1 | 2)) {
    return "Board does not show a win.";
  }
  return null;
}

function hasScoreFourWin(b: number[], player: 1 | 2): boolean {
  const N = 4;
  const idx = (x: number, y: number, z: number) => x + z * N + y * N * N;
  const dirs = [
    [1, 0, 0], [0, 1, 0], [0, 0, 1],
    [1, 1, 0], [1, -1, 0], [1, 0, 1], [1, 0, -1], [0, 1, 1], [0, 1, -1],
    [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
  ];
  for (const [dx, dy, dz] of dirs) {
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) {
        for (let z = 0; z < N; z++) {
          const ex = x + dx * 3;
          const ey = y + dy * 3;
          const ez = z + dz * 3;
          if (ex < 0 || ex >= N || ey < 0 || ey >= N || ez < 0 || ez >= N) continue;
          if ([0, 1, 2, 3].every(i => b[idx(x + dx * i, y + dy * i, z + dz * i)] === player)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/** Tic-tac-toe: flat length-9 board of null | 'X' | 'O'. */
export function validateTicTacToe(
  boardState: unknown,
  winner: unknown,
  seat: Seat,
): string | null {
  if (!boardState || typeof boardState !== "object") return "Missing board state.";
  const board = (boardState as { board?: unknown }).board;
  if (!Array.isArray(board) || board.length !== 9) return "Invalid board.";
  for (const cell of board) {
    if (cell !== null && cell !== "X" && cell !== "O") return "Invalid cell.";
  }
  const foreign = rejectForeignWinner(winner, seat);
  if (foreign) return foreign;
  if (winner === undefined) return null;
  if (winner === 0) {
    return (board as (string | null)[]).every(c => c !== null) ? null : "Board is not full.";
  }
  const mark = seat === 1 ? "X" : "O";
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  const cells = board as (string | null)[];
  const won = lines.some(line => line.every(i => cells[i] === mark));
  if (!won) return "Board does not show a win.";
  return null;
}

/** Chess: FEN + optional lastFrom/lastTo; checkmate/draw via chess.js. */
export function validateChess(
  boardState: unknown,
  winner: unknown,
  seat: Seat,
  opts: ValidateOpts = {},
): string | null {
  if (!boardState || typeof boardState !== "object") return "Missing board state.";
  const { fen, lastFrom, lastTo } = boardState as {
    fen?: unknown;
    lastFrom?: unknown;
    lastTo?: unknown;
  };
  if (typeof fen !== "string" || !fen.trim()) return "Missing FEN.";

  let game: Chess;
  try {
    game = new Chess(fen);
  } catch {
    return "Invalid FEN.";
  }

  const prev = opts.previousBoardState as { fen?: string } | null | undefined;
  if (
    prev &&
    typeof prev.fen === "string" &&
    typeof lastFrom === "string" &&
    typeof lastTo === "string"
  ) {
    try {
      const before = new Chess(prev.fen);
      const expected = seat === 1 ? "w" : "b";
      if (before.turn() !== expected) return "Not your turn on the board.";
      const move = before.move({
        from: lastFrom,
        to: lastTo,
        promotion: "q",
      });
      if (!move) return "Illegal chess move.";
      // Compare piece placement + side to move (ignore clocks/ep nuances via board fen parts).
      if (before.fen().split(" ").slice(0, 4).join(" ") !== fen.split(" ").slice(0, 4).join(" ")) {
        return "Board does not match move.";
      }
    } catch {
      return "Illegal chess move.";
    }
  }

  if (winner === undefined) return null;
  if (winner === 0) {
    if (!game.isGameOver() || game.isCheckmate()) return "Not a draw position.";
    return null;
  }
  if (winner !== seat) return "Winner must be the mover.";
  if (!game.isCheckmate()) return "Board does not show checkmate.";
  // After the winning move, it is the opponent's turn and they are mated.
  const winnerColor = seat === 1 ? "w" : "b";
  if (game.turn() === winnerColor) return "Checkmate side mismatch.";
  return null;
}

type CheckerPiece = { color: "red" | "black"; king: boolean };
type CheckerBoard = (CheckerPiece | null)[][];

function checkersCount(board: CheckerBoard, color: "red" | "black"): number {
  let n = 0;
  for (const row of board) for (const cell of row) if (cell?.color === color) n++;
  return n;
}

function checkersDirs(p: CheckerPiece): number[][] {
  if (p.king) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return p.color === "red" ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
}

function checkersHasMove(board: CheckerBoard, color: "red" | "black"): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;
      for (const [dr, dc] of checkersDirs(p)) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !board[nr][nc]) return true;
        const jr = r + 2 * dr, jc = c + 2 * dc;
        if (
          jr >= 0 && jr < 8 && jc >= 0 && jc < 8 &&
          board[nr]?.[nc] && board[nr][nc]!.color !== color && !board[jr][jc]
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

/** Checkers: 8×8 of null | {color, king}; win = opponent empty or immobile. */
export function validateCheckers(
  boardState: unknown,
  winner: unknown,
  seat: Seat,
): string | null {
  if (!boardState || typeof boardState !== "object") return "Missing board state.";
  const board = (boardState as { board?: unknown }).board;
  if (!Array.isArray(board) || board.length !== 8) return "Invalid board.";
  for (const row of board) {
    if (!Array.isArray(row) || row.length !== 8) return "Invalid board.";
    for (const cell of row) {
      if (cell === null) continue;
      if (!cell || typeof cell !== "object") return "Invalid cell.";
      const { color, king } = cell as { color?: unknown; king?: unknown };
      if (color !== "red" && color !== "black") return "Invalid cell.";
      if (typeof king !== "boolean") return "Invalid cell.";
    }
  }
  const b = board as CheckerBoard;
  if (winner === undefined) return null;
  if (winner === 0) return "Checkers has no draws.";
  if (!isInt(winner) || (winner !== 1 && winner !== 2)) return "Invalid winner.";

  const winColor: "red" | "black" = winner === 1 ? "red" : "black";
  const loseColor: "red" | "black" = winColor === "red" ? "black" : "red";
  const lost =
    checkersCount(b, loseColor) === 0 || !checkersHasMove(b, loseColor);
  if (!lost) return "Board does not show a win.";
  // Prefer self-win; allow opponent win only if mover's army is actually gone/stuck.
  if (winner !== seat) {
    const moverColor: "red" | "black" = seat === 1 ? "red" : "black";
    if (checkersCount(b, moverColor) > 0 && checkersHasMove(b, moverColor)) {
      return "Winner must be the mover.";
    }
  }
  return null;
}

/**
 * Cube Twist race: the submitted `cube` must be exactly one quarter-turn
 * away from the mover's stored cube; a win claim requires it solved.
 * There is no turn — both players race their own copy of the scramble.
 */
export function validateCubeTwist(
  boardState: unknown,
  winner: unknown,
  seat: Seat,
  opts: ValidateOpts = {},
): string | null {
  if (!boardState || typeof boardState !== "object") return "Missing board state.";
  const { cube, moveCount } = boardState as { cube?: unknown; moveCount?: unknown };
  if (!isCubeShape(cube)) return "Invalid cube.";
  if (moveCount !== undefined && (!isInt(moveCount) || moveCount < 0 || moveCount > 2000)) {
    return "Invalid move count.";
  }
  const prev = opts.previousBoardState as { cubes?: Record<string, Cube> } | null | undefined;
  const prevCube = prev?.cubes?.[String(seat)];
  if (isCubeShape(prevCube) && !isOneCubeTwist(prevCube, cube)) {
    return "Not a single legal twist.";
  }
  const foreign = rejectForeignWinner(winner, seat);
  if (foreign) return foreign;
  if (winner === undefined || winner === 0) return null;
  if (!cubeIsSolved(cube)) return "Cube is not solved.";
  return null;
}

/** Ludo: seat-indexed relative piece arrays; win = all four home. The
 *  result must be a legal consequence of the server-issued roll. */
export function validateLudo(
  boardState: unknown,
  winner: unknown,
  seat: Seat,
  opts: ValidateOpts = {},
): string | null {
  if (!boardState || typeof boardState !== "object") return "Missing board state.";
  const { pieces, lastRoll } = boardState as {
    pieces?: unknown;
    lastRoll?: unknown;
  };
  const n = opts.playerCount ?? (Array.isArray(pieces) ? pieces.length : 0);
  if (!Array.isArray(pieces) || pieces.length < 2 || pieces.length > 4) return "Invalid pieces.";
  if (n > 0 && pieces.length !== n) return "Piece roster mismatch.";
  for (const seatPieces of pieces) {
    if (!Array.isArray(seatPieces) || seatPieces.length !== 4) return "Invalid pieces.";
    for (const p of seatPieces) {
      if (!isInt(p) || p < -1 || p > LUDO_HOME) return "Invalid piece position.";
    }
  }
  if (!isInt(lastRoll) || lastRoll < 1 || lastRoll > 6) {
    return "Invalid dice roll.";
  }
  // Every piece move must be the legal result of the issued roll.
  const prev = opts.previousBoardState as { pieces?: unknown } | null | undefined;
  const prevPieces = Array.isArray(prev?.pieces)
    ? (prev!.pieces as number[][])
    : Array.from({ length: n }, () => [-1, -1, -1, -1]);
  if (prevPieces.length === pieces.length && seat - 1 < pieces.length) {
    if (!isLegalLudoResult(prevPieces, pieces as number[][], seat - 1, lastRoll)) {
      return "Illegal ludo move.";
    }
  }
  const foreign = rejectForeignWinner(winner, seat);
  if (foreign) return foreign;
  if (winner === undefined || winner === 0) return null;
  const won = (pieces[seat - 1] as number[]).every(p => p >= LUDO_HOME);
  if (!won) return "Not all pieces are home.";
  return null;
}

/**
 * UNO: a regular move plays exactly one card. The new discard top must be
 * a card from the mover's stored hand, legally playable on the previous
 * top card, and the submitted hand must equal stored minus that card.
 * Draws, passes, and deals are action moves handled in multiplayer.ts.
 */
export function validateUno(
  boardState: unknown,
  winner: unknown,
  seat: Seat,
  opts: ValidateOpts = {},
): string | null {
  if (!boardState || typeof boardState !== "object") return "Missing board state.";
  const { hands, discard, color } = boardState as {
    hands?: unknown;
    discard?: unknown;
    color?: unknown;
  };
  if (!hands || typeof hands !== "object") return "Missing hands.";
  if (!Array.isArray(discard) || discard.length < 1) return "Invalid discard.";

  const prev = opts.previousBoardState as {
    hands?: Record<string, UnoCard[]>;
    discard?: UnoCard[];
    color?: UnoCard["color"];
  } | null | undefined;
  const storedHand = prev?.hands?.[String(seat)];
  const prevDiscard = prev?.discard;
  if (!Array.isArray(storedHand) || !Array.isArray(prevDiscard)) {
    return "Game not dealt.";
  }

  const submittedHand = (hands as Record<string, unknown>)[String(seat)];
  if (!Array.isArray(submittedHand) || !submittedHand.every(isUnoCard)) return "Invalid hand.";

  // Discard grew by exactly one card, appended.
  if (!discard.every(isUnoCard)) return "Invalid discard.";
  if (discard.length !== prevDiscard.length + 1) return "Invalid discard.";
  for (let i = 0; i < prevDiscard.length; i++) {
    const a = prevDiscard[i] as UnoCard;
    const b = discard[i] as UnoCard;
    if (a.id !== b.id) return "Discard history changed.";
  }
  const played = discard[discard.length - 1] as UnoCard;
  if (!isUnoCard(played)) return "Invalid card.";

  // The played card must come from the mover's stored hand, and the new
  // hand must equal the old one minus exactly that card (compared by id).
  const remaining = storedHand.map(c => c.id);
  const playIdx = remaining.indexOf(played.id);
  if (playIdx === -1) return "Card not in hand.";
  remaining.splice(playIdx, 1);
  const submittedIds = submittedHand.map(c => c.id).sort((a, b) => a - b);
  const expectedIds = [...remaining].sort((a, b) => a - b);
  if (submittedIds.length !== expectedIds.length || submittedIds.some((id, i) => id !== expectedIds[i])) {
    return "Hand does not match play.";
  }

  const prevTop = prevDiscard[prevDiscard.length - 1];
  const prevColor = (prev?.color ?? "red") as (typeof UNO_COLORS)[number];
  if (!unoCanPlay(played, prevTop, prevColor)) return "Card is not playable.";

  if (!(UNO_COLORS as readonly string[]).includes(color as string)) return "Invalid color.";
  // Non-wild cards must keep their own color as the active color.
  if (played.type !== "wild" && played.type !== "wild4" && color !== played.color) {
    return "Invalid color.";
  }

  const foreign = rejectForeignWinner(winner, seat);
  if (foreign) return foreign;
  if (winner === undefined || winner === 0) return null;
  if (submittedHand.length !== 0) return "Winner hand is not empty.";
  return null;
}

/**
 * Scrabble: the board may only gain tiles; the mover's submitted rack plus
 * the newly placed letters must equal their stored rack (the server then
 * refills from the hidden pool); only the mover's score may change.
 */
export function validateScrabble(
  boardState: unknown,
  winner: unknown,
  seat: Seat,
  opts: ValidateOpts = {},
): string | null {
  if (!boardState || typeof boardState !== "object") return "Missing board state.";
  const { board, scores, racks } = boardState as {
    board?: unknown;
    scores?: unknown;
    racks?: unknown;
  };
  if (!Array.isArray(board) || board.length !== SCRABBLE_BOARD_SIZE) return "Invalid board.";
  for (const row of board) {
    if (!Array.isArray(row) || row.length !== SCRABBLE_BOARD_SIZE) return "Invalid board.";
    for (const cell of row) {
      if (cell !== null && !isScrabbleLetter(cell)) return "Invalid tile.";
    }
  }
  if (!Array.isArray(scores) || scores.length < 2) return "Invalid scores.";
  for (const s of scores) {
    if (typeof s !== "number" || !Number.isFinite(s) || s < 0 || s > 10_000) {
      return "Invalid score.";
    }
  }
  if (!Array.isArray(racks) || racks.length !== scores.length) return "Invalid racks.";

  const prev = opts.previousBoardState as {
    board?: (string | null)[][];
    racks?: string[][];
    scores?: number[];
  } | null | undefined;

  if (!Array.isArray(prev?.board) || !Array.isArray(prev?.racks) || !Array.isArray(prev?.scores)) {
    return "Game not dealt.";
  }

  const idx = seat - 1;
  if (idx < 0 || idx >= prev.racks.length) return "Invalid seat.";

  // Board is append-only: existing tiles can never move or disappear.
  const placed: string[] = [];
  const prevBoard = prev.board as (string | null)[][];
  for (let r = 0; r < SCRABBLE_BOARD_SIZE; r++) {
    for (let c = 0; c < SCRABBLE_BOARD_SIZE; c++) {
      const before = prevBoard[r]?.[c] ?? null;
      const after = (board as (string | null)[][])[r][c];
      if (before !== null && before !== after) return "Board history changed.";
      if (before === null && after !== null) placed.push(after as string);
    }
  }

  // The mover's rack minus what they placed is what remains. A pass
  // (placed = []) therefore requires an unchanged rack.
  const myRack = (racks as unknown[])[idx];
  if (!Array.isArray(myRack) || !myRack.every(isScrabbleLetter)) return "Invalid rack.";
  const count = (arr: string[]) => {
    const m = new Map<string, number>();
    for (const l of arr) m.set(l, (m.get(l) ?? 0) + 1);
    return m;
  };
  const expected = count(prev.racks[idx]);
  for (const l of placed) {
    const n = expected.get(l) ?? 0;
    if (n === 0) return "Placed tile not in rack.";
    expected.set(l, n - 1);
  }
  const expectedRack: string[] = [];
  for (const [l, n] of expected) for (let i = 0; i < n; i++) expectedRack.push(l);
  const have = count(myRack as string[]);
  for (const [l, n] of count(expectedRack)) {
    if (have.get(l) !== n) return "Rack does not match play.";
  }

  // Only the mover's score may change, by a sane amount.
  for (let i = 0; i < scores.length; i++) {
    const delta = (scores as number[])[i] - (prev.scores[i] ?? 0);
    if (i === idx) {
      if (delta < 0 || delta > 1000) return "Invalid score change.";
    } else if (delta !== 0) {
      return "Only the mover's score may change.";
    }
  }

  const foreign = rejectForeignWinner(winner, seat);
  if (foreign) return foreign;
  if (winner === undefined || winner === 0) return null;
  // Client seats are 0-indexed in scores; winner is 1-indexed playerNumber.
  const myScore = scores[idx] as number;
  if (myScore <= 0) return "Winner score too low.";
  const best = Math.max(...(scores as number[]));
  if (myScore < best) return "Winner does not lead on score.";
  return null;
}

/** Snakes & Ladders: positions must equal resolve(prev + server roll). */
export function validateSnakesLadders(
  boardState: unknown,
  winner: unknown,
  seat: Seat,
  opts: ValidateOpts = {},
): string | null {
  if (!boardState || typeof boardState !== "object") return "Missing board state.";
  const { positions, lastRoll } = boardState as {
    positions?: unknown;
    lastRoll?: unknown;
  };
  const n = opts.playerCount ?? (Array.isArray(positions) ? positions.length : 2);
  if (!Array.isArray(positions) || positions.length !== n) return "Invalid positions.";
  for (const p of positions) {
    if (!isInt(p) || p < 0 || p > SNL_BOARD_SIZE) return "Invalid position.";
  }
  if (!isInt(lastRoll) || lastRoll < 1 || lastRoll > 6) return "Invalid dice roll.";

  const prev = opts.previousBoardState as { positions?: unknown } | null | undefined;
  const prevPositions = Array.isArray(prev?.positions)
    ? (prev!.positions as number[])
    : Array.from({ length: n }, () => 0);
  if (prevPositions.length === positions.length && seat - 1 < positions.length) {
    if (!isLegalSnakesResult(prevPositions, positions as number[], seat - 1, lastRoll)) {
      return "Illegal move.";
    }
  }

  const foreign = rejectForeignWinner(winner, seat);
  if (foreign) return foreign;
  if (winner === undefined || winner === 0) return null;
  if ((positions as number[])[seat - 1] < SNL_BOARD_SIZE) return "Not at square 100.";
  return null;
}

/**
 * Bingo: the called list may only grow (and only the host may grow it);
 * a win claim must carry the player's card and marks, and the marks must
 * prove a line from called numbers.
 */
export function validateBingo(
  boardState: unknown,
  winner: unknown,
  seat: Seat,
  opts: ValidateOpts = {},
): string | null {
  if (!boardState || typeof boardState !== "object") return "Missing board state.";
  const { called, card, marks } = boardState as {
    called?: unknown;
    card?: unknown;
    marks?: unknown;
  };
  if (!Array.isArray(called) || called.length > 75) return "Invalid called list.";
  for (const c of called) {
    if (!isInt(c) || c < 1 || c > 75) return "Invalid call.";
  }
  if (new Set(called).size !== called.length) return "Duplicate calls.";

  const prev = opts.previousBoardState as { called?: unknown } | null | undefined;
  const prevCalled = Array.isArray(prev?.called) ? (prev!.called as number[]) : [];
  if (
    (called as number[]).length < prevCalled.length ||
    !prevCalled.every((v, i) => (called as number[])[i] === v)
  ) {
    return "Called history changed.";
  }
  // Non-host seats may claim a win but may never add calls.
  if (seat !== 1 && (called as number[]).length !== prevCalled.length) {
    return "Only the host calls.";
  }

  const foreign = rejectForeignWinner(winner, seat);
  if (foreign) return foreign;
  if (winner === undefined || winner === 0) return null;
  if (!isBingoCard(card) || !isBingoMarks(marks)) return "Missing card proof.";
  if (!isProvableBingoWin(card, marks, called as number[])) {
    return "Card does not show a win.";
  }
  return null;
}

const VALIDATED_GAMES = new Set([
  "connect-four",
  "score-four",
  "tic-tac-toe",
  "chess",
  "checkers",
  "cube-twist",
  "ludo",
  "uno",
  "scrabble",
  "bingo",
  "snakes-ladders",
]);

export function validateMoveForGame(
  gameId: string,
  boardState: unknown,
  winner: unknown,
  seat: Seat,
  opts: ValidateOpts = {},
): string | null {
  if (winner !== undefined && !isInt(winner)) return "Invalid winner.";
  if (VALIDATED_GAMES.has(gameId) && (boardState == null || typeof boardState !== "object")) {
    if (winner !== undefined) return "Missing board state.";
    return null;
  }
  switch (gameId) {
    case "connect-four":
      return validateConnectFour(boardState, winner, seat);
    case "score-four":
      return validateScoreFour(boardState, winner, seat);
    case "tic-tac-toe":
      return validateTicTacToe(boardState, winner, seat);
    case "chess":
      return validateChess(boardState, winner, seat, opts);
    case "checkers":
      return validateCheckers(boardState, winner, seat);
    case "cube-twist":
      return validateCubeTwist(boardState, winner, seat, opts);
    case "ludo":
      return validateLudo(boardState, winner, seat, opts);
    case "snakes-ladders":
      return validateSnakesLadders(boardState, winner, seat, opts);
    case "uno":
      return validateUno(boardState, winner, seat, opts);
    case "scrabble":
      return validateScrabble(boardState, winner, seat, opts);
    case "bingo":
      return validateBingo(boardState, winner, seat, opts);
    default:
      return null;
  }
}
