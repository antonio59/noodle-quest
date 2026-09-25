import { expect, test, vi } from 'vitest';
import { render } from '@testing-library/react';
import Uno from '@/games/uno';
import { dealInitial } from '../logic';

vi.mock('../logic', async importOriginal => {
  const actual = await importOriginal<typeof import('../logic')>();
  return { ...actual, dealInitial: vi.fn(actual.dealInitial) };
});

// Regression: the first solo round built hands, deck and discard from five
// separate shuffles, so one card could be in both hands (and the deck).
test('the first solo round comes from a single deal', () => {
  render(<Uno stage={1} onScore={vi.fn()} onProgress={vi.fn()} onMessage={vi.fn()} onEnd={vi.fn()} />);
  expect(vi.mocked(dealInitial)).toHaveBeenCalledTimes(1);
});
