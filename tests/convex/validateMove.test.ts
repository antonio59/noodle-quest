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
  validateBingo,
  validateSnakesLadders,
  validateMoveForGame,
} from '../../convex/model/validateMove';
import {
  applyCubeMove,
  cubeIsSolved,
  dealScrabble,
  dealUno,
  isOneCubeTwist,
  newCube,
  scrambleCube,
  type UnoCard,
} from '../../convex/model/gameRules';

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
    const board = Array.from({ length: 64 }, (_, i) => (i % 2) + 1);
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
    expect(validateMoveForGame('word-search', {}, undefined, 1)).toBeNull();
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
  const base: number[][] = [[-1, -1, -1, -1], [-1, -1, -1, -1]];

  it('accepts all-home win after a legal finishing move', () => {
    const prev = [[54, 54, 54, 53], [-1, -1, -1, -1]];
    const pieces = [[54, 54, 54, 54], [-1, -1, -1, -1]];
    expect(
      validateLudo({ pieces, lastRoll: 1 }, 1, 1, { playerCount: 2, previousBoardState: { pieces: prev } }),
    ).toBeNull();
  });

  it('rejects win when pieces remain', () => {
    const prev = [[54, 54, 4, -1], [-1, -1, -1, -1]];
    const pieces = [[54, 54, 10, -1], [-1, -1, -1, -1]];
    expect(
      validateLudo({ pieces, lastRoll: 6 }, 1, 1, { playerCount: 2, previousBoardState: { pieces: prev } }),
    ).toBe('Not all pieces are home.');
  });

  it('accepts leaving base on a 6', () => {
    const pieces = [[0, -1, -1, -1], [-1, -1, -1, -1]];
    expect(
      validateLudo({ pieces, lastRoll: 6 }, undefined, 1, { playerCount: 2, previousBoardState: { pieces: base } }),
    ).toBeNull();
  });

  it('rejects leaving base without a 6', () => {
    const pieces = [[0, -1, -1, -1], [-1, -1, -1, -1]];
    expect(
      validateLudo({ pieces, lastRoll: 5 }, 1, 1, { playerCount: 2, previousBoardState: { pieces: base } }),
    ).toBe('Illegal ludo move.');
  });

  it('rejects moving two pieces in one roll', () => {
    const prev = [[3, 8, -1, -1], [-1, -1, -1, -1]];
    const pieces = [[5, 10, -1, -1], [-1, -1, -1, -1]];
    expect(
      validateLudo({ pieces, lastRoll: 2 }, 1, 1, { playerCount: 2, previousBoardState: { pieces: prev } }),
    ).toBe('Illegal ludo move.');
  });

  it('accepts a capture sending the victim back to base', () => {
    // Red (entry 0) lands on relative 5 → absolute 5. Blue (entry 24) at
    // relative 29 → absolute (24+29)%48 = 5. Captured → -1.
    const prev = [[4, -1, -1, -1], [29, -1, -1, -1]];
    const pieces = [[5, -1, -1, -1], [-1, -1, -1, -1]];
    expect(
      validateLudo({ pieces, lastRoll: 1 }, undefined, 1, { playerCount: 2, previousBoardState: { pieces: prev } }),
    ).toBeNull();
  });

  it('rejects knocking off a piece on a safe square', () => {
    // Absolute 8 is safe: blue relative 32 → (24+32)%48 = 8.
    const prev = [[7, -1, -1, -1], [32, -1, -1, -1]];
    const pieces = [[8, -1, -1, -1], [-1, -1, -1, -1]];
    expect(
      validateLudo({ pieces, lastRoll: 1 }, 1, 1, { playerCount: 2, previousBoardState: { pieces: prev } }),
    ).toBe('Illegal ludo move.');
  });
});

