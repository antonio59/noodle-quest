import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import {
  hashPin,
  verifyPin,
  isValidPin,
  generateSalt,
  generateToken,
  createSession,
  playerFromSession,
  deleteSessionsForPlayer,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_MS,
} from "./model/auth";
import { assertAdminSecret } from "./model/admin";
import { internal } from "./_generated/api";

// Expanded avatar pool — must stay in sync with src/lib/avatars.ts
const AVATARS = [
  "🦊","🐱","🐶","🦁","🐼","🐨","🦄","🐸","🐙","🦋","🐢","🦖","🐧","🦜","🐝",
  "🐺","🦝","🐗","🦓","🦒","🐘","🦏","🐊","🦈","🐋","🦩","🐓","🦉","🦇","🐿️",
  "🐲","👻","🤖","👽","🧙","🧛","🦸","🦹","🌵","🍄","🌻","⭐","🔥","💎","🎯","🍜",
];

/** Case-insensitive name lookup — prevents "Alice"/"alice" impersonation. */
async function findPlayerByName(ctx: MutationCtx, name: string) {
  const exact = await ctx.db.query("players").withIndex("by_name", q => q.eq("name", name)).unique();
  if (exact) return exact;
  const lower = name.toLowerCase();
  const all = await ctx.db.query("players").collect();
  return all.find(p => p.name.toLowerCase() === lower) ?? null;
}

export const signUp = mutation({
  args: {
    name: v.string(),
    pin: v.string(),
    avatar: v.optional(v.string()),
    // Present when signing up through a game invite link — invited friends
    // skip the approval queue.
    inviteCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (name.length < 2) return { error: "Name needs at least 2 characters!" };
    if (name.length > 30) return { error: "Name is too long (30 characters max)." };
    if (!isValidPin(args.pin)) return { error: "Passcode must be 6 digits." };

    const existing = await findPlayerByName(ctx, name);
    if (existing) return { error: "Name already taken!" };

    // A live multiplayer invite auto-approves — someone already vouched.
    let invited = false;
    if (args.inviteCode) {
      const invite = await ctx.db
        .query("multiplayer_invites")
        .withIndex("by_code", q => q.eq("inviteCode", args.inviteCode!))
        .unique();
      invited = !!invite && invite.status === "pending" && invite.expiresAt > Date.now();
    }

    const avatar = args.avatar && AVATARS.includes(args.avatar)
      ? args.avatar
      : AVATARS[Math.floor(Math.random() * AVATARS.length)];
    const pinSalt = generateSalt();
    const pinHash = await hashPin(args.pin, pinSalt);
    const now = Date.now();

    if (invited) {
      const playerId = await ctx.db.insert("players", {
        name,
        pinHash,
        pinSalt,
        avatar,
        kidMode: false,
        theme: "dark",
        status: "approved",
        createdAt: now,
        lastActive: now,
      });
      const sessionToken = await createSession(ctx, playerId);
      return { playerId, avatar, sessionToken, kidMode: false, theme: "dark" as const };
    }

    // Uninvited signup — park it until the owner approves. No session is
    // issued, so nothing in the app is reachable yet.
    const approvalToken = generateToken();
    const playerId = await ctx.db.insert("players", {
      name,
      pinHash,
      pinSalt,
      avatar,
      kidMode: false,
      theme: "dark",
      status: "pending",
      approvalToken,
      createdAt: now,
      lastActive: now,
    });
    // Fire-and-forget: email the owner an approve/reject link.
    await ctx.scheduler.runAfter(0, internal.emails.sendSignupApproval, {
      name,
      avatar,
      approvalToken,
    });
    return { pending: true as const, playerId };
  },
});

