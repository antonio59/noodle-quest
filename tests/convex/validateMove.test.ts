import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  validateConnectFour,
  validateScoreFour,
  validateTicTacToe,
  validateChess,
  validateCheckers,
  validateCubeTwist,
  validateLudo,
  validateUno,
  validateScrabble,
  validateMoveForGame,
} from '../../convex/model/validateMove';

describe('validateMove', () => {
  it('accepts a connect-four win for the mover', () => {
    const board = Array.from({ length: 6 }, () => Array(7).fill(null));
    for (let c = 0; c < 4; c++) board[5][c] = 'red';
    expect(validateConnectFour({ board }, 1, 1)).toBeNull();
  });

  it('rejects a connect-four win claim without a line', () => {
    const board = Array.from({ length: 6 }, () => Array(7).fill(null));
    board[5][0] = 'red';
    expect(validateConnectFour({ board }, 1, 1)).toBe('Board does not show a win.');
  });

  it('accepts score-four draw claim', () => {
    const board = Array(64).fill(0);
    expect(validateScoreFour({ board }, 0, 1)).toBeNull();
  });

  it('accepts tic-tac-toe X win on flat board', () => {
    const board = ['X', 'X', 'X', 'O', 'O', null, null, null, null];
    expect(validateTicTacToe({ board }, 1, 1)).toBeNull();
  });

  it('rejects winner without board for validated games', () => {
    expect(validateMoveForGame('chess', null, 1, 1)).toBe('Missing board state.');
    expect(validateMoveForGame('ludo', undefined, 1, 1)).toBe('Missing board state.');
  });

  it('routes unknown games as pass-through', () => {
    expect(validateMoveForGame('bingo', {}, undefined, 1)).toBeNull();
  });
});

describe('validateChess', () => {
  it('accepts a legal move from previous FEN', () => {
    const before = new Chess();
    const from = 'e2';
    const to = 'e4';
    before.move({ from, to });
    expect(
      validateChess(
        { fen: before.fen(), lastFrom: from, lastTo: to },
        undefined,
        1,
        { previousBoardState: { fen: new Chess().fen() } },
      ),
    ).toBeNull();
  });

  it('rejects an illegal move from previous FEN', () => {
    expect(
      validateChess(
        { fen: new Chess().fen(), lastFrom: 'e2', lastTo: 'e5' },
        undefined,
        1,
        { previousBoardState: { fen: new Chess().fen() } },
      ),
    ).toBe('Illegal chess move.');
  });

  it('rejects checkmate claim on a quiet position', () => {
    expect(
      validateChess({ fen: new Chess().fen() }, 1, 1),
    ).toBe('Board does not show checkmate.');
  });
});

describe('validateCheckers', () => {
  it('accepts a win when opponent has no pieces', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[5][0] = { color: 'red', king: false };
    expect(validateCheckers({ board }, 1, 1)).toBeNull();
  });

  it('rejects a win when both sides still have moves', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[5][0] = { color: 'red', king: false };
    board[2][1] = { color: 'black', king: false };
    expect(validateCheckers({ board }, 1, 1)).toBe('Board does not show a win.');
  });
});

describe('validateCubeTwist', () => {
  function solvedCube() {
    // 26 non-center cubies matching cube-twist/logic newCube layout.
    const colors = ['R', 'O', 'W', 'Y', 'G', 'B'] as const;
    const cube = [];
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          const cols: (string | null)[] = [null, null, null, null, null, null];
          if (x === 1) cols[0] = colors[0];
          if (x === -1) cols[1] = colors[1];
          if (y === 1) cols[2] = colors[2];
          if (y === -1) cols[3] = colors[3];
          if (z === 1) cols[4] = colors[4];
          if (z === -1) cols[5] = colors[5];
          cube.push({ pos: [x, y, z], colors: cols });
        }
      }
    }
    return cube;
  }

  it('accepts a solved win', () => {
    expect(validateCubeTwist({ cube: solvedCube(), moveCount: 12 }, 1, 1)).toBeNull();
  });

  it('rejects win on unsolved cube', () => {
    const cube = solvedCube();
    const faceCubie = cube.find(c => c.pos[0] === 1 && c.colors[0] === 'R');
    expect(faceCubie).toBeTruthy();
    faceCubie!.colors[0] = 'G';
    expect(validateCubeTwist({ cube, moveCount: 3 }, 1, 1)).toBe('Cube is not solved.');
  });
});

describe('validateLudo', () => {
  it('accepts all-home win', () => {
    const pieces = [
      [54, 54, 54, 54],
      [-1, -1, -1, -1],
    ];
    expect(validateLudo({ pieces, lastRoll: 3, turnSeat: 1 }, 1, 1, { playerCount: 2 })).toBeNull();
  });

  it('rejects win when pieces remain', () => {
    const pieces = [
      [54, 54, 10, -1],
      [-1, -1, -1, -1],
    ];
    expect(validateLudo({ pieces }, 1, 1, { playerCount: 2 })).toBe('Not all pieces are home.');
  });
});

describe('validateUno', () => {
  it('accepts empty-hand win', () => {
    expect(
      validateUno({ hands: { '1': [], '2': [{ id: 'x' }] }, discard: [] }, 1, 1),
    ).toBeNull();
  });

  it('rejects win with cards remaining', () => {
    expect(
      validateUno({ hands: { '1': [{ id: 'x' }], '2': [] } }, 1, 1),
    ).toBe('Winner hand is not empty.');
  });
});

describe('validateScrabble', () => {
  it('accepts leading score win', () => {
    expect(
      validateScrabble({ board: [[]], scores: [120, 40], racks: [[], []] }, 1, 1),
    ).toBeNull();
  });

  it('rejects trailing score win', () => {
    expect(
      validateScrabble({ board: [[]], scores: [40, 120], racks: [[], []] }, 1, 1),
    ).toBe('Winner does not lead on score.');
  });
});
