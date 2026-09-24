import { describe, expect, test } from 'vitest';
import {
  addToTally,
  describeMatch,
  seatAt,
  seatListError,
  nextSeat,
  rotateSeats,
} from '../pass-and-play';

const DAD = { name: 'Dad', avatar: '🐻' };
const MIA = { name: 'Mia', avatar: '🦊' };
const SAM = { name: 'Sam', avatar: '🐸' };

describe('seatAt', () => {
  test('returns the 1-indexed seat', () => {
    expect(seatAt([DAD, MIA], 2)).toEqual(MIA);
  });

  test('falls back to a numbered player for a missing seat', () => {
    expect(seatAt([DAD], 3)).toEqual({ name: 'Player 3', avatar: '🙂' });
  });
});

describe('nextSeat', () => {
  test('wraps around the table', () => {
    expect(nextSeat(1, 3)).toBe(2);
    expect(nextSeat(3, 3)).toBe(1);
  });
});

describe('describeMatch', () => {
  test('two players: winner beat loser', () => {
    expect(describeMatch([DAD, MIA], 2, 'Chess')).toBe('Mia beat Dad at Chess');
  });

  test('three or more players: winner won against the rest', () => {
    expect(describeMatch([DAD, MIA, SAM], 1, 'UNO')).toBe('Dad won UNO against Mia and Sam');
  });

  test('draw', () => {
    expect(describeMatch([DAD, MIA], 0, 'Checkers')).toBe('Dad and Mia drew at Checkers');
  });

  test('no result recorded', () => {
    expect(describeMatch([DAD, MIA], undefined, 'Chess')).toBe('Dad and Mia played Chess');
  });
});

describe('addToTally', () => {
  test('counts wins per player name without mutating the input', () => {
    const before = { Dad: 1 };
    const after = addToTally(before, [DAD, MIA], 2);
    expect(after).toEqual({ Dad: 1, Mia: 1 });
    expect(before).toEqual({ Dad: 1 });
  });

  test('draws and missing results leave the tally unchanged', () => {
    expect(addToTally({ Dad: 2 }, [DAD, MIA], 0)).toEqual({ Dad: 2 });
    expect(addToTally({ Dad: 2 }, [DAD, MIA], undefined)).toEqual({ Dad: 2 });
  });
});

describe('rotateSeats', () => {
  test('moves everyone up one seat', () => {
    expect(rotateSeats([DAD, MIA, SAM])).toEqual([MIA, SAM, DAD]);
  });

  test('leaves a lone seat alone', () => {
    expect(rotateSeats([DAD])).toEqual([DAD]);
  });
});

describe('seatListError', () => {
  test('accepts a valid table', () => {
    expect(seatListError([DAD, MIA], 2, 4)).toBeNull();
  });

  test('enforces the seat range', () => {
    expect(seatListError([DAD], 2, 4)).toBe('Pick at least 2 players');
    expect(seatListError([DAD, MIA, SAM], 2, 2)).toBe('This game seats 2 players');
  });

  test('rejects blank and duplicate names', () => {
    expect(seatListError([DAD, { name: '  ', avatar: '🙂' }], 2, 2)).toBe('Every player needs a name');
    expect(seatListError([DAD, { name: 'dad', avatar: '🙂' }], 2, 2)).toBe('Each player needs a different name');
  });
});
