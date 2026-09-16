import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { deleteSessionsForPlayer } from "./model/auth";

// Resolve a one-time approval token from the admin email link.
export const getByApprovalToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_approval", q => q.eq("approvalToken", args.token))
      .unique();
    if (!player) return null;
    return {
      playerId: player._id,
      name: player.name,
      avatar: player.avatar,
      status: player.status ?? "approved",
      createdAt: player.createdAt,
    };
  },
});

// Apply an approve/reject decision from the emailed link. The token is
// cleared either way so a link can't be replayed or leak a stale state.
export const applySignupDecision = internalMutation({
  args: {
    token: v.string(),
    decision: v.union(v.literal("approve"), v.literal("reject")),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_approval", q => q.eq("approvalToken", args.token))
      .unique();
    if (!player) return { found: false as const };

    const patch: { approvalToken?: undefined; status?: "approved" | "rejected" } = {
      approvalToken: undefined,
    };
    if (player.status === "pending") {
      patch.status = args.decision === "approve" ? "approved" : "rejected";
      if (patch.status === "rejected") {
        // Belt and suspenders — pending signups never get a session, but
        // reject should still kill any that somehow exist.
        await deleteSessionsForPlayer(ctx, player._id);
      }
    }
    await ctx.db.patch(player._id, patch);

    return {
      found: true as const,
      name: player.name,
      decision: args.decision,
      // Whether this call actually changed anything (vs. a replayed link).
      changed: player.status === "pending",
    };
  },
});
