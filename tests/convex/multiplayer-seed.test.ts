// @vitest-environment edge-runtime
import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup } from "./setup";
import { applyCubeMove, newCube, snlResolve } from "../../convex/model/gameRules";

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

const rawSession = (t: ReturnType<typeof setup>, sessionId: any) =>
  t.run(async ctx => ctx.db.get(sessionId));

type UnoCard = { color: string; symbol: string; type: string; id: number };
const keepsTurn = (c: UnoCard) =>
  c.symbol === "skip" || c.symbol === "reverse" || c.symbol === "draw2" || c.type === "wild4";
const canPlay = (c: UnoCard, top: UnoCard, color: string) =>
  c.type === "wild" || c.type === "wild4" || c.color === color ||
  (top.type !== "wild" && top.type !== "wild4" && c.symbol === top.symbol);

// The deal is server-authoritative setup, not a turn: afterwards the host
// must still hold the turn, or nobody can move and the game deadlocks.
describe("server deal", () => {
  test("scrabble: deal hides the bag + opponent rack, host plays first", async () => {
    const t = setup();
    const { host, guest, sessionId } = await startGame(t, "scrabble");

    const deal = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken, move: { action: "deal", dict: "intl" },
    });
    expect(deal.ok).toBe(true);

    const session = (await rawSession(t, sessionId))!;
    expect(session.currentPlayer).toBe(1);
    const bs = session.boardState as any;
    expect(bs.board.length).toBe(15);
    expect(bs.racks[0].length).toBe(7);
    expect(bs.racks[1].length).toBe(7);
    expect(bs.scores).toEqual([0, 0]);

    // Hidden info: guest sees own rack only; bag + host rack are masked.
    const guestView = await t.query(api.multiplayer.getSession, {
      sessionId, sessionToken: guest.sessionToken,
    });
    const gbs = guestView!.boardState as any;
    expect(gbs.racks[1].every((l: unknown) => typeof l === "string")).toBe(true);
    expect(gbs.racks[0].every((l: unknown) => l === null)).toBe(true);
    expect(gbs.pool.every((l: unknown) => l === null)).toBe(true);
    expect(gbs.pool.length).toBe(bs.pool.length);

    // Host plays one tile from their stored rack → turn rotates.
    const letter = bs.racks[0][0];
    const board = bs.board.map((r: unknown[]) => [...r]);
    board[7][7] = letter;
    const play = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken,
      move: { boardState: {
        board,
        racks: [bs.racks[0].slice(1), []],
        scores: [3, 0],
        isFirstMove: false,
        lastWord: 'P1 played "X"',
        dict: "intl",
      } },
    });
    expect(play.error).toBeUndefined();
    expect(play.ok).toBe(true);
    const after = (await rawSession(t, sessionId))!;
    expect(after.currentPlayer).toBe(2);
    // Server refilled the host rack back to 7 from the hidden pool.
    expect((after.boardState as any).racks[0].length).toBe(7);
  });

  test("scrabble: a forged rack tile is rejected", async () => {
    const t = setup();
    const { host, sessionId } = await startGame(t, "scrabble");
    await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken, move: { action: "deal" },
    });
    const bs = ((await rawSession(t, sessionId))!.boardState) as any;
    const rack = bs.racks[0] as string[];

    // A letter guaranteed absent from the rack → "Placed tile not in rack."
    const absent = ["Z", "Q", "X", "J", "K"].find(l => !rack.includes(l))!;
    const board = bs.board.map((r: unknown[]) => [...r]);
    board[7][7] = absent;
    const forged = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken,
      move: { boardState: { board, racks: [rack, []], scores: [10, 0] } },
    });
    expect(forged.error).toBe("Placed tile not in rack.");

    // Playing a real rack tile while keeping it on the rack duplicates it →
    // "Rack does not match play."
    const kept = bs.board.map((r: unknown[]) => [...r]);
    kept[7][7] = rack[0];
    const duped = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken,
      move: { boardState: { board: kept, racks: [rack, []], scores: [10, 0] } },
    });
    expect(duped.error).toBe("Rack does not match play.");
  });

  test("uno: deal, draw, pass cycle works with hidden opponent hand", async () => {
    const t = setup();
    const { host, guest, sessionId } = await startGame(t, "uno");

    const deal = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken, move: { action: "deal" },
    });
    expect(deal.ok).toBe(true);

    let session = (await rawSession(t, sessionId))!;
    expect(session.currentPlayer).toBe(1);
    let bs = session.boardState as any;
    expect(bs.hands["1"].length).toBe(7);
    expect(bs.hands["2"].length).toBe(7);
    expect(bs.discard.length).toBe(1);

    // Guest can't act on the host's turn.
    const early = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: guest.sessionToken, move: { action: "draw" },
    });
    expect(early.error).toBe("Not your turn.");

    // Host draws once, then must pass before the turn rotates.
    const draw = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken, move: { action: "draw" },
    });
    expect(draw.ok).toBe(true);
    session = (await rawSession(t, sessionId))!;
    bs = session.boardState as any;
    expect(bs.hands["1"].length).toBe(8);
    expect(bs.drew).toBe(1);
    expect(session.currentPlayer).toBe(1);

    const again = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken, move: { action: "draw" },
    });
    expect(again.error).toBe("Already drew this turn.");

    const pass = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken, move: { action: "pass" },
    });
    expect(pass.ok).toBe(true);
    session = (await rawSession(t, sessionId))!;
    expect(session.currentPlayer).toBe(2);

    // Guest's view: their own hand is real, the host's is masked.
    const guestView = await t.query(api.multiplayer.getSession, {
      sessionId, sessionToken: guest.sessionToken,
    });
    const gbs = guestView!.boardState as any;
    expect(gbs.hands["2"].every((c: any) => typeof c.id === "number")).toBe(true);
    expect(gbs.hands["1"].every((c: any) => c.hidden === true)).toBe(true);
    expect(gbs.deck.every((c: any) => c.hidden === true)).toBe(true);
  });

  test("uno: playing a card from hand rotates the turn per card rules", async () => {
    const t = setup();
    const { host, sessionId } = await startGame(t, "uno");
    await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken, move: { action: "deal" },
    });
    const bs = ((await rawSession(t, sessionId))!.boardState) as any;
    const hand = bs.hands["1"] as UnoCard[];
    const top = bs.discard[bs.discard.length - 1] as UnoCard;
    const playable = hand.find(c => canPlay(c, top, bs.color));
    expect(playable).toBeTruthy();

    const play = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken,
      move: { boardState: {
        hands: { 1: hand.filter(c => c.id !== playable!.id) },
        discard: [...bs.discard, playable],
        color: playable!.type === "wild" || playable!.type === "wild4" ? "blue" : playable!.color,
      } },
    });
    expect(play.error).toBeUndefined();
    expect(play.ok).toBe(true);
    const after = (await rawSession(t, sessionId))!;
    expect(after.currentPlayer).toBe(keepsTurn(playable!) ? 1 : 2);
  });

  test("uno: a card not in hand is rejected", async () => {
    const t = setup();
    const { host, sessionId } = await startGame(t, "uno");
    await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken, move: { action: "deal" },
    });
    const bs = ((await rawSession(t, sessionId))!.boardState) as any;
    const forged: UnoCard = { color: "red", symbol: "9", type: "number", id: 9999 };
    const play = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken,
      move: { boardState: {
        hands: { 1: bs.hands["1"].slice(1) },
        discard: [...bs.discard, forged],
        color: "red",
      } },
    });
    expect(play.error).toBe("Card not in hand.");
  });

  test("cube-twist: server scrambles once, both seats race their own copy", async () => {
    const t = setup();
    const { host, guest, sessionId } = await startGame(t, "cube-twist");
    const deal = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken, move: { action: "deal", n: 12 },
    });
    expect(deal.ok).toBe(true);
    const bs = ((await rawSession(t, sessionId))!.boardState) as any;
    expect(bs.cubes["1"].length).toBe(26);
    expect(bs.cubes["2"].length).toBe(26);

    // Race game: the guest can twist even though seat 1 holds the turn.
    const guestCube = bs.cubes["2"];
    const twisted = applyCubeMove(guestCube, { axis: 0, layer: 1, dir: 1 });
    const move = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: guest.sessionToken,
      move: { boardState: { cube: twisted } },
    });
    expect(move.error).toBeUndefined();
    const after = ((await rawSession(t, sessionId))!.boardState) as any;
    expect(after.moveCounts["2"]).toBe(1);

    // A jump straight to solved (not one twist away) is rejected.
    const cheat = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken,
      move: { boardState: { cube: newCube() }, winner: 1 },
    });
    expect(cheat.error).toBe("Not a single legal twist.");
  });
});

