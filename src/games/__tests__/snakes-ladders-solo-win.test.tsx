import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SnakesLaddersGame from '@/games/snakes-ladders';

const face = (f: number) => (f - 0.5) / 6;
const NO = 0.999; // fails the AI's ladder/snake-avoid chance checks

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

// Regression: the win branch marked the game ended before scheduling onEnd,
// and schedule() skips callbacks once ended — so solo wins were never saved.
test('a solo win reaches onEnd so the score is saved', () => {
  // Player: 1 (ladder 1→38), 6, 6, 1 (ladder 51→67), 4 (ladder 71→91), 6, 3 → 100.
  // AI: first roll is one call; later turns are [ladder check, snake check, roll].
  const calls = [
    face(1), face(2),
    face(6), NO, NO, face(2),
    face(6), NO, NO, face(2),
    face(1), NO, NO, face(2),
    face(4), NO, NO, face(2),
    face(6), NO, NO, face(2),
    face(3),
  ];
  vi.spyOn(Math, 'random').mockImplementation(() => calls.shift() ?? face(2));
  const onEnd = vi.fn();
  render(
    <SnakesLaddersGame
      stage={1}
      aiDifficulty="easy"
      onScore={vi.fn()}
      onProgress={vi.fn()}
      onMessage={vi.fn()}
      onEnd={onEnd}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /start game/i }));
  for (let turn = 0; turn < 7; turn++) {
    fireEvent.click(screen.getByRole('button', { name: /roll/i }));
    act(() => { vi.advanceTimersByTime(6000); });
  }
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ stars: 3 }));
});
