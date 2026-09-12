import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { playerFromSession } from "./model/auth";
import { validateMoveForGame } from "./model/validateMove";
import {
  bingoPool,
  dealScrabble,
  dealUno,
  rollDie,
  scrambleCube,
  shuffle,
  unoDrawPenalty,
  unoKeepsTurn,
  type UnoCard,
  type UnoColor,
} from "./model/gameRules";

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

// ── Multiplayer protocol ───────────────────────────────────────────────
//
// Games where the initial deal MUST be produced server-side (prevents the
// host from stacking the deck / knowing the draw order / choosing a
// scramble it has already solved).
const DEAL_GAMES = new Set(["uno", "scrabble", "cube-twist"]);

// Games with server-rolled dice. A `{action:'roll'}` move stores
// boardState.pendingRoll = {seat, value}; the next regular move must carry
// lastRoll === value, which consumes it. Stops re-rolling and forged dice.
const ROLL_GAMES = new Set(["ludo", "snakes-ladders"]);

// Race games: no turn gate, every seated player may move at any time.
const RACE_GAMES = new Set(["cube-twist"]);

// Server-owned boardState keys a client can never write directly.
const SERVER_ONLY_KEYS: Record<string, string[]> = {
  bingo: ["pool"],
  uno: ["deck", "drew"],
  "snakes-ladders": ["pendingRoll"],
  ludo: ["pendingRoll"],
};

const MAX_PLAYERS = 8;
const MOVE_PAYLOAD_LIMIT = 64_000;
const MAX_STORED_MOVES = 400;

function nextSeat(seat: number, n: number): number {
  return (seat % n) + 1;
}

/** Placeholder objects used to hide other players' private state. */
const HIDDEN_CARD = { hidden: true } as const;

/**
 * Strip private information out of a stored boardState for `viewerSeat`
 * (1-indexed, or null for an unseated spectator). UNO hides other hands
 * and the draw pile; Scrabble hides other racks and the tile bag; Bingo
 * hides the upcoming call order.
 */
function sanitizeBoardState(gameId: string, bs: unknown, viewerSeat: number | null): unknown {
  if (bs === null || typeof bs !== "object") return bs;
  const state = bs as Record<string, unknown>;

  if (gameId === "uno") {
    const hands = state.hands as Record<string, unknown[]> | undefined;
    if (!hands) return state;
    const out: Record<string, unknown> = { ...state };
    const visibleHands: Record<string, unknown> = {};
    for (const [key, hand] of Object.entries(hands)) {
      visibleHands[key] =
        viewerSeat !== null && Number(key) === viewerSeat && Array.isArray(hand)
          ? hand
          : (Array.isArray(hand) ? hand.map(() => HIDDEN_CARD) : hand);
    }
    out.hands = visibleHands;
    if (Array.isArray(state.deck)) out.deck = (state.deck as unknown[]).map(() => HIDDEN_CARD);
    return out;
  }

  if (gameId === "scrabble") {
    const out: Record<string, unknown> = { ...state };
    if (Array.isArray(state.racks)) {
      out.racks = (state.racks as unknown[]).map((rack, i) =>
        viewerSeat === i + 1 && Array.isArray(rack)
          ? rack
          : Array.isArray(rack)
            ? (rack as unknown[]).map(() => null)
            : rack,
      );
    }
    if (Array.isArray(state.pool)) out.pool = (state.pool as unknown[]).map(() => null);
    return out;
  }

  if (gameId === "bingo") {
    const out: Record<string, unknown> = { ...state };
    delete out.pool;
    return out;
  }

  return state;
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

    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(args.gameId)) {
      return { error: "Unknown game." };
    }

    let toName: string | undefined;
    if (args.toId) {
      const to = await ctx.db.get(args.toId);
      if (!to) return { error: "Target player not found." };
      toName = to.name;
    }

    const minPlayers = Math.min(MAX_PLAYERS, Math.max(2, Math.floor(args.minPlayers ?? 2)));
    const maxPlayers = Math.min(MAX_PLAYERS, Math.max(minPlayers, Math.floor(args.maxPlayers ?? 2)));

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
      // The linked session is dead too — nobody can join a game whose
      // invite expired while it was still waiting for players.
      if (invite.sessionId) {
        const session = await ctx.db.get(invite.sessionId);
        if (session && (session.status === 'waiting' || session.status === 'lobby')) {
          await ctx.db.patch(session._id, { status: 'finished', updatedAt: Date.now() });
        }
      }
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
    if (session.status === 'finished') return { error: "This game has ended." };
    if (session.status === 'playing') return { error: "Game already started." };

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

