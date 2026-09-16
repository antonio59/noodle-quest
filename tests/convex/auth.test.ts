// @vitest-environment edge-runtime
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { setup, approvedPlayer } from "./setup";

const NAME = "Tester";
const PIN = "123456";

async function signUp(t: ReturnType<typeof setup>, name = NAME, pin = PIN) {
  return await t.mutation(api.auth.signUp, { name, pin });
}

describe("signUp", () => {
  test("uninvited signups are pending — no session is issued", async () => {
    const t = setup();
    const res = await signUp(t);
    expect(res.error).toBeUndefined();
    expect(res.pending).toBe(true);
    expect(res.playerId).toBeDefined();
    expect(res.sessionToken).toBeUndefined();
    const player = await t.run(async ctx => ctx.db.get(res.playerId!));
    expect(player!.status).toBe("pending");
    expect(player!.approvalToken).toMatch(/^[0-9a-f]{64}$/);
  });

  test("a valid invite code auto-approves and issues a session", async () => {
    const t = setup();
    const host = await approvedPlayer(t, "Host");
    const invite = await t.mutation(api.multiplayer.createInvite, {
      gameId: "chess", sessionToken: host.sessionToken,
    });
    const res = await t.mutation(api.auth.signUp, {
      name: "Guest", pin: PIN, inviteCode: invite.inviteCode,
    });
    expect(res.error).toBeUndefined();
    expect(res.pending).toBeUndefined();
    expect(res.sessionToken).toMatch(/^[0-9a-f]{64}$/);
    const player = await t.run(async ctx => ctx.db.get(res.playerId!));
    expect(player!.status).toBe("approved");
  });

  test("a bogus or expired invite code still queues for approval", async () => {
    const t = setup();
    const res = await t.mutation(api.auth.signUp, {
      name: "Stranger", pin: PIN, inviteCode: "not-a-real-code",
    });
    expect(res.pending).toBe(true);
    expect(res.sessionToken).toBeUndefined();
  });

  test("never stores the plaintext PIN", async () => {
    const t = setup();
    const res = await signUp(t);
    const player = await t.run(async ctx => ctx.db.get(res.playerId!));
    expect(player!.pin).toBeUndefined();
    expect(player!.pinHash).toMatch(/^[0-9a-f]{64}$/);
    expect(player!.pinSalt).toMatch(/^[0-9a-f]{32}$/);
    expect(player!.pinHash).not.toContain(PIN);
  });

  test("rejects invalid PINs and short names", async () => {
    const t = setup();
    expect((await t.mutation(api.auth.signUp, { name: "Ok", pin: "12" })).error).toBeDefined();
    expect((await t.mutation(api.auth.signUp, { name: "Ok", pin: "abcdef" })).error).toBeDefined();
    expect((await t.mutation(api.auth.signUp, { name: "A", pin: PIN })).error).toBeDefined();
  });

  test("rejects duplicate names", async () => {
    const t = setup();
    await signUp(t);
    const res = await signUp(t);
    expect(res.error).toBe("Name already taken!");
  });
});

