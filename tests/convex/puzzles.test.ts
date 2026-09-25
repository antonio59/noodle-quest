// @vitest-environment edge-runtime
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { weeklyPuzzleKey } from "../../convex/model/puzzles";
import { setup, approvedPlayer as signedUp } from "./setup";

const ENTRIES = [
  { answer: "beach", clue: "Sandy place by the sea" },
  { answer: "Pasty", clue: "Cornish pastry with a crimped edge" },
  { answer: "surf", clue: "Ride a wave on a board" },
  { answer: "grandma", clue: "Dad's mum" },
];

afterEach(() => {
  vi.useRealTimers();
});

async function makePuzzle(t: ReturnType<typeof setup>, token: string) {
  const res = await t.mutation(api.puzzles.createFamilyPuzzle, { sessionToken: token, title: " Cornwall ", entries: ENTRIES });
  if (!res.puzzleId) throw new Error(res.error);
  return res.puzzleId;
}

describe("family puzzles", () => {
  test("create normalises answers, announces it, and lists it", async () => {
    const t = setup();
    const mum = await signedUp(t, "Mum");
    const id = await makePuzzle(t, mum.sessionToken);

    const puzzle = await t.query(api.puzzles.getFamilyPuzzle, { sessionToken: mum.sessionToken, puzzleId: id });
    expect(puzzle?.title).toBe("Cornwall");
    expect(puzzle?.entries.map(e => e.answer)).toEqual(["BEACH", "PASTY", "SURF", "GRANDMA"]);

    const list = await t.query(api.puzzles.listFamilyPuzzles, { sessionToken: mum.sessionToken });
    expect(list).toEqual([expect.objectContaining({ title: "Cornwall", wordCount: 4, mine: true })]);

    const activity = await t.query(api.feed.getActivity, { sessionToken: mum.sessionToken });
    expect(activity.some(p => p.content.includes("made a family puzzle"))).toBe(true);
  });

  test("create rejects invalid puzzles and needs a session", async () => {
    const t = setup();
    const mum = await signedUp(t, "Mum");
    const few = await t.mutation(api.puzzles.createFamilyPuzzle, {
      sessionToken: mum.sessionToken, title: "Tiny", entries: ENTRIES.slice(0, 3),
    });
    expect(few.error).toMatch(/4–15 words/);
    const anon = await t.mutation(api.puzzles.createFamilyPuzzle, {
      sessionToken: "bogus", title: "Cornwall", entries: ENTRIES,
    });
    expect(anon.error).toBe("Not signed in.");
  });

  test("getFamilyPuzzle tolerates junk ids", async () => {
    const t = setup();
    const mum = await signedUp(t, "Mum");
    expect(await t.query(api.puzzles.getFamilyPuzzle, { sessionToken: mum.sessionToken, puzzleId: "nope" })).toBeNull();
  });

  test("only the maker can delete, and times go with it", async () => {
    const t = setup();
    const mum = await signedUp(t, "Mum");
    const kid = await signedUp(t, "Kid");
    const id = await makePuzzle(t, mum.sessionToken);
    const solved = await t.mutation(api.puzzles.submitPuzzleTime, { sessionToken: kid.sessionToken, puzzleKey: `family:${id}`, seconds: 60 });
    expect(solved.firstSolve).toBe(true);

    const denied = await t.mutation(api.puzzles.deleteFamilyPuzzle, { sessionToken: kid.sessionToken, puzzleId: id });
    expect(denied.error).toMatch(/Only the person/);
    const ok = await t.mutation(api.puzzles.deleteFamilyPuzzle, { sessionToken: mum.sessionToken, puzzleId: id });
    expect(ok.ok).toBe(true);
    expect(await t.run(async ctx => ctx.db.query("puzzle_times").collect())).toHaveLength(0);
  });
});

describe("puzzle times", () => {
  test("keeps each player's best time and announces only the first solve", async () => {
    const t = setup();
    const mum = await signedUp(t, "Mum");
    const kid = await signedUp(t, "Kid");
    const key = weeklyPuzzleKey(Date.now());

    const first = await t.mutation(api.puzzles.submitPuzzleTime, { sessionToken: kid.sessionToken, puzzleKey: key, seconds: 192 });
    expect(first).toEqual({ best: 192, isNewBest: true, firstSolve: true });
    const slower = await t.mutation(api.puzzles.submitPuzzleTime, { sessionToken: kid.sessionToken, puzzleKey: key, seconds: 300 });
    expect(slower).toEqual({ best: 192, isNewBest: false, firstSolve: false });
    const faster = await t.mutation(api.puzzles.submitPuzzleTime, { sessionToken: kid.sessionToken, puzzleKey: key, seconds: 150 });
    expect(faster).toEqual({ best: 150, isNewBest: true, firstSolve: false });
    await t.mutation(api.puzzles.submitPuzzleTime, { sessionToken: mum.sessionToken, puzzleKey: key, seconds: 170 });

    const board = await t.query(api.puzzles.getPuzzleBoard, { sessionToken: kid.sessionToken, puzzleKey: key });
    expect(board.map(r => [r.name, r.seconds, r.isMe])).toEqual([["Kid", 150, true], ["Mum", 170, false]]);

    const activity = await t.query(api.feed.getActivity, { sessionToken: kid.sessionToken });
    const solves = activity.filter(p => p.content.startsWith("🧩 solved"));
    expect(solves.map(p => p.content)).toEqual([
      "🧩 solved this week's family puzzle in 2:50",
      "🧩 solved this week's family puzzle in 3:12",
    ]);
  });

  test("rejects closed weeks, unknown puzzles and silly times", async () => {
    const t = setup();
    const kid = await signedUp(t, "Kid");
    const submit = (puzzleKey: string, seconds: number) =>
      t.mutation(api.puzzles.submitPuzzleTime, { sessionToken: kid.sessionToken, puzzleKey, seconds });

    expect((await submit("week:2020-W01", 60)).error).toBe("That puzzle isn't open.");
    expect((await submit("family:abcdefghijklmnop", 60)).error).toBe("That puzzle isn't open.");
    expect((await submit("nonsense", 60)).error).toBe("That puzzle isn't open.");
    expect((await submit(weeklyPuzzleKey(Date.now()), 2)).error).toBe("That time doesn't look right.");
  });

  test("family puzzle solves name the puzzle in the feed", async () => {
    const t = setup();
    const mum = await signedUp(t, "Mum");
    const kid = await signedUp(t, "Kid");
    const id = await makePuzzle(t, mum.sessionToken);
    await t.mutation(api.puzzles.submitPuzzleTime, { sessionToken: kid.sessionToken, puzzleKey: `family:${id}`, seconds: 65 });
    const activity = await t.query(api.feed.getActivity, { sessionToken: kid.sessionToken });
    expect(activity.map(p => p.content)).toContain("🧩 solved Mum's “Cornwall” puzzle in 1:05");
  });
});
