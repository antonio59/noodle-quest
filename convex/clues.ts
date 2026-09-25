import Anthropic from "@anthropic-ai/sdk";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { playerFromSession } from "./model/auth";
import { takeRateLimit } from "./model/rateLimit";
import {
  CLUE_SCHEMA,
  CLUE_SYSTEM_PROMPT,
  buildCluePrompt,
  cleanWordList,
  sanitiseClues,
  type ClueSuggestion,
} from "./model/clues";

/**
 * "Write clues for me" in the family puzzle maker. Claude drafts a
 * kid-friendly clue per word; the family reviews and edits before saving.
 *
 * Required env var on the Convex deployment (dashboard → Settings →
 * Environment Variables):
 *   ANTHROPIC_API_KEY — from platform.claude.com
 *
 * Without it the button reports "unconfigured" and families write clues
 * themselves — puzzles still work.
 */

const MODEL = "claude-opus-5";
const REQUESTS_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;

export type ClueStatus = "ok" | "unconfigured" | "unavailable" | "denied" | "limited";

export interface ClueResult {
  status: ClueStatus;
  clues: ClueSuggestion[];
}

export const claimClueRequest = internalMutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args): Promise<"ok" | "denied" | "limited"> => {
    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return "denied";
    const allowed = await takeRateLimit(ctx, `clues:${player._id}`, REQUESTS_PER_HOUR, HOUR_MS);
    return allowed ? "ok" : "limited";
  },
});

function logApiError(err: unknown): void {
  if (err instanceof Anthropic.RateLimitError) {
    console.error("suggestClues: Anthropic rate limit", err.status);
  } else if (err instanceof Anthropic.AuthenticationError) {
    console.error("suggestClues: ANTHROPIC_API_KEY was rejected");
  } else if (err instanceof Anthropic.BadRequestError) {
    console.error("suggestClues: bad request", err.message);
  } else if (err instanceof Anthropic.APIError) {
    console.error(`suggestClues: API error ${err.status}`, err.message);
  } else {
    console.error("suggestClues: request failed", err);
  }
}

export const suggestClues = action({
  args: { sessionToken: v.string(), words: v.array(v.string()), theme: v.optional(v.string()) },
  handler: async (ctx, args): Promise<ClueResult> => {
    const words = cleanWordList(args.words);
    if (words.length === 0) return { status: "ok", clues: [] };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { status: "unconfigured", clues: [] };

    const claim = await ctx.runMutation(internal.clues.claimClueRequest, { sessionToken: args.sessionToken });
    if (claim !== "ok") return { status: claim, clues: [] };

    const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
    try {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        // Route a classifier decline to Anthropic's recommended fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: { type: "json_schema", schema: CLUE_SCHEMA } },
        system: CLUE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildCluePrompt(words, args.theme) }],
      });
      if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
        console.error(`suggestClues: stopped early (${response.stop_reason})`);
        return { status: "unavailable", clues: [] };
      }
      const text = response.content.find(b => b.type === "text");
      if (!text || text.type !== "text") return { status: "unavailable", clues: [] };
      return { status: "ok", clues: sanitiseClues(words, JSON.parse(text.text)) };
    } catch (err) {
      logApiError(err);
      return { status: "unavailable", clues: [] };
    }
  },
});
