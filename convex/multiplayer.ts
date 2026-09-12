import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { playerFromSession } from "./model/auth";
import { validateMoveForGame } from "./model/validateMove";

// Generate a short unique invite code via CSPRNG; retry on collision.
async function generateInviteCode(ctx: MutationCtx): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 32; attempt++) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[bytes[i]! % chars.length];
    }
    const existing = await ctx.db
      .query("multiplayer_invites")
      .withIndex("by_code", q => q.eq("inviteCode", code))
      .unique();
    if (!existing) return code;
  }
  throw new Error("Failed to generate unique invite code");
}

interface Seat {
  id: Id<"players">;
  name: string;
  avatar: string;
  seat: number;
}

/** Read a canonical player roster from a session, falling back to legacy
 *  player1/player2 fields for documents written before the N-player refactor. */
function rosterFor(session: {
  players?: Seat[];
  player1Id: Id<"players">;
  player1Name: string;
  player1Avatar: string;
  player2Id?: Id<"players">;
  player2Name?: string;
  player2Avatar?: string;
}): Seat[] {
  if (session.players && session.players.length > 0) return session.players;
  const seats: Seat[] = [
    { id: session.player1Id, name: session.player1Name, avatar: session.player1Avatar, seat: 1 },
  ];
  if (session.player2Id && session.player2Name && session.player2Avatar) {
    seats.push({ id: session.player2Id, name: session.player2Name, avatar: session.player2Avatar, seat: 2 });
  }
  return seats;
}

// Create a multiplayer invite (link or direct)
export const createInvite = mutation({
  args: {
    gameId: v.string(),
    sessionToken: v.string(),
    toId: v.optional(v.id("players")),
    minPlayers: v.optional(v.number()),
    maxPlayers: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const from = await playerFromSession(ctx, args.sessionToken);
    if (!from) return { error: "Not signed in." };
    const fromId = from._id;

    let toName: string | undefined;
    if (args.toId) {
      const to = await ctx.db.get(args.toId);
      if (!to) return { error: "Target player not found." };
      toName = to.name;
    }

    const minPlayers = Math.max(2, args.minPlayers ?? 2);
    const maxPlayers = Math.max(minPlayers, args.maxPlayers ?? 2);

    const hostSeat: Seat = {
      id: fromId,
      name: from.name,
      avatar: from.avatar,
      seat: 1,
    };

    // Create the session. 'waiting' = host alone; 'lobby' = enough players to
    // start but host hasn't pressed start yet. 'playing' begins on startSession.
    const sessionId = await ctx.db.insert("multiplayer_sessions", {
      gameId: args.gameId,
      player1Id: fromId,
      player1Name: from.name,
      player1Avatar: from.avatar,
      players: [hostSeat],
      minPlayers,
      maxPlayers,
      boardState: null,
      currentPlayer: 1,
      status: 'waiting',
      moves: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const inviteCode = await generateInviteCode(ctx);
    const inviteId = await ctx.db.insert("multiplayer_invites", {
      gameId: args.gameId,
      fromId,
      fromName: from.name,
      fromAvatar: from.avatar,
      toId: args.toId,
      toName,
      inviteCode,
      sessionId,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
    });

    // Auto-post to feed
    await ctx.db.insert("feed", {
      authorId: fromId,
      authorName: from.name,
      authorAvatar: from.avatar,
      type: 'invite',
      content: `invited someone to play ${args.gameId}!`,
      gameId: args.gameId,
      createdAt: Date.now(),
    });

    return { inviteId, inviteCode, sessionId };
  },
});

// Get invite by code
export const getInvite = query({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db.query("multiplayer_invites")
      .withIndex("by_code", q => q.eq("inviteCode", args.inviteCode))
      .unique();
    if (!invite) return null;
    return {
      _id: invite._id,
      gameId: invite.gameId,
      fromId: invite.fromId,
      fromName: invite.fromName,
      fromAvatar: invite.fromAvatar,
      toId: invite.toId,
      toName: invite.toName,
      inviteCode: invite.inviteCode,
      sessionId: invite.sessionId,
      status: invite.status,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
    };
  },
});

// Get pending invites for the signed-in player
export const getPendingInvites = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return [];
    const invites = await ctx.db.query("multiplayer_invites")
      .withIndex("by_to", q => q.eq("toId", player._id).eq("status", "pending"))
      .collect();
    return invites
      .filter(i => i.expiresAt > Date.now())
      .map(i => ({
        _id: i._id,
        gameId: i.gameId,
        fromName: i.fromName,
        fromAvatar: i.fromAvatar,
        inviteCode: i.inviteCode,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
      }));
  },
});

