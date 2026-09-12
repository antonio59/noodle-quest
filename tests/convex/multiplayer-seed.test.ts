// @vitest-environment edge-runtime
import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup } from "./setup";

async function signedUpPlayer(t: ReturnType<typeof setup>, name: string) {
  const res = await t.mutation(api.auth.signUp, { name, pin: "123456" });
  return { playerId: res.playerId!, sessionToken: res.sessionToken! };
}

async function startGame(t: ReturnType<typeof setup>, gameId: string) {
  const host = await signedUpPlayer(t, "Host");
  const guest = await signedUpPlayer(t, "Guest");
  const invite = await t.mutation(api.multiplayer.createInvite, { gameId, sessionToken: host.sessionToken });
  const join = await t.mutation(api.multiplayer.joinSession, {
    inviteCode: invite.inviteCode!, sessionToken: guest.sessionToken,
  });
  return { host, guest, sessionId: join.sessionId! };
}

const emptyBoard = () => Array.from({ length: 15 }, () => Array(15).fill(null));

// Seeding the initial deal is setup, not a turn. If the server rotates the
// turn on the seed, boardState and currentPlayer disagree and NOBODY can
// move: the host is told "Not your turn", the guest is told to wait.
describe("host seeding must not consume a turn", () => {
  test("scrabble: host can play the first word after seeding", async () => {
    const t = setup();
    const { host, sessionId } = await startGame(t, "scrabble");

    const seed = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken,
      move: { boardState: {
        board: emptyBoard(), racks: [["A"], ["B"]], pool: ["C"],
        scores: [0, 0], currentSeat: 0, isFirstMove: true, lastWord: "", dict: "intl",
        turnSeat: 1,
      } },
    });
    expect(seed.ok).toBe(true);

    const session = await t.run(async ctx => ctx.db.get(sessionId));
    expect(session!.currentPlayer).toBe(1); // still the host's turn

    const play = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken,
      move: { boardState: {
        board: emptyBoard(), racks: [["A"], ["B"]], pool: [],
        scores: [12, 0], currentSeat: 1, isFirstMove: false, lastWord: "CAT", dict: "intl",
        turnSeat: 2,
      } },
    });
    expect(play.error).toBeUndefined();
    expect(play.ok).toBe(true);

    // ...and the turn actually handed over to the guest
    const after = await t.run(async ctx => ctx.db.get(sessionId));
    expect(after!.currentPlayer).toBe(2);
  });

  test("uno: host can play the first card after seeding", async () => {
    const t = setup();
    const { host, sessionId } = await startGame(t, "uno");

    const seed = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken,
      move: { boardState: {
        hands: { 1: [{ color: "red", value: "5" }], 2: [{ color: "blue", value: "7" }] },
        deck: [], discard: [{ color: "red", value: "3" }], color: "red",
        currentPlayer: 1, turnSeat: 1,
      } },
    });
    expect(seed.ok).toBe(true);

    const session = await t.run(async ctx => ctx.db.get(sessionId));
    expect(session!.currentPlayer).toBe(1);

    const play = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken,
      move: { boardState: {
        hands: { 1: [], 2: [{ color: "blue", value: "7" }] },
        deck: [], discard: [{ color: "red", value: "5" }], color: "red",
        currentPlayer: 2, turnSeat: 2,
      } },
    });
    expect(play.error).toBeUndefined();
    expect(play.ok).toBe(true);
  });

  test("uno: a skip card keeps the turn with the player who played it", async () => {
    const t = setup();
    const { host, sessionId } = await startGame(t, "uno");

    await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken,
      move: { boardState: { hands: {}, deck: [], discard: [], color: "red", currentPlayer: 1, turnSeat: 1 } },
    });
    // Skip played by seat 1 → seat 1 goes again
    await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken,
      move: { boardState: { hands: {}, deck: [], discard: [], color: "red", currentPlayer: 1, turnSeat: 1 } },
    });
    const session = await t.run(async ctx => ctx.db.get(sessionId));
    expect(session!.currentPlayer).toBe(1);
  });
});
