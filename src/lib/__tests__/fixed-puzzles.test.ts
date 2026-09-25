import { describe, expect, test } from 'vitest';
import { familyPuzzle, weeklyPuzzle } from '../fixed-puzzles';
import { generateCrossword } from '@/lib/puzzle-engine/crossword/generator';
import { generateWordSearch } from '@/lib/puzzle-engine/wordsearch/generator';

const ENTRIES = [
  { answer: 'BEACH', clue: 'Sandy place by the sea' },
  { answer: 'PASTY', clue: 'Cornish pastry' },
  { answer: 'SURF', clue: 'Ride a wave' },
  { answer: 'GRANDMA', clue: "Dad's mum" },
];

describe('weeklyPuzzle', () => {
  test('everyone gets the same grid for the same week', () => {
    const a = weeklyPuzzle('2026-W40');
    const b = weeklyPuzzle('2026-W40');
    expect(a.seed).toBe(b.seed);
    const gridA = generateCrossword(a.words, a.clues, { gridSize: a.gridSize, maxWords: a.maxWords, seed: a.seed });
    const gridB = generateCrossword(b.words, b.clues, { gridSize: b.gridSize, maxWords: b.maxWords, seed: b.seed });
    expect(gridA.words).toEqual(gridB.words);
  });

  test('alternates kind and changes seed week to week', () => {
    expect(weeklyPuzzle('2026-W40').kind).toBe('crossword');
    expect(weeklyPuzzle('2026-W41').kind).toBe('wordsearch');
    expect(weeklyPuzzle('2026-W40').seed).not.toBe(weeklyPuzzle('2026-W41').seed);
  });

  test('never offers banned words', () => {
    expect(weeklyPuzzle('2026-W40').words.some(w => w.banned)).toBe(false);
  });
});

describe('familyPuzzle', () => {
  test('turns entries into word + clue data keyed by the puzzle', () => {
    const p = familyPuzzle('abc123', ENTRIES, 'crossword');
    expect(p.key).toBe('family:abc123');
    expect(p.words.map(w => w.answer)).toEqual(['BEACH', 'PASTY', 'SURF', 'GRANDMA']);
    expect(p.clues.find(c => c.wordId === 'fam-GRANDMA')?.clue).toBe("Dad's mum");
    expect(p.maxWords).toBe(4);
  });

  test('sizes the grid from the longest word, within bounds', () => {
    expect(familyPuzzle('x', ENTRIES, 'crossword').gridSize).toBe(10);
    expect(familyPuzzle('x', ENTRIES, 'wordsearch').gridSize).toBe(9);
    const long = [...ENTRIES, { answer: 'ABCDEFGHIJKL', clue: 'twelve' }];
    expect(familyPuzzle('x', long, 'crossword').gridSize).toBe(15);
    expect(familyPuzzle('x', long, 'wordsearch').gridSize).toBe(14);
  });

  test('a word search built from it is the same for everyone', () => {
    const p = familyPuzzle('abc123', ENTRIES, 'wordsearch');
    const cfg = { gridSize: p.gridSize, maxWords: p.maxWords, seed: p.seed, directions: ['across', 'down'] as ('across' | 'down')[] };
    expect(generateWordSearch(p.words, cfg).grid).toEqual(generateWordSearch(p.words, cfg).grid);
  });
});