export const logIn = mutation({
  args: { name: v.string(), pin: v.string() },
  handler: async (ctx, args) => {
    const player = await ctx.db.query("players").withIndex("by_name", q => q.eq("name", args.name.trim())).unique();
    if (!player) return { error: "No player found." };
    if (player.status === "pending") {
      return { error: "Almost there — the site owner still needs to approve your account." };
    }
    if (player.status === "rejected") {
      return { error: "This account wasn't approved." };
    }

    const now = Date.now();
    if (player.lockedUntil && player.lockedUntil > now) {
      const minutes = Math.ceil((player.lockedUntil - now) / 60_000);
      return { error: `Too many tries. Locked for ${minutes} more minute${minutes === 1 ? "" : "s"}.` };
    }

    let valid = false;
    if (player.pinHash && player.pinSalt) {
      valid = await verifyPin(args.pin, player.pinSalt, player.pinHash);
    } else if (player.pin !== undefined) {
      // Legacy plaintext PIN — verify, then upgrade to a hash in place.
      valid = player.pin === args.pin;
      if (valid) {
        const pinSalt = generateSalt();
        const pinHash = await hashPin(args.pin, pinSalt);
        await ctx.db.patch(player._id, { pin: undefined, pinHash, pinSalt });
      }
    }

    if (!valid) {
      const failedAttempts = (player.failedAttempts ?? 0) + 1;
      if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
        await ctx.db.patch(player._id, { failedAttempts: 0, lockedUntil: now + LOCKOUT_MS });
        return { error: "Too many tries. Locked for 5 minutes." };
      }
      await ctx.db.patch(player._id, { failedAttempts });
      return { error: "Wrong PIN!" };
    }

    await ctx.db.patch(player._id, { lastActive: now, failedAttempts: 0, lockedUntil: undefined });
    // Hygiene: drop expired sessions so the table doesn't grow forever.
    const stale = await ctx.db
      .query("sessions")
      .withIndex("by_player", q => q.eq("playerId", player._id))
      .collect();
    for (const s of stale) {
      if (s.expiresAt < now) await ctx.db.delete(s._id);
    }
    const sessionToken = await createSession(ctx, player._id);
    return {
      playerId: player._id,
      name: player.name,
      avatar: player.avatar,
      sessionToken,
      kidMode: player.kidMode ?? false,
      theme: player.theme ?? "dark",
    };
  },
});

export const logOut = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", q => q.eq("token", args.sessionToken))
      .unique();
    if (session) await ctx.db.delete(session._id);
    return { success: true };
  },
});

export const getPlayer = query({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) return null;
    return { id: player._id, name: player.name, avatar: player.avatar };
  },
});

export const searchPlayers = query({
  args: { query: v.string(), sessionToken: v.string() },
  handler: async (ctx, args) => {
    const me = await playerFromSession(ctx, args.sessionToken);
    if (!me) return [];
    if (args.query.trim().length < 2) return [];
    const matches = await ctx.db
      .query("players")
      .withSearchIndex("search_name", q => q.search("name", args.query))
      .take(11);
    return matches
      .filter(p => p._id !== me._id)
      .slice(0, 10)
      .map(p => ({ id: p._id, name: p.name, avatar: p.avatar }));
  },
});

export const updateAvatar = mutation({
  args: { sessionToken: v.string(), avatar: v.string() },
  handler: async (ctx, args) => {
    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return { error: "Not signed in." };
    if (!AVATARS.includes(args.avatar)) return { error: "Unknown avatar." };
    await ctx.db.patch(player._id, { avatar: args.avatar });
    return { success: true };
  },
});

export const updateName = mutation({
  args: { sessionToken: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return { error: "Not signed in." };
    const trimmed = args.name.trim();
    if (trimmed.length < 2) return { error: "Name needs at least 2 characters!" };
    if (trimmed.length > 30) return { error: "Name is too long (30 characters max)." };
    const existing = await findPlayerByName(ctx, trimmed);
    if (existing && existing._id !== player._id) return { error: "Name already taken!" };
    await ctx.db.patch(player._id, { name: trimmed });
    return { success: true, name: trimmed };
  },
});

export const updatePrefs = mutation({
  args: {
    sessionToken: v.string(),
    kidMode: v.optional(v.boolean()),
    theme: v.optional(v.union(v.literal("dark"), v.literal("light"))),
  },
  handler: async (ctx, args) => {
    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return { error: "Not signed in." };
    const patch: { kidMode?: boolean; theme?: "dark" | "light" } = {};
    if (args.kidMode !== undefined) patch.kidMode = args.kidMode;
    if (args.theme !== undefined) patch.theme = args.theme;
    if (Object.keys(patch).length === 0) return { error: "Nothing to update." };
    await ctx.db.patch(player._id, patch);
    return { success: true, ...patch };
  },
});

// Public: powers the profile-picker on the login screen, so it cannot
// require a session. Only exposes what that screen needs.
export const getAllPlayers = query({
  args: {},
  handler: async (ctx) => {
    const players = await ctx.db.query("players").collect();
    // The picker is public — keep pending/rejected signups off it.
    return players
      .filter(p => p.status === undefined || p.status === "approved")
      .map(p => ({ id: p._id, name: p.name, avatar: p.avatar }));
  },
});