// Join a multiplayer session via invite code. Appends the joiner to the roster
// up to maxPlayers. Invite stays pending until the lobby is full OR the host
// presses start (startSession).
export const joinSession = mutation({
  args: {
    inviteCode: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.query("multiplayer_invites")
      .withIndex("by_code", q => q.eq("inviteCode", args.inviteCode))
      .unique();

    if (!invite) return { error: "Invite not found." };
    if (invite.status !== 'pending') return { error: "Invite already used." };
    if (invite.expiresAt < Date.now()) {
      await ctx.db.patch(invite._id, { status: 'expired' });
      return { error: "Invite has expired." };
    }

    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return { error: "Not signed in." };
    const playerId = player._id;

    if (invite.toId && invite.toId !== playerId) {
      return { error: "This invite isn't for you." };
    }

    if (!invite.sessionId) return { error: "Session missing." };
    const session = await ctx.db.get(invite.sessionId);
    if (!session) return { error: "Session not found." };

    const roster = rosterFor(session);
    if (roster.some(s => s.id === playerId)) {
      // Already joined — idempotent success.
      return { sessionId: invite.sessionId };
    }

    const maxPlayers = session.maxPlayers ?? 2;
    if (roster.length >= maxPlayers) return { error: "Game is full." };

    const minPlayers = session.minPlayers ?? 2;
    const newSeat: Seat = {
      id: playerId,
      name: player.name,
      avatar: player.avatar,
      seat: roster.length + 1,
    };
    const players = [...roster, newSeat];

    // For 2-player games the second join auto-starts, matching legacy behaviour.
    // For 3+ player games we stay in 'lobby' until the host calls startSession.
    const canAutoStart = maxPlayers === 2 && players.length === 2;
    const nextStatus = canAutoStart ? 'playing' : 'lobby';

    // Keep legacy player2* fields populated when seat 2 fills, for older reads.
    const legacyPatch: {
      player2Id?: Id<"players">;
      player2Name?: string;
      player2Avatar?: string;
    } = {};
    if (newSeat.seat === 2) {
      legacyPatch.player2Id = newSeat.id;
      legacyPatch.player2Name = newSeat.name;
      legacyPatch.player2Avatar = newSeat.avatar;
    }

    await ctx.db.patch(invite.sessionId, {
      ...legacyPatch,
      players,
      status: nextStatus,
      updatedAt: Date.now(),
    });

    // Accept the invite only once the lobby is considered ready. Leave it
    // pending while we're still filling seats.
    if (canAutoStart || players.length >= maxPlayers) {
      await ctx.db.patch(invite._id, { status: 'accepted' });
    }

    return { sessionId: invite.sessionId, players, canStart: players.length >= minPlayers };
  },
});

// Host starts the session once ≥ minPlayers have joined. No-op for 2-player
// games, which auto-start when the second player joins.
export const startSession = mutation({
  args: {
    sessionId: v.id("multiplayer_sessions"),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return { error: "Not signed in." };
    const session = await ctx.db.get(args.sessionId);
    if (!session) return { error: "Session not found." };
    if (session.player1Id !== player._id) return { error: "Only the host can start." };
    if (session.status === 'playing' || session.status === 'finished') {
      return { error: "Game already started." };
    }
    const roster = rosterFor(session);
    const minPlayers = session.minPlayers ?? 2;
    if (roster.length < minPlayers) {
      return { error: `Need at least ${minPlayers} players.` };
    }
    await ctx.db.patch(args.sessionId, {
      status: 'playing',
      currentPlayer: 1,
      updatedAt: Date.now(),
    });
    // Accept any remaining pending invites tied to this session.
    const invites = await ctx.db.query("multiplayer_invites")
      .withIndex("by_from", q => q.eq("fromId", session.player1Id))
      .collect();
    for (const inv of invites) {
      if (inv.sessionId === args.sessionId && inv.status === 'pending') {
        await ctx.db.patch(inv._id, { status: 'accepted' });
      }
    }
    return { ok: true };
  },
});

