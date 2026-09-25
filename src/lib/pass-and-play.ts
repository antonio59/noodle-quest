// Pass & play: every seat is a person sharing this one device. No AI, no
// server — scores aren't saved (playing both sides would farm stars), the
// table just keeps a friendly tally of who won each round.
import type { LocalSeat } from '@/types';
import { describeMatchNames } from '../../convex/model/matchSummary';

export const MAX_GUEST_NAME = 20;
export const GUEST_AVATARS = ['🙂', '🐻', '🦊', '🐸', '🐼', '🦁', '🐯', '🐨'] as const;

/** Seat colours for turn banners, so each person can spot "their" turn. */
export const SEAT_COLORS = ['#f0a83a', '#e85d4c', '#3ecf8e', '#5aa9e6'] as const;

/** Wins per player name across rematches (seat order rotates, names don't). */
export type MatchTally = Readonly<Record<string, number>>;

/** The 1-indexed seat, or a numbered stand-in if it doesn't exist. */
export function seatAt(seats: readonly LocalSeat[], seat: number): LocalSeat {
  return seats[seat - 1] ?? { name: `Player ${seat}`, avatar: '🙂' };
}

/** The seat after `seat` at a table of `count`, wrapping to seat 1. */
export function nextSeat(seat: number, count: number): number {
  return seat >= count ? 1 : seat + 1;
}

/**
 * One-line result for the end screen and the family feed.
 * `winnerSeat` is 1-indexed; 0 means a draw; undefined means no result.
 */
export function describeMatch(
  seats: readonly LocalSeat[],
  winnerSeat: number | undefined,
  gameName: string,
): string {
  return describeMatchNames(seats.map(s => s.name), winnerSeat, gameName);
}

export function addToTally(
  tally: MatchTally,
  seats: readonly LocalSeat[],
  winnerSeat: number | undefined,
): MatchTally {
  if (!winnerSeat) return tally;
  const name = seatAt(seats, winnerSeat).name;
  return { ...tally, [name]: (tally[name] ?? 0) + 1 };
}

/** Next rematch's turn order: everyone moves up one, so first move rotates. */
export function rotateSeats<T>(seats: readonly T[]): T[] {
  return seats.length < 2 ? [...seats] : [...seats.slice(1), seats[0]];
}

/** Why this table can't start yet, or null when it's good to go. */
export function seatListError(seats: readonly LocalSeat[], min: number, max: number): string | null {
  if (seats.length < min) return `Pick at least ${min} players`;
  if (seats.length > max) return `This game seats ${max} players`;
  const names = seats.map(s => s.name.trim().toLowerCase());
  if (names.some(n => n.length === 0)) return 'Every player needs a name';
  if (new Set(names).size !== names.length) return 'Each player needs a different name';
  return null;
}
