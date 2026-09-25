// "This week in the family": a rolling 7-day summary built from scores,
// challenges and the weekly puzzle. Shared by the home card and the
// Sunday recap email.
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { formatSolveTime, weeklyPuzzleKey } from "./puzzles";

export const RECAP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_HIGHLIGHTS = 5;

export interface RecapPlayer {
  name: string;
  avatar: string;
  plays: number;
  stars: number;
  gamesTried: number;
}

export interface FamilyWeek {
  since: number;
  totalPlays: number;
  totalStars: number;
  /** Everyone who played, most stars first. */
  players: RecapPlayer[];
  topGame: { gameId: string; plays: number } | null;
  challengeWins: { winner: string; loser: string; gameId: string }[];
  puzzleLeader: { name: string; avatar: string; seconds: number } | null;
}

function tallyPlayers(scores: Doc<"scores">[], names: Map<Id<"players">, Doc<"players">>): RecapPlayer[] {
  const byPlayer = new Map<Id<"players">, { plays: number; stars: number; games: Set<string> }>();
  for (const s of scores) {
    const row = byPlayer.get(s.playerId) ?? { plays: 0, stars: 0, games: new Set<string>() };
    byPlayer.set(s.playerId, { plays: row.plays + 1, stars: row.stars + s.stars, games: row.games.add(s.gameId) });
  }
  return [...byPlayer.entries()]
    .flatMap(([id, row]) => {
      const p = names.get(id);
      return p ? [{ name: p.name, avatar: p.avatar, plays: row.plays, stars: row.stars, gamesTried: row.games.size }] : [];
    })
    .sort((a, b) => b.stars - a.stars || b.plays - a.plays || a.name.localeCompare(b.name));
}

function mostPlayed(scores: Doc<"scores">[]): FamilyWeek["topGame"] {
  const counts = new Map<string, number>();
  for (const s of scores) counts.set(s.gameId, (counts.get(s.gameId) ?? 0) + 1);
  let top: FamilyWeek["topGame"] = null;
  for (const [gameId, plays] of counts) {
    if (!top || plays > top.plays || (plays === top.plays && gameId < top.gameId)) top = { gameId, plays };
  }
  return top;
}

export async function buildFamilyWeek(ctx: QueryCtx, now: number): Promise<FamilyWeek> {
  const since = now - RECAP_WINDOW_MS;
  const scores = await ctx.db
    .query("scores")
    .withIndex("by_playedAt", q => q.gt("playedAt", since))
    .collect();

  // Challenges have no time index; a family's table stays small.
  const challenges = (await ctx.db.query("challenges").collect())
    .filter(c => c.status === "completed" && (c.completedAt ?? 0) > since)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  const ids = new Set<Id<"players">>([
    ...scores.map(s => s.playerId),
    ...challenges.flatMap(c => [c.fromId, c.toId]),
  ]);
  const players = new Map<Id<"players">, Doc<"players">>();
  for (const id of ids) {
    const p = await ctx.db.get(id);
    if (p) players.set(id, p);
  }

  const challengeWins = challenges.slice(0, MAX_HIGHLIGHTS).flatMap(c => {
    const toWon = (c.toScore ?? 0) > c.fromScore;
    const winner = players.get(toWon ? c.toId : c.fromId);
    const loser = players.get(toWon ? c.fromId : c.toId);
    return winner && loser ? [{ winner: winner.name, loser: loser.name, gameId: c.gameId }] : [];
  });

  const fastest = await ctx.db
    .query("puzzle_times")
    .withIndex("by_puzzle", q => q.eq("puzzleKey", weeklyPuzzleKey(now)))
    .order("asc")
    .first();

  return {
    since,
    totalPlays: scores.length,
    totalStars: scores.reduce((sum, s) => sum + s.stars, 0),
    players: tallyPlayers(scores, players),
    topGame: mostPlayed(scores),
    challengeWins,
    puzzleLeader: fastest ? { name: fastest.playerName, avatar: fastest.playerAvatar, seconds: fastest.seconds } : null,
  };
}

/** "connect-four" → "Connect Four" — the server doesn't know display names. */
export function prettyGameId(gameId: string): string {
  return gameId.split("-").map(w => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderRecapEmail(week: FamilyWeek): { subject: string; html: string } {
  const star = week.players[0];
  const rows = week.players
    .map(p => `<tr><td style="padding:6px 8px">${escapeHtml(p.avatar)} ${escapeHtml(p.name)}</td>`
      + `<td style="padding:6px 8px;text-align:right">${p.plays}</td>`
      + `<td style="padding:6px 8px;text-align:right">${p.stars} ⭐</td>`
      + `<td style="padding:6px 8px;text-align:right">${p.gamesTried}</td></tr>`)
    .join("");
  const highlights = [
    star && `🌟 Star of the week: <strong>${escapeHtml(star.name)}</strong> with ${star.stars} stars`,
    week.topGame && `🎲 Most played: <strong>${escapeHtml(prettyGameId(week.topGame.gameId))}</strong> (${week.topGame.plays} games)`,
    week.puzzleLeader && `🧩 Fastest family puzzle: <strong>${escapeHtml(week.puzzleLeader.name)}</strong> in ${formatSolveTime(week.puzzleLeader.seconds)}`,
    ...week.challengeWins.map(c => `⚔️ ${escapeHtml(c.winner)} beat ${escapeHtml(c.loser)} at ${escapeHtml(prettyGameId(c.gameId))}`),
  ].filter(Boolean);

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1c1917">
      <h2 style="margin:0 0 4px">🍜 This week in the family</h2>
      <p style="color:#57534e;margin:0 0 16px">${week.totalPlays} games played · ${week.totalStars} stars earned</p>
      ${highlights.length ? `<ul style="padding-left:18px;line-height:1.7;margin:0 0 16px">${highlights.map(h => `<li>${h}</li>`).join("")}</ul>` : ""}
      ${rows ? `<table style="border-collapse:collapse;width:100%;font-size:14px">
        <thead><tr style="color:#78716c;text-align:left"><th style="padding:6px 8px">Player</th><th style="padding:6px 8px;text-align:right">Games</th><th style="padding:6px 8px;text-align:right">Stars</th><th style="padding:6px 8px;text-align:right">Tried</th></tr></thead>
        <tbody>${rows}</tbody></table>` : `<p>A quiet week — maybe a family game night soon? 🎲</p>`}
    </div>`;
  const subject = week.totalPlays > 0
    ? `🍜 Family week: ${week.totalPlays} games, ${star ? `${star.name} is star of the week` : "lots of fun"}`
    : "🍜 Family week: a quiet one";
  return { subject, html };
}
