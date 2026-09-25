import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const remove = vi.fn();
const navigate = vi.fn();
const useQueryMock = vi.fn();

vi.mock('convex/react', () => ({
  useMutation: () => remove,
  useQuery: (fn: unknown, args: unknown) => useQueryMock(fn, args),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ player: { sessionToken: 'tok' } }) }));
vi.mock('react-router-dom', async importOriginal => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

import { PuzzleCorner } from '../index';
import { WeeklyPuzzleCard } from '@/components/puzzles/WeeklyPuzzleCard';

afterEach(() => {
  remove.mockReset();
  navigate.mockReset();
  useQueryMock.mockReset();
});

const MINE = { id: 'p1', title: 'Cornwall', wordCount: 6, creatorName: 'Mum', creatorAvatar: '🐻', createdAt: 0, mine: true };
const THEIRS = { ...MINE, id: 'p2', title: 'Pets', creatorName: 'Mia', mine: false };

/** listFamilyPuzzles gets an array; the weekly board gets `board`. */
function withData(list: unknown, board: unknown[] = []) {
  useQueryMock.mockImplementation((_fn, args) =>
    args && typeof args === 'object' && 'puzzleKey' in args ? board : list);
}

describe('PuzzleCorner', () => {
  test('lists family puzzles and opens them as crossword or word search', () => {
    withData([MINE, THEIRS]);
    render(<MemoryRouter><PuzzleCorner /></MemoryRouter>);
    const pets = screen.getByRole('heading', { name: 'Pets' }).closest('li')!;
    fireEvent.click(within(pets).getByRole('button', { name: /Word search/ }));
    expect(navigate).toHaveBeenCalledWith('/puzzles/family/p2/wordsearch');
    expect(within(pets).queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });

  test('deleting your own puzzle asks first', () => {
    withData([MINE]);
    render(<MemoryRouter><PuzzleCorner /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Cornwall' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Cornwall' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(remove).toHaveBeenCalledWith({ sessionToken: 'tok', puzzleId: 'p1' });
  });

  test('empty state invites the first puzzle', () => {
    withData([]);
    render(<MemoryRouter><PuzzleCorner /></MemoryRouter>);
    expect(screen.getByText(/No family puzzles yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Make a puzzle/ }));
    expect(navigate).toHaveBeenCalledWith('/puzzles/new');
  });
});

describe('WeeklyPuzzleCard', () => {
  test('shows the leader and invites you to beat your own time', () => {
    withData([], [
      { name: 'Mia', avatar: '🦊', seconds: 95, isMe: false },
      { name: 'Dad', avatar: '🐻', seconds: 130, isMe: true },
    ]);
    render(<MemoryRouter><WeeklyPuzzleCard /></MemoryRouter>);
    const card = screen.getByRole('button', { name: /This week's family puzzle/ });
    expect(card).toHaveTextContent('Mia leads in 1:35 · 2 solved');
    expect(card).toHaveTextContent('Beat 2:10');
    fireEvent.click(card);
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/puzzles\/week\/\d{4}-W\d{2}$/));
  });

  test('nobody solved yet', () => {
    withData([], []);
    render(<MemoryRouter><WeeklyPuzzleCard /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /This week's family puzzle/ })).toHaveTextContent('Nobody has solved it yet');
  });
});
