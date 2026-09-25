import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { GameProps, LocalSeat } from '@/types';
import { bestMove } from '../logic';
import ConnectFourGame from '..';

// Wrap the AI so we can prove pass & play never asks it for a move.
vi.mock('../logic', async (importOriginal) => {
  const real = await importOriginal<typeof import('../logic')>();
  return { ...real, bestMove: vi.fn(real.bestMove) };
});

const SEATS: LocalSeat[] = [
  { name: 'Mia', avatar: '🦊' },
  { name: 'Leo', avatar: '🐻' },
];

// A legal 42-move game (0-indexed columns, red first) that fills the board
// without anyone connecting four.
const DRAW_GAME = [
  3, 5, 0, 6, 0, 0, 3, 4, 4, 6, 5, 5, 5, 6, 0, 4, 6, 0, 6, 1, 1,
  2, 4, 5, 3, 6, 1, 1, 1, 3, 5, 4, 1, 2, 3, 0, 2, 2, 4, 2, 3, 2,
];

function makeProps(overrides: Partial<GameProps> = {}): GameProps {
  return {
    stage: 1,
    onScore: vi.fn(),
    onProgress: vi.fn(),
    onMessage: vi.fn(),
    onEnd: vi.fn(),
    localSeats: SEATS,
    ...overrides,
  };
}

/** Drop into a 0-indexed column. */
function drop(col: number) {
  fireEvent.click(screen.getByRole('button', { name: `Drop disc in column ${col + 1}` }));
}

function play(cols: number[]) {
  cols.forEach(drop);
}

function discCount(): number {
  return screen.queryAllByRole('button', { name: /^Column \d, row \d: (?!empty)/ }).length;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(bestMove).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('connect four pass & play', () => {
  test('skips the intro and goes straight to the board', () => {
    render(<ConnectFourGame {...makeProps()} />);
    expect(screen.queryByRole('button', { name: /start game/i })).not.toBeInTheDocument();
    expect(screen.getByRole('grid', { name: /connect four board/i })).toBeInTheDocument();
    expect(screen.getByText("Mia's turn")).toBeInTheDocument();
    expect(screen.getByText('· Red')).toBeInTheDocument();
    expect(screen.queryByText(/AI/)).not.toBeInTheDocument();
  });

  test('seat 1 drops red, then seat 2 drops yellow — no AI move in between', () => {
    render(<ConnectFourGame {...makeProps()} />);

    drop(3);
    expect(screen.getByRole('button', { name: "Column 4, row 6: Mia's red disc" })).toBeInTheDocument();
    expect(screen.getByText("Leo's turn")).toBeInTheDocument();
    expect(screen.getByText('· Yellow')).toBeInTheDocument();

    // Well past the solo AI's 400ms think time: nothing else lands.
    act(() => { vi.advanceTimersByTime(5000); });
    expect(discCount()).toBe(1);
    expect(bestMove).not.toHaveBeenCalled();

    drop(3);
    expect(screen.getByRole('button', { name: "Column 4, row 5: Leo's yellow disc" })).toBeInTheDocument();
    expect(screen.getByText("Mia's turn")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(discCount()).toBe(2);
    expect(bestMove).not.toHaveBeenCalled();
  });

  test('seat 1 wins: onEnd fires once with winnerSeat 1', () => {
    const onEnd = vi.fn();
    render(<ConnectFourGame {...makeProps({ onEnd })} />);

    play([0, 1, 0, 1, 0, 1, 0]); // red stacks four in column 1
    expect(screen.getByText(/Mia wins!/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /play again|try again/i })).not.toBeInTheDocument();

    // The board stays up briefly so everyone sees the winning line.
    expect(onEnd).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith({ score: 0, stars: 0, summary: 'Mia wins!', winnerSeat: 1 });

    // The finished board takes no more moves.
    drop(4);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(discCount()).toBe(7);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(bestMove).not.toHaveBeenCalled();
  });

  test('seat 2 wins: winnerSeat 2', () => {
    const onEnd = vi.fn();
    render(<ConnectFourGame {...makeProps({ onEnd })} />);

    play([0, 1, 0, 1, 0, 1, 2, 1]); // yellow stacks four in column 2
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith({ score: 0, stars: 0, summary: 'Leo wins!', winnerSeat: 2 });
  });

  test('a full board with no line is a draw: winnerSeat 0', () => {
    const onEnd = vi.fn();
    render(<ConnectFourGame {...makeProps({ onEnd })} />);

    play(DRAW_GAME);
    expect(discCount()).toBe(42);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith({ score: 0, stars: 0, summary: "It's a draw!", winnerSeat: 0 });
  });

  test('without localSeats the solo intro and AI still run', () => {
    render(<ConnectFourGame {...makeProps({ localSeats: undefined })} />);
    fireEvent.click(screen.getByRole('button', { name: /start game/i }));

    drop(3);
    act(() => { vi.advanceTimersByTime(500); });
    expect(bestMove).toHaveBeenCalledTimes(1);
    expect(discCount()).toBe(2);
  });
});
