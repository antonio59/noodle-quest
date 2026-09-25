import { describe, expect, test } from "vitest";
import {
  formatSolveTime,
  isOpenWeek,
  isoWeek,
  nextWeekStart,
  normaliseAnswer,
  parsePuzzleKey,
  puzzleError,
  seedFromKey,
  weeklyPuzzleKind,
} from "../../convex/model/puzzles";

const entries = (...answers: string[]) => answers.map(a => ({ answer: a, clue: `clue for ${a.length}` }));

describe("normaliseAnswer", () => {
  test("keeps letters only, uppercased, accents folded", () => {
    expect(normaliseAnswer(" Ice-cream! ")).toBe("ICECREAM");
    expect(normaliseAnswer("Café")).toBe("CAFE");
  });
});

describe("puzzleError", () => {
  test("accepts a good puzzle", () => {
    expect(puzzleError("Cornwall", entries("BEACH", "PASTY", "SURF", "GRANDMA"))).toBeNull();
  });

  test("needs a title and 4–15 words", () => {
    expect(puzzleError("  ", entries("BEACH", "PASTY", "SURF", "GRANDMA"))).toMatch(/title/);
    expect(puzzleError("Hi", entries("BEACH", "PASTY", "SURF"))).toMatch(/4–15 words/);
  });

  test("checks answer length, duplicates and clues", () => {
    expect(puzzleError("Hi", entries("AB", "PASTY", "SURF", "GRANDMA"))).toMatch(/3–12 letters/);
    expect(puzzleError("Hi", entries("BEACH", "BEACH", "SURF", "GRANDMA"))).toMatch(/twice/);
    const blank = [...entries("BEACH", "PASTY", "SURF"), { answer: "GRANDMA", clue: " " }];
    expect(puzzleError("Hi", blank)).toMatch(/needs a clue/);
  });

  test("rejects clues that give the answer away", () => {
    const leaky = [...entries("BEACH", "PASTY", "SURF"), { answer: "GRANDMA", clue: "Grandma's house" }];
    expect(puzzleError("Hi", leaky)).toMatch(/gives the answer away/);
  });
});

describe("isoWeek", () => {
  test("matches ISO-8601 week numbering, including year boundaries", () => {
    expect(isoWeek(Date.UTC(2026, 8, 25))).toBe("2026-W39"); // Fri 25 Sep 2026
    expect(isoWeek(Date.UTC(2026, 0, 1))).toBe("2026-W01"); // Thu 1 Jan 2026
    expect(isoWeek(Date.UTC(2027, 0, 1))).toBe("2026-W53"); // Fri 1 Jan 2027
    expect(isoWeek(Date.UTC(2024, 11, 30))).toBe("2025-W01"); // Mon 30 Dec 2024
  });

  test("the week changes at Monday 00:00 UTC", () => {
    const sunday = Date.UTC(2026, 8, 27, 23, 59);
    expect(isoWeek(sunday)).toBe("2026-W39");
    expect(nextWeekStart(sunday)).toBe(Date.UTC(2026, 8, 28));
    expect(isoWeek(nextWeekStart(sunday))).toBe("2026-W40");
  });
});

describe("isOpenWeek", () => {
  test("allows this week and last week only", () => {
    const now = Date.UTC(2026, 8, 28, 0, 5); // Monday of W40
    expect(isOpenWeek("2026-W40", now)).toBe(true);
    expect(isOpenWeek("2026-W39", now)).toBe(true);
    expect(isOpenWeek("2026-W38", now)).toBe(false);
    expect(isOpenWeek("2026-W41", now)).toBe(false);
  });
});

describe("parsePuzzleKey", () => {
  test("recognises weekly and family keys", () => {
    expect(parsePuzzleKey("week:2026-W39")).toEqual({ kind: "week", week: "2026-W39" });
    expect(parsePuzzleKey("family:jd7abc123def456")).toEqual({ kind: "family", puzzleId: "jd7abc123def456" });
    expect(parsePuzzleKey("week:2026-39")).toBeNull();
    expect(parsePuzzleKey("family:../../etc")).toBeNull();
  });
});

describe("seeds and kinds", () => {
  test("seedFromKey is stable and spreads", () => {
    expect(seedFromKey("week:2026-W39")).toBe(seedFromKey("week:2026-W39"));
    expect(seedFromKey("week:2026-W39")).not.toBe(seedFromKey("week:2026-W40"));
  });

  test("weekly kind alternates", () => {
    expect(weeklyPuzzleKind("2026-W39")).toBe("wordsearch");
    expect(weeklyPuzzleKind("2026-W40")).toBe("crossword");
  });

  test("formatSolveTime", () => {
    expect(formatSolveTime(192)).toBe("3:12");
    expect(formatSolveTime(5)).toBe("0:05");
  });
});
