// @vitest-environment edge-runtime
import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup, approvedPlayer as signedUp } from "./setup";

describe("createPost kid mode", () => {
  test("kid-mode players can't post chat or GIFs", async () => {
    const t = setup();
    const kid = await signedUp(t, "Kid");
    await t.run(async ctx => ctx.db.patch(kid.playerId, { kidMode: true }));
    for (const [type, content] of [
      ["chat", "hi"],
      ["gif_url", "https://media0.giphy.com/media/x/200w.gif"],
      ["sticker", "happy"],
    ] as const) {
      const res = await t.mutation(api.feed.createPost, { sessionToken: kid.sessionToken, type, content });
      expect(res.error).toBe("Chat is switched off in kid mode.");
    }
    const feed = await t.run(async ctx => ctx.db.query("feed").collect());
    expect(feed).toHaveLength(0);
  });

  test("everyone else can still chat", async () => {
    const t = setup();
    const alice = await signedUp(t, "Alice");
    const res = await t.mutation(api.feed.createPost, { sessionToken: alice.sessionToken, type: "chat", content: "hi" });
    expect(res.postId).toBeDefined();
  });
});

describe("postLocalMatch", () => {
  test("posts a pass & play result to the activity feed", async () => {
    const t = setup();
    const dad = await signedUp(t, "Dad");
    const res = await t.mutation(api.feed.postLocalMatch, {
      sessionToken: dad.sessionToken,
      gameId: "chess",
      summary: "Mia beat Dad at Chess",
    });
    expect(res.postId).toBeDefined();
    const activity = await t.query(api.feed.getActivity, { sessionToken: dad.sessionToken });
    expect(activity).toHaveLength(1);
    expect(activity[0].content).toBe("🏠 Mia beat Dad at Chess (pass & play)");
    expect(activity[0].gameId).toBe("chess");
  });

  test("kid-mode players can share results — it's activity, not chat", async () => {
    const t = setup();
    const kid = await signedUp(t, "Kid");
    await t.run(async ctx => ctx.db.patch(kid.playerId, { kidMode: true }));
    const res = await t.mutation(api.feed.postLocalMatch, {
      sessionToken: kid.sessionToken, gameId: "uno", summary: "Kid beat Dad at UNO",
    });
    expect(res.postId).toBeDefined();
  });

  test("requires a session and a sane summary", async () => {
    const t = setup();
    const dad = await signedUp(t, "Dad");
    const bogus = await t.mutation(api.feed.postLocalMatch, {
      sessionToken: "bogus", gameId: "chess", summary: "x beat y",
    });
    expect(bogus.error).toBe("Not signed in.");
    const long = await t.mutation(api.feed.postLocalMatch, {
      sessionToken: dad.sessionToken, gameId: "chess", summary: "a".repeat(201),
    });
    expect(long.error).toBe("Result must be 1-200 characters.");
    const badGame = await t.mutation(api.feed.postLocalMatch, {
      sessionToken: dad.sessionToken, gameId: "Chess!!", summary: "x beat y",
    });
    expect(badGame.error).toBe("Unknown game.");
  });
});