describe("signup approval", () => {
  test("pending players cannot log in until approved", async () => {
    const t = setup();
    await signUp(t);
    const res = await t.mutation(api.auth.logIn, { name: NAME, pin: PIN });
    expect(res.error).toContain("approve");
    expect(res.sessionToken).toBeUndefined();
  });

  test("rejected players are told and stay blocked", async () => {
    const t = setup();
    const created = await signUp(t);
    await t.run(async ctx => {
      await ctx.db.patch(created.playerId!, { status: "rejected" as const });
    });
    const res = await t.mutation(api.auth.logIn, { name: NAME, pin: PIN });
    expect(res.error).toBe("This account wasn't approved.");
  });

  test("approving via the emailed token lets the player log in", async () => {
    const t = setup();
    const created = await signUp(t);
    const token = (await t.run(async ctx => ctx.db.get(created.playerId!)))!.approvalToken!;

    const applied = await t.mutation(internal.signups.applySignupDecision, {
      token, decision: "approve",
    });
    expect(applied.changed).toBe(true);

    const res = await t.mutation(api.auth.logIn, { name: NAME, pin: PIN });
    expect(res.error).toBeUndefined();
    expect(res.sessionToken).toMatch(/^[0-9a-f]{64}$/);

    // The link is single-use — the token is consumed, so replaying finds nothing.
    const replay = await t.mutation(internal.signups.applySignupDecision, {
      token, decision: "reject",
    });
    expect(replay.found).toBe(false);
  });

  test("rejecting via the token clears it", async () => {
    const t = setup();
    const created = await signUp(t);
    const token = (await t.run(async ctx => ctx.db.get(created.playerId!)))!.approvalToken!;
    const applied = await t.mutation(internal.signups.applySignupDecision, {
      token, decision: "reject",
    });
    expect(applied.changed).toBe(true);
    expect((await t.mutation(api.auth.logIn, { name: NAME, pin: PIN })).error).toContain("wasn't approved");
  });

  test("admin mutations approve and reject with the secret", async () => {
    const t = setup();
    process.env.ADMIN_SECRET = "test-admin-secret-min-24chars!";
    const created = await signUp(t);

    const denied = await t.mutation(api.auth.adminApprovePlayer, {
      playerId: created.playerId!, adminSecret: "wrong-secret-that-is-long-enough!!",
    });
    expect(denied.error).toBe("Unauthorized");

    const ok = await t.mutation(api.auth.adminApprovePlayer, {
      playerId: created.playerId!, adminSecret: "test-admin-secret-min-24chars!",
    });
    expect(ok.success).toBe(true);
    expect((await t.mutation(api.auth.logIn, { name: NAME, pin: PIN })).sessionToken).toBeDefined();
  });

  test("rejecting an approved player revokes their sessions", async () => {
    const t = setup();
    process.env.ADMIN_SECRET = "test-admin-secret-min-24chars!";
    const p = await approvedPlayer(t, NAME);
    await t.mutation(api.auth.adminRejectPlayer, {
      playerId: p.playerId, adminSecret: "test-admin-secret-min-24chars!",
    });
    const res = await t.mutation(api.auth.updateAvatar, {
      sessionToken: p.sessionToken, avatar: "🐱",
    });
    expect(res.error).toBe("Not signed in.");
  });
});

describe("logIn", () => {
  test("returns a fresh session token on success", async () => {
    const t = setup();
    const created = await approvedPlayer(t, NAME);
    const res = await t.mutation(api.auth.logIn, { name: NAME, pin: PIN });
    expect(res.error).toBeUndefined();
    expect(res.sessionToken).toMatch(/^[0-9a-f]{64}$/);
    expect(res.sessionToken).not.toBe(created.sessionToken);
  });

  test("rejects a wrong PIN", async () => {
    const t = setup();
    await approvedPlayer(t, NAME);
    const res = await t.mutation(api.auth.logIn, { name: NAME, pin: "000000" });
    expect(res.error).toBe("Wrong PIN!");
  });

  // Six PIN verifications at 10k SHA-256 iterations each; the 5s default
  // is not enough once the full suite is running in parallel.
  test("locks the account after 5 failed attempts", { timeout: 30000 }, async () => {
    const t = setup();
    await approvedPlayer(t, NAME);
    for (let i = 0; i < 4; i++) {
      const res = await t.mutation(api.auth.logIn, { name: NAME, pin: "000000" });
      expect(res.error).toBe("Wrong PIN!");
    }
    const locked = await t.mutation(api.auth.logIn, { name: NAME, pin: "000000" });
    expect(locked.error).toContain("Locked");
    // Even the correct PIN is rejected while locked
    const stillLocked = await t.mutation(api.auth.logIn, { name: NAME, pin: PIN });
    expect(stillLocked.error).toContain("Locked");
  });

  test("upgrades a legacy plaintext PIN to a hash on login", async () => {
    const t = setup();
    const playerId = await t.run(async ctx =>
      ctx.db.insert("players", { name: "Legacy", pin: PIN, avatar: "🦊", createdAt: 1, lastActive: 1 }),
    );
    const res = await t.mutation(api.auth.logIn, { name: "Legacy", pin: PIN });
    expect(res.error).toBeUndefined();
    expect(res.sessionToken).toBeDefined();
    const player = await t.run(async ctx => ctx.db.get(playerId));
    expect(player!.pin).toBeUndefined();
    expect(player!.pinHash).toBeDefined();
    // Subsequent logins use the hash path
    const again = await t.mutation(api.auth.logIn, { name: "Legacy", pin: PIN });
    expect(again.error).toBeUndefined();
  });
});

