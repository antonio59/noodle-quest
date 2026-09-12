/**
 * Server-side move checks for online board games.
 * Validates board shape and that claimed wins match the submitted state.
 * Where previous board + last move are present (chess), also checks legality.
 */

import { Chess } from "chess.js";

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
  if (winner === undefined || winner === 0) return null;
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
  if (winner === undefined || winner === 0) return null;
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
  if (winner === undefined || winner === 0) return null;
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

const CUBE_COLORS = new Set(["W", "Y", "G", "B", "R", "O"]);

function cubeIsSolved(cube: unknown): boolean {
  if (!Array.isArray(cube) || cube.length !== 26) return false;
  // Face normals: +x -x +y -y +z -z
  const normals: [number, number, number][] = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ];
  for (let face = 0; face < 6; face++) {
    const n = normals[face];
    const axis = n.findIndex(c => c !== 0);
    const layer = n[axis];
    const stickers: unknown[] = [];
    for (const cubie of cube) {
      if (!cubie || typeof cubie !== "object") return false;
      const { pos, colors } = cubie as { pos?: unknown; colors?: unknown };
      if (!Array.isArray(pos) || pos.length !== 3) return false;
      if (!Array.isArray(colors) || colors.length !== 6) return false;
      if ((pos as number[])[axis] !== layer) continue;
      stickers.push(colors[face]);
    }
    if (stickers.length !== 9) return false;
    const first = stickers[0];
    if (first === null || !CUBE_COLORS.has(first as string)) return false;
    if (stickers.some(s => s !== first)) return false;
  }
  return true;
}

/** Cube Twist: cubie array; winner requires a solved cube. */
export function validateCubeTwist(
  boardState: unknown,
  winner: unknown,
  seat: Seat,
): string | null {
  if (!boardState || typeof boardState !== "object") return "Missing board state.";
  const { cube, moveCount } = boardState as { cube?: unknown; moveCount?: unknown };
  if (!Array.isArray(cube) || cube.length !== 26) return "Invalid cube.";
  for (const cubie of cube) {
    if (!cubie || typeof cubie !== "object") return "Invalid cubie.";
    const { pos, colors } = cubie as { pos?: unknown; colors?: unknown };
    if (!Array.isArray(pos) || pos.length !== 3) return "Invalid cubie.";
    if (!Array.isArray(colors) || colors.length !== 6) return "Invalid cubie.";
    for (const c of colors) {
      if (c !== null && !CUBE_COLORS.has(c as string)) return "Invalid cubie color.";
    }
  }
  if (moveCount !== undefined && (!isInt(moveCount) || moveCount < 0 || moveCount > 500)) {
    return "Invalid move count.";
  }
  const foreign = rejectForeignWinner(winner, seat);
  if (foreign) return foreign;
  if (winner === undefined || winner === 0) return null;
  if (!cubeIsSolved(cube)) return "Cube is not solved.";
  return null;
}

const LUDO_HOME = 54;

/** Ludo: seat-indexed relative piece arrays; win = all four home. */
export function validateLudo(
  boardState: unknown,
  winner: unknown,
  seat: Seat,
  opts: ValidateOpts = {},
): string | null {
  if (!boardState || typeof boardState !== "object") return "Missing board state.";
  const { pieces, lastRoll, turnSeat } = boardState as {
    pieces?: unknown;
    lastRoll?: unknown;
    turnSeat?: unknown;
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
  if (lastRoll !== undefined && (!isInt(lastRoll) || lastRoll < 1 || lastRoll > 6)) {
    return "Invalid dice roll.";
  }
  if (turnSeat !== undefined && (!isInt(turnSeat) || turnSeat < 1 || turnSeat > pieces.length)) {
    return "Invalid turn seat.";
  }
  const foreign = rejectForeignWinner(winner, seat);
  if (foreign) return foreign;
  if (winner === undefined || winner === 0) return null;
  const won = (pieces[seat - 1] as number[]).every(p => p >= LUDO_HOME);
  if (!won) return "Not all pieces are home.";
  return null;
}

/** UNO: hands map; winner's hand must be empty. */
export function validateUno(
  boardState: unknown,
  winner: unknown,
  seat: Seat,
): string | null {
  if (!boardState || typeof boardState !== "object") return "Missing board state.";
  const { hands, discard } = boardState as { hands?: unknown; discard?: unknown };
  if (!hands || typeof hands !== "object") return "Missing hands.";
  const handMap = hands as Record<string, unknown>;
  for (const key of Object.keys(handMap)) {
    if (!Array.isArray(handMap[key])) return "Invalid hand.";
  }
  if (discard !== undefined && !Array.isArray(discard)) return "Invalid discard.";
  const foreign = rejectForeignWinner(winner, seat);
  if (foreign) return foreign;
  if (winner === undefined || winner === 0) return null;
  const winnerHand = handMap[String(seat)];
  if (!Array.isArray(winnerHand) || winnerHand.length !== 0) {
    return "Winner hand is not empty.";
  }
  return null;
}

/** Scrabble: board + scores; winner must hold the highest positive score. */
export function validateScrabble(
  boardState: unknown,
  winner: unknown,
  seat: Seat,
): string | null {
  if (!boardState || typeof boardState !== "object") return "Missing board state.";
  const { board, scores, racks } = boardState as {
    board?: unknown;
    scores?: unknown;
    racks?: unknown;
  };
  if (!Array.isArray(board)) return "Invalid board.";
  if (!Array.isArray(scores) || scores.length < 2) return "Invalid scores.";
  for (const s of scores) {
    if (typeof s !== "number" || !Number.isFinite(s) || s < 0 || s > 10_000) {
      return "Invalid score.";
    }
  }
  if (racks !== undefined) {
    if (!Array.isArray(racks) || racks.length !== scores.length) return "Invalid racks.";
  }
  const foreign = rejectForeignWinner(winner, seat);
  if (foreign) return foreign;
  if (winner === undefined || winner === 0) return null;
  // Client seats are 0-indexed in scores; winner is 1-indexed playerNumber.
  const idx = seat - 1;
  if (idx < 0 || idx >= scores.length) return "Invalid winner seat.";
  const myScore = scores[idx] as number;
  if (myScore <= 0) return "Winner score too low.";
  const best = Math.max(...(scores as number[]));
  if (myScore < best) return "Winner does not lead on score.";
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
      return validateCubeTwist(boardState, winner, seat);
    case "ludo":
      return validateLudo(boardState, winner, seat, opts);
    case "uno":
      return validateUno(boardState, winner, seat);
    case "scrabble":
      return validateScrabble(boardState, winner, seat);
    default:
      return null;
  }
}