describe('validateSnakesLadders', () => {
  it('accepts a plain move', () => {
    expect(
      validateSnakesLadders({ positions: [3, 0], lastRoll: 3 }, undefined, 1, {
        playerCount: 2, previousBoardState: { positions: [0, 0] },
      }),
    ).toBeNull();
  });

  it('resolves ladders and snakes', () => {
    expect(
      validateSnakesLadders({ positions: [38, 0], lastRoll: 1 }, undefined, 1, {
        playerCount: 2, previousBoardState: { positions: [0, 0] },
      }),
    ).toBeNull(); // 1 → ladder → 38
    expect(
      validateSnakesLadders({ positions: [6, 20], lastRoll: 2 }, 2, 2, {
        playerCount: 2, previousBoardState: { positions: [0, 18] },
      }),
    ).toBe('Illegal move.'); // 18 + 2 = 20, not 6
  });

  it('requires exact roll to finish', () => {
    expect(
      validateSnakesLadders({ positions: [98, 0], lastRoll: 4 }, undefined, 1, {
        playerCount: 2, previousBoardState: { positions: [98, 0] },
      }),
    ).toBeNull(); // overshoot → stays at 98
  });

  it('accepts the win at 100', () => {
    expect(
      validateSnakesLadders({ positions: [100, 0], lastRoll: 3 }, 1, 1, {
        playerCount: 2, previousBoardState: { positions: [97, 0] },
      }),
    ).toBeNull();
  });
});

describe('validateUno', () => {
  const num = (id: number, color = 'red', symbol = '5'): UnoCard => ({ color: color as UnoCard['color'], symbol, type: 'number', id });
  const dealt = (hand: UnoCard[], top: UnoCard, color = 'red') => ({
    hands: { '1': hand, '2': [num(90, 'blue', '7')] },
    discard: [top],
    color,
  });

  it('accepts a legal play and empty-hand win', () => {
    const played = num(1, 'red', '5');
    expect(
      validateUno(
        { hands: { '1': [], '2': [] }, discard: [num(50), played], color: 'red' },
        1, 1,
        { previousBoardState: dealt([played], num(50)) },
      ),
    ).toBeNull();
  });

  it('rejects a card that was never in hand', () => {
    const prev = dealt([num(1), num(2)], num(50));
    expect(
      validateUno(
        { hands: { '1': [num(1)] }, discard: [num(50), num(999, 'red', '5')] },
        undefined, 1,
        { previousBoardState: prev },
      ),
    ).toBe('Card not in hand.');
  });

  it('rejects a non-matching play', () => {
    const bad = num(3, 'blue', '9');
    const prev = dealt([num(1), bad], num(50), 'red');
    expect(
      validateUno(
        { hands: { '1': [num(1)] }, discard: [num(50), bad], color: 'blue' },
        undefined, 1,
        { previousBoardState: prev },
      ),
    ).toBe('Card is not playable.');
  });

  it('rejects a hand that kept the played card', () => {
    const played = num(1, 'red', '5');
    const kept = num(2, 'red', '7');
    const prev = dealt([played, kept], num(50));
    expect(
      validateUno(
        { hands: { '1': [played, kept] }, discard: [num(50), played], color: 'red' },
        undefined, 1,
        { previousBoardState: prev },
      ),
    ).toBe('Hand does not match play.');
  });

  it('rejects a win claim with cards remaining', () => {
    const played = num(1, 'red', '5');
    const prev = dealt([played, num(2)], num(50));
    expect(
      validateUno(
        { hands: { '1': [num(2)] }, discard: [num(50), played], color: 'red' },
        1, 1,
        { previousBoardState: prev },
      ),
    ).toBe('Winner hand is not empty.');
  });
});