describe("server dice", () => {
  test("ludo: roll → consume; re-roll and forged rolls rejected", async () => {
    const t = setup();
    const { host, guest, sessionId } = await startGame(t, "ludo");

    const g = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: guest.sessionToken, move: { action: "roll" },
    });
    expect(g.error).toBe("Not your turn.");

    const roll = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken, move: { action: "roll" },
    });
    expect(roll.ok).toBe(true);
    const d = (roll as any).roll as number;
    expect(d).toBeGreaterThanOrEqual(1);
    expect(d).toBeLessThanOrEqual(6);

    const reroll = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken, move: { action: "roll" },
    });
    expect(reroll.error).toBe("Already rolled — move a piece.");

    const base: number[][] = [[-1, -1, -1, -1], [-1, -1, -1, -1]];
    const wrong = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken,
      move: { boardState: { pieces: base, lastRoll: (d % 6) + 1 } },
    });
    expect(wrong.error).toBe("Roll mismatch.");

    // Consume the real roll: a 6 lets a piece out of base; otherwise
    // nothing can move and the unchanged board is the legal result.
    const pieces = d === 6 ? [[0, -1, -1, -1], [-1, -1, -1, -1]] : base;
    const move = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken,
      move: { boardState: { pieces, lastRoll: d } },
    });
    expect(move.error).toBeUndefined();
    const after = (await rawSession(t, sessionId))!;
    expect(after.currentPlayer).toBe(d === 6 ? 1 : 2); // bonus roll on a 6
    expect((after.boardState as any).pendingRoll ?? null).toBeNull();
  });

  test("ludo: moving before rolling is rejected", async () => {
    const t = setup();
    const { host, sessionId } = await startGame(t, "ludo");
    const move = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken,
      move: { boardState: { pieces: [[0, -1, -1, -1], [-1, -1, -1, -1]], lastRoll: 6 } },
    });
    expect(move.error).toBe("Roll the dice first.");
  });

  test("snakes-ladders: server roll drives a legal move", async () => {
    const t = setup();
    const { host, sessionId } = await startGame(t, "snakes-ladders");
    const roll = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken, move: { action: "roll" },
    });
    const d = (roll as any).roll as number;
    const move = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken,
      move: { boardState: { positions: [snlResolve(d), 0], lastRoll: d } },
    });
    // e.g. rolling 1 hits the ladder at 1 → resolves to 38.
    expect(move.error).toBeUndefined();
    const after = (await rawSession(t, sessionId))!;
    expect(after.currentPlayer).toBe(2);
  });
});

