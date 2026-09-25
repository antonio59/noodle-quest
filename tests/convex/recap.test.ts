// @vitest-environment edge-runtime
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { RECAP_WINDOW_MS, prettyGameId, renderRecapEmail } from "../../convex/model/recap";
import { weeklyPuzzleKey } from "../../convex/model/puzzles";
import { setup, approvedPlayer as signedUp } from "./setup";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function score(t: ReturnType<typeof setup>, token: string, gameId: string, stars: number) {
  await t.mutation(api.games.saveScore, { sessionToken: token, gameId, stage: 1, score: 50, stars });
}

describe("recap.getFamilyWeek", () => {
  test("needs a session", async () => {
    const t = setup();
    expect(await t.query(api.recap.getFamilyWeek, { sessionToken: "bogus" })).toBeNull();
  });

  test("summarises the last 7 days: totals, star of the week, top game, challenges, puzzle", async () => {
    const t = setup();
    const mum = await signedUp(t, "Mum");
    const mia = await signedUp(t, "Mia");
    await score(t, mia.sessionToken, "chess", 3);
    await score(t, mia.sessionToken, "uno", 2);
    await score(t, mum.sessionToken, "chess", 1);
    // An old score outside the window is ignored.
    await t.run(async ctx => {
      await ctx.db.insert("scores", {
        playerId: mum.playerId, gameId: "ludo", stage: 1, score: 10, stars: 3,
        playedAt: Date.now() - RECAP_WINDOW_MS - 60_000,
      });
    });
    const challenge = await t.mutation(api.challenges.sendChallenge, {
      sessionToken: mum.sessionToken, toId: mia.playerId, gameId: "chess", stage: 1, fromScore: 40,
    });
    await t.mutation(api.challenges.respondToChallenge, {
      sessionToken: mia.sessionToken, challengeId: challenge.challengeId!, toScore: 90,
    });
    await t.mutation(api.puzzles.submitPuzzleTime, {
      sessionToken: mia.sessionToken, puzzleKey: weeklyPuzzleKey(Date.now()), seconds: 125,
    });
    // A challenge finished before the window doesn't appear.
    await t.run(async ctx => {
      await ctx.db.insert("challenges", {
        fromId: mia.playerId, toId: mum.playerId, gameId: "ludo", stage: 1, fromScore: 1, toScore: 99,
        status: "completed", createdAt: 0, completedAt: Date.now() - RECAP_WINDOW_MS - 60_000,
      });
    });

    const week = await t.query(api.recap.getFamilyWeek, { sessionToken: mum.sessionToken });
    expect(week).toMatchObject({
      totalPlays: 3,
      totalStars: 6,
      topGame: { gameId: "chess", plays: 2 },
      challengeWins: [{ winner: "Mia", loser: "Mum", gameId: "chess" }],
      puzzleLeader: { name: "Mia", seconds: 125 },
    });
    expect(week!.players.map(p => [p.name, p.plays, p.stars, p.gamesTried])).toEqual([
      ["Mia", 2, 5, 2],
      ["Mum", 1, 1, 1],
    ]);
  });
});

describe("recap email", () => {
  test("prettyGameId", () => {
    expect(prettyGameId("connect-four")).toBe("Connect Four");
    expect(prettyGameId("2048")).toBe("2048");
  });

  test("escapes names and handles a quiet week", () => {
    const busy = renderRecapEmail({
      since: 0, totalPlays: 1, totalStars: 3,
      players: [{ name: "<b>Bo</b>", avatar: "🐸", plays: 1, stars: 3, gamesTried: 1 }],
      topGame: { gameId: "uno", plays: 1 }, challengeWins: [], puzzleLeader: null,
    });
    expect(busy.html).toContain("&lt;b&gt;Bo&lt;/b&gt;");
    expect(busy.html).not.toContain("<b>Bo</b>");
    expect(busy.subject).toContain("star of the week");

    const quiet = renderRecapEmail({
      since: 0, totalPlays: 0, totalStars: 0, players: [], topGame: null, challengeWins: [], puzzleLeader: null,
    });
    expect(quiet.subject).toBe("🍜 Family week: a quiet one");
    expect(quiet.html).toContain("A quiet week");
  });

  test("sendWeeklyRecap mails the owner via Resend", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("ADMIN_EMAIL", "owner@example.com");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const t = setup();
    await t.action(internal.recap.sendWeeklyRecap, {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(init.body));
    expect(body.to).toEqual(["owner@example.com"]);
    expect(body.subject).toMatch(/Family week/);
  });

  test("sendWeeklyRecap skips quietly without email config", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const t = setup();
    await t.action(internal.recap.sendWeeklyRecap, {});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