// Admin: full player list including activity timestamps
export const adminGetAllPlayers = query({
  args: { adminSecret: v.string() },
  handler: async (ctx, args) => {
    const auth = await assertAdminSecret(ctx, args.adminSecret);
    if (auth.ok === false) return { error: auth.error };
    const players = await ctx.db.query("players").collect();
    return { players: players.map(p => ({ id: p._id, name: p.name, avatar: p.avatar, status: p.status ?? "approved", createdAt: p.createdAt, lastActive: p.lastActive })) };
  },
});

// Admin: approve a pending signup (also usable after an email link fails).
export const adminApprovePlayer = mutation({
  args: { playerId: v.id("players"), adminSecret: v.string() },
  handler: async (ctx, args) => {
    const auth = await assertAdminSecret(ctx, args.adminSecret);
    if (auth.ok === false) return { error: auth.error };
    const player = await ctx.db.get(args.playerId);
    if (!player) return { error: "Player not found" };
    await ctx.db.patch(args.playerId, { status: "approved", approvalToken: undefined });
    return { success: true };
  },
});

// Admin: reject a pending signup — blocks login and revokes any sessions.
export const adminRejectPlayer = mutation({
  args: { playerId: v.id("players"), adminSecret: v.string() },
  handler: async (ctx, args) => {
    const auth = await assertAdminSecret(ctx, args.adminSecret);
    if (auth.ok === false) return { error: auth.error };
    const player = await ctx.db.get(args.playerId);
    if (!player) return { error: "Player not found" };
    await ctx.db.patch(args.playerId, { status: "rejected", approvalToken: undefined });
    await deleteSessionsForPlayer(ctx, args.playerId);
    return { success: true };
  },
});

// Admin: reset a player's PIN
export const adminResetPin = mutation({
  args: { playerId: v.id("players"), newPin: v.string(), adminSecret: v.string() },
  handler: async (ctx, args) => {
    const auth = await assertAdminSecret(ctx, args.adminSecret);
    if (auth.ok === false) return { error: auth.error };
    if (!isValidPin(args.newPin)) return { error: "PIN must be 6 digits" };
    const player = await ctx.db.get(args.playerId);
    if (!player) return { error: "Player not found" };
    const pinSalt = generateSalt();
    const pinHash = await hashPin(args.newPin, pinSalt);
    await ctx.db.patch(args.playerId, { pin: undefined, pinHash, pinSalt, failedAttempts: 0, lockedUntil: undefined });
    // A PIN reset invalidates existing sessions.
    await deleteSessionsForPlayer(ctx, args.playerId);
    return { success: true };
  },
});

