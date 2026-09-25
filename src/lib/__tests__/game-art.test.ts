import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import '@/lib/game-manifest';
import { canonicalGameId, getAllGames } from '@/lib/game-registry';

const ART_DIR = path.resolve(__dirname, '../../../public/art');

describe('game art', () => {
  test('every registered game has an illustrated tile (run `pnpm art:build`)', () => {
    const missing = getAllGames().map(g => g.id).filter(id => !fs.existsSync(path.join(ART_DIR, `${id}.svg`)));
    expect(missing).toEqual([]);
  });

  test('aliases resolve to their game', () => {
    expect(canonicalGameId('word-search')).toBe('wordsearch');
    expect(canonicalGameId('chess')).toBe('chess');
  });
});
