import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { playerFromSession } from "./model/auth";
import {
  MAX_SOLVE_SECONDS,
  MIN_SOLVE_SECONDS,
  formatSolveTime,
  isOpenWeek,
  normaliseAnswer,
  parsePuzzleKey,
  puzzleError,
} from "./model/puzzles";

const LIST_LIMIT = 50;
const BOARD_LIMIT = 20;

const entryValidator = v.object({ answer: v.string(), clue: v.string() });

function summarise(p: Doc<"family_puzzles">, viewerId: Id<"players">) {
  return {
    id: p._id,
    title: p.title,
    wordCount: p.entries.length,
    creatorName: p.creatorName,
    creatorAvatar: p.creatorAvatar,
    createdAt: p.createdAt,
    mine: p.createdBy === viewerId,
  };
}

export const listFamilyPuzzles = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const viewer = await playerFromSession(ctx, args.sessionToken);
    if (!viewer) return [];
    const puzzles = await ctx.db.query("family_puzzles").withIndex("by_created").order("desc").take(LIST_LIMIT);
    return puzzles.map(p => summarise(p, viewer._id));
  },
});

export const getFamilyPuzzle = query({
  args: { sessionToken: v.string(), puzzleId: v.string() },
  handler: async (ctx, args) => {
    const viewer = await playerFromSession(ctx, args.sessionToken);
    if (!viewer) return null;
    const id = ctx.db.normalizeId("family_puzzles", args.puzzleId);
    const puzzle = id ? await ctx.db.get(id) : null;
    if (!puzzle) return null;
    return { ...summarise(puzzle, viewer._id), entries: puzzle.entries };
  },
});

export const createFamilyPuzzle = mutation({
  args: { sessionToken: v.string(), title: v.string(), entries: v.array(entryValidator) },
  handler: async (ctx, args) => {
    const author = await playerFromSession(ctx, args.sessionToken);
    if (!author) return { error: "Not signed in." };
    const title = args.title.trim();
    const entries = args.entries.map(e => ({ answer: normaliseAnswer(e.answer), clue: e.clue.trim() }));
    const error = puzzleError(title, entries);
    if (error) return { error };

    const now = Date.now();
    const puzzleId = await ctx.db.insert("family_puzzles", {
      title,
      entries,
      createdBy: author._id,
      creatorName: author.name,
      creatorAvatar: author.avatar,
      createdAt: now,
    });
    await ctx.db.insert("feed", {
      authorId: author._id,
      authorName: author.name,
      authorAvatar: author.avatar,
      type: "score",
      content: `🧩 made a family puzzle: “${title}” — can you solve it?`,
      createdAt: now,
    });
    return { puzzleId };
  },
});

export const deleteFamilyPuzzle = mutation({
  args: { sessionToken: v.string(), puzzleId: v.id("family_puzzles") },
  handler: async (ctx, args) => {
    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return { error: "Not signed in." };
    const puzzle = await ctx.db.get(args.puzzleId);
    if (!puzzle) return { error: "Puzzle not found." };
    if (puzzle.createdBy !== player._id) return { error: "Only the person who made it can delete it." };
    const times = await ctx.db
      .query("puzzle_times")
      .withIndex("by_puzzle", q => q.eq("puzzleKey", `family:${args.puzzleId}`))
      .collect();
    for (const t of times) await ctx.db.delete(t._id);
    await ctx.db.delete(args.puzzleId);
    return { ok: true };
  },
});

/** Human label for a puzzle key, used in feed posts. Null if it can't be played. */
async function puzzleLabel(ctx: MutationCtx, key: string): Promise<string | null> {
  const parsed = parsePuzzleKey(key);
  if (!parsed) return null;
  if (parsed.kind === "week") {
    return isOpenWeek(parsed.week, Date.now()) ? "this week's family puzzle" : null;
  }
  const id = ctx.db.normalizeId("family_puzzles", parsed.puzzleId);
  const puzzle = id ? await ctx.db.get(id) : null;
  return puzzle ? `${puzzle.creatorName}'s “${puzzle.title}” puzzle` : null;
}

export const submitPuzzleTime = mutation({
  args: { sessionToken: v.string(), puzzleKey: v.string(), seconds: v.number() },
  handler: async (ctx, args) => {
    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return { error: "Not signed in." };
    const seconds = Math.round(args.seconds);
    if (!Number.isFinite(seconds) || seconds < MIN_SOLVE_SECONDS || seconds > MAX_SOLVE_SECONDS) {
      return { error: "That time doesn't look right." };
    }
    const label = await puzzleLabel(ctx, args.puzzleKey);
    if (!label) return { error: "That puzzle isn't open." };

    const existing = await ctx.db
      .query("puzzle_times")
      .withIndex("by_puzzle_player", q => q.eq("puzzleKey", args.puzzleKey).eq("playerId", player._id))
      .unique();
    const now = Date.now();
    if (existing) {
      if (seconds >= existing.seconds) return { best: existing.seconds, isNewBest: false, firstSolve: false };
      await ctx.db.patch(existing._id, { seconds, completedAt: now });
      return { best: seconds, isNewBest: true, firstSolve: false };
    }

    await ctx.db.insert("puzzle_times", {
      puzzleKey: args.puzzleKey,
      playerId: player._id,
      playerName: player.name,
      playerAvatar: player.avatar,
      seconds,
      completedAt: now,
    });
    // Only the first solve is announced, so replays don't flood the feed.
    await ctx.db.insert("feed", {
      authorId: player._id,
      authorName: player.name,
      authorAvatar: player.avatar,
      type: "score",
      content: `🧩 solved ${label} in ${formatSolveTime(seconds)}`,
      createdAt: now,
    });
    return { best: seconds, isNewBest: true, firstSolve: true };
  },
});

export const getPuzzleBoard = query({
  args: { sessionToken: v.string(), puzzleKey: v.string() },
  handler: async (ctx, args) => {
    const viewer = await playerFromSession(ctx, args.sessionToken);
    if (!viewer || !parsePuzzleKey(args.puzzleKey)) return [];
    const times = await ctx.db
      .query("puzzle_times")
      .withIndex("by_puzzle", q => q.eq("puzzleKey", args.puzzleKey))
      .order("asc")
      .take(BOARD_LIMIT);
    return times.map(t => ({
      name: t.playerName,
      avatar: t.playerAvatar,
      seconds: t.seconds,
      isMe: t.playerId === viewer._id,
    }));
  },
});
