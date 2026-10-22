import { mutation, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { playerFromSession } from "./model/auth";
import { assertAdminSecret } from "./model/admin";

const MAX_ERROR_ID = 120;
const MAX_GAME_ID = 60;
const MAX_PLAYER_NAME = 60;
const MAX_ERROR_TYPE = 40;
const MAX_SEVERITY = 20;
const MAX_MESSAGE = 2000;
const MAX_STACK = 8000;
const MAX_CONTEXT_JSON = 4000;
/** Stack traces and client context are not kept forever. */
export const REPORT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

function cap(value: string | undefined, max: number): string | undefined {
  if (value === undefined) return undefined;
  return value.slice(0, max);
}

function capContext(context: unknown): unknown {
  if (context === undefined) return undefined;
  try {
    const json = JSON.stringify(context);
    if (json === undefined) return undefined;
    if (json.length <= MAX_CONTEXT_JSON) return context;
    return json.slice(0, MAX_CONTEXT_JSON);
  } catch {
    return undefined;
  }
}

/** Strip fields that must not leave the server for browser admin UIs. */
function stripReportForBrowser<T extends { stackTrace?: string; context?: unknown }>(report: T) {
  const { stackTrace: _st, context: _ctx, ...safe } = report;
  return safe;
}

// Submit a game request from a player. Attribution comes from the session
// (when provided) rather than client-supplied identity.
export const createGameRequest = mutation({
  args: {
    gameName: v.string(),
    description: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const player = args.sessionToken ? await playerFromSession(ctx, args.sessionToken) : null;
    return await ctx.db.insert("game_requests", {
      gameName: args.gameName.slice(0, 80),
      description: args.description.slice(0, 2000),
      playerId: player?._id,
      playerName: player?.name,
      createdAt: Date.now(),
    });
  },
});

interface ReportInput {
  errorId: string;
  gameId?: string;
  playerId?: Id<"players">;
  playerName?: string;
  errorType: string;
  severity: string;
  message: string;
  stackTrace?: string;
  context?: unknown;
}

async function upsertReport(ctx: MutationCtx, input: ReportInput) {
  const now = Date.now();
  const errorId = cap(input.errorId, MAX_ERROR_ID) ?? "";

  // Check if this error already exists
  const existing = await ctx.db
    .query("reports")
    .withIndex("by_errorId", (q) => q.eq("errorId", errorId))
    .first();

  if (existing) {
    // Update existing report
    await ctx.db.patch(existing._id, {
      updatedAt: now,
      status: "open",
    });
    return { id: existing._id, isNew: false };
  }

  const reportId = await ctx.db.insert("reports", {
    errorId,
    gameId: cap(input.gameId, MAX_GAME_ID),
    playerId: input.playerId,
    playerName: cap(input.playerName, MAX_PLAYER_NAME),
    errorType: cap(input.errorType, MAX_ERROR_TYPE) ?? "runtime",
    severity: cap(input.severity, MAX_SEVERITY) ?? "medium",
    message: cap(input.message, MAX_MESSAGE) ?? "",
    stackTrace: cap(input.stackTrace, MAX_STACK),
    context: capContext(input.context),
    status: "open",
    createdAt: now,
    updatedAt: now,
  });

  return { id: reportId, isNew: true };
}

// Create a new error report from the app. Anonymous reports are allowed
// (errors can happen before login); attribution comes from the session.
export const createReport = mutation({
  args: {
    errorId: v.string(),
    gameId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    errorType: v.string(),
    severity: v.string(),
    message: v.string(),
    stackTrace: v.optional(v.string()),
    context: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const player = args.sessionToken ? await playerFromSession(ctx, args.sessionToken) : null;
    return await upsertReport(ctx, {
      errorId: args.errorId,
      gameId: args.gameId,
      playerId: player?._id,
      playerName: player?.name,
      errorType: args.errorType,
      severity: args.severity,
      message: args.message,
      stackTrace: args.stackTrace,
      context: args.context,
    });
  },
});

// Create a report from the secret-verified webhook (convex/webhooks.ts),
// which is trusted to attribute reports to players directly.
export const createReportFromWebhook = internalMutation({
  args: {
    errorId: v.string(),
    gameId: v.optional(v.string()),
    playerId: v.optional(v.id("players")),
    playerName: v.optional(v.string()),
    errorType: v.string(),
    severity: v.string(),
    message: v.string(),
    stackTrace: v.optional(v.string()),
    context: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await upsertReport(ctx, args);
  },
});

// Delete reports past the retention window, including stack traces and context.
export const purgeOldReports = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - REPORT_RETENTION_MS;
    let deleted = 0;
    while (deleted < 500) {
      const old = await ctx.db
        .query("reports")
        .withIndex("by_created", q => q.lt("createdAt", cutoff))
        .take(100);
      if (old.length === 0) break;
      for (const report of old) await ctx.db.delete(report._id);
      deleted += old.length;
      if (old.length < 100) break;
    }
    return { deleted };
  },
});