describe('validateScrabble', () => {
  const emptyBoard = () => Array.from({ length: 15 }, () => Array(15).fill(null));

  it('accepts a rack-consistent play and leading win', () => {
    const prev = { board: emptyBoard(), racks: [['C', 'A', 'T'], ['X']], scores: [0, 0] };
    const board = emptyBoard();
    board[7][7] = 'C';
    expect(
      validateScrabble({ board, racks: [['A', 'T'], ['X']], scores: [120, 0] }, 1, 1, {
        previousBoardState: prev,
      }),
    ).toBeNull();
  });

  it('rejects a play using tiles not on the rack', () => {
    const prev = { board: emptyBoard(), racks: [['C', 'A', 'T'], ['X']], scores: [0, 0] };
    const board = emptyBoard();
    board[7][7] = 'Q';
    expect(
      validateScrabble({ board, racks: [['C', 'A', 'T'], ['X']], scores: [5, 0] }, 1, 1, {
        previousBoardState: prev,
      }),
    ).toBe('Placed tile not in rack.');
  });

  it('rejects moves that rewrite board history', () => {
    const prevBoard = emptyBoard();
    prevBoard[7][7] = 'C';
    const prev = { board: prevBoard, racks: [['A'], ['X']], scores: [3, 0] };
    const board = emptyBoard();
    board[7][7] = 'Z';
    expect(
      validateScrabble({ board, racks: [['A'], ['X']], scores: [3, 0] }, 1, 1, {
        previousBoardState: prev,
      }),
    ).toBe('Board history changed.');
  });

  it('rejects score changes for the non-mover', () => {
    const prev = { board: emptyBoard(), racks: [['C'], ['X']], scores: [0, 0] };
    expect(
      validateScrabble({ board: emptyBoard(), racks: [['C'], ['X']], scores: [0, 50] }, 1, 1, {
        previousBoardState: prev,
      }),
    ).toBe("Only the mover's score may change.");
  });
});

describe('validateBingo', () => {
  const card = () => {
    const ranges: [number, number][] = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];
    const c: (number | 'FREE')[][] = Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 5 }, (_, col) => ranges[col][0] + r),
    );
    c[2][2] = 'FREE';
    return c;
  };

  it('accepts a provable win', () => {
    const c = card();
    const called = [1, 16, 31, 46, 61, 2];
    const marks = Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, () => r === 0));
    expect(
      validateBingo({ called, card: c, marks }, 2, 2, { previousBoardState: { called } }),
    ).toBeNull();
  });

  it('rejects a win when a marked number was never called', () => {
    const c = card();
    const called = [1, 16, 46, 61]; // 31 missing
    const marks = Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, () => r === 0));
    expect(
      validateBingo({ called, card: c, marks }, 2, 2, { previousBoardState: { called } }),
    ).toBe('Card does not show a win.');
  });

  it('rejects guests adding calls', () => {
    expect(
      validateBingo({ called: [7, 9] }, undefined, 2, 2, { previousBoardState: { called: [7] } }),
    ).toBe('Only the host calls.');
  });
});

describe('gameRules', () => {
  it('dealUno produces 7-card hands and a number starter', () => {
    const d = dealUno(2);
    expect(d.hands[1].length).toBe(7);
    expect(d.hands[2].length).toBe(7);
    expect(d.discard.length).toBe(1);
    expect(d.discard[0].type).toBe('number');
    const ids = new Set<number>();
    for (const c of [...d.hands[1], ...d.hands[2], ...d.deck, ...d.discard]) ids.add(c.id);
    expect(ids.size).toBe(108);
  });

  it('dealScrabble deals 7-tile racks and keeps tile conservation', () => {
    const d = dealScrabble(3);
    expect(d.racks.length).toBe(3);
    expect(d.racks.every(r => r.length === 7)).toBe(true);
    expect(d.pool.length).toBe(98 - 21);
    expect(d.scores).toEqual([0, 0, 0]);
  });

  it('scrambled cubes stay one legal twist at a time and solved detection works', () => {
    const cube = newCube();
    expect(cubeIsSolved(cube)).toBe(true);
    const twisted = applyCubeMove(cube, { axis: 0, layer: 1, dir: 1 });
    expect(cubeIsSolved(twisted)).toBe(false);
    expect(isOneCubeTwist(cube, twisted)).toBe(true);
    expect(isOneCubeTwist(cube, applyCubeMove(twisted, { axis: 0, layer: 1, dir: 1 }))).toBe(false);
    const scrambled = scrambleCube(12);
    expect(scrambled.length).toBe(26);
    expect(cubeIsSolved(scrambled)).toBe(false);
  });
});
