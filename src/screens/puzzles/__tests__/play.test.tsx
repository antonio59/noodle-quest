import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { isoWeek } from '../../../../convex/model/puzzles';

const submit = vi.fn();
const useQueryMock = vi.fn();

vi.mock('convex/react', () => ({ useMutation: () => submit, useQuery: (...args: unknown[]) => useQueryMock(...args) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ player: { sessionToken: 'tok' } }) }));
// Stand-in puzzles: a button that finishes, so the screen's flow is what's tested.
vi.mock('@/features/crossword/index', () => ({
  default: ({ onEnd, fixed }: { onEnd: () => void; fixed: { key: string } }) =>
    <button onClick={onEnd}>finish crossword {fixed.key}</button>,
}));
vi.mock('@/features/wordsearch/index', () => ({
  default: ({ onEnd, fixed }: { onEnd: () => void; fixed: { key: string } }) =>
    <button onClick={onEnd}>finish wordsearch {fixed.key}</button>,
}));

import { FamilyPuzzlePlay, WeeklyPuzzlePlay } from '../play';

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/puzzles/week/:week" element={<WeeklyPuzzlePlay />} />
        <Route path="/puzzles/family/:id/:kind" element={<FamilyPuzzlePlay />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  submit.mockReset();
  useQueryMock.mockReset();
});

const thisWeek = isoWeek(Date.now());
const PUZZLE = {
  id: 'p1', title: 'Cornwall', creatorName: 'Mum', wordCount: 4, creatorAvatar: '🐻', createdAt: 0, mine: false,
  entries: [
    { answer: 'BEACH', clue: 'a' }, { answer: 'PASTY', clue: 'b' }, { answer: 'SURF', clue: 'c' }, { answer: 'GRANDMA', clue: 'd' },
  ],
};

describe('weekly puzzle play', () => {
  test('finishing submits the time and shows the result with the family board', async () => {
    submit.mockResolvedValue({ best: 42, isNewBest: true, firstSolve: true });
    useQueryMock.mockReturnValue([{ name: 'Mia', avatar: '🦊', seconds: 42, isMe: true }]);
    renderAt(`/puzzles/week/${thisWeek}`);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`finish .* week:${thisWeek}`) }));
    expect(await screen.findByText('Your best time on this one.')).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ sessionToken: 'tok', puzzleKey: `week:${thisWeek}` }));
    expect(screen.getByRole('dialog', { name: 'Puzzle solved' })).toHaveTextContent('Mia (you)');
  });

  test('a slower replay keeps the old best', async () => {
    submit.mockResolvedValue({ best: 30, isNewBest: false, firstSolve: false });
    useQueryMock.mockReturnValue([]);
    renderAt(`/puzzles/week/${thisWeek}`);
    fireEvent.click(screen.getByRole('button', { name: /finish/ }));
    expect(await screen.findByText('Your best is still 0:30.')).toBeInTheDocument();
  });

  test('a refused save is shown, not swallowed', async () => {
    submit.mockResolvedValue({ error: "That puzzle isn't open." });
    useQueryMock.mockReturnValue([]);
    renderAt(`/puzzles/week/${thisWeek}`);
    fireEvent.click(screen.getByRole('button', { name: /finish/ }));
    expect(await screen.findByText("That puzzle isn't open.")).toBeInTheDocument();
  });

  test('old or malformed weeks are closed', () => {
    renderAt('/puzzles/week/2020-W01');
    expect(screen.getByText(/has closed/)).toBeInTheDocument();
  });
});

describe('family puzzle play', () => {
  test('plays the chosen kind', () => {
    useQueryMock.mockReturnValue(PUZZLE);
    renderAt('/puzzles/family/p1/wordsearch');
    expect(screen.getByRole('button', { name: 'finish wordsearch family:p1' })).toBeInTheDocument();
    expect(screen.getByText('Cornwall · by Mum')).toBeInTheDocument();
  });

  test('handles a deleted puzzle and an unknown kind', () => {
    useQueryMock.mockReturnValue(null);
    renderAt('/puzzles/family/p1/crossword');
    expect(screen.getByText('That puzzle has been deleted.')).toBeInTheDocument();
  });

  test('rejects unknown kinds', () => {
    useQueryMock.mockReturnValue(PUZZLE);
    renderAt('/puzzles/family/p1/sudoku');
    expect(screen.getByText("We don't know that kind of puzzle.")).toBeInTheDocument();
  });
});