// Resolve a report (called by bot after fix)
export const resolveReport = internalMutation({
  args: {
    errorId: v.string(),
    resolvedBy: v.optional(v.string()),
    resolutionNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db
      .query("reports")
      .withIndex("by_errorId", (q) => q.eq("errorId", args.errorId))
      .first();

    if (!report) {
      throw new Error(`Report not found for errorId: ${args.errorId}`);
    }

    const wasAlreadyResolved = report.status === "resolved";

    const now = Date.now();
    await ctx.db.patch(report._id, {
      status: "resolved",
      resolvedBy: args.resolvedBy || "bot",
      resolvedAt: now,
      updatedAt: now,
    });

    // Post resolution message to feed only if not already resolved
    if (report.playerId && !wasAlreadyResolved) {
      await ctx.db.insert("feed", {
        authorId: report.playerId,
        authorName: "🤖 Noodle Bot",
        authorAvatar: "🤖",
        type: "system",
        content: args.resolutionNote || `Bug in ${report.gameId || "game"} has been fixed!`,
        gameId: report.gameId,
        createdAt: now,
      });
    }

    return report._id;
  },
});

// Get open reports (admin only; stack/context stripped for browser)
export const getOpenReports = query({
  args: { adminSecret: v.string() },
  handler: async (ctx, args) => {
    const auth = await assertAdminSecret(ctx, args.adminSecret);
    if (auth.ok === false) return { error: auth.error };
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .collect();
    return { reports: reports.map(stripReportForBrowser) };
  },
});

// Get reports for a specific game (admin only; stack/context stripped)
export const getGameReports = query({
  args: { gameId: v.string(), adminSecret: v.string() },
  handler: async (ctx, args) => {
    const auth = await assertAdminSecret(ctx, args.adminSecret);
    if (auth.ok === false) return { error: auth.error };
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .order("desc")
      .collect();
    return { reports: reports.map(stripReportForBrowser) };
  },
});

// Get recent reports (admin only; stack/context stripped for browser)
export const getRecentReports = query({
  args: { limit: v.optional(v.number()), adminSecret: v.string() },
  handler: async (ctx, args) => {
    const auth = await assertAdminSecret(ctx, args.adminSecret);
    if (auth.ok === false) return { error: auth.error };
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_created", (q) => q)
      .order("desc")
      .take(args.limit || 10);
    return { reports: reports.map(stripReportForBrowser) };
  },
});

// Update report with Linear issue info
export const updateReportWithLinear = internalMutation({
  args: {
    errorId: v.string(),
    linearIssueId: v.string(),
    linearIssueUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db
      .query("reports")
      .withIndex("by_errorId", (q) => q.eq("errorId", args.errorId))
      .first();

    if (!report) {
      throw new Error(`Report not found for errorId: ${args.errorId}`);
    }

    await ctx.db.patch(report._id, {
      linearIssueId: args.linearIssueId,
      linearIssueUrl: args.linearIssueUrl,
      status: "investigating",
      updatedAt: Date.now(),
    });

    return report._id;
  },
});
