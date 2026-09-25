import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { GameProps, LocalSeat } from '@/types';
import { bestMove } from '../logic';
import TicTacToeGame from '..';

// Wrap the AI so we can prove pass & play never asks it for a move.
vi.mock('../logic', async (importOriginal) => {
  const real = await importOriginal<typeof import('../logic')>();
  return { ...real, bestMove: vi.fn(real.bestMove) };
});

const SEATS: LocalSeat[] = [
  { name: 'Mia', avatar: '🦊' },
  { name: 'Leo', avatar: '🐻' },
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

/** Cells are numbered 0-8, row by row. */
function tap(i: number) {
  const name = new RegExp(`^Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}:`);
  fireEvent.click(screen.getByRole('button', { name }));
}

function play(cells: number[]) {
  cells.forEach(tap);
}

function filledCells(): number {
  return screen.getAllByRole('button', { name: /^Row \d, column \d: [XO]$/ }).length;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(bestMove).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('tic-tac-toe pass & play', () => {
  test('skips the intro and goes straight to the board', () => {
    render(<TicTacToeGame {...makeProps()} />);
    expect(screen.queryByRole('button', { name: /start game/i })).not.toBeInTheDocument();
    expect(screen.getByRole('grid', { name: /tic-tac-toe board/i })).toBeInTheDocument();
    expect(screen.getByText("Mia's turn")).toBeInTheDocument();
    expect(screen.queryByText(/wins:/i)).not.toBeInTheDocument();
  });

  test('seat 1 plays X, then seat 2 plays O — no AI move in between', () => {
    render(<TicTacToeGame {...makeProps()} />);

    tap(4);
    expect(screen.getByRole('button', { name: 'Row 2, column 2: X' })).toBeInTheDocument();
    expect(screen.getByText("Leo's turn")).toBeInTheDocument();

    // Well past the solo AI's 400ms think time: nothing else lands.
    act(() => { vi.advanceTimersByTime(5000); });
    expect(filledCells()).toBe(1);
    expect(bestMove).not.toHaveBeenCalled();

    tap(0);
    expect(screen.getByRole('button', { name: 'Row 1, column 1: O' })).toBeInTheDocument();
    expect(screen.getByText("Mia's turn")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(filledCells()).toBe(2);
    expect(bestMove).not.toHaveBeenCalled();
  });

  test('seat 1 wins: onEnd fires once with winnerSeat 1', () => {
    const onEnd = vi.fn();
    render(<TicTacToeGame {...makeProps({ onEnd })} />);

    play([0, 3, 1, 4, 2]); // X takes the top row
    expect(screen.getByText(/Mia wins!/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /play again/i })).not.toBeInTheDocument();

    // The board stays up briefly so everyone sees the winning line.
    expect(onEnd).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith({ score: 0, stars: 0, summary: 'Mia wins!', winnerSeat: 1 });

    // The finished board takes no more moves.
    tap(8);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(bestMove).not.toHaveBeenCalled();
  });

  test('seat 2 wins: winnerSeat 2', () => {
    const onEnd = vi.fn();
    render(<TicTacToeGame {...makeProps({ onEnd })} />);

    play([0, 3, 1, 4, 8, 5]); // O takes the middle row
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith({ score: 0, stars: 0, summary: 'Leo wins!', winnerSeat: 2 });
  });

  test('a full board with no line is a draw: winnerSeat 0', () => {
    const onEnd = vi.fn();
    render(<TicTacToeGame {...makeProps({ onEnd })} />);

    // X O X / X O O / O X X
    play([0, 1, 2, 4, 3, 5, 7, 6, 8]);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith({ score: 0, stars: 0, summary: "It's a draw!", winnerSeat: 0 });
  });

  test('without localSeats the solo intro and AI still run', () => {
    render(<TicTacToeGame {...makeProps({ localSeats: undefined })} />);
    fireEvent.click(screen.getByRole('button', { name: /start game/i }));

    tap(4);
    act(() => { vi.advanceTimersByTime(500); });
    expect(bestMove).toHaveBeenCalledTimes(1);
    expect(filledCells()).toBe(2);
  });
});
