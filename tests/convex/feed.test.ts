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
  const share = (t: ReturnType<typeof setup>, sessionToken: string, over: Partial<{ gameId: string; seatNames: string[]; winnerSeat: number }> = {}) =>
    t.mutation(api.feed.postLocalMatch, { sessionToken, gameId: "chess", seatNames: ["Dad", "Mia"], winnerSeat: 2, ...over });

  test("posts a server-written pass & play result to the activity feed", async () => {
    const t = setup();
    const dad = await signedUp(t, "Dad");
    const res = await share(t, dad.sessionToken);
    expect(res.postId).toBeDefined();
    const activity = await t.query(api.feed.getActivity, { sessionToken: dad.sessionToken });
    expect(activity).toHaveLength(1);
    expect(activity[0].content).toBe("🏠 Mia beat Dad at Chess (pass & play)");
    expect(activity[0].gameId).toBe("chess");
  });

  test("writes draws and 3+ player wins too", async () => {
    const t = setup();
    const dad = await signedUp(t, "Dad");
    await share(t, dad.sessionToken, { gameId: "uno", winnerSeat: 0 });
    await share(t, dad.sessionToken, { gameId: "snakes-ladders", seatNames: ["Dad", "Mia", "Leo"], winnerSeat: 3 });
    const contents = (await t.query(api.feed.getActivity, { sessionToken: dad.sessionToken })).map(p => p.content);
    expect(contents).toContain("🏠 Dad and Mia drew at UNO (pass & play)");
    expect(contents).toContain("🏠 Leo won Snakes & Ladders against Dad and Mia (pass & play)");
  });

  test("rejects games without pass & play, bad seats and bad winners", async () => {
    const t = setup();
    const dad = await signedUp(t, "Dad");
    expect((await share(t, "bogus")).error).toBe("Not signed in.");
    expect((await share(t, dad.sessionToken, { gameId: "sudoku" })).error).toBe("Unknown game.");
    expect((await share(t, dad.sessionToken, { seatNames: ["Dad"] })).error).toBe("Pick 2–4 players.");
    expect((await share(t, dad.sessionToken, { seatNames: ["Dad", "x".repeat(21)] })).error).toBe("Player names must be 1–20 letters.");
    expect((await share(t, dad.sessionToken, { seatNames: ["Dad", "<b>hi</b>"] })).error).toBe("Player names must be 1–20 letters.");
    expect((await share(t, dad.sessionToken, { winnerSeat: 3 })).error).toBe("Invalid result.");
  });

  test("kid mode can share, but only games between family members", async () => {
    const t = setup();
    const kid = await signedUp(t, "Mia");
    await signedUp(t, "Dad");
    await t.run(async ctx => ctx.db.patch(kid.playerId, { kidMode: true }));
    expect((await share(t, kid.sessionToken, { seatNames: ["mia", "Dad"] })).postId).toBeDefined();
    const guest = await share(t, kid.sessionToken, { seatNames: ["Mia", "Poo head"] });
    expect(guest.error).toBe("Kid mode can only share games between family members.");
  });
});
