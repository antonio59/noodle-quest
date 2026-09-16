import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  players: defineTable({
    name: v.string(),
    // Legacy plaintext PIN. Cleared once the player is migrated to
    // pinHash/pinSalt (lazily on login, or via migrations:hashAllPins).
    pin: v.optional(v.string()),
    pinHash: v.optional(v.string()),
    pinSalt: v.optional(v.string()),
    // Login brute-force protection
    failedAttempts: v.optional(v.number()),
    lockedUntil: v.optional(v.number()),
    avatar: v.string(),
    // Family prefs — optional so existing rows stay valid.
    kidMode: v.optional(v.boolean()),
    theme: v.optional(v.union(v.literal("dark"), v.literal("light"))),
    // Signup gate. Missing = approved (grandfathered players). "pending"
    // waits for admin approval; "rejected" is blocked and hidden.
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    )),
    // Single-use capability token embedded in the admin approval email —
    // lets the owner approve/reject from the link without logging in.
    approvalToken: v.optional(v.string()),
    createdAt: v.number(),
    lastActive: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_approval", ["approvalToken"])
    .searchIndex("search_name", { searchField: "name" }),

  // Auth sessions. A token is issued on signup/login and must accompany
  // every mutation that acts on a player's behalf.
  sessions: defineTable({
    playerId: v.id("players"),
    token: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_player", ["playerId"]),

  progress: defineTable({
    playerId: v.id("players"),
    gameId: v.string(),
    stage: v.number(),
    highScore: v.number(),
    starsEarned: v.number(),
    timesPlayed: v.number(),
    lastPlayed: v.number(),
  })
    .index("by_player", ["playerId"])
    .index("by_player_game", ["playerId", "gameId"]),

  scores: defineTable({
    playerId: v.id("players"),
    gameId: v.string(),
    stage: v.number(),
    score: v.number(),
    stars: v.number(),
    playedAt: v.number(),
  })
    .index("by_player", ["playerId"])
    .index("by_game_score", ["gameId", "score"])
    .index("by_playedAt", ["playedAt"]),

  challenges: defineTable({
    fromId: v.id("players"),
    toId: v.id("players"),
    gameId: v.string(),
    stage: v.number(),
    fromScore: v.number(),
    toScore: v.optional(v.number()),
    status: v.string(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_to", ["toId", "status"])
    .index("by_from", ["fromId"]),

  feed: defineTable({
    authorId: v.id("players"),
    authorName: v.string(),
    authorAvatar: v.string(),
    type: v.string(),
    content: v.string(),
    gameId: v.optional(v.string()),
    gameName: v.optional(v.string()),
    gameEmoji: v.optional(v.string()),
    stage: v.optional(v.number()),
    stars: v.optional(v.number()),
    createdAt: v.number(),
    // Reply-to-message (WhatsApp-style). We snapshot the quoted text so
    // deleting/editing the original message doesn't break old quotes.
    replyToId: v.optional(v.id("feed")),
    replyToAuthorName: v.optional(v.string()),
    replyToContent: v.optional(v.string()),
    replyToType: v.optional(v.string()),
  })
    .index("by_time", ["createdAt"])
    .index("by_type_time", ["type", "createdAt"]),

  // Emoji reactions on feed posts. One row per (post, player, emoji)
  // — a player can react with multiple distinct emojis, but the same
  // emoji from the same player on the same post is deduped at write time.
  reactions: defineTable({
    postId: v.id("feed"),
    playerId: v.id("players"),
    playerName: v.string(),
    emoji: v.string(),
    createdAt: v.number(),
  })
    .index("by_post", ["postId"])
    .index("by_post_player", ["postId", "playerId"]),

  favorites: defineTable({
    playerId: v.id("players"),
    gameId: v.string(),
    addedAt: v.number(),
  }).index("by_player", ["playerId"]),

  playlists: defineTable({
    playerId: v.id("players"),
    name: v.string(),
    trackIds: v.array(v.string()),
    isDefault: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_player", ["playerId"]),

  // Multiplayer tables
  multiplayer_invites: defineTable({
    gameId: v.string(),
    fromId: v.id("players"),
    fromName: v.string(),
    fromAvatar: v.string(),
    toId: v.optional(v.id("players")),
    toName: v.optional(v.string()),
    inviteCode: v.string(),
    sessionId: v.optional(v.id("multiplayer_sessions")),
    status: v.string(), // 'pending' | 'accepted' | 'declined' | 'expired'
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_code", ["inviteCode"])
    .index("by_from", ["fromId"])
    .index("by_to", ["toId", "status"]),

  multiplayer_sessions: defineTable({
    gameId: v.string(),
    // Legacy 2-player fields (kept optional for backward compat). The
    // authoritative roster lives on the `players` array below — new code
    // should read from there.
    player1Id: v.id("players"),
    player1Name: v.string(),
    player1Avatar: v.string(),
    player2Id: v.optional(v.id("players")),
    player2Name: v.optional(v.string()),
    player2Avatar: v.optional(v.string()),
    // N-player roster. seat is 1-indexed (matches currentPlayer numbering).
    players: v.optional(
      v.array(
        v.object({
          id: v.id("players"),
          name: v.string(),
          avatar: v.string(),
          seat: v.number(),
        }),
      ),
    ),
    minPlayers: v.optional(v.number()),
    maxPlayers: v.optional(v.number()),
    boardState: v.any(),
    currentPlayer: v.number(), // 1..N
    status: v.string(), // 'waiting' | 'lobby' | 'playing' | 'finished'
    winner: v.optional(v.number()), // seat number, or 0 for draw
    moves: v.array(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_player1", ["player1Id", "status"])
    .index("by_player2", ["player2Id", "status"])
    .index("by_status", ["status"]),

  // Game requests from players
  game_requests: defineTable({
    gameName: v.string(),
    description: v.string(),
    playerId: v.optional(v.id("players")),
    playerName: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),

  // Admin secret brute-force gate (single row keyed "default")
  admin_gate: defineTable({
    key: v.string(),
    failedAttempts: v.number(),
    lockedUntil: v.optional(v.number()),
  }).index("by_key", ["key"]),

  // Error reports and bot integration
  reports: defineTable({
    errorId: v.string(), // unique error identifier
    gameId: v.optional(v.string()),
    playerId: v.optional(v.id("players")),
    playerName: v.optional(v.string()),
    errorType: v.string(), // 'runtime' | 'logic' | 'ui' | 'performance'
    severity: v.string(), // 'low' | 'medium' | 'high' | 'critical'
    message: v.string(),
    stackTrace: v.optional(v.string()),
    context: v.optional(v.any()), // game state, user action, etc.
    status: v.string(), // 'open' | 'investigating' | 'resolved' | 'dismissed'
    linearIssueId: v.optional(v.string()), // Linear issue ID
    linearIssueUrl: v.optional(v.string()),
    resolvedBy: v.optional(v.string()), // bot or user who resolved
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_errorId", ["errorId"])
    .index("by_game", ["gameId", "status"])
    .index("by_created", ["createdAt"]),
});
