// @vitest-environment edge-runtime
import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup } from "./setup";

async function signedUpPlayer(t: ReturnType<typeof setup>, name = "Scorer") {
  const res = await t.mutation(api.auth.signUp, { name, pin: "123456" });
  return { playerId: res.playerId!, sessionToken: res.sessionToken! };
}

describe("saveScore", () => {
  test("requires a valid session", async () => {
    const t = setup();
    const res = await t.mutation(api.games.saveScore, {
      sessionToken: "bogus", gameId: "chess", stage: 1, score: 100, stars: 3,
    });
    expect(res.error).toBe("Not signed in.");
  });

  test("records score, progress, and a feed post", async () => {
    const t = setup();
    const { playerId, sessionToken } = await signedUpPlayer(t);
    const res = await t.mutation(api.games.saveScore, {
      sessionToken, gameId: "chess", stage: 1, score: 100, stars: 3,
    });
    expect(res.ok).toBe(true);

    const scores = await t.run(async ctx => ctx.db.query("scores").collect());
    expect(scores).toHaveLength(1);
    expect(scores[0].playerId).toBe(playerId);

    const progress = await t.run(async ctx => ctx.db.query("progress").collect());
    expect(progress).toHaveLength(1);
    expect(progress[0].highScore).toBe(100);

    const feed = await t.run(async ctx => ctx.db.query("feed").collect());
    expect(feed).toHaveLength(1);
    expect(feed[0].type).toBe("score");
  });

  test("keeps the best high score and accumulates plays", async () => {
    const t = setup();
    const { sessionToken } = await signedUpPlayer(t);
    await t.mutation(api.games.saveScore, { sessionToken, gameId: "chess", stage: 1, score: 100, stars: 2 });
    await t.mutation(api.games.saveScore, { sessionToken, gameId: "chess", stage: 1, score: 50, stars: 1 });
    const progress = await t.run(async ctx => ctx.db.query("progress").collect());
    expect(progress).toHaveLength(1);
    expect(progress[0].highScore).toBe(100);
    expect(progress[0].starsEarned).toBe(3);
    expect(progress[0].timesPlayed).toBe(2);
  });

  test("rejects garbage values", async () => {
    const t = setup();
    const { sessionToken } = await signedUpPlayer(t);
    expect((await t.mutation(api.games.saveScore, { sessionToken, gameId: "chess", stage: 1, score: -5, stars: 1 })).error).toBeDefined();
    expect((await t.mutation(api.games.saveScore, { sessionToken, gameId: "chess", stage: 1, score: 10, stars: 7 })).error).toBeDefined();
    expect((await t.mutation(api.games.saveScore, { sessionToken, gameId: "chess", stage: 0, score: 10, stars: 1 })).error).toBeDefined();
  });
});

describe("getPlayerStats — continue playing", () => {
  test("tracks the most recently played game and stage", async (): Promise<void> => {
    const t = setup();
    const { sessionToken } = await signedUpPlayer(t, "Resumer");
    await t.mutation(api.games.saveScore, { sessionToken, gameId: "chess", stage: 3, score: 50, stars: 2 });
    await t.mutation(api.games.saveScore, { sessionToken, gameId: "ludo", stage: 5, score: 80, stars: 3 });

    const stats = await t.query(api.games.getPlayerStats, { sessionToken });
    const chess = stats!.gameStages["chess"];
    const ludo = stats!.gameStages["ludo"];
    expect(chess.lastStage).toBe(3);
    expect(ludo.lastStage).toBe(5);
    // Ludo was played last
    expect(ludo.lastPlayed).toBeGreaterThanOrEqual(chess.lastPlayed);
  });
});

describe("feed", () => {
  test("createPost attributes the author from the session", async () => {
    const t = setup();
    const { playerId, sessionToken } = await signedUpPlayer(t, "Poster");
    const res = await t.mutation(api.feed.createPost, { sessionToken, type: "chat", content: "hello!" });
    expect(res.postId).toBeDefined();
    const post = await t.run(async ctx => ctx.db.get(res.postId!));
    expect(post!.authorId).toBe(playerId);
    expect(post!.authorName).toBe("Poster");
  });

  test("createPost rejects anonymous and oversized posts", async () => {
    const t = setup();
    const { sessionToken } = await signedUpPlayer(t);
    expect((await t.mutation(api.feed.createPost, { sessionToken: "bogus", type: "chat", content: "hi" })).error).toBe("Not signed in.");
    expect((await t.mutation(api.feed.createPost, { sessionToken, type: "chat", content: "x".repeat(2001) })).error).toBeDefined();
  });

  test("toggleReaction adds then removes", async () => {
    const t = setup();
    const { sessionToken } = await signedUpPlayer(t);
    const { postId } = await t.mutation(api.feed.createPost, { sessionToken, type: "chat", content: "react to me" });
    expect((await t.mutation(api.feed.toggleReaction, { sessionToken, postId: postId!, emoji: "🔥" })).added).toBe(true);
    expect((await t.mutation(api.feed.toggleReaction, { sessionToken, postId: postId!, emoji: "🔥" })).removed).toBe(true);
  });
});

