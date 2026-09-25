import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MatchResult } from '../MatchResult';

const SEATS = [{ name: 'Dad', avatar: '🐻' }, { name: 'Mia', avatar: '🦊' }];

function renderResult(overrides: Partial<Parameters<typeof MatchResult>[0]> = {}) {
  const props = {
    gameName: 'Chess', gameEmoji: '♔', seats: SEATS, winnerSeat: 2 as number | undefined,
    tally: { Mia: 2, Dad: 1 }, shareState: 'idle' as const,
    onShare: vi.fn(), onRematch: vi.fn(), onDone: vi.fn(), ...overrides,
  };
  render(<MatchResult {...props} />);
  return props;
}

describe('MatchResult', () => {
  test('names the winner, the match and the running tally', () => {
    renderResult();
    expect(screen.getByRole('heading', { name: 'Mia wins!' })).toBeInTheDocument();
    expect(screen.getByText(/Mia beat Dad at Chess/)).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Dad');
    expect(rows[0]).toHaveTextContent('1');
    expect(rows[1]).toHaveTextContent('Mia');
    expect(rows[1]).toHaveTextContent('2');
  });

  test('draws say so', () => {
    renderResult({ winnerSeat: 0 });
    expect(screen.getByRole('heading', { name: "It's a draw!" })).toBeInTheDocument();
  });

  test('rematch, share and done call back', () => {
    const props = renderResult();
    fireEvent.click(screen.getByRole('button', { name: /Rematch/ }));
    fireEvent.click(screen.getByRole('button', { name: /Tell the family/ }));
    fireEvent.click(screen.getByRole('button', { name: /Back to Board games/ }));
    expect(props.onRematch).toHaveBeenCalled();
    expect(props.onShare).toHaveBeenCalled();
    expect(props.onDone).toHaveBeenCalled();
  });

  test('share shows posted / failed states and is disabled once posted', () => {
    const { unmount } = render(<MatchResult gameName="Chess" gameEmoji="♔" seats={SEATS} winnerSeat={1} tally={{}}
      shareState="shared" onShare={vi.fn()} onRematch={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Posted/ })).toBeDisabled();
    unmount();
    renderResult({ shareState: 'failed' });
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't post that");
  });

  test('without a signed-in player there is nothing to share to', () => {
    renderResult({ onShare: null });
    expect(screen.getByRole('button', { name: /Tell the family/ })).toBeDisabled();
  });
});
