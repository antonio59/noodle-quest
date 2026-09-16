import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { playerFromSession } from "./model/auth";

const MAX_POST_LENGTH = 2000;

const CLIENT_POST_TYPES = v.union(
  v.literal("chat"),
  v.literal("gif_url"),
  v.literal("sticker"),
);

function isAllowedGiphyUrl(content: string): boolean {
  try {
    const url = new URL(content);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "giphy.com" || host === "i.giphy.com") return true;
    // media*.giphy.com (e.g. media0.giphy.com, media1.giphy.com)
    return /^media\d*\.giphy\.com$/.test(host);
  } catch {
    return false;
  }
}

export const createPost = mutation({
  args: {
    sessionToken: v.string(),
    type: CLIENT_POST_TYPES,
    content: v.string(),
    gameId: v.optional(v.string()),
    gameName: v.optional(v.string()),
    gameEmoji: v.optional(v.string()),
    stage: v.optional(v.number()),
    stars: v.optional(v.number()),
    replyToId: v.optional(v.id("feed")),
  },
  handler: async (ctx, args) => {
    const author = await playerFromSession(ctx, args.sessionToken);
    if (!author) return { error: "Not signed in." };
    if (args.content.length === 0 || args.content.length > MAX_POST_LENGTH) {
      return { error: "Message must be 1-2000 characters." };
    }
    if (args.type === "gif_url" && !isAllowedGiphyUrl(args.content)) {
      return { error: "GIF must be an https Giphy URL." };
    }

    // Snapshot the quoted message so deletions/edits don't break old replies.
    let replyToAuthorName: string | undefined;
    let replyToContent: string | undefined;
    let replyToType: string | undefined;
    if (args.replyToId) {
      const original = await ctx.db.get(args.replyToId);
      if (original) {
        replyToAuthorName = original.authorName;
        replyToContent = original.content;
        replyToType = original.type;
      }
    }

    const postId = await ctx.db.insert("feed", {
      authorId: author._id,
      authorName: author.name,
      authorAvatar: author.avatar,
      type: args.type,
      content: args.content,
      gameId: args.gameId,
      gameName: args.gameName,
      gameEmoji: args.gameEmoji,
      stage: args.stage,
      stars: args.stars,
      createdAt: Date.now(),
      replyToId: args.replyToId,
      replyToAuthorName,
      replyToContent,
      replyToType,
    });
    return { postId };
  },
});

export const getFeed = query({
  args: { limit: v.optional(v.number()), sessionToken: v.string() },
  handler: async (ctx, args) => {
    const viewer = await playerFromSession(ctx, args.sessionToken);
    if (!viewer) return [];
    const limit = Math.min(args.limit ?? 50, 100);
    const posts = await ctx.db.query("feed").withIndex("by_time").order("desc").take(limit);
    return posts.map(p => ({ id: p._id, authorName: p.authorName, authorAvatar: p.authorAvatar, type: p.type, content: p.content, gameId: p.gameId, gameName: p.gameName, gameEmoji: p.gameEmoji, stage: p.stage, stars: p.stars, createdAt: p.createdAt }));
  },
});

const mapPost = (p: any) => ({
  id: p._id,
  authorName: p.authorName,
  authorAvatar: p.authorAvatar,
  type: p.type,
  content: p.content,
  gameId: p.gameId,
  gameName: p.gameName,
  gameEmoji: p.gameEmoji,
  stage: p.stage,
  stars: p.stars,
  createdAt: p.createdAt,
  replyToId: p.replyToId,
  replyToAuthorName: p.replyToAuthorName,
  replyToContent: p.replyToContent,
  replyToType: p.replyToType,
});

export const getChatMessages = query({
  args: { limit: v.optional(v.number()), sessionToken: v.string() },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const viewer = await playerFromSession(ctx, args.sessionToken);
    if (!viewer) return [];
    // Hide chat history that predates the viewer's join time.
    const since = viewer.createdAt;
    // Fetch chat, gif, and gif_url posts separately via the type+time index
    const [chats, gifs, gifUrls] = await Promise.all([
      ctx.db.query("feed").withIndex("by_type_time", q => q.eq("type", "chat")).order("desc").take(limit),
      ctx.db.query("feed").withIndex("by_type_time", q => q.eq("type", "gif")).order("desc").take(20),
      ctx.db.query("feed").withIndex("by_type_time", q => q.eq("type", "gif_url")).order("desc").take(20),
    ]);
    // Merge, drop anything older than the viewer joined, sort desc, cap to limit
    const visible = [...chats, ...gifs, ...gifUrls]
      .filter(p => p.createdAt >= since)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    // Bundle reactions for the visible posts. Done in one parallel batch so
    // the client gets reactions in the same snapshot as the messages.
    const reactionsPerPost = await Promise.all(
      visible.map(p =>
        ctx.db.query("reactions").withIndex("by_post", q => q.eq("postId", p._id)).collect(),
      ),
    );

    return visible.map((p, i) => ({
      ...mapPost(p),
      reactions: reactionsPerPost[i].map(r => ({
        id: r._id,
        playerId: r.playerId,
        playerName: r.playerName,
        emoji: r.emoji,
      })),
    }));
  },
});

// Newest chat-style post timestamp — powers the unread dot in the nav
// without subscribing the whole message list.
export const getLatestChatTime = query({
  args: {},
  handler: async (ctx) => {
    let latest = 0;
    for (const type of ["chat", "gif", "gif_url"]) {
      const post = await ctx.db.query("feed").withIndex("by_type_time", q => q.eq("type", type)).order("desc").first();
      if (post && post.createdAt > latest) latest = post.createdAt;
    }
    return latest;
  },
});

export const getActivity = query({
  args: { limit: v.optional(v.number()), sessionToken: v.string() },
  handler: async (ctx, args) => {
    const viewer = await playerFromSession(ctx, args.sessionToken);
    if (!viewer) return [];
    const limit = Math.min(args.limit ?? 50, 100);
    const posts = await ctx.db.query("feed").withIndex("by_type_time", q => q.eq("type", "score")).order("desc").take(limit);
    return posts.map(mapPost);
  },
});

// Toggle a reaction: if the same (post, player, emoji) row exists, remove it;
// otherwise insert it. A player can stack multiple distinct emojis on the
// same post (Slack/Discord-style), but tapping the same emoji twice
// removes their reaction.
export const toggleReaction = mutation({
  args: {
    sessionToken: v.string(),
    postId: v.id("feed"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return { error: "Not signed in." };

    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_post_player", q => q.eq("postId", args.postId).eq("playerId", player._id))
      .collect();
    const match = existing.find(r => r.emoji === args.emoji);
    if (match) {
      await ctx.db.delete(match._id);
      return { removed: true };
    }
    await ctx.db.insert("reactions", {
      postId: args.postId,
      playerId: player._id,
      playerName: player.name,
      emoji: args.emoji,
      createdAt: Date.now(),
    });
    return { added: true };
  },
});
