import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

// PIN hashing
//
// PINs are 6 digits, so the keyspace (1M) is small enough that no hash
// survives a determined offline attack. Hashing still matters: it keeps
// plaintext PINs out of the database, dashboard, backups, and logs.
// The real online defence is the login lockout in auth.ts.
//
// We use iterated salted SHA-256 via Web Crypto (the Convex runtime does
// not expose PBKDF2/bcrypt). 10k iterations keeps mutations fast while
// making bulk scans of a leaked table annoying.
const HASH_ITERATIONS = 10_000;

export const SESSION_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes
export { MAX_LOGIN_ATTEMPTS };

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  let data: Uint8Array<ArrayBuffer> = encoder.encode(`${salt}:${pin}`);
  for (let i = 0; i < HASH_ITERATIONS; i++) {
    data = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  }
  return toHex(data);
}

export async function verifyPin(pin: string, salt: string, expectedHash: string): Promise<boolean> {
  const actual = await hashPin(pin, salt);
  // Constant-time comparison of equal-length hex strings.
  if (actual.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export async function createSession(ctx: MutationCtx, playerId: Id<"players">): Promise<string> {
  const token = generateToken();
  const now = Date.now();
  await ctx.db.insert("sessions", {
    playerId,
    token,
    createdAt: now,
    expiresAt: now + SESSION_LIFETIME_MS,
  });
  return token;
}

/** Resolve a session token to its player, or null if invalid/expired. */
export async function playerFromSession(
  ctx: QueryCtx | MutationCtx,
  token: string,
): Promise<Doc<"players"> | null> {
  if (!token) return null;
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", q => q.eq("token", token))
    .unique();
  if (!session || session.expiresAt < Date.now()) return null;
  const player = await ctx.db.get(session.playerId);
  // Pending/rejected accounts hold no access even if a session exists.
  if (player && player.status && player.status !== "approved") return null;
  return player;
}

export async function deleteSessionsForPlayer(ctx: MutationCtx, playerId: Id<"players">): Promise<void> {
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_player", q => q.eq("playerId", playerId))
    .collect();
  for (const s of sessions) {
    await ctx.db.delete(s._id);
  }
}