describe("multiplayer", () => {
  test("invite/join/move flow is session-authenticated", async () => {
    const t = setup();
    const host = await signedUpPlayer(t, "Host");
    const guest = await signedUpPlayer(t, "Guest");

    const invite = await t.mutation(api.multiplayer.createInvite, { gameId: "connect-four", sessionToken: host.sessionToken });
    expect(invite.inviteCode).toBeDefined();

    // Joining with a bad token fails; with a real one succeeds and auto-starts (2p)
    const badJoin = await t.mutation(api.multiplayer.joinSession, { inviteCode: invite.inviteCode!, sessionToken: "bogus" });
    expect(badJoin.error).toBe("Not signed in.");
    const join = await t.mutation(api.multiplayer.joinSession, { inviteCode: invite.inviteCode!, sessionToken: guest.sessionToken });
    expect(join.sessionId).toBeDefined();

    const board = Array.from({ length: 6 }, () => Array(7).fill(null));
    board[5][1] = "red";

    // It's seat 1's turn: the guest (seat 2) cannot move, the host can
    const wrongTurn = await t.mutation(api.multiplayer.makeMove, {
      sessionId: join.sessionId!, sessionToken: guest.sessionToken,
      move: { boardState: { board } },
    });
    expect(wrongTurn.error).toBe("Not your turn.");
    const move = await t.mutation(api.multiplayer.makeMove, {
      sessionId: join.sessionId!, sessionToken: host.sessionToken,
      move: { boardState: { board } },
    });
    expect(move.ok).toBe(true);
  });

  test("only the invitee can decline a direct invite", async () => {
    const t = setup();
    const host = await signedUpPlayer(t, "Host");
    const invitee = await signedUpPlayer(t, "Invitee");
    const other = await signedUpPlayer(t, "Bystander");

    const invite = await t.mutation(api.multiplayer.createInvite, {
      gameId: "checkers", sessionToken: host.sessionToken, toId: invitee.playerId,
    });
    const denied = await t.mutation(api.multiplayer.declineInvite, { inviteCode: invite.inviteCode!, sessionToken: other.sessionToken });
    expect(denied.error).toBe("You can't decline this invite.");
    const ok = await t.mutation(api.multiplayer.declineInvite, { inviteCode: invite.inviteCode!, sessionToken: invitee.sessionToken });
    expect(ok.ok).toBe(true);
  });
});

describe("adminMergePlayers", () => {
  test("moves progress, scores, and feed posts to the target", async () => {
    const t = setup();
    process.env.ADMIN_SECRET = "test-admin-secret-min-24chars!";
    const a = await signedUpPlayer(t, "Source");
    const b = await signedUpPlayer(t, "Target");

    await t.mutation(api.games.saveScore, { sessionToken: a.sessionToken, gameId: "chess", stage: 1, score: 100, stars: 2 });
    await t.mutation(api.games.saveScore, { sessionToken: b.sessionToken, gameId: "chess", stage: 1, score: 40, stars: 1 });
    await t.mutation(api.games.saveScore, { sessionToken: a.sessionToken, gameId: "ludo", stage: 2, score: 70, stars: 3 });

    const res = await t.mutation(api.auth.adminMergePlayers, {
      sourceId: a.playerId, targetId: b.playerId, adminSecret: "test-admin-secret-min-24chars!",
    });
    expect(res.success).toBe(true);

    const players = await t.run(async ctx => ctx.db.query("players").collect());
    expect(players.map(p => p.name)).toEqual(["Target"]);

    const scores = await t.run(async ctx => ctx.db.query("scores").collect());
    expect(scores).toHaveLength(3);
    expect(scores.every(s => s.playerId === b.playerId)).toBe(true);

    // chess stage 1 rows merged: best high score kept, stars summed
    const progress = await t.run(async ctx => ctx.db.query("progress").collect());
    const chess = progress.find(p => p.gameId === "chess")!;
    expect(chess.playerId).toBe(b.playerId);
    expect(chess.highScore).toBe(100);
    expect(chess.starsEarned).toBe(3);
    expect(chess.timesPlayed).toBe(2);
    const ludo = progress.find(p => p.gameId === "ludo")!;
    expect(ludo.playerId).toBe(b.playerId);

    // Source player's sessions are gone
    const sessions = await t.run(async ctx => ctx.db.query("sessions").collect());
    expect(sessions.every(s => s.playerId === b.playerId)).toBe(true);
  });
});