// Leave a game. The session ends and the next seated player is recorded as
// the winner (forfeit).
export const resignSession = mutation({
  args: {
    sessionId: v.id("multiplayer_sessions"),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return { error: "Not signed in." };
    const session = await ctx.db.get(args.sessionId);
    if (!session) return { error: "Session not found." };
    if (session.status === 'finished') return { ok: true };
    const roster = rosterFor(session);
    const seat = roster.find(s => s.id === player._id);
    if (!seat) return { error: "You are not in this game." };
    const winner = roster.find(s => s.seat !== seat.seat)?.seat;
    await ctx.db.patch(args.sessionId, {
      status: 'finished',
      winner,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

// Get a multiplayer session. sessionToken identifies the viewer so that
// hidden-information games can reveal exactly their own cards.
export const getSession = query({
  args: {
    sessionId: v.id("multiplayer_sessions"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    const roster = rosterFor(session);
    const viewer = args.sessionToken ? await playerFromSession(ctx, args.sessionToken) : null;
    const viewerSeat = viewer ? (roster.find(s => s.id === viewer._id)?.seat ?? null) : null;
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
      boardState: sanitizeBoardState(session.gameId, session.boardState, viewerSeat),
      currentPlayer: session.currentPlayer,
      status: session.status,
      winner: session.winner,
      moves: session.moves,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  },
});

// ── makeMove helpers ───────────────────────────────────────────────────

function dealGame(gameId: string, playerCount: number, move: Record<string, unknown>): Record<string, unknown> | { error: string } {
  if (gameId === "uno") {
    const deal = dealUno(playerCount);
    return { ...deal, currentPlayer: 1 };
  }
  if (gameId === "scrabble") {
    const deal = dealScrabble(playerCount);
    const dict =
      typeof move.dict === "string" && /^[a-z0-9-]{1,16}$/i.test(move.dict) ? move.dict : "intl";
    return {
      ...deal,
      currentSeat: 0,
      isFirstMove: true,
      lastWord: "",
      dict,
    };
  }
  if (gameId === "cube-twist") {
    const n =
      typeof move.n === "number" && Number.isInteger(move.n) && move.n >= 1 && move.n <= 50
        ? move.n
        : 12;
    const scramble = scrambleCube(n);
    const cubes: Record<number, unknown> = {};
    const moveCounts: Record<number, number> = {};
    for (let seat = 1; seat <= playerCount; seat++) {
      cubes[seat] = scramble;
      moveCounts[seat] = 0;
    }
    return { scramble, cubes, moveCounts };
  }
  return { error: "This game has no deal." };
}

function hasDealState(gameId: string, bs: Record<string, unknown>): boolean {
  if (gameId === "uno") return bs.hands !== null && typeof bs.hands === "object";
  if (gameId === "scrabble") return Array.isArray(bs.board);
  if (gameId === "cube-twist") return bs.cubes !== null && typeof bs.cubes === "object";
  return true;
}

/** Pop `count` cards off the deck, reshuffling spent discards if needed. */
function unoDraw(deck: UnoCard[], discard: UnoCard[], count: number): { drawn: UnoCard[]; deck: UnoCard[] } {
  let d = deck;
  if (d.length < count && discard.length > 1) {
    d = shuffle(discard.slice(0, -1).concat(d));
  }
  return { drawn: d.slice(0, count), deck: d.slice(count) };
}

/**
 * Rebuild the authoritative boardState from the submitted one. Hidden or
 * server-owned fields are always taken from the stored state, never from
 * the client.
 */
function mergeBoardState(
  gameId: string,
  stored: Record<string, unknown>,
  submitted: Record<string, unknown>,
  seat: number,
  playerCount: number,
): Record<string, unknown> {
  // Never let a client write server-owned keys (deck order, call pool,
  // pending rolls, draw markers).
  const protectedKeys = SERVER_ONLY_KEYS[gameId] ?? [];
  const base: Record<string, unknown> = { ...submitted };
  for (const key of protectedKeys) {
    delete base[key];
    if (key in stored && stored[key] != null) base[key] = stored[key];
  }

  if (gameId === "uno") {
    const storedHands = (stored.hands ?? {}) as Record<string, UnoCard[]>;
    const submittedHands = (base.hands ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...storedHands };
    // The mover's own hand is the only client-writable hand, and only
    // after validateUno proved it equals stored minus the played card.
    merged[String(seat)] = submittedHands[String(seat)] ?? storedHands[String(seat)] ?? [];

    // +2 / +4 penalties are dealt by the server from the real deck so the
    // victim's cards never transit through the attacker's client.
    const discard = (base.discard ?? []) as UnoCard[];
    const played = discard[discard.length - 1];
    let deck = (stored.deck ?? []) as UnoCard[];
    if (played && unoDrawPenalty(played) > 0) {
      const victim = nextSeat(seat, playerCount);
      const { drawn, deck: rest } = unoDraw(deck, discard, unoDrawPenalty(played));
      deck = rest;
      merged[String(victim)] = [...(merged[String(victim)] as UnoCard[] ?? []), ...drawn];
    }
    base.hands = merged;
    base.deck = deck;
    delete base.drew;
    return base;
  }

  if (gameId === "scrabble") {
    const storedRacks = (stored.racks ?? []) as string[][];
    const storedPool = (stored.pool ?? []) as string[];
    const submittedRacks = (base.racks ?? []) as unknown[];
    const moverIdx = seat - 1;
    const myRack = Array.isArray(submittedRacks[moverIdx])
      ? (submittedRacks[moverIdx] as string[])
      : storedRacks[moverIdx] ?? [];
    // Server refills the mover's rack from the hidden pool; other racks
    // always come from stored state.
    const drawCount = Math.max(0, Math.min(7 - myRack.length, storedPool.length));
    const racks = storedRacks.map((r, i) => (i === moverIdx ? [...myRack, ...storedPool.slice(0, drawCount)] : r));
    base.racks = racks;
    base.pool = storedPool.slice(drawCount);
    return base;
  }

  if (gameId === "cube-twist") {
    const cubes = { ...((stored.cubes ?? {}) as Record<string, unknown>) };
    const moveCounts = { ...((stored.moveCounts ?? {}) as Record<string, number>) };
    if (base.cube !== undefined) {
      cubes[String(seat)] = base.cube;
      moveCounts[String(seat)] = (moveCounts[String(seat)] ?? 0) + 1;
    }
    delete base.cube;
    delete base.moveCount;
    base.cubes = cubes;
    base.moveCounts = moveCounts;
    return base;
  }

  return base;
}

/** Where the turn goes after this move. Client `turnSeat` is advisory and
 *  ignored — the server derives it from game rules. */
function resolveNextSeat(
  gameId: string,
  session: { currentPlayer: number },
  seat: number,
  playerCount: number,
  boardState: Record<string, unknown>,
): number {
  switch (gameId) {
    case "bingo":
    case "cube-twist":
      return session.currentPlayer;
    case "ludo": {
      // Rolling a 6 earns a bonus roll.
      return boardState.lastRoll === 6 ? seat : nextSeat(seat, playerCount);
    }
    case "uno": {
      const discard = boardState.discard as UnoCard[] | undefined;
      const top = discard?.[discard.length - 1];
      return top && unoKeepsTurn(top) ? seat : nextSeat(seat, playerCount);
    }
    default:
      return nextSeat(seat, playerCount);
  }
}

// Make a move in a multiplayer session.
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

    if (JSON.stringify(args.move).length > MOVE_PAYLOAD_LIMIT) {
      return { error: "Move payload too large." };
    }

    const move = (args.move ?? {}) as Record<string, unknown>;
    const action = typeof move.action === "string" ? move.action : null;
    const winner = move.winner as number | undefined;
    let stored = (session.boardState ?? {}) as Record<string, unknown>;
    const gameId = session.gameId;
    const playerCount = roster.length;

    const recordMove = async () => {
      const moves = [...session.moves, { player: seat.seat, move: args.move, at: Date.now() }];
      return moves.length > MAX_STORED_MOVES ? moves.slice(-MAX_STORED_MOVES) : moves;
    };

    // ── Action moves (server-produced state) ──────────────────────────
    if (action) {
      if (action === "deal") {
        if (seat.seat !== 1) return { error: "Only the host deals." };
        if (!DEAL_GAMES.has(gameId)) return { error: "This game has no deal." };
        if (hasDealState(gameId, stored)) return { error: "Already dealt." };
        const dealt = dealGame(gameId, playerCount, move);
        if ("error" in dealt) return dealt;
        await ctx.db.patch(args.sessionId, {
          boardState: dealt,
          currentPlayer: 1,
          moves: await recordMove(),
          updatedAt: Date.now(),
        });
        return { ok: true };
      }

      if (action === "roll") {
        if (!ROLL_GAMES.has(gameId)) return { error: "This game has no dice." };
        if (session.currentPlayer !== seat.seat) return { error: "Not your turn." };
        const pending = stored.pendingRoll as { seat?: number } | undefined;
        if (pending?.seat === seat.seat) return { error: "Already rolled — move a piece." };
        const value = rollDie();
        await ctx.db.patch(args.sessionId, {
          boardState: { ...stored, lastRoll: value, pendingRoll: { seat: seat.seat, value } },
          moves: await recordMove(),
          updatedAt: Date.now(),
        });
        return { ok: true, roll: value };
      }

      if (action === "call") {
        if (gameId !== "bingo") return { error: "This game has no caller." };
        if (seat.seat !== 1) return { error: "Only the host calls." };
        let pool = stored.pool as number[] | undefined;
        if (!Array.isArray(pool)) pool = bingoPool();
        if (pool.length === 0) return { error: "All numbers called." };
        const called = Array.isArray(stored.called) ? (stored.called as number[]) : [];
        await ctx.db.patch(args.sessionId, {
          boardState: { ...stored, called: [...called, pool[0]], pool: pool.slice(1) },
          moves: await recordMove(),
          updatedAt: Date.now(),
        });
        return { ok: true };
      }

      if (action === "draw") {
        if (gameId !== "uno") return { error: "This game has no draw pile." };
        if (session.currentPlayer !== seat.seat) return { error: "Not your turn." };
        if (stored.drew === seat.seat) return { error: "Already drew this turn." };
        const hands = (stored.hands ?? {}) as Record<string, UnoCard[]>;
        const discard = (stored.discard ?? []) as UnoCard[];
        const deck = (stored.deck ?? []) as UnoCard[];
        const { drawn, deck: rest } = unoDraw(deck, discard, 1);
        if (drawn.length === 0) return { error: "Deck is empty." };
        await ctx.db.patch(args.sessionId, {
          boardState: {
            ...stored,
            hands: { ...hands, [String(seat.seat)]: [...(hands[String(seat.seat)] ?? []), ...drawn] },
            deck: rest,
            drew: seat.seat,
          },
          moves: await recordMove(),
          updatedAt: Date.now(),
        });
        return { ok: true };
      }

      if (action === "pass") {
        if (gameId !== "uno") return { error: "This game has no passing." };
        if (session.currentPlayer !== seat.seat) return { error: "Not your turn." };
        if (stored.drew !== seat.seat) return { error: "Draw a card before passing." };
        const next = { ...stored };
        delete next.drew;
        await ctx.db.patch(args.sessionId, {
          boardState: next,
          currentPlayer: nextSeat(seat.seat, playerCount),
          moves: await recordMove(),
          updatedAt: Date.now(),
        });
        return { ok: true };
      }

      return { error: "Unknown action." };
    }

    // ── Regular moves ─────────────────────────────────────────────────

    // Bingo is a shared call clock, not a turn game: the host broadcasts
    // numbers and any seated player may shout bingo. Skip the turn gate
    // for win claims so the guest isn't told "Not your turn" on a valid win.
    const bingoClaim = gameId === "bingo" && winner === seat.seat;
    const freeForAll = RACE_GAMES.has(gameId);
    if (!freeForAll && !bingoClaim && session.currentPlayer !== seat.seat) {
      return { error: "Not your turn." };
    }

    if (winner !== undefined) {
      // 0 = draw; otherwise seat 1..roster.length
      if (!Number.isInteger(winner) || (winner !== 0 && (winner < 1 || winner > playerCount))) {
        return { error: "Invalid winner." };
      }
    }

    if (DEAL_GAMES.has(gameId) && !hasDealState(gameId, stored)) {
      return { error: "Game not dealt yet." };
    }

    let boardState = (move.boardState ?? session.boardState) as Record<string, unknown> | null;
    if (boardState === null || typeof boardState !== "object") {
      boardState = {};
    }

    // Dice games: a move that carries a roll must consume the server roll.
    if (ROLL_GAMES.has(gameId)) {
      const pending = stored.pendingRoll as { seat?: number; value?: number } | undefined;
      if (pending && pending.seat === seat.seat) {
        if (boardState.lastRoll !== pending.value) return { error: "Roll mismatch." };
        stored = { ...stored, pendingRoll: null };
      } else if (boardState.lastRoll !== undefined) {
        return { error: "Roll the dice first." };
      }
    }

    const rulesError = validateMoveForGame(gameId, boardState, winner, seat.seat, {
      previousBoardState: stored,
      playerCount,
    });
    if (rulesError) return { error: rulesError };

    boardState = mergeBoardState(gameId, stored, boardState, seat.seat, playerCount);

    const next = resolveNextSeat(gameId, session, seat.seat, playerCount, boardState);

    // Games keep a turn mirror inside boardState for their render code.
    // Always write the server-derived seat so a client can't move the
    // displayed turn independently of the real one.
    if (gameId === "scrabble") {
      boardState = { ...boardState, currentSeat: next - 1 };
    } else if (gameId === "uno" || gameId === "ludo" || gameId === "snakes-ladders") {
      boardState = { ...boardState, currentPlayer: next, turnSeat: next };
    }

    await ctx.db.patch(args.sessionId, {
      boardState,
      currentPlayer: next,
      moves: await recordMove(),
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

// Decline an invite. Direct invites can be declined by the invitee or the
// host; open link invites can only be cancelled by the host — anyone else
// holding the code just doesn't use it.
export const declineInvite = mutation({
  args: { inviteCode: v.string(), sessionToken: v.string() },
  handler: async (ctx, args) => {
    const player = await playerFromSession(ctx, args.sessionToken);
    if (!player) return { error: "Not signed in." };
    const invite = await ctx.db.query("multiplayer_invites")
      .withIndex("by_code", q => q.eq("inviteCode", args.inviteCode))
      .unique();
    if (!invite) return { error: "Invite not found." };
    const isHost = invite.fromId === player._id;
    const isAddressee = invite.toId === player._id;
    if (invite.toId ? !isAddressee && !isHost : !isHost) {
      return { error: "You can't decline this invite." };
    }
    await ctx.db.patch(invite._id, { status: 'declined' });
    if (invite.sessionId) {
      const session = await ctx.db.get(invite.sessionId);
      if (session && (session.status === 'waiting' || session.status === 'lobby')) {
        await ctx.db.patch(session._id, { status: 'finished', updatedAt: Date.now() });
      }
    }
    return { ok: true };
  },
});
