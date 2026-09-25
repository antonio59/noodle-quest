import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { GameProps, LocalSeat } from '@/types';
import LudoGame from '@/games/ludo';

const SEATS: LocalSeat[] = [
  { name: 'Ann', avatar: '🦊' },
  { name: 'Bo', avatar: '🐸' },
  { name: 'Cy', avatar: '🐼' },
];

// rollDie() is floor(random * 6) + 1, so these pin the die face.
const ROLL_ONE = 0;
const ROLL_SIX = 0.99;

function makeProps(): GameProps {
  return {
    stage: 1,
    onScore: vi.fn(),
    onProgress: vi.fn(),
    onMessage: vi.fn(),
    onEnd: vi.fn(),
    numPlayers: SEATS.length,
    localSeats: SEATS,
  };
}

function banner(): HTMLElement {
  return screen.getByRole('status');
}

function roll() {
  fireEvent.click(screen.getByRole('button', { name: /roll/i }));
}

/** Longer than any AI delay (800ms) or end-of-game beat (1000ms). */
function waitOut() {
  act(() => { vi.advanceTimersByTime(5000); });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ludo pass & play', () => {
  test('goes straight to the board with a turn banner for seat 1', () => {
    render(<LudoGame {...makeProps()} />);
    expect(screen.queryByRole('button', { name: /start game/i })).not.toBeInTheDocument();
    expect(banner()).toHaveTextContent("Ann's turn");
    expect(banner()).toHaveTextContent('Red');
    // Progress rows name every seat; no "You" or "AI" in pass & play.
    for (const s of SEATS) expect(screen.getByText(`${s.avatar} ${s.name}`)).toBeInTheDocument();
    expect(screen.queryByText(/^you$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bAI\b/)).not.toBeInTheDocument();
  });

  test('turns pass seat 1 → 2 → 3 → 1 and nobody moves for an idle seat', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(ROLL_ONE); // a 1 can't leave base
    const props = makeProps();
    render(<LudoGame {...props} />);

    const expected: [string, string][] = [['Bo', 'Green'], ['Cy', 'Blue'], ['Ann', 'Red']];
    for (const [name, colour] of expected) {
      roll();
      const rolls = random.mock.calls.length;
      waitOut();
      // Nothing rolled on its own: the next seat is still waiting to tap Roll.
      expect(random.mock.calls.length).toBe(rolls);
      expect(banner()).toHaveTextContent(`${name}'s turn`);
      expect(banner()).toHaveTextContent(colour);
      expect(screen.getByRole('button', { name: /roll/i })).toBeEnabled();
    }
    expect(props.onMessage).toHaveBeenCalledWith('Ann rolled 1 — no piece can move!');
    expect(props.onMessage).not.toHaveBeenCalledWith(expect.stringMatching(/\bAI\b/));
    expect(props.onEnd).not.toHaveBeenCalled();
  });

  test('the first seat to get all 4 pieces home wins, reported once', () => {
    // Ann rolls a 1 (turn passes), then every roll is a 6 — Bo keeps the
    // turn on each 6 and races all four pieces home.
    vi.spyOn(Math, 'random').mockReturnValueOnce(ROLL_ONE).mockReturnValue(ROLL_SIX);
    const props = makeProps();
    render(<LudoGame {...props} />);

    roll();
    expect(banner()).toHaveTextContent("Bo's turn");

    // 4 pieces × (enter on a 6 + 9 sixes to reach home) = 40 rolls.
    for (let i = 0; i < 40; i++) {
      expect(banner()).toHaveTextContent("Bo's turn");
      roll();
      const options = screen.queryAllByRole('button', { name: /^piece \d/i });
      if (options.length > 0) fireEvent.click(options[0]);
    }

    expect(props.onEnd).not.toHaveBeenCalled(); // a beat to see the last move
    waitOut();
    expect(props.onEnd).toHaveBeenCalledTimes(1);
    expect(props.onEnd).toHaveBeenCalledWith({ score: 0, stars: 0, summary: 'Bo wins!', winnerSeat: 2 });
    expect(props.onScore).not.toHaveBeenCalled();

    // The board is done: no more rolls, and onEnd never fires again.
    expect(screen.getByRole('button', { name: /waiting/i })).toBeDisabled();
    waitOut();
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });

  test('two seats play each other instead of the AI', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(ROLL_ONE);
    const props = { ...makeProps(), numPlayers: 2, localSeats: SEATS.slice(0, 2) };
    render(<LudoGame {...props} />);

    roll();
    const rolls = random.mock.calls.length;
    waitOut();
    expect(random.mock.calls.length).toBe(rolls);
    expect(banner()).toHaveTextContent("Bo's turn");
    expect(banner()).toHaveTextContent('Blue');
    expect(screen.getByRole('button', { name: /roll/i })).toBeEnabled();
  });
});
