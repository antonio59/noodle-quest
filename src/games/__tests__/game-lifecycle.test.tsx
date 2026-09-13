/**
 * Game lifecycle contract tests.
 *
 * Advances fake timers up to 60s for each game, then unmounts. Verifies:
 *   - onEnd fires at most once; when it fires, stars in [0,3] integer and
 *     score is numeric.
 *   - Every onProgress(v) call has v in [0, 1] (± tiny epsilon).
 *
 * Interaction-only games still get the mount/advance/unmount smoke, but we
 * only validate the invariants (we don't expect onEnd to fire).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act } from 'react';
import { render, cleanup } from '@testing-library/react';
import '@/lib/game-manifest';
import { getGameComponent } from '@/lib/game-registry';
import type { GameProps } from '@/types';

const GAME_IDS = [
  'anagram', 'attention-archery', 'bingo', 'bookworm', 'box-breathing', 'breath-bubbles',
  'calm-breathing', 'checkers', 'chess', 'coherent-breathing', 'color-rush',
  'connect-four', 'connect-lines', 'copy-cat', 'crossword', 'cube-twist',
  'dual-n-back', 'echo-tap', 'emotion-volcano', 'empathy-engine', 'feelings-faces',
  'fill-blank', 'flag-match', 'flexibility-frames', 'focus-frenzy', 'go-no-go',
  'grounding', 'just-right', 'ludo', 'map-quiz', 'memory-match', 'mirror-match',
  'minesweeper', 'mistake-master', 'mole-mash', 'number-ninja', 'patience-pop',
  'pattern-painter', 'pixel-paint', 'quick-math', 'reverse-cat', 'routine-roadmap',
  'score-four', 'scrabble', 'snakes-ladders', 'squish-lab', 'steady-hands',
  'story-builder', 'stroop-challenge', 'sudoku', 'tic-tac-toe', 'triangle-breathing',
  'uno', 'word-guess', 'wordsearch',
];

const EPS = 0.001;

interface Harness {
  props: GameProps;
  endCalls: Array<{ score: number; stars: number; summary: string }>;
  progressValues: number[];
}

function makeHarness(): Harness {
  const endCalls: Harness['endCalls'] = [];
  const progressValues: number[] = [];
  const props: GameProps = {
    stage: 1,
    onScore: vi.fn(),
    onProgress: vi.fn((v: number) => { progressValues.push(v); }),
    onMessage: vi.fn(),
    onEnd: vi.fn((r) => { endCalls.push(r); }),
    aiDifficulty: 'medium',
  };
  return { props, endCalls, progressValues };
}

function assertInvariants(h: Harness, id: string) {
  for (const v of h.progressValues) {
    expect(Number.isFinite(v), `${id}: progress not finite: ${v}`).toBe(true);
    expect(v, `${id}: progress below 0: ${v}`).toBeGreaterThanOrEqual(-EPS);
    expect(v, `${id}: progress above 1: ${v}`).toBeLessThanOrEqual(1 + EPS);
  }
  expect(h.endCalls.length, `${id}: onEnd fired ${h.endCalls.length} times`).toBeLessThanOrEqual(1);
  if (h.endCalls.length === 1) {
    const { score, stars } = h.endCalls[0];
    expect(typeof score, `${id}: score not numeric`).toBe('number');
    expect(Number.isFinite(score), `${id}: score not finite`).toBe(true);
    expect(Number.isInteger(stars), `${id}: stars not integer: ${stars}`).toBe(true);
    expect(stars, `${id}: stars below 0`).toBeGreaterThanOrEqual(0);
    expect(stars, `${id}: stars above 3`).toBeLessThanOrEqual(3);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => { vi.runOnlyPendingTimers(); });
  cleanup();
  vi.useRealTimers();
});

describe('game lifecycle contract', () => {
  for (const id of GAME_IDS) {
    it(`${id} upholds invariants through 60s of fake time`, () => {
      vi.clearAllMocks();
      const Component = getGameComponent(id);
      expect(Component, `${id} component not registered`).toBeDefined();
      if (!Component) return;

      const h = makeHarness();
      const { unmount } = render(<Component {...h.props} />);

      // Advance in chunks so any chained timers can flush.
      for (let i = 0; i < 6; i++) {
        act(() => { vi.advanceTimersByTime(10_000); });
      }

      assertInvariants(h, id);
      expect(() => unmount()).not.toThrow();
    });
  }
});
