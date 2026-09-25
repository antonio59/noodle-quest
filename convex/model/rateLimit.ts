import type { MutationCtx } from "../_generated/server";

/**
 * Fixed-window rate limit. Returns true (and counts the call) when `key`
 * has made fewer than `limit` calls in the current `windowMs` window.
 */
export async function takeRateLimit(
  ctx: MutationCtx,
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const now = Date.now();
  const row = await ctx.db.query("rate_limits").withIndex("by_key", q => q.eq("key", key)).unique();
  if (!row) {
    await ctx.db.insert("rate_limits", { key, windowStart: now, count: 1 });
    return true;
  }
  if (now - row.windowStart >= windowMs) {
    await ctx.db.patch(row._id, { windowStart: now, count: 1 });
    return true;
  }
  if (row.count >= limit) return false;
  await ctx.db.patch(row._id, { count: row.count + 1 });
  return true;
}
