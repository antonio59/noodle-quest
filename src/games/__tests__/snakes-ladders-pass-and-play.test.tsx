import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { GameProps, LocalSeat } from '@/types';
import SnakesLaddersGame from '@/games/snakes-ladders';

const SEATS: LocalSeat[] = [
  { name: 'Ann', avatar: '🦊' },
  { name: 'Bo', avatar: '🐸' },
  { name: 'Cy', avatar: '🐼' },
  { name: 'Di', avatar: '🐻' },
];

function makeProps(seatCount: number): GameProps {
  const localSeats = SEATS.slice(0, seatCount);
  return {
    stage: 1,
    onScore: vi.fn(),
    onProgress: vi.fn(),
    onMessage: vi.fn(),
    onEnd: vi.fn(),
    numPlayers: localSeats.length,
    localSeats,
  };
}

/** Pin die faces in order (rollDie is floor(random * 6) + 1), then 2s. */
function queueRolls(faces: number[]) {
  const queue = [...faces];
  return vi.spyOn(Math, 'random').mockImplementation(() => ((queue.shift() ?? 2) - 0.5) / 6);
}

function banner(): HTMLElement {
  return screen.getByRole('status');
}

function roll() {
  fireEvent.click(screen.getByRole('button', { name: /roll/i }));
}

/** Longer than a full move (6 steps + snake/ladder pause) and any AI delay. */
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

describe('snakes & ladders pass & play', () => {
  test('goes straight to the board with a turn banner for seat 1', () => {
    render(<SnakesLaddersGame {...makeProps(3)} />);
    expect(screen.queryByRole('button', { name: /start game/i })).not.toBeInTheDocument();
    expect(banner()).toHaveTextContent("Ann's turn");
    expect(banner()).toHaveTextContent('Gold');
    for (const s of SEATS.slice(0, 3)) expect(screen.getByText(`${s.avatar} ${s.name}`)).toBeInTheDocument();
    expect(screen.queryByText(/\bAI\b/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\byou\b/i)).not.toBeInTheDocument();
  });

  test('turns pass seat 1 → 2 → 3 → 1 and nobody moves for an idle seat', () => {
    const random = queueRolls([]);
    const props = makeProps(3);
    render(<SnakesLaddersGame {...props} />);

    const expected: [string, string][] = [['Bo', 'Red'], ['Cy', 'Green'], ['Ann', 'Gold']];
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
    // Everyone rolled a 2, so all three tokens share square 2 and stay visible.
    for (const s of SEATS.slice(0, 3)) expect(screen.getByRole('img', { name: `${s.name}'s token` })).toBeInTheDocument();
    expect(props.onMessage).not.toHaveBeenCalledWith(expect.stringMatching(/\bAI\b/));
    expect(props.onEnd).not.toHaveBeenCalled();
  });

  test('four seats get four distinct token colours on a shared square', () => {
    queueRolls([1, 1, 1, 1]); // square 1 is a ladder to 38
    render(<SnakesLaddersGame {...makeProps(4)} />);
    for (let i = 0; i < 4; i++) {
      roll();
      waitOut();
    }
    const tokens = SEATS.map(s => screen.getByRole('img', { name: `${s.name}'s token` }));
    expect(new Set(tokens.map(t => t.parentElement)).size).toBe(1);
    expect(new Set(tokens.map(t => t.style.background)).size).toBe(4);
    expect(new Set(tokens.map(t => t.className)).size).toBe(4); // each in its own corner
  });

  test('the first seat to reach 100 wins, reported once', () => {
    // Bo: 1→38 (ladder), 44, 50, 51→67 (ladder), 71→91 (ladder), 94, 100.
    // Ann and Cy roll 2s and stay near the bottom.
    const bo = [1, 6, 6, 1, 4, 3, 6];
    queueRolls(bo.flatMap((face, i) => (i < bo.length - 1 ? [2, face, 2] : [2, face])));
    const props = makeProps(3);
    render(<SnakesLaddersGame {...props} />);

    for (let i = 0; i < bo.length * 3 - 1; i++) {
      roll();
      waitOut();
    }

    expect(props.onEnd).toHaveBeenCalledTimes(1);
    expect(props.onEnd).toHaveBeenCalledWith({ score: 0, stars: 0, summary: 'Bo wins!', winnerSeat: 2 });
    expect(props.onScore).not.toHaveBeenCalled();

    // The board is done: no more rolls, and onEnd never fires again.
    expect(screen.getByRole('button', { name: /roll/i })).toBeDisabled();
    roll();
    waitOut();
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });

  test('two seats play each other instead of the AI', () => {
    const random = queueRolls([]);
    render(<SnakesLaddersGame {...makeProps(2)} />);

    roll();
    const rolls = random.mock.calls.length;
    waitOut();
    expect(random.mock.calls.length).toBe(rolls);
    expect(banner()).toHaveTextContent("Bo's turn");
    expect(screen.getByRole('button', { name: /roll/i })).toBeEnabled();
  });
});
