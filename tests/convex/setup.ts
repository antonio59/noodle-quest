import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

// All convex function modules (including _generated). Tests live outside
// convex/ so the deploy bundle never sees test code.
export const modules = import.meta.glob([
  "../../convex/**/*.ts",
  "../../convex/**/*.js",
]);

export function setup() {
  return convexTest(schema, modules);
}

// Sign up and approve the player the way the owner would — signUp now
// queues uninvited accounts as pending, so tests that need a working
// session approve directly in the DB, then log in for a real token.
export async function approvedPlayer(
  t: ReturnType<typeof setup>,
  name = "Test Player",
  pin = "123456",
) {
  const res = await t.mutation(api.auth.signUp, { name, pin });
  if (!res.playerId) throw new Error(`signUp failed: ${res.error ?? "unknown"}`);
  await t.run(async ctx => {
    await ctx.db.patch(res.playerId!, { status: "approved" as const });
  });
  const login = await t.mutation(api.auth.logIn, { name, pin });
  if (!login.sessionToken) throw new Error(`logIn failed: ${login.error ?? "unknown"}`);
  return { playerId: res.playerId, sessionToken: login.sessionToken };
}
