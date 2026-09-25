import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { GameProps, LocalSeat } from '@/types';
import CheckersGame from '@/games/checkers';
import { SIZE, initBoard, type Board, type Color } from '../logic';
import { localResult } from '../pass-and-play';

const SEATS: LocalSeat[] = [
  { name: 'Mia', avatar: '🦊' },
  { name: 'Sam', avatar: '🐻' },
];

const PIECE_FILL: Record<Color, string> = { red: '#DC2626', black: '#1F2937' };

// A quick cooperative game (found by search) in which Red leaves Black with
// no legal move after 23 plies. "x" marks jumps; multi-jumps list every hop.
const RED_WINS_LINE = [
  'c3-d4', 'h6-g5', 'g3-f4', 'f6-e5', 'd4xf6', 'g7xe5xg3', 'h2xf4xh6', 'f8-g7',
  'h6xf8', 'd6-e5', 'f8xd6xf4', 'd8-e7', 'e3-d4', 'b6-c5', 'd4xb6xd8xf6', 'a7-b6',
  'a3-b4', 'b6-c5', 'b4xd6', 'b8-c7', 'd6xb8', 'h8-g7', 'f6xh8',
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
  const { container } = render(<CheckersGame {...props} />);
  return { props, container };
}

/** The clickable square for e.g. "c3" — rows run rank 8 → 1, files a → h. */
function square(container: HTMLElement, name: string): Element {
  const file = name.charCodeAt(0) - 97;
  const rank = Number(name[1]);
  return container.querySelectorAll('svg[role="application"] > g')[(SIZE - rank) * SIZE + file];
}

function pieceAt(container: HTMLElement, name: string): Color | null {
  const sq = square(container, name);
  if (sq.querySelector(`circle[fill="${PIECE_FILL.red}"]`)) return 'red';
  if (sq.querySelector(`circle[fill="${PIECE_FILL.black}"]`)) return 'black';
  return null;
}

/** Plays "c3-d4" or "d4xb6xd8": tap the piece, then every landing square. */
function play(container: HTMLElement, move: string) {
  const [from, ...hops] = move.split(/[-x]/);
  const mover = pieceAt(container, from);
  fireEvent.click(square(container, from));
  for (const to of hops) fireEvent.click(square(container, to));
  expect(pieceAt(container, hops[hops.length - 1]), `${move} didn't land`).toBe(mover);
}

/** Every occupied square of `color`, e.g. ["a7", "b8", ...]. */
function squaresOf(container: HTMLElement, color: Color): string[] {
  const out: string[] = [];
  for (let rank = 1; rank <= SIZE; rank++) {
    for (const f of 'abcdefgh') {
      if (pieceAt(container, `${f}${rank}`) === color) out.push(`${f}${rank}`);
    }
  }
  return out;
}

/** Well past the solo AI's think + hop delays. */
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

describe('checkers pass & play', () => {
  test('skips the intro and seats Mia as Red, Sam as Black', () => {
    const { container } = renderLocal();

    expect(screen.queryByRole('button', { name: /start game/i })).not.toBeInTheDocument();
    expect(container.querySelector('svg[role="application"]')).not.toBeNull();
    expect(within(turnBanner()).getByText("Mia's turn")).toBeInTheDocument();
    expect(within(turnBanner()).getByText(/Red/)).toBeInTheDocument();
    expect(screen.getByText('🦊 Mia (Red): 12')).toBeInTheDocument();
    expect(screen.getByText('🐻 Sam (Black): 12')).toBeInTheDocument();
    expect(screen.queryByText(/AI|You:/)).not.toBeInTheDocument();
  });

  test('seat 1 moves Red, no AI replies, then seat 2 moves Black', () => {
    const { props, container } = renderLocal();
    const blackAtStart = squaresOf(container, 'black');

    play(container, 'c3-d4');
    waitOutAnyAi();
    // Black hasn't moved and the board is waiting on Sam.
    expect(squaresOf(container, 'black')).toEqual(blackAtStart);
    expect(within(turnBanner()).getByText("Sam's turn")).toBeInTheDocument();
    expect(within(turnBanner()).getByText(/Black/)).toBeInTheDocument();
    expect(props.onMessage).not.toHaveBeenCalledWith('AI thinking...');

    play(container, 'f6-e5');
    expect(pieceAt(container, 'f6')).toBeNull();
    expect(within(turnBanner()).getByText("Mia's turn")).toBeInTheDocument();

    expect(props.onScore).not.toHaveBeenCalled();
    expect(props.onEnd).not.toHaveBeenCalled();
  });

  test("Red can't move out of turn", () => {
    const { container } = renderLocal();
    play(container, 'c3-d4');
    // It's Black's turn — tapping a Red piece and a free square does nothing.
    fireEvent.click(square(container, 'e3'));
    fireEvent.click(square(container, 'f4'));
    expect(pieceAt(container, 'e3')).toBe('red');
    expect(pieceAt(container, 'f4')).toBeNull();
  });

  test('leaving Black with no moves ends the round once with seat 1 winning', () => {
    const { props, container } = renderLocal();
    for (const move of RED_WINS_LINE.slice(0, -1)) play(container, move);
    expect(props.onEnd).not.toHaveBeenCalled();

    play(container, RED_WINS_LINE[RED_WINS_LINE.length - 1]);
    expect(props.onEnd).toHaveBeenCalledTimes(1);
    expect(props.onEnd).toHaveBeenCalledWith({ score: 0, stars: 0, summary: 'Mia wins!', winnerSeat: 1 });

    // Nothing else happens afterwards — no AI, no second onEnd.
    waitOutAnyAi();
    fireEvent.click(square(container, 'h8'));
    fireEvent.click(square(container, 'g7'));
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });
});

describe('checkers localResult', () => {
  function emptyBoard(): Board {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  }

  test('null while the other side can still move', () => {
    expect(localResult(initBoard(), 'red', SEATS)).toBeNull();
  });

  test('Black wins for seat 2 when Red has no pieces left', () => {
    const b = emptyBoard();
    b[3][4] = { color: 'black', king: false };
    expect(localResult(b, 'black', SEATS)).toEqual({ score: 0, stars: 0, summary: 'Sam wins!', winnerSeat: 2 });
  });

  test('Red wins for seat 1 when Black is blocked in', () => {
    const b = emptyBoard();
    // Black man on b8: both steps (a7, c7) are taken and the jump over c7
    // lands on an occupied d6.
    b[0][1] = { color: 'black', king: false };
    b[1][0] = { color: 'red', king: false };
    b[1][2] = { color: 'red', king: false };
    b[2][3] = { color: 'red', king: false };
    expect(localResult(b, 'red', SEATS)).toEqual({ score: 0, stars: 0, summary: 'Mia wins!', winnerSeat: 1 });
  });
});
