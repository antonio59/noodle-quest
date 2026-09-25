// Pure helpers for AI-written crossword clues: prompt building and
// defensive cleanup of whatever the model returns.
import { MAX_ANSWER, MAX_THEME, MAX_WORDS, MIN_ANSWER, normaliseAnswer } from "./puzzles";

/** Clues kids can read at a glance; longer ones are dropped. */
export const MAX_SUGGESTED_CLUE = 80;

export interface ClueSuggestion {
  answer: string;
  clue: string;
}

export const CLUE_SYSTEM_PROMPT = `You write crossword clues for a family word-puzzle app played by children (roughly 6–12) together with their parents.

For each word, write one short, warm clue (under 60 characters) that a child could solve. Never put the answer, or an obvious form of it, in the clue. When a theme is given, lean on it so clues feel personal to the family — the words may be family names, pets or places only they know, and the theme is the only context you have for those. If a word isn't suitable for children, return an empty clue for it.

Return exactly one entry per word, in the order given, with the word copied exactly.`;

export const CLUE_SCHEMA = {
  type: "object",
  properties: {
    clues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          answer: { type: "string" },
          clue: { type: "string" },
        },
        required: ["answer", "clue"],
        additionalProperties: false,
      },
    },
  },
  required: ["clues"],
  additionalProperties: false,
} as const;

/** Normalised, de-duplicated, valid words, capped at a puzzle's worth. */
export function cleanWordList(words: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of words) {
    const w = normaliseAnswer(raw);
    if (w.length >= MIN_ANSWER && w.length <= MAX_ANSWER && !out.includes(w)) out.push(w);
    if (out.length === MAX_WORDS) break;
  }
  return out;
}

export function buildCluePrompt(words: readonly string[], theme: string | undefined): string {
  const t = (theme ?? "").trim().slice(0, MAX_THEME);
  const themeLine = t ? `Theme: ${t}` : "Theme: none — keep clues general.";
  return `${themeLine}\n\nWords:\n${words.map(w => `- ${w}`).join("\n")}`;
}

/**
 * Map the model's JSON onto the requested words, in order. Anything missing,
 * too long, or that leaks the answer comes back as an empty clue for the
 * family to fill in by hand.
 */
export function sanitiseClues(words: readonly string[], raw: unknown): ClueSuggestion[] {
  const list = (raw as { clues?: unknown })?.clues;
  const byAnswer = new Map<string, string>();
  if (Array.isArray(list)) {
    for (const item of list) {
      const answer = normaliseAnswer(String((item as { answer?: unknown })?.answer ?? ""));
      const clue = String((item as { clue?: unknown })?.clue ?? "").trim();
      if (answer && !byAnswer.has(answer)) byAnswer.set(answer, clue);
    }
  }
  return words.map(answer => {
    const clue = byAnswer.get(answer) ?? "";
    const leaks = clue.toUpperCase().replace(/[^A-Z]/g, "").includes(answer);
    return { answer, clue: clue.length <= MAX_SUGGESTED_CLUE && !leaks ? clue : "" };
  });
}
