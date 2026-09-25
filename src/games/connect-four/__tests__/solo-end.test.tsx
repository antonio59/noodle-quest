import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ConnectFourGame from '..';

// A predictable opponent: always drops in the far-right column.
vi.mock('../logic', async (importOriginal) => {
  const real = await importOriginal<typeof import('../logic')>();
  return { ...real, bestMove: vi.fn(() => 6) };
});

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

// Regression: the win branch marked the game ended before scheduling onEnd,
// and schedule() skips callbacks once ended — solo results were never saved.
test('a solo win reports its result', () => {
  const onEnd = vi.fn();
  render(
    <ConnectFourGame stage={1} aiDifficulty="easy" onScore={vi.fn()} onProgress={vi.fn()} onMessage={vi.fn()} onEnd={onEnd} />,
  );
  fireEvent.click(screen.getByRole('button', { name: /start game/i }));
  for (let i = 0; i < 4; i++) {
    fireEvent.click(screen.getByRole('button', { name: 'Drop disc in column 1' }));
    act(() => { vi.advanceTimersByTime(3000); });
  }
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ stars: 3 }));
});
