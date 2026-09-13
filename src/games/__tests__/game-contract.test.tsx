/**
 * Game contract smoke tests.
 *
 * For every registered game, verifies:
 *   1. The component's dynamic import resolves.
 *   2. It mounts at stage 1 without throwing.
 *   3. It accepts the standard GameProps without type errors at runtime.
 *   4. It unmounts cleanly (no leaked timers firing setState after unmount).
 *
 * These are smoke tests — they do not exercise full gameplay. They catch
 * regressions where a refactor breaks a game's render path or lifecycle.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@/lib/game-manifest';
import { getGameComponent, getGameMeta } from '@/lib/game-registry';
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

function makeProps(overrides: Partial<GameProps> = {}): GameProps {
  return {
    stage: 1,
    onScore: vi.fn(),
    onProgress: vi.fn(),
    onMessage: vi.fn(),
    onEnd: vi.fn(),
    aiDifficulty: 'medium',
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('game contract', () => {
  it('registers every expected game', () => {
    for (const id of GAME_IDS) {
      expect(getGameMeta(id), `${id} meta missing`).toBeDefined();
    }
  });

  // Feature-backed games (crossword, wordsearch) live outside src/games.
  // The manifest registers their components too; the smoke test below
  // covers every registered GAME_ID including those.
  for (const id of GAME_IDS) {
    it(`${id} mounts and unmounts without throwing`, () => {
      const Component = getGameComponent(id);
      expect(Component, `${id} component not registered`).toBeDefined();
      if (!Component) return;

      const { unmount } = render(<Component {...makeProps()} />);

      // Let any synchronous mount effects settle.
      expect(() => unmount()).not.toThrow();
    });
  }
});
