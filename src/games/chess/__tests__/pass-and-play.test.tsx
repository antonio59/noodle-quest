import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Chess } from 'chess.js';
import type { GameProps, LocalSeat } from '@/types';
import ChessGame from '@/games/chess';
import { localResult } from '../pass-and-play';

const SEATS: LocalSeat[] = [
  { name: 'Mia', avatar: '🦊' },
  { name: 'Sam', avatar: '🐻' },
];

function makeProps(): GameProps {
  return {
    stage: 1,
    onScore: vi.fn(),
    onProgress: vi.fn(),
    onMessage: vi.fn(),
    onEnd: vi.fn(),
    aiDifficulty: 'medium',
    localSeats: SEATS,
  };
}

function renderLocal() {
  const props = makeProps();
  const { container } = render(<ChessGame {...props} />);
  return { props, container };
}

/** The clickable square for e.g. "e2" — rows run rank 8 → 1, files a → h. */
function square(container: HTMLElement, name: string): Element {
  const file = name.charCodeAt(0) - 97;
  const rank = Number(name[1]);
  return container.querySelectorAll('svg[role="application"] > g')[(8 - rank) * 8 + file];
}

function play(container: HTMLElement, from: string, to: string) {
  fireEvent.click(square(container, from));
  fireEvent.click(square(container, to));
}

/** Well past the solo AI's 600ms "thinking" delay. */
function waitOutAnyAi() {
  act(() => { vi.advanceTimersByTime(10_000); });
}

function turnBanner(): HTMLElement {
  return screen.getByText(/'s turn$/).closest('[role="status"]') as HTMLElement;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('chess pass & play', () => {
  test('skips the intro and seats Mia as White, Sam as Black', () => {
    const { container } = renderLocal();

    expect(screen.queryByRole('button', { name: /start game/i })).not.toBeInTheDocument();
    expect(container.querySelector('svg[role="application"]')).not.toBeNull();
    expect(within(turnBanner()).getByText("Mia's turn")).toBeInTheDocument();
    expect(within(turnBanner()).getByText(/White/)).toBeInTheDocument();
    expect(screen.getByText('🦊 Mia ♙')).toBeInTheDocument();
    expect(screen.getByText('🐻 Sam ♟')).toBeInTheDocument();
    expect(screen.queryByText(/AI ♟|You ♙/)).not.toBeInTheDocument();
  });

  test('seat 1 moves White, no AI replies, then seat 2 moves Black', () => {
    const { props, container } = renderLocal();

    play(container, 'e2', 'e4');
    expect(square(container, 'e4').textContent).toContain('♙');
    expect(square(container, 'e2').textContent).toBe('');

    waitOutAnyAi();
    // Black hasn't moved: the whole back two ranks are still full, nothing
    // landed on ranks 5–6, and the board is waiting on Sam.
    for (const f of 'abcdefgh') {
      expect(square(container, `${f}7`).textContent).toContain('♟');
      expect(square(container, `${f}8`).textContent).not.toBe('');
      expect(square(container, `${f}6`).textContent).toBe('');
      expect(square(container, `${f}5`).textContent).toBe('');
    }
    expect(within(turnBanner()).getByText("Sam's turn")).toBeInTheDocument();
    expect(within(turnBanner()).getByText(/Black/)).toBeInTheDocument();
    expect(props.onMessage).not.toHaveBeenCalledWith('AI thinking...');

    play(container, 'e7', 'e5');
    expect(square(container, 'e5').textContent).toContain('♟');
    expect(square(container, 'e7').textContent).toBe('');
    expect(within(turnBanner()).getByText("Mia's turn")).toBeInTheDocument();

    expect(props.onScore).not.toHaveBeenCalled();
    expect(props.onEnd).not.toHaveBeenCalled();
  });

  test("White can't move out of turn", () => {
    const { container } = renderLocal();
    play(container, 'e2', 'e4');
    // It's Black's turn — White's d-pawn stays put.
    play(container, 'd2', 'd4');
    expect(square(container, 'd2').textContent).toContain('♙');
    expect(square(container, 'd4').textContent).toBe('');
  });

  test('shows check for Black too', () => {
    const { container } = renderLocal();
    play(container, 'e2', 'e4');
    play(container, 'f7', 'f6');
    expect(screen.queryByText(/Check!/)).not.toBeInTheDocument();
    play(container, 'd1', 'h5');
    expect(screen.getByText(/Check!/)).toBeInTheDocument();
    expect(within(turnBanner()).getByText("Sam's turn")).toBeInTheDocument();
  });

  test('Black can promote through the picker', () => {
    const { container } = renderLocal();
    const moves: [string, string][] = [
      ['a2', 'a3'], ['h7', 'h5'], ['g2', 'g4'], ['h5', 'g4'], ['g1', 'f3'],
      ['g4', 'f3'], ['a3', 'a4'], ['f3', 'e2'], ['a4', 'a5'],
    ];
    for (const [from, to] of moves) play(container, from, to);

    play(container, 'e2', 'f1');
    // The picker offers Black's pieces for Black's pawn
    fireEvent.click(screen.getByRole('button', { name: /knight/i }));
    expect(square(container, 'f1').textContent).toContain('♞');
    expect(screen.queryByRole('button', { name: /knight/i })).not.toBeInTheDocument();
  });

  test("Fool's Mate ends the round once with seat 2 winning", () => {
    const { props, container } = renderLocal();
    play(container, 'f2', 'f3');
    play(container, 'e7', 'e5');
    play(container, 'g2', 'g4');
    expect(props.onEnd).not.toHaveBeenCalled();
    play(container, 'd8', 'h4');

    expect(props.onEnd).toHaveBeenCalledTimes(1);
    expect(props.onEnd).toHaveBeenCalledWith({ score: 0, stars: 0, summary: 'Sam wins!', winnerSeat: 2 });

    // Nothing else happens afterwards — no AI, no second onEnd.
    waitOutAnyAi();
    play(container, 'e1', 'f2');
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });

  test('threefold repetition is a draw (winnerSeat 0)', () => {
    const { props, container } = renderLocal();
    const shuffle: [string, string][] = [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']];
    for (const [from, to] of [...shuffle, ...shuffle]) play(container, from, to);

    expect(props.onEnd).toHaveBeenCalledTimes(1);
    expect(props.onEnd).toHaveBeenCalledWith({ score: 0, stars: 0, summary: "It's a draw!", winnerSeat: 0 });
  });
});

describe('chess localResult', () => {
  test('null while the game is still going', () => {
    expect(localResult(new Chess(), SEATS)).toBeNull();
  });

  test('checkmate by White wins for seat 1', () => {
    const mated = new Chess('R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1');
    expect(localResult(mated, SEATS)).toEqual({ score: 0, stars: 0, summary: 'Mia wins!', winnerSeat: 1 });
  });

  test.each([
    ['stalemate', '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'],
    ['insufficient material', '8/8/8/4k3/8/8/8/4K3 w - - 0 1'],
    ['50-move rule', '8/8/8/4k3/8/8/2R5/4K3 w - - 100 80'],
  ])('%s is a draw', (_label, fen) => {
    expect(localResult(new Chess(fen), SEATS)).toEqual({ score: 0, stars: 0, summary: "It's a draw!", winnerSeat: 0 });
  });
});
