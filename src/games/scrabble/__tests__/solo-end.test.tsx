import { afterEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ScrabbleGame from '@/games/scrabble';
import { clearDictionaryCache } from '@/games/scrabble/dictionary';

// A dictionary the AI can't build anything from (every word starts with Q +
// four letters, and the bag holds no Q), so it passes and rounds tick over.
const filler = (n: number): string => {
  let s = ''; let x = n;
  do { s = String.fromCharCode(65 + (x % 26)) + s; x = Math.floor(x / 26); } while (x > 0);
  return 'Q' + s.padStart(4, 'A');
};
const dict = Array.from({ length: 20000 }, (_, i) => filler(i)).join('\n');

vi.mock('@/games/scrabble/logic', async importOriginal => {
  const actual = await importOriginal<typeof import('@/games/scrabble/logic')>();
  return { ...actual, buildTilePool: () => Array<string>(60).fill('E') };
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clearDictionaryCache();
});

// Regression: finishGame marked the game ended, then scheduled onEnd through
// schedule(), which drops callbacks once ended — solo results never saved.
test('a solo game that runs out of rounds reports its result', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(dict) }));
  const onEnd = vi.fn();
  render(<ScrabbleGame stage={1} onScore={vi.fn()} onProgress={vi.fn()} onMessage={vi.fn()} onEnd={onEnd} />);
  fireEvent.click(await screen.findByRole('button', { name: /start game/i }));
  vi.useFakeTimers();

  for (let round = 0; round < 12 && onEnd.mock.calls.length === 0; round++) {
    const passBtn = screen.queryByRole('button', { name: 'Pass' });
    if (passBtn && !passBtn.hasAttribute('disabled')) fireEvent.click(passBtn);
    act(() => { vi.advanceTimersByTime(5000); });
  }
  act(() => { vi.advanceTimersByTime(5000); });
  expect(onEnd).toHaveBeenCalledTimes(1);
});
