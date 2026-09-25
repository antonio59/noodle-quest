// Scrabble dictionary variants and loading. Two real lexica:
//   intl — SOWPODS/CSW-style, used in the UK and most of the world
//   na   — TWL-style, used in US & Canada club/tournament play
// Both files are pre-trimmed to 2-10 letter words (a 7-tile rack makes
// longer words effectively unplayable here, and the smaller sets keep
// the download and AI search fast).

export type DictVariant = 'intl' | 'na';

/** Download state of the active lexicon; 'fallback' = the small built-in list. */
export type DictStatus = 'loading' | 'ready' | 'error' | 'fallback';

export interface DictionaryInfo {
  label: string;
  short: string;
  flag: string;
  file: string;
  blurb: string;
}

export const DICTIONARIES: Record<DictVariant, DictionaryInfo> = {
  intl: {
    label: 'UK & International',
    short: 'UK/Intl',
    flag: '🇬🇧',
    file: '/dict/en-intl.txt',
    blurb: 'SOWPODS — the list used in the UK and most of the world',
  },
  na: {
    label: 'US & Canada',
    short: 'US/CA',
    flag: '🇺🇸',
    file: '/dict/en-na.txt',
    blurb: 'TWL — the list used in North American play',
  },
};

const STORAGE_KEY = 'nq_scrabble_dict';

export function isDictVariant(v: unknown): v is DictVariant {
  return v === 'intl' || v === 'na';
}

export function getPreferredDictionary(): DictVariant {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isDictVariant(stored) ? stored : 'intl';
  } catch {
    return 'intl';
  }
}

export function setPreferredDictionary(v: DictVariant): void {
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch {
    // storage unavailable — session-only preference
  }
}

/** Parse a raw word-list file into the validation set. */
export function parseDictionary(text: string): Set<string> {
  const words = text
    .split('\n')
    .map(w => w.trim().toUpperCase())
    .filter(w => w.length >= 2 && w.length <= 10 && /^[A-Z]+$/.test(w));
  return new Set(words);
}

// Loaded sets are kept for the session so switching variants (or
// re-mounting the game) doesn't re-download 1MB+ files.
const cache = new Map<DictVariant, Set<string>>();

/** Drop cached word sets (used by tests). */
export function clearDictionaryCache(): void {
  cache.clear();
}

export async function fetchDictionary(variant: DictVariant): Promise<Set<string>> {
  const cached = cache.get(variant);
  if (cached) return cached;
  const res = await fetch(DICTIONARIES[variant].file);
  if (!res.ok) throw new Error(`Dictionary download failed (${res.status})`);
  const set = parseDictionary(await res.text());
  // A real word list has six figures of entries; a truncated or error
  // response must not silently become the validation set.
  if (set.size < 10000) throw new Error('Dictionary file looks corrupt');
  cache.set(variant, set);
  return set;
}
