// Puzzles that must come out the same on every device: the shared weekly
// family puzzle and puzzles the family built from their own words. Both are
// seeded from their key, so everyone races on an identical grid.
import type { ClueEntry, WordEntry } from '@/data/words/schema';
import { EN_GB_CORE_CLUES, EN_GB_CORE_WORDS } from '@/data/words/en-gb-core';
import { excludeBanned } from '@/data/words/filters';
import { seedFromKey, weeklyPuzzleKind, type PuzzleEntry } from '../../convex/model/puzzles';

export type PuzzleKind = 'crossword' | 'wordsearch';

export interface FixedPuzzle {
  /** Stable identity: "week:2026-W39" or "family:<id>". */
  key: string;
  kind: PuzzleKind;
  seed: number;
  words: WordEntry[];
  clues: ClueEntry[];
  gridSize: number;
  maxWords: number;
}

const WEEKLY_SIZE: Record<PuzzleKind, { gridSize: number; maxWords: number }> = {
  crossword: { gridSize: 11, maxWords: 12 },
  wordsearch: { gridSize: 12, maxWords: 12 },
};

export function weeklyPuzzle(week: string): FixedPuzzle {
  const key = `week:${week}`;
  const kind = weeklyPuzzleKind(week);
  return {
    key,
    kind,
    seed: seedFromKey(key),
    words: excludeBanned(EN_GB_CORE_WORDS),
    clues: EN_GB_CORE_CLUES,
    ...WEEKLY_SIZE[kind],
  };
}

function familyWord(answer: string): WordEntry {
  return {
    id: `fam-${answer}`,
    answer,
    normalised: answer,
    locale: 'en-GB',
    length: answer.length,
    tags: ['family'],
    difficulty: 1,
    frequency: 500,
  };
}

export function familyPuzzle(puzzleId: string, entries: readonly PuzzleEntry[], kind: PuzzleKind): FixedPuzzle {
  const key = `family:${puzzleId}`;
  const longest = Math.max(...entries.map(e => e.answer.length));
  // Room for every word to cross or hide, without a sea of empty squares.
  const gridSize = Math.min(15, Math.max(kind === 'crossword' ? 10 : 9, longest + (kind === 'crossword' ? 3 : 2)));
  return {
    key,
    kind,
    seed: seedFromKey(key),
    words: entries.map(e => familyWord(e.answer)),
    clues: entries.map(e => ({ wordId: `fam-${e.answer}`, clue: e.clue, locale: 'en-GB', source: 'family' })),
    gridSize,
    maxWords: entries.length,
  };
}