describe("bingo shared call clock", () => {
  test("host calls via action; the call order is server-side", async () => {
    const t = setup();
    const { host, sessionId } = await startGame(t, "bingo");

    const first = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken, move: { action: "call" },
    });
    expect(first.ok).toBe(true);
    const second = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken, move: { action: "call" },
    });
    expect(second.ok).toBe(true);

    const session = (await rawSession(t, sessionId))!;
    const bs = session.boardState as any;
    expect(bs.called.length).toBe(2);
    expect(new Set(bs.called).size).toBe(2);
    expect(session.currentPlayer).toBe(1); // the call clock is not a turn

    // The upcoming pool is never exposed to clients.
    const hostView = await t.query(api.multiplayer.getSession, {
      sessionId, sessionToken: host.sessionToken,
    });
    expect((hostView!.boardState as any).pool).toBeUndefined();
    expect((hostView!.boardState as any).called.length).toBe(2);
  });

  const RANGES: [number, number][] = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];
  function winningCard(called: number[]): (number | "FREE")[][] {
    const card: (number | "FREE")[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
    card[2][2] = "FREE";
    for (let c = 0; c < 5; c++) {
      const [lo, hi] = RANGES[c];
      const win = called.find(n => n >= lo && n <= hi) ?? lo;
      card[0][c] = win;
      const fillers: number[] = [];
      for (let n = lo; n <= hi && fillers.length < 4; n++) {
        if (n !== win) fillers.push(n);
      }
      const rows = c === 2 ? [1, 3, 4] : [1, 2, 3, 4];
      // Column 2 only needs 3 fillers (row 2 is FREE)
      for (let i = 0; i < rows.length; i++) card[rows[i]][c] = fillers[i];
    }
    return card;
  }

  test("guest can shout bingo with a provable card", async () => {
    const t = setup();
    const { host, guest, sessionId } = await startGame(t, "bingo");

    // Call until every column range has at least one called number.
    for (let i = 0; i < 75; i++) {
      const bs = ((await rawSession(t, sessionId))!.boardState ?? {}) as any;
      const called: number[] = bs.called ?? [];
      if (RANGES.every(([lo, hi]) => called.some(n => n >= lo && n <= hi))) break;
      await t.mutation(api.multiplayer.makeMove, {
        sessionId, sessionToken: host.sessionToken, move: { action: "call" },
      });
    }
    const called = (((await rawSession(t, sessionId))!.boardState) as any).called as number[];

    const card = winningCard(called);
    const marks = Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, () => r === 0));
    const shout = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: guest.sessionToken,
      move: { boardState: { called, card, marks }, winner: 2 },
    });
    expect(shout.error).toBeUndefined();
    expect(shout.ok).toBe(true);

    const session = (await rawSession(t, sessionId))!;
    expect(session.winner).toBe(2);
    expect(session.status).toBe("finished");
  });

  test("guest cannot claim bingo without a provable card", async () => {
    const t = setup();
    const { host, guest, sessionId } = await startGame(t, "bingo");
    await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken, move: { action: "call" },
    });
    const called = (((await rawSession(t, sessionId))!.boardState) as any).called as number[];
    const card = winningCard([...called, 75, 74, 73, 72, 71]); // numbers never called
    const marks = Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, () => r === 0));
    const shout = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: guest.sessionToken,
      move: { boardState: { called, card, marks }, winner: 2 },
    });
    expect(shout.error).toBe("Card does not show a win.");
  });

  test("guest cannot inject extra calls while the host owns the clock", async () => {
    const t = setup();
    const { host, guest, sessionId } = await startGame(t, "bingo");
    await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken, move: { action: "call" },
    });
    const called = (((await rawSession(t, sessionId))!.boardState) as any).called as number[];

    const spoof = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: guest.sessionToken,
      move: { boardState: { called: [...called, 75] } },
    });
    expect(spoof.error).toBe("Not your turn.");
  });

  test("guest cannot declare the host the winner", async () => {
    const t = setup();
    const { host, guest, sessionId } = await startGame(t, "bingo");
    await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: host.sessionToken, move: { action: "call" },
    });
    const called = (((await rawSession(t, sessionId))!.boardState) as any).called as number[];

    const gift = await t.mutation(api.multiplayer.makeMove, {
      sessionId, sessionToken: guest.sessionToken,
      move: { boardState: { called }, winner: 1 },
    });
    expect(gift.error).toBe("Not your turn.");
  });
});

describe("resignSession", () => {
  test("a player resigning finishes the game for the other seat", async () => {
    const t = setup();
    const { guest, sessionId } = await startGame(t, "ludo");
    const res = await t.mutation(api.multiplayer.resignSession, {
      sessionId, sessionToken: guest.sessionToken,
    });
    expect(res.ok).toBe(true);
    const session = (await rawSession(t, sessionId))!;
    expect(session.status).toBe("finished");
    expect(session.winner).toBe(1);
  });

  test("non-players cannot resign someone else's game", async () => {
    const t = setup();
    const { sessionId } = await startGame(t, "ludo");
    const stranger = await signedUpPlayer(t, "Stranger");
    const res = await t.mutation(api.multiplayer.resignSession, {
      sessionId, sessionToken: stranger.sessionToken,
    });
    expect(res.error).toBe("You are not in this game.");
  });
});
