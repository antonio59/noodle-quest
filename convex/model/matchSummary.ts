// Pass & play result sentences ("Mia beat Dad at Chess"). Shared by the
// result screen and feed.postLocalMatch, which writes the sentence itself so
// nobody can post free text through it.

/** Games with pass & play, and the name the feed uses for each. */
export const PASS_AND_PLAY_GAMES: Readonly<Record<string, string>> = {
  checkers: "Checkers",
  chess: "Chess",
  "connect-four": "Connect Four",
  ludo: "Ludo",
  scrabble: "Scrabble",
  "score-four": "Score Four",
  "snakes-ladders": "Snakes & Ladders",
  "tic-tac-toe": "Tic-Tac-Toe",
  uno: "UNO",
};

export const MAX_SEAT_NAME = 20;

/** Letters, digits, spaces, apostrophes and hyphens — a name, not a message. */
export function isValidSeatName(name: string): boolean {
  const n = name.trim();
  return n.length >= 1 && n.length <= MAX_SEAT_NAME && /^[\p{L}\p{N}' -]+$/u.test(n);
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * `winnerSeat` is 1-indexed into `names`; 0 means a draw; undefined means
 * no result was recorded.
 */
export function describeMatchNames(
  names: readonly string[],
  winnerSeat: number | undefined,
  gameName: string,
): string {
  if (winnerSeat === undefined) return `${joinNames(names)} played ${gameName}`;
  if (winnerSeat === 0) return `${joinNames(names)} drew at ${gameName}`;
  const winner = names[winnerSeat - 1] ?? `Player ${winnerSeat}`;
  const others = names.filter((_, i) => i !== winnerSeat - 1);
  return others.length === 1
    ? `${winner} beat ${others[0]} at ${gameName}`
    : `${winner} won ${gameName} against ${joinNames(others)}`;
}
