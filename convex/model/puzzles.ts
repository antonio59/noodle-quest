// Shared rules for family puzzles and the weekly family puzzle. Pure
// functions only — imported by Convex functions and by the browser, so the
// editor and the server agree on what a valid puzzle is.

export const MIN_WORDS = 4;
export const MAX_WORDS = 15;
export const MIN_ANSWER = 3;
export const MAX_ANSWER = 12;
export const MAX_CLUE = 100;
export const MAX_TITLE = 40;
export const MAX_THEME = 80;
/** Fastest believable solve; anything quicker is a bug or a fib. */
export const MIN_SOLVE_SECONDS = 5;
export const MAX_SOLVE_SECONDS = 24 * 60 * 60;

export interface PuzzleEntry {
  answer: string;
  clue: string;
}

/** "Ice-cream!" → "ICECREAM". Accents are folded, everything else dropped. */
export function normaliseAnswer(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

/** Why this puzzle can't be saved, or null if it's fine. Expects normalised answers. */
export function puzzleError(title: string, entries: readonly PuzzleEntry[]): string | null {
  const t = title.trim();
  if (t.length === 0 || t.length > MAX_TITLE) return `Give it a title (up to ${MAX_TITLE} characters).`;
  if (entries.length < MIN_WORDS || entries.length > MAX_WORDS) {
    return `Use ${MIN_WORDS}–${MAX_WORDS} words.`;
  }
  const seen = new Set<string>();
  for (const e of entries) {
    if (e.answer.length < MIN_ANSWER || e.answer.length > MAX_ANSWER || !/^[A-Z]+$/.test(e.answer)) {
      return `"${e.answer || "?"}" needs ${MIN_ANSWER}–${MAX_ANSWER} letters.`;
    }
    if (seen.has(e.answer)) return `"${e.answer}" is in there twice.`;
    seen.add(e.answer);
    const clue = e.clue.trim();
    if (clue.length === 0 || clue.length > MAX_CLUE) return `"${e.answer}" needs a clue (up to ${MAX_CLUE} characters).`;
    if (clue.toUpperCase().includes(e.answer)) return `The clue for "${e.answer}" gives the answer away.`;
  }
  return null;
}

/** ISO-8601 week of a UTC timestamp, e.g. "2026-W39" (weeks start Monday). */
export function isoWeek(ms: number): string {
  const d = new Date(ms);
  const day = d.getUTCDay() || 7; // Mon=1 … Sun=7
  // Thursday of this week decides which year the week belongs to.
  const thursday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - day);
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.ceil(((thursday - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

const WEEK_MS = 7 * 86_400_000;

export function weeklyPuzzleKey(ms: number): string {
  return `week:${isoWeek(ms)}`;
}

/** Monday 00:00 UTC of the week after `ms` — when the weekly puzzle changes. */
export function nextWeekStart(ms: number): number {
  const d = new Date(ms);
  const day = d.getUTCDay() || 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 8 - day);
}

export type ParsedPuzzleKey =
  | { kind: "week"; week: string }
  | { kind: "family"; puzzleId: string };

export function parsePuzzleKey(key: string): ParsedPuzzleKey | null {
  const week = /^week:(\d{4}-W\d{2})$/.exec(key);
  if (week) return { kind: "week", week: week[1] };
  // Shape check only; callers resolve the id with db.normalizeId.
  const family = /^family:([\w;-]{1,80})$/.exec(key);
  if (family) return { kind: "family", puzzleId: family[1] };
  return null;
}

/**
 * Weekly results are accepted for this week and last week, so someone who
 * starts late on Sunday night can still finish after midnight UTC.
 */
export function isOpenWeek(week: string, nowMs: number): boolean {
  return week === isoWeek(nowMs) || week === isoWeek(nowMs - WEEK_MS);
}

/** Stable 32-bit seed from a string (FNV-1a) — same puzzle for everyone. */
export function seedFromKey(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Alternate crossword and word search week to week. */
export function weeklyPuzzleKind(week: string): "crossword" | "wordsearch" {
  const n = Number(week.slice(-2));
  return n % 2 === 0 ? "crossword" : "wordsearch";
}

export function formatSolveTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
