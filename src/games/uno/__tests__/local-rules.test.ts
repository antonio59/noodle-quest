import { describe, expect, test } from 'vitest';
import type { UnoCard } from '../logic';
import { advance, describeEvent, drawCard, handOf, playCard, recapFor, takeCards, type LocalTable, type LocalUnoState } from '../local-rules';

let nextId = 0;
const card = (color: UnoCard['color'], symbol: UnoCard['symbol'], type: UnoCard['type'] = 'number'): UnoCard =>
  ({ color, symbol, type, id: nextId++ });

function table(seat1: UnoCard[], seat2: UnoCard[], deck: UnoCard[] = []): LocalTable {
  return { hands: [seat1, seat2], deck, discard: [card('red', '5')], color: 'red', turn: 1 };
}

describe('playCard', () => {
  test('a plain card moves the turn to the other seat', () => {
    const red7 = card('red', '7');
    const out = playCard(table([red7, card('blue', '1')], [card('green', '2')]), red7.id)!;
    expect(out.passes).toBe(true);
    expect(out.table.turn).toBe(2);
    expect(out.table.discard[out.table.discard.length - 1]).toBe(red7);
  });

  test('an illegal card, or a wild without a color, is refused', () => {
    const blue9 = card('blue', '9');
    const wild = card('wild', 'wild', 'wild');
    const t = table([blue9, wild, card('red', '1')], [card('green', '2')]);
    expect(playCard(t, blue9.id)).toBeNull();
    expect(playCard(t, wild.id)).toBeNull();
    expect(playCard(t, wild.id, 'green')!.table.color).toBe('green');
  });

  test('+2 makes the other seat draw 2 and keeps the turn', () => {
    const plus2 = card('red', 'draw2', 'action');
    const deck = [card('blue', '1'), card('blue', '2'), card('blue', '3')];
    const out = playCard(table([plus2, card('red', '1')], [card('green', '2')], deck), plus2.id)!;
    expect(out.passes).toBe(false);
    expect(out.table.turn).toBe(1);
    expect(handOf(out.table, 2)).toHaveLength(3);
    expect(out.table.deck).toHaveLength(1);
    expect(describeEvent(out.event, 'Mia')).toBe('played Red +2, Mia drew 2');
  });

  test('Wild +4 sets the color, deals 4 and keeps the turn', () => {
    const plus4 = card('wild', 'wild', 'wild4');
    const deck = [1, 2, 3, 4].map(() => card('green', '1'));
    const out = playCard(table([plus4, card('red', '1')], [card('green', '2')], deck), plus4.id, 'yellow')!;
    expect(out.table.color).toBe('yellow');
    expect(handOf(out.table, 2)).toHaveLength(5);
    expect(out.table.turn).toBe(1);
  });

  test('going out wins before a +2 lands', () => {
    const plus2 = card('red', 'draw2', 'action');
    const out = playCard(table([plus2], [card('green', '2')], [card('blue', '1'), card('blue', '2')]), plus2.id)!;
    expect(out.winner).toBe(1);
    expect(handOf(out.table, 2)).toHaveLength(1);
  });
});

describe('drawCard', () => {
  test('an unplayable draw passes; a playable one stays with the seat', () => {
    const miss = drawCard(table([card('blue', '1')], [card('green', '2')], [card('green', '8')]));
    expect(miss.passes).toBe(true);
    expect(handOf(miss.table, 1)).toHaveLength(2);

    const hit = drawCard(table([card('blue', '1')], [card('green', '2')], [card('red', '8')]));
    expect(hit.passes).toBe(false);
    expect(hit.table.turn).toBe(1);
  });

  test('an empty deck reshuffles the discard pile under its top card', () => {
    const top = card('red', '5');
    const under = [card('blue', '1'), card('blue', '2')];
    const { drawn, deck, discard } = takeCards([], [...under, top], 1);
    expect(drawn).toHaveLength(1);
    expect(deck).toHaveLength(1);
    expect(discard).toEqual([top]);
    expect(new Set([...drawn, ...deck].map(c => c.id))).toEqual(new Set(under.map(c => c.id)));
  });
});

describe('advance', () => {
  const base = (t: LocalTable): LocalUnoState =>
    ({ table: t, curtain: null, turnLog: [], pendingWild: null, message: '', winner: null });
  const names = ['Dad', 'Mia'] as const;

  test('collects a whole turn into the next curtain recap', () => {
    const skip = card('red', 'skip', 'action');
    const red7 = card('red', '7');
    const t = table([skip, red7, card('blue', '1')], [card('green', '2')]);

    const afterSkip = advance(base(t), playCard(t, skip.id)!, names);
    expect(afterSkip.curtain).toBeNull();
    expect(afterSkip.message).toBe('Mia is skipped — Dad goes again!');

    const afterSeven = advance(afterSkip, playCard(afterSkip.table, red7.id)!, names);
    expect(afterSeven.curtain).toEqual({
      seat: 2,
      recap: 'Dad played Red Skip, then played Red 7 · Dad has 1 card — UNO!',
    });
    expect(afterSeven.turnLog).toEqual([]);
  });

  test('recapFor pluralises the count', () => {
    expect(recapFor('Mia', ['drew a card'], 5)).toBe('Mia drew a card · Mia has 5 cards');
  });
});