describe("sessions", () => {
  test("logOut revokes the session", async () => {
    const t = setup();
    const { sessionToken } = await approvedPlayer(t, NAME);
    await t.mutation(api.auth.logOut, { sessionToken: sessionToken! });
    const res = await t.mutation(api.auth.updateAvatar, { sessionToken: sessionToken!, avatar: "🐱" });
    expect(res.error).toBe("Not signed in.");
  });

  test("updateName/updateAvatar reject bogus tokens", async () => {
    const t = setup();
    await approvedPlayer(t, NAME);
    expect((await t.mutation(api.auth.updateName, { sessionToken: "nope", name: "Hax" })).error).toBe("Not signed in.");
    expect((await t.mutation(api.auth.updateAvatar, { sessionToken: "nope", avatar: "🐱" })).error).toBe("Not signed in.");
  });

  test("updateName changes the caller's own name only", async () => {
    const t = setup();
    const a = await approvedPlayer(t, "Alice");
    await approvedPlayer(t, "Bob");
    const res = await t.mutation(api.auth.updateName, { sessionToken: a.sessionToken!, name: "Bob" });
    expect(res.error).toBe("Name already taken!");
    const ok = await t.mutation(api.auth.updateName, { sessionToken: a.sessionToken!, name: "Alicia" });
    expect(ok.success).toBe(true);
  });
});

describe("getAllPlayers", () => {
  test("exposes only id, name, and avatar", async () => {
    const t = setup();
    await approvedPlayer(t, NAME);
    const players = await t.query(api.auth.getAllPlayers, {});
    expect(players).toHaveLength(1);
    expect(Object.keys(players[0]).sort()).toEqual(["avatar", "id", "name"]);
  });

  test("hides pending and rejected signups from the picker", async () => {
    const t = setup();
    await approvedPlayer(t, "Approved");
    await signUp(t, "Pending Pete");
    const rejected = await signUp(t, "Rejected Rita");
    await t.run(async ctx => {
      await ctx.db.patch(rejected.playerId!, { status: "rejected" as const });
    });
    const players = await t.query(api.auth.getAllPlayers, {});
    expect(players.map(p => p.name)).toEqual(["Approved"]);
  });
});

describe("migrations:hashAllPins", () => {
  test("hashes every remaining plaintext PIN", async () => {
    const t = setup();
    await t.run(async ctx => {
      await ctx.db.insert("players", { name: "P1", pin: "111111", avatar: "🦊", createdAt: 1, lastActive: 1 });
      await ctx.db.insert("players", { name: "P2", pin: "222222", avatar: "🐱", createdAt: 1, lastActive: 1 });
    });
    const res = await t.mutation(internal.migrations.hashAllPins, {});
    expect(res.migrated).toBe(2);
    const players = await t.run(async ctx => ctx.db.query("players").collect());
    for (const p of players) {
      expect(p.pin).toBeUndefined();
      expect(p.pinHash).toBeDefined();
    }
    // Players can still log in with their original PINs
    const login = await t.mutation(api.auth.logIn, { name: "P1", pin: "111111" });
    expect(login.error).toBeUndefined();
  });
});

describe("admin functions", () => {
  test("adminResetPin requires the admin secret and invalidates sessions", async () => {
    const t = setup();
    process.env.ADMIN_SECRET = "test-admin-secret-min-24chars!";
    const created = await approvedPlayer(t, NAME);
    const denied = await t.mutation(api.auth.adminResetPin, {
      playerId: created.playerId!,
      newPin: "654321",
      adminSecret: "wrong-secret-that-is-long-enough!!",
    });
    expect(denied.error).toBe("Unauthorized");

    const ok = await t.mutation(api.auth.adminResetPin, {
      playerId: created.playerId!,
      newPin: "654321",
      adminSecret: "test-admin-secret-min-24chars!",
    });
    expect(ok.success).toBe(true);

    // Old session is revoked, old PIN no longer works, new PIN does
    const stale = await t.mutation(api.auth.updateAvatar, { sessionToken: created.sessionToken!, avatar: "🐱" });
    expect(stale.error).toBe("Not signed in.");
    expect((await t.mutation(api.auth.logIn, { name: NAME, pin: PIN })).error).toBe("Wrong PIN!");
    // (one failed attempt above — still well under the lockout)
    expect((await t.mutation(api.auth.logIn, { name: NAME, pin: "654321" })).error).toBeUndefined();
  });
});
