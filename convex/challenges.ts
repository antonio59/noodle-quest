import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { playerFromSession } from "./model/auth";

const MAX_SCORE = 1_000_000;

function isValidScore(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= MAX_SCORE;
}

/** Latest stored score for this player, game, and stage. Client-supplied totals are ignored. */
async function latestScore(
  ctx: MutationCtx,
  playerId: Id<"players">,
  gameId: string,
  stage: number,
  playedAfter?: number,
): Promise<number | null> {
  const rows = await ctx.db
    .query("scores")
    .withIndex("by_player", q => q.eq("playerId", playerId))
    .collect();
  let latest: { score: number; playedAt: number } | null = null;
  for (const row of rows) {
    if (row.gameId !== gameId || row.stage !== stage) continue;
    if (playedAfter !== undefined && row.playedAt < playedAfter) continue;
    if (!isValidScore(row.score)) continue;
    if (!latest || row.playedAt >= latest.playedAt) {
      latest = { score: row.score, playedAt: row.playedAt };
    }
  }
  return latest?.score ?? null;
}

export const sendChallenge = mutation({
  args: { sessionToken: v.string(), toId: v.id("players"), gameId: v.string(), stage: v.number() },
  handler: async (ctx, args) => {
    const from = await playerFromSession(ctx, args.sessionToken);
    if (!from) return { error: "Not signed in." };
    const to = await ctx.db.get(args.toId);
    if (!to) return { error: "Player not found." };
    if (to._id === from._id) return { error: "You can't challenge yourself!" };

    const fromScore = await latestScore(ctx, from._id, args.gameId, args.stage);
    if (fromScore === null) return { error: "Play this stage before sending a challenge." };

    // One open challenge per pairing per game keeps the inbox sane.
    const existing = await ctx.db
      .query("challenges")
      .withIndex("by_to", q => q.eq("toId", args.toId).eq("status", "pending"))
      .collect();
    if (existing.some(c => c.fromId === from._id && c.gameId === args.gameId)) {
      return { error: `${to.name} already has a pending challenge from you in this game.` };
    }

    const id = await ctx.db.insert("challenges", {
      fromId: from._id,
      toId: args.toId,
      gameId: args.gameId,
      stage: args.stage,
      fromScore,
      status: "pending",
      createdAt: Date.now(),
    });

    await ctx.db.insert("feed", {
      authorId: from._id,
      authorName: from.name,
      authorAvatar: from.avatar,
      type: "score",
      content: `⚔️ challenged ${to.name} to beat ${fromScore} pts!`,
      gameId: args.gameId,
      stage: args.stage,
      createdAt: Date.now(),
    });

    return { challengeId: id };
  },
});

export const respondToChallenge = mutation({
  args: { sessionToken: v.string(), challengeId: v.id("challenges") },
  handler: async (ctx, args) => {
    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return { error: "Not signed in." };
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge || challenge.status !== "pending") return { error: "Challenge not found or already completed." };
    if (challenge.toId !== player._id) return { error: "This challenge isn't for you." };
    // Only a score recorded after the challenge was sent counts as an answer.
    const toScore = await latestScore(ctx, player._id, challenge.gameId, challenge.stage, challenge.createdAt);
    if (toScore === null) return { error: "Play this stage before answering the challenge." };
    const won = toScore > challenge.fromScore;
    await ctx.db.patch(args.challengeId, { toScore, status: "completed", completedAt: Date.now() });

    const from = await ctx.db.get(challenge.fromId);
    await ctx.db.insert("feed", {
      authorId: player._id,
      authorName: player.name,
      authorAvatar: player.avatar,
      type: "score",
      content: won
        ? `🏆 beat ${from?.name ?? "a"} challenge — ${toScore} vs ${challenge.fromScore} pts!`
        : `⚔️ took on ${from?.name ?? "a"}'s challenge: ${toScore} vs ${challenge.fromScore} pts`,
      gameId: challenge.gameId,
      stage: challenge.stage,
      createdAt: Date.now(),
    });

    return { won, fromScore: challenge.fromScore, toScore };
  },
});

export const getPendingChallenges = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return [];
    const challenges = await ctx.db
      .query("challenges")
      .withIndex("by_to", q => q.eq("toId", player._id).eq("status", "pending"))
      .collect();
    // Enrich with the challenger's current name/avatar for the UI.
    const out = [];
    for (const c of challenges) {
      const from = await ctx.db.get(c.fromId);
      out.push({
        id: c._id,
        fromId: c.fromId,
        fromName: from?.name ?? "Unknown",
        fromAvatar: from?.avatar ?? "🎮",
        gameId: c.gameId,
        stage: c.stage,
        fromScore: c.fromScore,
        createdAt: c.createdAt,
      });
    }
    return out;
  },
});
