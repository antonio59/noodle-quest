import { afterEach, describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { GameProps, MultiplayerState } from '@/types';
import ScrabbleGame from '@/games/scrabble';
import { clearDictionaryCache } from '@/games/scrabble/dictionary';

// A real-ish dictionary: CAT plus enough filler to pass the corrupt-file guard.
const filler = (n: number): string => {
  let s = ''; let x = n;
  do { s = String.fromCharCode(65 + (x % 26)) + s; x = Math.floor(x / 26); } while (x > 0);
  return 'Q' + s.padStart(4, 'A');
};
const dict = ['CAT', ...Array.from({ length: 20000 }, (_, i) => filler(i))].join('\n');

const emptyBoard = () => Array.from({ length: 15 }, () => Array(15).fill(null));
const base: GameProps = { stage: 1, onScore: () => {}, onProgress: () => {}, onMessage: () => {}, onEnd: () => {} };

function hostState(): MultiplayerState {
  return {
    sessionId: 's1', playerNumber: 1, currentPlayer: 1,
    opponentName: 'Guesty', opponentAvatar: '🐱',
    players: [
      { id: 'p1' as never, name: 'Hosty', avatar: '🦊', seat: 1 },
      { id: 'p2' as never, name: 'Guesty', avatar: '🐱', seat: 2 },
    ],
    status: 'playing',
    boardState: {
      board: emptyBoard(),
      racks: [['C', 'A', 'T', 'X', 'Y', 'Z', 'W'], ['E', 'E', 'E', 'E', 'E', 'E', 'E']],
      pool: ['R', 'S', 'T'],
      scores: [0, 0], currentSeat: 0, isFirstMove: true, lastWord: '', dict: 'intl',
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  clearDictionaryCache();
});

describe('scrabble online submit', () => {
  test('the submitted board keeps the tiles that were just played', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(dict) }));
    const dispatched: { boardState: { board: (string | null)[][] } }[] = [];
    render(
      <ScrabbleGame
        {...base}
        multiplayerState={hostState()}
        onMultiplayerMove={m => dispatched.push(m as never)}
      />,
    );

    await waitFor(() => expect(screen.queryAllByRole('button', { name: /tile C/i })).toHaveLength(1));

    // Lay CAT through the centre star (row 8 = index 7), columns 7,8,9
    const place = (letter: string, row: number, col: number) => {
      fireEvent.click(screen.getAllByRole('button', { name: new RegExp(`tile ${letter}`, 'i') })[0]);
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`row ${row}, column ${col}$`, 'i') }));
    };
    place('C', 8, 8);
    place('A', 8, 9);
    place('T', 8, 10);

    // All three are on the board before submitting
    expect(screen.getByRole('button', { name: /row 8, column 8: C/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /submit|play word/i }));

    await waitFor(() => expect(dispatched.length).toBeGreaterThan(0));
    const sent = dispatched[dispatched.length - 1].boardState.board;
    // THE BUG: if the dispatched board is empty, the played word is lost the
    // moment the server echoes this state back.
    expect(sent[7][7]).toBe('C');
    expect(sent[7][8]).toBe('A');
    expect(sent[7][9]).toBe('T');
  });

  test('the played word survives a parent re-render that carries STALE server state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(dict) }));
    const dispatched: { boardState: unknown }[] = [];
    const initial = hostState();
    const { rerender } = render(
      <ScrabbleGame {...base} multiplayerState={initial} onMultiplayerMove={m => dispatched.push(m as never)} />,
    );

    await waitFor(() => expect(screen.queryAllByRole('button', { name: /tile C/i })).toHaveLength(1));
    const place = (letter: string, row: number, col: number) => {
      fireEvent.click(screen.getAllByRole('button', { name: new RegExp(`tile ${letter}`, 'i') })[0]);
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`row ${row}, column ${col}$`, 'i') }));
    };
    place('C', 8, 8); place('A', 8, 9); place('T', 8, 10);
    fireEvent.click(screen.getByRole('button', { name: /submit|play word/i }));
    await waitFor(() => expect(dispatched.length).toBeGreaterThan(0));

    // The mutation is still in flight. play.tsx re-renders for an unrelated
    // reason and hands down a NEW object still carrying the PRE-move board.
    rerender(
      <ScrabbleGame
        {...base}
        multiplayerState={{ ...initial }}
        onMultiplayerMove={m => dispatched.push(m as never)}
      />,
    );

    // The word must not be wiped by that stale echo.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /row 8, column 8: C/i })).toBeInTheDocument();
    });
  });

  test('a fresh empty-board snapshot from the server cannot wipe a just-submitted word', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(dict) }));
    const dispatched: { boardState: { board: (string | null)[][] } }[] = [];
    const initial = hostState();
    const { rerender } = render(
      <ScrabbleGame {...base} multiplayerState={initial} onMultiplayerMove={m => dispatched.push(m as never)} />,
    );

    await waitFor(() => expect(screen.queryAllByRole('button', { name: /tile C/i })).toHaveLength(1));
    const place = (letter: string, row: number, col: number) => {
      fireEvent.click(screen.getAllByRole('button', { name: new RegExp(`tile ${letter}`, 'i') })[0]);
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`row ${row}, column ${col}$`, 'i') }));
    };
    place('C', 8, 8); place('A', 8, 9); place('T', 8, 10);
    fireEvent.click(screen.getByRole('button', { name: /submit|play word/i }));
    await waitFor(() => expect(dispatched.length).toBeGreaterThan(0));

    // Convex often re-emits the pre-move document as a new object while the
    // mutation is in flight. Occupancy is still 0 — that must not clobber CAT.
    rerender(
      <ScrabbleGame
        {...base}
        multiplayerState={{
          ...initial,
          boardState: { ...initial.boardState as object, board: emptyBoard() },
        }}
        onMultiplayerMove={m => dispatched.push(m as never)}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /row 8, column 8: C/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /row 8, column 9: A/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /row 8, column 10: T/i })).toBeInTheDocument();
    });
  });
});
