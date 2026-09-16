// @vitest-environment edge-runtime
import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup, approvedPlayer as signedUp } from "./setup";

describe("sendChallenge", () => {
  test("requires a valid session", async () => {
    const t = setup();
    const bob = await signedUp(t, "Bob");
    const res = await t.mutation(api.challenges.sendChallenge, {
      sessionToken: "bogus", toId: bob.playerId, gameId: "scrabble", stage: 2, fromScore: 120,
    });
    expect(res.error).toBe("Not signed in.");
  });

  test("creates the challenge and announces it in the feed", async () => {
    const t = setup();
    const alice = await signedUp(t, "Alice");
    const bob = await signedUp(t, "Bob");
    const res = await t.mutation(api.challenges.sendChallenge, {
      sessionToken: alice.sessionToken, toId: bob.playerId, gameId: "scrabble", stage: 2, fromScore: 120,
    });
    expect(res.challengeId).toBeDefined();

    const pending = await t.query(api.challenges.getPendingChallenges, { sessionToken: bob.sessionToken });
    expect(pending).toHaveLength(1);
    expect(pending[0].fromName).toBe("Alice");
    expect(pending[0].fromScore).toBe(120);

    const feed = await t.run(async ctx => ctx.db.query("feed").collect());
    expect(feed.some(p => p.content.includes("challenged Bob"))).toBe(true);
  });

  test("blocks self-challenges and duplicate pending challenges", async () => {
    const t = setup();
    const alice = await signedUp(t, "Alice");
    const bob = await signedUp(t, "Bob");

    const self = await t.mutation(api.challenges.sendChallenge, {
      sessionToken: alice.sessionToken, toId: alice.playerId, gameId: "chess", stage: 1, fromScore: 10,
    });
    expect(self.error).toContain("yourself");

    await t.mutation(api.challenges.sendChallenge, {
      sessionToken: alice.sessionToken, toId: bob.playerId, gameId: "chess", stage: 1, fromScore: 10,
    });
    const dup = await t.mutation(api.challenges.sendChallenge, {
      sessionToken: alice.sessionToken, toId: bob.playerId, gameId: "chess", stage: 1, fromScore: 99,
    });
    expect(dup.error).toContain("pending challenge");
  });
});

describe("respondToChallenge", () => {
  async function pendingChallenge(t: ReturnType<typeof setup>) {
    const alice = await signedUp(t, "Alice");
    const bob = await signedUp(t, "Bob");
    const { challengeId } = await t.mutation(api.challenges.sendChallenge, {
      sessionToken: alice.sessionToken, toId: bob.playerId, gameId: "scrabble", stage: 2, fromScore: 120,
    });
    return { alice, bob, challengeId: challengeId! };
  }

  test("only the challenged player can respond", async () => {
    const t = setup();
    const { alice, challengeId } = await pendingChallenge(t);
    const res = await t.mutation(api.challenges.respondToChallenge, {
      sessionToken: alice.sessionToken, challengeId, toScore: 200,
    });
    expect(res.error).toBe("This challenge isn't for you.");
  });

  test("higher score wins, completes the challenge, and posts the result", async () => {
    const t = setup();
    const { bob, challengeId } = await pendingChallenge(t);
    const res = await t.mutation(api.challenges.respondToChallenge, {
      sessionToken: bob.sessionToken, challengeId, toScore: 150,
    });
    expect(res.won).toBe(true);

    // Completed challenges leave the pending list and can't be replayed
    const pending = await t.query(api.challenges.getPendingChallenges, { sessionToken: bob.sessionToken });
    expect(pending).toHaveLength(0);
    const again = await t.mutation(api.challenges.respondToChallenge, {
      sessionToken: bob.sessionToken, challengeId, toScore: 999,
    });
    expect(again.error).toContain("already completed");

    const feed = await t.run(async ctx => ctx.db.query("feed").collect());
    expect(feed.some(p => p.content.includes("150 vs 120"))).toBe(true);
  });

  test("equal score does not beat the challenger", async () => {
    const t = setup();
    const { bob, challengeId } = await pendingChallenge(t);
    const res = await t.mutation(api.challenges.respondToChallenge, {
      sessionToken: bob.sessionToken, challengeId, toScore: 120,
    });
    expect(res.won).toBe(false);
  });
});

describe("getLeaderboard time windows", () => {
  test("windowed boards only count scores after `since`", async () => {
    const t = setup();
    const alice = await signedUp(t, "Alice");
    const bob = await signedUp(t, "Bob");

    // Alice scored long ago; Bob scored just now.
    await t.run(async ctx => {
      await ctx.db.insert("scores", { playerId: alice.playerId, gameId: "chess", stage: 1, score: 500, stars: 3, playedAt: Date.now() - 30 * 24 * 3600_000 });
    });
    await t.mutation(api.games.saveScore, { sessionToken: bob.sessionToken, gameId: "chess", stage: 1, score: 50, stars: 1 });

    const allTime = await t.query(api.games.getLeaderboard, { sessionToken: bob.sessionToken });
    expect(allTime.map(e => e.playerName)).toEqual(["Alice", "Bob"]);

    const week = await t.query(api.games.getLeaderboard, { sessionToken: bob.sessionToken, since: Date.now() - 7 * 24 * 3600_000 });
    expect(week.map(e => e.playerName)).toEqual(["Bob"]);
  });
});

describe("getLatestChatTime", () => {
  test("tracks the newest chat post and ignores score posts", async () => {
    const t = setup();
    const alice = await signedUp(t, "Alice");
    expect(await t.query(api.feed.getLatestChatTime, {})).toBe(0);

    await t.mutation(api.games.saveScore, { sessionToken: alice.sessionToken, gameId: "chess", stage: 1, score: 50, stars: 1 });
    expect(await t.query(api.feed.getLatestChatTime, {})).toBe(0); // score post ≠ chat

    await t.mutation(api.feed.createPost, { sessionToken: alice.sessionToken, type: "chat", content: "hello!" });
    expect(await t.query(api.feed.getLatestChatTime, {})).toBeGreaterThan(0);
  });
});
