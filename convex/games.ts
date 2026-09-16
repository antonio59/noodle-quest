import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { playerFromSession } from "./model/auth";

export const saveScore = mutation({
  args: { sessionToken: v.string(), gameId: v.string(), stage: v.number(), score: v.number(), stars: v.number() },
  handler: async (ctx, args) => {
    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return { error: "Not signed in." };
    if (!/^[a-z0-9-]{1,40}$/.test(args.gameId)) return { error: "Invalid game." };
    if (!Number.isFinite(args.score) || args.score < 0 || args.score > 1_000_000) return { error: "Invalid score." };
    if (!Number.isInteger(args.stars) || args.stars < 0 || args.stars > 3) return { error: "Invalid stars." };
    if (!Number.isInteger(args.stage) || args.stage < 1) return { error: "Invalid stage." };

    const playerId = player._id;
    await ctx.db.insert("scores", { playerId, gameId: args.gameId, stage: args.stage, score: args.score, stars: args.stars, playedAt: Date.now() });
    const existing = await ctx.db.query("progress").withIndex("by_player_game", q => q.eq("playerId", playerId).eq("gameId", args.gameId)).filter(q => q.eq(q.field("stage"), args.stage)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, { highScore: Math.max(existing.highScore, args.score), starsEarned: existing.starsEarned + args.stars, timesPlayed: existing.timesPlayed + 1, lastPlayed: Date.now() });
    } else {
      await ctx.db.insert("progress", { playerId, gameId: args.gameId, stage: args.stage, highScore: args.score, starsEarned: args.stars, timesPlayed: 1, lastPlayed: Date.now() });
    }
    if (args.score > 0) {
      await ctx.db.insert("feed", { authorId: playerId, authorName: player.name, authorAvatar: player.avatar, type: "score", content: `${"⭐".repeat(Math.min(args.stars, 3))} on ${args.gameId}!`, gameId: args.gameId, stage: args.stage, stars: args.stars, createdAt: Date.now() });
    }
    return { ok: true };
  },
});

export const getPlayerProgress = query({
  args: { sessionToken: v.string(), gameId: v.string() },
  handler: async (ctx, args) => {
    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return null;
    const rows = await ctx.db
      .query("progress")
      .withIndex("by_player_game", q => q.eq("playerId", player._id).eq("gameId", args.gameId))
      .collect();
    // Return the highest stage that was completed (earned at least 1 star)
    let maxStage = 0;
    for (const r of rows) {
      if (r.starsEarned > 0 && r.stage > maxStage) maxStage = r.stage;
    }
    return { maxUnlockedStage: maxStage + 1, stages: rows.map(r => ({ stage: r.stage, highScore: r.highScore, stars: r.starsEarned, timesPlayed: r.timesPlayed })) };
  },
});

export const getPlayerStats = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return null;
    const scores = await ctx.db.query("scores").withIndex("by_player", q => q.eq("playerId", player._id)).collect();
    let totalStars = 0;
    let totalScore = 0;
    const gameIds = new Set<string>();
    for (const s of scores) {
      totalStars += s.stars;
      totalScore += s.score;
      gameIds.add(s.gameId);
    }
    // Get progress for best stage info
    const progress = await ctx.db.query("progress").withIndex("by_player", q => q.eq("playerId", player._id)).collect();
    const gameStages: Record<string, { highScore: number; starsEarned: number; timesPlayed: number; lastPlayed: number; lastStage: number }> = {};
    for (const p of progress) {
      const existing = gameStages[p.gameId];
      if (!existing) {
        gameStages[p.gameId] = {
          highScore: p.highScore,
          starsEarned: p.starsEarned,
          timesPlayed: p.timesPlayed,
          lastPlayed: p.lastPlayed,
          lastStage: p.stage,
        };
      } else {
        gameStages[p.gameId] = {
          highScore: Math.max(existing.highScore, p.highScore),
          starsEarned: Math.max(existing.starsEarned, p.starsEarned),
          timesPlayed: existing.timesPlayed + p.timesPlayed,
          // Most recent stage wins the "continue playing" slot
          lastPlayed: Math.max(existing.lastPlayed, p.lastPlayed),
          lastStage: p.lastPlayed > existing.lastPlayed ? p.stage : existing.lastStage,
        };
      }
    }
    return { totalStars, totalScore, gamesPlayed: gameIds.size, totalGames: scores.length, gameStages };
  },
});

// Global play counts over the last 30 days. Used client-side to surface a rotating
// bonus pool: the least-played games in the window earn a score multiplier. As plays
// accumulate, the bonus pool shifts automatically — no cron or admin action needed.
export const getMonthlyPlayCounts = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const windowStart = now - 30 * 24 * 60 * 60 * 1000;
    const scores = await ctx.db
      .query("scores")
      .withIndex("by_playedAt", q => q.gte("playedAt", windowStart))
      .collect();
    const counts: Record<string, number> = {};
    for (const s of scores) {
      counts[s.gameId] = (counts[s.gameId] ?? 0) + 1;
    }
    return { counts, windowStart, windowEnd: now };
  },
});

export const getLeaderboard = query({
  args: { gameId: v.optional(v.string()), since: v.optional(v.number()), sessionToken: v.string() },
  handler: async (ctx, args) => {
    const viewer = await playerFromSession(ctx, args.sessionToken);
    if (!viewer) return [];
    let scores: Doc<"scores">[];
    if (args.since !== undefined) {
      // Windowed boards (this week/month) walk the playedAt index; the
      // optional game filter is applied in memory (family-scale data).
      scores = await ctx.db.query("scores").withIndex("by_playedAt", q => q.gte("playedAt", args.since!)).collect();
      if (args.gameId) scores = scores.filter(s => s.gameId === args.gameId);
    } else {
      scores = args.gameId
        ? await ctx.db.query("scores").withIndex("by_game_score", q => q.eq("gameId", args.gameId!)).collect()
        : await ctx.db.query("scores").collect();
    }

    const playerMap = new Map<string, { name: string; avatar: string; totalStars: number; totalScore: number; games: Map<string, { stars: number; score: number }> }>();
    for (const s of scores) {
      const existing = playerMap.get(s.playerId);
      const gameStats = existing?.games.get(s.gameId) || { stars: 0, score: 0 };
      const newStars = gameStats.stars + s.stars;
      const newScore = gameStats.score + s.score;
      
      if (existing) {
        existing.totalStars += s.stars;
        existing.totalScore += s.score;
        existing.games.set(s.gameId, { stars: newStars, score: newScore });
      } else {
        const player = await ctx.db.get(s.playerId);
        const gamesMap = new Map<string, { stars: number; score: number }>();
        gamesMap.set(s.gameId, { stars: s.stars, score: s.score });
        playerMap.set(s.playerId, { name: player?.name || "?", avatar: player?.avatar || "🎮", totalStars: s.stars, totalScore: s.score, games: gamesMap });
      }
    }
    
    return Array.from(playerMap.entries())
      .map(([id, p]) => {
        const topGames = Array.from(p.games.entries())
          .map(([gameId, stats]) => ({ gameId, stars: stats.stars, score: stats.score }))
          .sort((a, b) => b.stars - a.stars)
          .slice(0, 5);
        return { playerId: id, playerName: p.name, avatar: p.avatar, totalStars: p.totalStars, totalScore: p.totalScore, gamesPlayed: p.games.size, topGames };
      })
      .sort((a, b) => b.totalStars - a.totalStars);
  },
});