// Get a multiplayer session
export const getSession = query({
  args: { sessionId: v.id("multiplayer_sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    const roster = rosterFor(session);
    return {
      _id: session._id,
      gameId: session.gameId,
      players: roster,
      minPlayers: session.minPlayers ?? 2,
      maxPlayers: session.maxPlayers ?? 2,
      // Legacy mirrors for any old callers
      player1Id: session.player1Id,
      player1Name: session.player1Name,
      player1Avatar: session.player1Avatar,
      player2Id: session.player2Id,
      player2Name: session.player2Name,
      player2Avatar: session.player2Avatar,
      boardState: session.boardState,
      currentPlayer: session.currentPlayer,
      status: session.status,
      winner: session.winner,
      moves: session.moves,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  },
});

// Make a move in a multiplayer session. Rotates currentPlayer modulo N.
export const makeMove = mutation({
  args: {
    sessionId: v.id("multiplayer_sessions"),
    sessionToken: v.string(),
    move: v.any(),
  },
  handler: async (ctx, args) => {
    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return { error: "Not signed in." };
    const session = await ctx.db.get(args.sessionId);
    if (!session) return { error: "Session not found." };
    if (session.status !== 'playing') return { error: "Game is not active." };

    const roster = rosterFor(session);
    const seat = roster.find(s => s.id === player._id);
    if (!seat) return { error: "You are not in this game." };
    if (session.currentPlayer !== seat.seat) return { error: "Not your turn." };

    const winner = args.move?.winner;
    if (winner !== undefined) {
      // 0 = draw; otherwise seat 1..roster.length
      if (!Number.isInteger(winner) || (winner !== 0 && (winner < 1 || winner > roster.length))) {
        return { error: "Invalid winner." };
      }
    }

    const boardState = args.move?.boardState ?? session.boardState;
    const rulesError = validateMoveForGame(
      session.gameId,
      boardState,
      winner,
      seat.seat,
      {
        previousBoardState: session.boardState,
        playerCount: roster.length,
      },
    );
    if (rulesError) return { error: rulesError };

    const moves = [...session.moves, { player: seat.seat, move: args.move, at: Date.now() }];
    // Prefer client-supplied turnSeat (Ludo bonus-6 / Cube Twist) when valid.
    const clientTurn = args.move?.boardState?.turnSeat;
    const nextSeat =
      Number.isInteger(clientTurn) && clientTurn >= 1 && clientTurn <= roster.length
        ? clientTurn
        : (seat.seat % roster.length) + 1;

    await ctx.db.patch(args.sessionId, {
      boardState,
      currentPlayer: nextSeat,
      moves,
      winner,
      status: winner !== undefined ? 'finished' : 'playing',
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

// Get active games for the signed-in player.
export const getActiveGames = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return [];
    const playing = await ctx.db.query("multiplayer_sessions")
      .withIndex("by_status", q => q.eq("status", "playing"))
      .collect();

    const mine = playing.filter(s => rosterFor(s).some(seat => seat.id === player._id));

    return mine.map(s => {
      const roster = rosterFor(s);
      const mySeat = roster.find(seat => seat.id === player._id)!;
      const others = roster.filter(seat => seat.id !== player._id);
      const firstOther = others[0];
      return {
        _id: s._id,
        gameId: s.gameId,
        opponentName: firstOther?.name ?? null,
        opponentAvatar: firstOther?.avatar ?? null,
        playerCount: roster.length,
        currentPlayer: s.currentPlayer,
        isMyTurn: s.currentPlayer === mySeat.seat,
        updatedAt: s.updatedAt,
      };
    });
  },
});

// Decline an invite. Direct invites can only be declined by the invitee;
// open link invites can be declined by any signed-in player holding the code.
export const declineInvite = mutation({
  args: { inviteCode: v.string(), sessionToken: v.string() },
  handler: async (ctx, args) => {
    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return { error: "Not signed in." };
    const invite = await ctx.db.query("multiplayer_invites")
      .withIndex("by_code", q => q.eq("inviteCode", args.inviteCode))
      .unique();
    if (!invite) return { error: "Invite not found." };
    if (invite.toId && invite.toId !== player._id) return { error: "This invite isn't for you." };
    await ctx.db.patch(invite._id, { status: 'declined' });
    if (invite.sessionId) {
      await ctx.db.patch(invite.sessionId, { status: 'finished', updatedAt: Date.now() });
    }
    return { ok: true };
  },
});