// Admin: merge source player into target player (keeps target, deletes source)
export const adminMergePlayers = mutation({
  args: { sourceId: v.id("players"), targetId: v.id("players"), adminSecret: v.string() },
  handler: async (ctx, args) => {
    const auth = await assertAdminSecret(ctx, args.adminSecret);
    if (auth.ok === false) return { error: auth.error };
    if (args.sourceId === args.targetId) return { error: "Cannot merge a player into themselves" };

    const source = await ctx.db.get(args.sourceId);
    const target = await ctx.db.get(args.targetId);
    if (!source || !target) return { error: "One or both players not found" };

    // 1. Merge progress: combine by gameId+stage, keep best scores
    const sourceProgress = await ctx.db.query("progress").withIndex("by_player", q => q.eq("playerId", args.sourceId)).collect();
    for (const sp of sourceProgress) {
      const existing = await ctx.db.query("progress").withIndex("by_player_game", q => q.eq("playerId", args.targetId).eq("gameId", sp.gameId)).filter(q => q.eq(q.field("stage"), sp.stage)).unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          highScore: Math.max(existing.highScore, sp.highScore),
          starsEarned: existing.starsEarned + sp.starsEarned,
          timesPlayed: existing.timesPlayed + sp.timesPlayed,
          lastPlayed: Math.max(existing.lastPlayed, sp.lastPlayed),
        });
        await ctx.db.delete(sp._id);
      } else {
        await ctx.db.patch(sp._id, { playerId: args.targetId });
      }
    }

    // 2. Reassign scores
    const sourceScores = await ctx.db.query("scores").withIndex("by_player", q => q.eq("playerId", args.sourceId)).collect();
    for (const sc of sourceScores) {
      await ctx.db.patch(sc._id, { playerId: args.targetId });
    }

    // 3. Reassign challenges (as sender or receiver)
    const challengesAsFrom = await ctx.db.query("challenges").withIndex("by_from", q => q.eq("fromId", args.sourceId)).collect();
    for (const c of challengesAsFrom) {
      await ctx.db.patch(c._id, { fromId: args.targetId });
    }
    const challengesAsTo = await ctx.db.query("challenges").withIndex("by_to", q => q.eq("toId", args.sourceId)).collect();
    for (const c of challengesAsTo) {
      await ctx.db.patch(c._id, { toId: args.targetId });
    }

    // 4. Reassign feed posts
    const feedPosts = await ctx.db.query("feed").collect();
    for (const post of feedPosts) {
      if (post.authorId === args.sourceId) {
        await ctx.db.patch(post._id, { authorId: args.targetId, authorName: target.name, authorAvatar: target.avatar });
      }
    }

    // 5. Reassign favorites (deduplicate by gameId)
    const sourceFavs = await ctx.db.query("favorites").withIndex("by_player", q => q.eq("playerId", args.sourceId)).collect();
    const targetFavs = await ctx.db.query("favorites").withIndex("by_player", q => q.eq("playerId", args.targetId)).collect();
    const targetFavGameIds = new Set(targetFavs.map(f => f.gameId));
    for (const fav of sourceFavs) {
      if (targetFavGameIds.has(fav.gameId)) {
        await ctx.db.delete(fav._id);
      } else {
        await ctx.db.patch(fav._id, { playerId: args.targetId });
      }
    }

    // 6. Reassign playlists
    const sourcePlaylists = await ctx.db.query("playlists").withIndex("by_player", q => q.eq("playerId", args.sourceId)).collect();
    for (const pl of sourcePlaylists) {
      await ctx.db.patch(pl._id, { playerId: args.targetId });
    }

    // 7. Reassign multiplayer invites
    const invites = await ctx.db.query("multiplayer_invites").collect();
    for (const inv of invites) {
      if (inv.fromId === args.sourceId) {
        await ctx.db.patch(inv._id, { fromId: args.targetId, fromName: target.name, fromAvatar: target.avatar });
      }
      if (inv.toId === args.sourceId) {
        await ctx.db.patch(inv._id, { toId: args.targetId, toName: target.name });
      }
    }

    // 8. Reassign multiplayer sessions
    const sessions = await ctx.db.query("multiplayer_sessions").collect();
    for (const sess of sessions) {
      if (sess.player1Id === args.sourceId) {
        await ctx.db.patch(sess._id, { player1Id: args.targetId, player1Name: target.name, player1Avatar: target.avatar });
      }
      if (sess.player2Id === args.sourceId) {
        await ctx.db.patch(sess._id, { player2Id: args.targetId, player2Name: target.name, player2Avatar: target.avatar });
      }
    }

    // 9. Reassign reports
    const reports = await ctx.db.query("reports").collect();
    for (const r of reports) {
      if (r.playerId === args.sourceId) {
        await ctx.db.patch(r._id, { playerId: args.targetId, playerName: target.name });
      }
    }

    // Delete the source player's auth sessions, then the player itself
    await deleteSessionsForPlayer(ctx, args.sourceId);
    await ctx.db.delete(args.sourceId);

    return { success: true, message: `Merged ${source.name} into ${target.name}` };
  },
});

// Admin: get full player stats for review
export const adminGetPlayerDetails = query({
  args: { playerId: v.id("players"), adminSecret: v.string() },
  handler: async (ctx, args) => {
    const auth = await assertAdminSecret(ctx, args.adminSecret);
    if (auth.ok === false) return { error: auth.error };
    const player = await ctx.db.get(args.playerId);
    if (!player) return { error: "Player not found" };

    const progress = await ctx.db.query("progress").withIndex("by_player", q => q.eq("playerId", args.playerId)).collect();
    const scores = await ctx.db.query("scores").withIndex("by_player", q => q.eq("playerId", args.playerId)).collect();
    const challengesSent = await ctx.db.query("challenges").withIndex("by_from", q => q.eq("fromId", args.playerId)).collect();
    const challengesReceived = await ctx.db.query("challenges").withIndex("by_to", q => q.eq("toId", args.playerId)).collect();

    return {
      id: player._id,
      name: player.name,
      avatar: player.avatar,
      createdAt: player.createdAt,
      lastActive: player.lastActive,
      progressCount: progress.length,
      scoresCount: scores.length,
      challengesSent: challengesSent.length,
      challengesReceived: challengesReceived.length,
    };
  },
});
