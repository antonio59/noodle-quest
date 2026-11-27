import { describe, expect, test } from 'vitest';
import '@/lib/game-manifest';
import { getAllGames } from '@/lib/game-registry';
import {
  loosenChipMessage,
  matchesPicker,
  parsePickerParams,
  playTogetherHref,
  playerSpan,
  togglePlayers,
  writePickerParams,
  type PickerFilters,
} from '@/lib/game-picker';

const none: PickerFilters = { age: null, players: null, time: null };

describe('player span', () => {
  test('a game with no together-range is one player', () => {
    expect(playerSpan({})).toEqual({ min: 1, max: 1 });
  });

  test('pass-and-play widens an online cap', () => {
    expect(playerSpan({ minPlayers: 2, maxPlayers: 2, passAndPlay: { min: 2, max: 4 } })).toEqual({ min: 2, max: 4 });
    expect(playerSpan({ minPlayers: 2, maxPlayers: 8 })).toEqual({ min: 2, max: 8 });
  });

  test('catalog seats match the manifest', () => {
    const byId = Object.fromEntries(getAllGames().map(game => [game.id, game]));
    expect(playerSpan(byId['memory-match'])).toEqual({ min: 1, max: 1 });
    expect(playerSpan(byId['tic-tac-toe'])).toEqual({ min: 2, max: 2 });
    expect(playerSpan(byId['snakes-ladders'])).toEqual({ min: 2, max: 4 });
    expect(playerSpan(byId.bingo)).toEqual({ min: 2, max: 8 });
  });
});

describe('picker filters', () => {
  test('every game has an age band and a minute range', () => {
    const games = getAllGames();
    expect(games).toHaveLength(56);
    for (const game of games) {
      expect(game.age, game.id).toMatch(/^(everyone|4\+|7\+|10\+)$/);
      expect(game.minutes!.min, game.id).toBeGreaterThan(0);
      expect(game.minutes!.max, game.id).toBeGreaterThanOrEqual(game.minutes!.min);
    }
  });

  test('age is the youngest person in the room, and a missing tag stays visible', () => {
    const older = { age: '10+' as const, minutes: { min: 15, max: 40 } };
    const little = { age: 'everyone' as const, minutes: { min: 2, max: 5 } };
    expect(matchesPicker(older, { ...none, age: '7+' })).toBe(false);
    expect(matchesPicker(little, { ...none, age: '4+' })).toBe(true);
    expect(matchesPicker({ age: '4+' }, { ...none, age: 'everyone' })).toBe(false);
    expect(matchesPicker({}, { ...none, age: '10+' })).toBe(true);
  });

  test('under 5 and under 15 use the long end of the sitting', () => {
    const quick = { minutes: { min: 1, max: 5 } };
    const medium = { minutes: { min: 8, max: 15 } };
    const long = { minutes: { min: 15, max: 40 } };
    expect(matchesPicker(quick, { ...none, time: 5 })).toBe(true);
    expect(matchesPicker(quick, { ...none, time: 15 })).toBe(true);
    expect(matchesPicker(medium, { ...none, time: 5 })).toBe(false);
    expect(matchesPicker(medium, { ...none, time: 15 })).toBe(true);
    expect(matchesPicker(long, { ...none, time: 15 })).toBe(false);
    expect(matchesPicker({}, { ...none, time: 5 })).toBe(true);
  });

  test('player chips are 1, 2, 3–4, and 2 or more', () => {
    const solo = {};
    const pair = { minPlayers: 2, maxPlayers: 2 };
    const table = { passAndPlay: { min: 2, max: 4 } };
    expect(matchesPicker(solo, { ...none, players: '1' })).toBe(true);
    expect(matchesPicker(solo, { ...none, players: '2plus' })).toBe(false);
    expect(matchesPicker(pair, { ...none, players: '1' })).toBe(false);
    expect(matchesPicker(pair, { ...none, players: '2' })).toBe(true);
    expect(matchesPicker(pair, { ...none, players: '3-4' })).toBe(false);
    expect(matchesPicker(pair, { ...none, players: '2plus' })).toBe(true);
    expect(matchesPicker(table, { ...none, players: '2' })).toBe(true);
    expect(matchesPicker(table, { ...none, players: '3-4' })).toBe(true);
  });

  test('chips combine, and play together is board games for 2 or more', () => {
    const games = getAllGames();
    const together = games.filter(game =>
      game.category === 'board' && matchesPicker(game, { ...none, players: '2plus' }));
    expect(together.map(game => game.id).sort()).toEqual([
      'bingo', 'checkers', 'chess', 'connect-four', 'ludo', 'score-four',
      'scrabble', 'snakes-ladders', 'tic-tac-toe', 'uno',
    ]);
    expect(games.filter(game =>
      game.category === 'board' && matchesPicker(game, { age: 'everyone', players: '2plus', time: 5 }),
    )).toEqual([]);
    expect(matchesPicker(
      { age: '4+', minutes: { min: 1, max: 3 }, minPlayers: 2, maxPlayers: 2 },
      { age: 'everyone', players: '2', time: 5 },
    )).toBe(false);
  });

  test('2 and 3–4 combine, and 1 replaces them', () => {
    expect(togglePlayers(null, '2')).toBe('2');
    expect(togglePlayers('2', '2')).toBeNull();
    expect(togglePlayers('2', '3-4')).toBe('2plus');
    expect(togglePlayers('2plus', '2')).toBe('3-4');
    expect(togglePlayers('2plus', '1')).toBe('1');
    expect(togglePlayers('1', '1')).toBeNull();
  });

  test('the empty line names the chips to loosen', () => {
    expect(loosenChipMessage(none)).toBeNull();
    expect(loosenChipMessage({ ...none, age: '7+' })).toBe('No games match. Loosen 7+.');
    expect(loosenChipMessage({ ...none, age: '7+', time: 5 })).toBe('No games match. Loosen 7+ or Under 5.');
    expect(loosenChipMessage({ age: '10+', players: '2plus', time: 5 }, ['Memory'], 'chess'))
      .toBe('No games match "chess". Loosen Memory, 10+, 2 or more players, or Under 5.');
  });

  test('play together opens the board tab for 2 or more, and the query round-trips', () => {
    expect(playTogetherHref()).toBe('/games?tab=board&players=2plus');
    const params = new URLSearchParams();
    writePickerParams(params, { age: '4+', players: '2plus', time: 5 });
    expect(params.get('age')).toBe('4+');
    expect(parsePickerParams(params)).toEqual({ age: '4+', players: '2plus', time: 5 });
    expect(parsePickerParams(new URLSearchParams('players=nope&time=99'))).toEqual(none);
  });
});
