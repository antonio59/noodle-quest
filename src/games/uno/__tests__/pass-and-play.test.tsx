import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { GameProps, LocalSeat } from '@/types';
import Uno from '@/games/uno';
import { dealInitial, type UnoCard, type UnoColor } from '../logic';

// Deterministic deals: swap only dealInitial, keep the real rules.
vi.mock('../logic', async importOriginal => {
  const actual = await importOriginal<typeof import('../logic')>();
  return { ...actual, dealInitial: vi.fn(actual.dealInitial) };
});

let nextId = 1000;
const card = (color: UnoCard['color'], symbol: UnoCard['symbol'], type: UnoCard['type'] = 'number'): UnoCard =>
  ({ color, symbol, type, id: nextId++ });

const RED_5 = () => card('red', '5');
// Seat 2 has nothing matching red or 5, so whatever it holds stays put.
const MIA_HAND = () => [
  card('green', '4'), card('green', '6'), card('yellow', '2'), card('yellow', '3'),
  card('blue', '8'), card('blue', '9'), card('green', '1'),
];
const DECK = () => [card('green', '8'), card('yellow', '4'), card('blue', '2'), card('green', '9')];

function dealWith(pHand: UnoCard[], aHand: UnoCard[] = MIA_HAND(), color: UnoColor = 'red') {
  vi.mocked(dealInitial).mockReturnValue({ pHand, aHand, deck: DECK(), discard: [RED_5()], color });
}

const SEATS: LocalSeat[] = [{ name: 'Dad', avatar: '🐻' }, { name: 'Mia', avatar: '🦊' }];

function renderTable(onEnd = vi.fn()) {
  const props: GameProps = {
    stage: 1, onScore: vi.fn(), onProgress: vi.fn(), onMessage: vi.fn(), onEnd, localSeats: SEATS,
  };
  render(<Uno {...props} />);
  return onEnd;
}

const curtainFor = (name: string) => screen.queryByRole('dialog', { name: `Pass the device to ${name}` });
const handOf = (name: string) => screen.queryByRole('group', { name: `${name}'s hand` });
const takeDevice = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`I'm ${name} — show me`) }));
const playCard = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('UNO pass & play', () => {
  test('starts behind the curtain for seat 1 and skips the intro', () => {
    dealWith([card('red', '7'), card('red', '3'), card('blue', '1')]);
    renderTable();

    const curtain = curtainFor('Dad');
    expect(curtain).toBeInTheDocument();
    expect(within(curtain!).getByText('Dad goes first · Mia has 7 cards')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start game/i })).not.toBeInTheDocument();
    expect(handOf('Dad')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Red 7' })).not.toBeInTheDocument();

    takeDevice('Dad');

    expect(curtainFor('Dad')).not.toBeInTheDocument();
    expect(screen.getByText("Dad's turn")).toBeInTheDocument();
    expect(within(handOf('Dad')!).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByText('Mia · 7 cards')).toBeInTheDocument();
  });

  test('a played card curtains the table for seat 2, hides seat 1, and no AI moves', () => {
    dealWith([card('red', '7'), card('red', '3'), card('blue', '1')]);
    const onEnd = renderTable();
    takeDevice('Dad');

    playCard('Red 7');

    const curtain = curtainFor('Mia');
    expect(curtain).toBeInTheDocument();
    expect(within(curtain!).getByText('Dad played Red 7 · Dad has 2 cards')).toBeInTheDocument();
    expect(handOf('Dad')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Red 3' })).not.toBeInTheDocument();
    expect(handOf('Mia')).not.toBeInTheDocument(); // not until she takes the device

    // Far past the solo AI's 600–1000ms think time: nothing may move.
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(curtainFor('Mia')).toBeInTheDocument();

    takeDevice('Mia');
    expect(screen.getByText("Mia's turn")).toBeInTheDocument();
    expect(within(handOf('Mia')!).getAllByRole('button')).toHaveLength(7);
    expect(screen.getByText('Dad · 2 cards')).toBeInTheDocument();
    expect(screen.getByText('RED')).toBeInTheDocument(); // Red 7 still on top
    expect(screen.queryByText(/AI/)).not.toBeInTheDocument();
    expect(onEnd).not.toHaveBeenCalled();
  });

  test('a skip keeps the same seat without a curtain, and going out ends as seat 1', () => {
    dealWith([card('red', 'skip', 'action'), card('red', '7')]);
    const onEnd = renderTable();
    takeDevice('Dad');

    playCard('Red Skip');

    expect(curtainFor('Mia')).not.toBeInTheDocument();
    expect(screen.getByText('Mia is skipped — Dad goes again!')).toBeInTheDocument();
    expect(screen.getByText('UNO!')).toBeInTheDocument();

    playCard('Red 7');
    act(() => { vi.advanceTimersByTime(10_000); });

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith({ score: 0, stars: 0, summary: 'Dad wins!', winnerSeat: 1 });
  });

  test('seat 2 emptying their hand reports winnerSeat 2 once', () => {
    dealWith([card('red', '7'), card('red', '3')], [card('red', '9')]);
    const onEnd = renderTable();
    takeDevice('Dad');
    playCard('Red 7');
    takeDevice('Mia');

    playCard('Red 9');
    act(() => { vi.advanceTimersByTime(10_000); });

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith({ score: 0, stars: 0, summary: 'Mia wins!', winnerSeat: 2 });
  });

  test('the seat that plays a wild picks its color, and the recap says so', () => {
    dealWith([card('wild', 'wild', 'wild'), card('red', '3')]);
    renderTable();
    takeDevice('Dad');

    playCard('Wild');
    fireEvent.click(screen.getByRole('button', { name: 'Blue' }));

    const curtain = curtainFor('Mia');
    expect(curtain).toBeInTheDocument();
    expect(within(curtain!).getByText('Dad played Wild, chose Blue · Dad has 1 card — UNO!')).toBeInTheDocument();
  });

  test('drawing an unplayable card passes the device', () => {
    dealWith([card('blue', '1'), card('green', '3')]);
    renderTable();
    takeDevice('Dad');

    fireEvent.click(screen.getByRole('button', { name: 'Draw a card' }));

    const curtain = curtainFor('Mia');
    expect(curtain).toBeInTheDocument();
    expect(within(curtain!).getByText('Dad drew a card · Dad has 3 cards')).toBeInTheDocument();
  });

  test('without local seats the solo intro still shows', () => {
    const props: GameProps = { stage: 1, onScore: vi.fn(), onProgress: vi.fn(), onMessage: vi.fn(), onEnd: vi.fn() };
    render(<Uno {...props} />);
    expect(screen.getByRole('button', { name: /start game/i })).toBeInTheDocument();
    expect(curtainFor('Dad')).not.toBeInTheDocument();
  });
});
