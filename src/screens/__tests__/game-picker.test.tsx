import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@/lib/game-manifest';

const navigate = vi.fn();

vi.mock('convex/react', () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ player: null }) }));
vi.mock('react-router-dom', async importOriginal => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

import { GameHub } from '@/screens/game-hub';
import { Home } from '@/screens/home';

describe('tonights game picker', () => {
  test('Play together opens the board tab for 2 or more', () => {
    render(<MemoryRouter><Home /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Play together/ }));
    expect(navigate).toHaveBeenCalledWith('/games?tab=board&players=2plus');
  });

  test('board chips hide solo games and name the chip to loosen', () => {
    render(
      <MemoryRouter initialEntries={['/games?tab=board&players=2plus']}>
        <GameHub />
      </MemoryRouter>,
    );
    expect(screen.getByText('Checkers')).toBeInTheDocument();
    expect(screen.getByText('Tic-Tac-Toe')).toBeInTheDocument();
    expect(screen.queryByText('2048')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3–4', pressed: true })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Under 5' }));
    expect(screen.queryByText('Checkers')).not.toBeInTheDocument();
    expect(screen.getByText('Tic-Tac-Toe')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Everyone' }));
    expect(screen.queryByText('Tic-Tac-Toe')).not.toBeInTheDocument();
    expect(screen.getByText('No games match. Loosen Everyone, 2 or more players, or Under 5.')).toBeInTheDocument();
  });
});
