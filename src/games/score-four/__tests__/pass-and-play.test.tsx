import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { GameProps, LocalSeat } from '@/types';
import { bestRod } from '../logic';
import ScoreFourGame from '..';

// jsdom has no WebGL: claim support so the game renders its board, and stub
// the three.js canvas out. Rod clicks are raycast inside the canvas, so the
// tests play through the board's keyboard controls instead — arrows move a
// rod cursor and Enter drops, via the same handleDrop a click uses.
vi.mock('@/lib/webgl', () => ({ webglSupported: () => true }));
vi.mock('@react-three/fiber', () => ({ Canvas: () => null, useFrame: () => {} }));

// Wrap the AI so we can prove pass & play never asks it for a move.
vi.mock('../logic', async (importOriginal) => {
  const real = await importOriginal<typeof import('../logic')>();
  return { ...real, bestRod: vi.fn(real.bestRod) };
});

const SEATS: LocalSeat[] = [
  { name: 'Mia', avatar: '🦊' },
  { name: 'Leo', avatar: '🐻' },
];

type RodXZ = [x: number, z: number];

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

function board(): HTMLElement {
  return screen.getByRole('application');
}

function press(key: string, times = 1) {
  for (let i = 0; i < times; i++) fireEvent.keyDown(board(), { key });
}

/** Walk the rod cursor to (x, z) from the top-left corner, then drop. */
function dropAt([x, z]: RodXZ) {
  press('ArrowLeft', 3);
  press('ArrowUp', 3);
  press('ArrowRight', x);
  press('ArrowDown', z);
  press('Enter');
}

function play(rods: RodXZ[]) {
  rods.forEach(dropAt);
}

function beadCount(): number {
  const match = /(\d+) beads placed/.exec(board().getAttribute('aria-label') ?? '');
  return Number(match?.[1]);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(bestRod).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('score four pass & play', () => {
  test('skips the intro and goes straight to the board', () => {
    render(<ScoreFourGame {...makeProps()} />);
    expect(screen.queryByRole('button', { name: /start game/i })).not.toBeInTheDocument();
    expect(board()).toHaveAttribute('aria-label', expect.stringContaining("Mia's turn."));
    expect(screen.getByText("Mia's turn")).toBeInTheDocument();
    expect(screen.getByText('· Orange')).toBeInTheDocument();
    expect(screen.queryByText(/AI/)).not.toBeInTheDocument();
  });

  test('seat 1 drops, then seat 2 drops — no AI move in between', () => {
    render(<ScoreFourGame {...makeProps()} />);

    dropAt([0, 0]);
    expect(beadCount()).toBe(1);
    expect(screen.getByText("Leo's turn")).toBeInTheDocument();
    expect(screen.getByText('· Red')).toBeInTheDocument();

    // Well past the solo AI's 450ms think time: nothing else lands.
    act(() => { vi.advanceTimersByTime(5000); });
    expect(beadCount()).toBe(1);
    expect(bestRod).not.toHaveBeenCalled();

    dropAt([0, 0]); // stacks on top of Mia's bead
    expect(beadCount()).toBe(2);
    expect(screen.getByText("Mia's turn")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(beadCount()).toBe(2);
    expect(bestRod).not.toHaveBeenCalled();
  });

  test('seat 1 wins: onEnd fires once with winnerSeat 1', () => {
    const onEnd = vi.fn();
    render(<ScoreFourGame {...makeProps({ onEnd })} />);

    // Mia fills the front row on the floor; Leo builds the row behind.
    play([[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1], [3, 0]]);
    expect(screen.getByText(/Mia wins!/)).toBeInTheDocument();
    expect(board()).toHaveAttribute('aria-label', expect.stringContaining('Game over.'));

    // The board stays up briefly so everyone sees the winning line.
    expect(onEnd).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith({ score: 0, stars: 0, summary: 'Mia wins!', winnerSeat: 1 });

    // The finished board takes no more moves.
    dropAt([3, 3]);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(beadCount()).toBe(7);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(bestRod).not.toHaveBeenCalled();
  });

  test('seat 2 wins: winnerSeat 2', () => {
    const onEnd = vi.fn();
    render(<ScoreFourGame {...makeProps({ onEnd })} />);

    play([[0, 0], [0, 1], [1, 0], [1, 1], [3, 3], [2, 1], [3, 2], [3, 1]]);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith({ score: 0, stars: 0, summary: 'Leo wins!', winnerSeat: 2 });
  });

  test('without localSeats the solo intro and AI still run', () => {
    render(<ScoreFourGame {...makeProps({ localSeats: undefined })} />);
    fireEvent.click(screen.getByRole('button', { name: /start game/i }));

    dropAt([0, 0]);
    act(() => { vi.advanceTimersByTime(500); });
    expect(bestRod).toHaveBeenCalledTimes(1);
    expect(beadCount()).toBe(2);
  });
});
