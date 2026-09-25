import { afterEach, describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/lib/game-manifest';

const useQueryMock = vi.fn();
vi.mock('convex/react', () => ({ useQuery: (...args: unknown[]) => useQueryMock(...args) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ player: { sessionToken: 'tok' } }) }));

import { FamilyWeekCard } from '../FamilyWeekCard';

afterEach(() => useQueryMock.mockReset());

const WEEK = {
  since: 0,
  totalPlays: 7,
  totalStars: 12,
  players: [
    { name: 'Mia', avatar: '🦊', plays: 5, stars: 9, gamesTried: 3 },
    { name: 'Dad', avatar: '🐻', plays: 2, stars: 3, gamesTried: 1 },
  ],
  topGame: { gameId: 'chess', plays: 4 },
  challengeWins: [{ winner: 'Mia', loser: 'Dad', gameId: 'uno' }],
  puzzleLeader: null,
};

describe('FamilyWeekCard', () => {
  test('shows totals, star of the week, per-player rows and highlights', () => {
    useQueryMock.mockReturnValue(WEEK);
    render(<FamilyWeekCard />);
    expect(screen.getByText(/star of the week/)).toHaveTextContent('Mia');
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Mia');
    expect(rows[0]).toHaveTextContent('5 · 9⭐');
    expect(screen.getByText(/Most played: .*Chess \(4\)/)).toBeInTheDocument();
    expect(screen.getByText(/Mia beat Dad at .*UNO/)).toBeInTheDocument();
  });

  test('a quiet week nudges a game night', () => {
    useQueryMock.mockReturnValue({ ...WEEK, totalPlays: 0, totalStars: 0, players: [], topGame: null, challengeWins: [] });
    render(<FamilyWeekCard />);
    expect(screen.getByText(/A quiet week so far/)).toBeInTheDocument();
  });

  test('renders nothing while loading or signed out', () => {
    useQueryMock.mockReturnValue(null);
    const { container } = render(<FamilyWeekCard />);
    expect(container).toBeEmptyDOMElement();
  });
});
