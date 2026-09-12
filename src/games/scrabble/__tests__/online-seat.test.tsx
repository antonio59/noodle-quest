import { afterEach, describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { GameProps, MultiplayerState } from '@/types';
import ScrabbleGame from '@/games/scrabble';
import { clearDictionaryCache } from '@/games/scrabble/dictionary';

const letters = (n: number): string => {
  let s = ''; let x = n;
  do { s = String.fromCharCode(65 + (x % 26)) + s; x = Math.floor(x / 26); } while (x > 0);
  return s;
};
const bigList = Array.from({ length: 20000 }, (_, i) => 'W' + letters(i).padStart(4, 'A')).join('\n');

const emptyBoard = () => Array.from({ length: 15 }, () => Array(15).fill(null));

const base: GameProps = {
  stage: 1,
  onScore: () => {}, onProgress: () => {}, onMessage: () => {}, onEnd: () => {},
};

/** Guest = seat 2, so mySeat = 1. Host holds rack index 0. */
function guestState(): MultiplayerState {
  return {
    sessionId: 's1',
    playerNumber: 2,
    currentPlayer: 2, // guest's turn
    opponentName: 'Hosty',
    opponentAvatar: '🦊',
    players: [
      { id: 'p1' as never, name: 'Hosty', avatar: '🦊', seat: 1 },
      { id: 'p2' as never, name: 'Guesty', avatar: '🐱', seat: 2 },
    ],
    status: 'playing',
    boardState: {
      board: emptyBoard(),
      racks: [['Z', 'Z', 'Z', 'Z', 'Z', 'Z', 'Z'], ['A', 'B', 'C', 'D', 'E', 'F', 'G']],
      pool: ['H', 'I', 'J'],
      scores: [0, 0],
      currentSeat: 1, // 0-indexed → the guest
      isFirstMove: true,
      lastWord: '',
      dict: 'intl',
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  clearDictionaryCache();
});

describe('scrabble online seat handling (guest)', () => {
  test('the guest plays from their own rack, not the host seat', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(bigList) }));
    render(<ScrabbleGame {...base} multiplayerState={guestState()} />);

    // The guest's own tiles (A-G) are shown, not the host's (Z)
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /tile A/i }).length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole('button', { name: /tile Z/i })).not.toBeInTheDocument();

    // Placing a tile must consume it from the GUEST's rack. Before the fix the
    // hardcoded seat 0 drained the host's rack and this tile never left.
    expect(screen.queryAllByRole('button', { name: /tile A/i })).toHaveLength(1);
    fireEvent.click(screen.getAllByRole('button', { name: /tile A/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /row 8, column 8/i }));
    // The A leaves the guest's own rack. With the old hardcoded seat 0 it
    // was filtered out of the HOST's rack instead and stayed here forever.
    await waitFor(() => {
      expect(screen.queryAllByRole('button', { name: /tile A/i })).toHaveLength(0);
    });
    // ...and it landed on the board
    expect(screen.getByRole('button', { name: /row 8, column 8: A/i })).toBeInTheDocument();
  });

  test('the guest is labelled "You", not the host', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(bigList) }));
    render(<ScrabbleGame {...base} multiplayerState={guestState()} />);
    await waitFor(() => expect(screen.getAllByText('You').length).toBeGreaterThan(0));
    // The opponent is named, never called "AI" in an online game
    expect(screen.getAllByText(/Hosty/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^AI/)).not.toBeInTheDocument();
  });
});
