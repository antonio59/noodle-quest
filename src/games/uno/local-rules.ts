// Pass & play UNO: the solo game's rules with two to four people instead of
// a person and the AI. Pure and immutable — every move returns a new table —
// plus the curtain recaps that tell the next person what they missed.
import { canPlay, createDeck, dealInitial, shuffle, type UnoCard, type UnoColor } from './logic';
import { cardName, colorName } from './display';

/** 1-indexed seat. Seat 1 plays first. */
export type Seat = 1 | 2 | 3 | 4;
export type SeatCount = 2 | 3 | 4;
/** +1 follows seat order; −1 walks back around the table. */
export type Direction = 1 | -1;

export interface LocalTable {
  /** hands[0] belongs to seat 1. Length is the seat count (2–4). */
  hands: readonly UnoCard[][];
  deck: UnoCard[];
  discard: UnoCard[];
  color: UnoColor;
  turn: Seat;
  direction: Direction;
}

export type TurnEvent =
  | { kind: 'play'; card: UnoCard; color: UnoColor; penalty: number }
  | { kind: 'draw'; card: UnoCard | null; playable: boolean };

export interface TurnOutcome {
  table: LocalTable;
  event: TurnEvent;
  /** True when play moves to another seat, i.e. the device changes hands. */
  passes: boolean;
  /** The seat that just emptied their hand. */
  winner: Seat | null;
}

export const handOf = (table: LocalTable, seat: Seat): UnoCard[] => table.hands[seat - 1] ?? [];
export const topOf = (table: LocalTable): UnoCard | undefined => table.discard[table.discard.length - 1];

const isWild = (card: UnoCard) => card.type === 'wild' || card.type === 'wild4';
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function clampCount(n: number): SeatCount {
  // shortcut: 4 local seats, when the pass-and-play manifest allows more.
  if (n >= 4) return 4;
  if (n === 3) return 3;
  return 2;
}

/** Next seat in `direction`, wrapping around a table of `count`. */
function nextSeat(seat: number, count: number, direction: Direction): Seat {
  const step = direction === 1 ? 1 : count - 1;
  return (((seat - 1 + step) % count) + 1) as Seat;
}

function withHand(hands: readonly UnoCard[][], seat: Seat, hand: UnoCard[]): UnoCard[][] {
  return hands.map((h, i) => (i === seat - 1 ? hand : h));
}

function dealSeats(count: 3 | 4): Pick<LocalTable, 'hands' | 'deck' | 'discard' | 'color'> {
  const d = createDeck();
  const hands = Array.from({ length: count }, (_, i) => d.slice(i * 7, i * 7 + 7));
  let rest = d.slice(count * 7);
  // Starter is a number card, same rule as the two-player deal.
  const starterIdx = rest.findIndex(c => c.type === 'number');
  const starter = starterIdx >= 0 ? rest[starterIdx] : rest[0];
  rest = rest.filter(c => c.id !== starter.id);
  return {
    hands,
    deck: rest,
    discard: [starter],
    color: starter.color === 'wild' ? 'red' : (starter.color as UnoColor),
  };
}

/** One deal. Two seats keep the solo deal; 3–4 take further hands from that same deck. */
export function newTable(seatCount: SeatCount = 2): LocalTable {
  if (seatCount === 2) {
    const { pHand, aHand, deck, discard, color } = dealInitial();
    return { hands: [pHand, aHand], deck, discard, color, turn: 1, direction: 1 };
  }
  return { ...dealSeats(seatCount), turn: 1, direction: 1 };
}

/** Take `count` cards; a short deck is topped up by reshuffling the discard pile under its top card. */
export function takeCards(deck: UnoCard[], discard: UnoCard[], count: number) {
  if (deck.length >= count) return { drawn: deck.slice(0, count), deck: deck.slice(count), discard };
  const pool = [...deck, ...shuffle(discard.slice(0, -1))];
  return { drawn: pool.slice(0, count), deck: pool.slice(count), discard: discard.slice(-1) };
}

function penaltyFor(card: UnoCard): number {
  if (card.symbol === 'draw2') return 2;
  return card.type === 'wild4' ? 4 : 0;
}

// Two seats: reverse meets the same neighbour either way, so it skips them.
// Three or four: reverse flips direction and play continues that way; skip
// and draw cards miss the next seat and land on the one after.
function resolveTurn(card: UnoCard, seat: Seat, count: number, direction: Direction): {
  turn: Seat;
  direction: Direction;
  passes: boolean;
  victim: Seat;
} {
  if (card.symbol === 'reverse') {
    const nextDir: Direction = direction === 1 ? -1 : 1;
    const victim = nextSeat(seat, count, direction);
    if (count === 2) return { turn: seat, direction: nextDir, passes: false, victim };
    const turn = nextSeat(seat, count, nextDir);
    return { turn, direction: nextDir, passes: turn !== seat, victim };
  }
  if (card.symbol === 'skip' || penaltyFor(card) > 0) {
    const victim = nextSeat(seat, count, direction);
    const turn = nextSeat(victim, count, direction);
    return { turn, direction, passes: turn !== seat, victim };
  }
  const turn = nextSeat(seat, count, direction);
  return { turn, direction, passes: turn !== seat, victim: turn };
}

/** The current seat plays `cardId` (wilds need `chosen`). Null if the move isn't legal. */
export function playCard(table: LocalTable, cardId: number, chosen?: UnoColor): TurnOutcome | null {
  const seat = table.turn;
  const card = handOf(table, seat).find(c => c.id === cardId);
  const top = topOf(table);
  if (!card || !top || !canPlay(card, top, table.color)) return null;
  if (isWild(card) && !chosen) return null;

  const color = isWild(card) ? (chosen as UnoColor) : (card.color as UnoColor);
  const hand = handOf(table, seat).filter(c => c.id !== card.id);
  const played: LocalTable = { ...table, hands: withHand(table.hands, seat, hand), discard: [...table.discard, card], color };
  // Going out ends the round before any +2/+4 lands, as in the solo game.
  if (hand.length === 0) {
    return { table: played, event: { kind: 'play', card, color, penalty: 0 }, passes: false, winner: seat };
  }

  const resolved = resolveTurn(card, seat, table.hands.length, table.direction);
  let hands = played.hands;
  let deck = played.deck;
  let discard = played.discard;
  let drawnCount = 0;
  if (penaltyFor(card) > 0) {
    const taken = takeCards(played.deck, played.discard, penaltyFor(card));
    drawnCount = taken.drawn.length;
    const victimHand = [...handOf(played, resolved.victim), ...taken.drawn];
    hands = withHand(played.hands, resolved.victim, victimHand);
    deck = taken.deck;
    discard = taken.discard;
  }
  return {
    table: { ...played, hands, deck, discard, turn: resolved.turn, direction: resolved.direction },
    event: { kind: 'play', card, color, penalty: drawnCount },
    passes: resolved.passes,
    winner: null,
  };
}

/** The current seat draws one: a playable card stays with them to play, anything else ends the turn. */
export function drawCard(table: LocalTable): TurnOutcome {
  const seat = table.turn;
  const { drawn, deck, discard } = takeCards(table.deck, table.discard, 1);
  const card = drawn[0] ?? null;
  const top = discard[discard.length - 1];
  const playable = !!card && !!top && canPlay(card, top, table.color);
  const hand = card ? [...handOf(table, seat), card] : handOf(table, seat);
  const next = nextSeat(seat, table.hands.length, table.direction);
  return {
    table: { ...table, hands: withHand(table.hands, seat, hand), deck, discard, turn: playable ? seat : next },
    event: { kind: 'draw', card, playable },
    passes: !playable,
    winner: null,
  };
}

// ── The table as the people around it see it ──

export interface LocalUnoState {
  table: LocalTable;
  /** Covers the table until `seat` has the device. */
  curtain: { seat: Seat; recap: string } | null;
  /** What the current seat has done so far this turn, for the next recap. */
  turnLog: string[];
  /** A wild waiting for its colour. */
  pendingWild: UnoCard | null;
  message: string;
  winner: Seat | null;
}

/** Recap fragment for one move, e.g. "played Wild +4, chose Blue, Mia drew 4". */
export function describeEvent(event: TurnEvent, otherName: string): string {
  if (event.kind === 'draw') return event.card ? 'drew a card' : 'found the deck empty';
  const parts = [`played ${cardName(event.card)}`];
  if (isWild(event.card)) parts.push(`chose ${colorName(event.color)}`);
  if (event.penalty > 0) parts.push(`${otherName} drew ${event.penalty}`);
  return parts.join(', ');
}

/** Curtain text for the next seat: what just happened and the cards left. */
export function recapFor(name: string, log: readonly string[], cardsLeft: number): string {
  const uno = cardsLeft === 1 ? ' — UNO!' : '';
  return `${name} ${log.join(', then ')} · ${name} has ${plural(cardsLeft, 'card')}${uno}`;
}

function againMessage(event: TurnEvent, name: string, otherName: string): string {
  if (event.kind === 'draw') return event.card ? `${name} drew ${cardName(event.card)} and can play it!` : `${name} goes again!`;
  if (event.penalty > 0) return `${otherName} draws ${event.penalty} and is skipped — ${name} goes again!`;
  return `${otherName} is skipped — ${name} goes again!`;
}

/** A fresh deal, curtained for seat 1. */
export function beginMatch(names: readonly string[]): LocalUnoState {
  const count = clampCount(names.length);
  const table = newTable(count);
  const waiting = names.slice(1, count).map((name, i) =>
    `${name} has ${plural(handOf(table, (i + 2) as Seat).length, 'card')}`,
  );
  return {
    table,
    curtain: { seat: 1, recap: `${names[0]} goes first · ${waiting.join(' · ')}` },
    turnLog: [],
    pendingWild: null,
    message: `${names[0]} goes first — match the color or number.`,
    winner: null,
  };
}

/** Folds a move into the state: a new curtain when the device changes hands, otherwise the same seat goes on. */
export function advance(state: LocalUnoState, outcome: TurnOutcome, names: readonly string[]): LocalUnoState {
  const actor = state.table.turn;
  const name = names[actor - 1] ?? `Player ${actor}`;
  const victim = nextSeat(actor, state.table.hands.length, state.table.direction);
  const victimName = names[victim - 1] ?? `Player ${victim}`;
  const turnLog = [...state.turnLog, describeEvent(outcome.event, victimName)];
  const next = { ...state, table: outcome.table, pendingWild: null };

  if (outcome.winner) return { ...next, turnLog, winner: outcome.winner, message: `${name} wins!` };
  if (outcome.passes) {
    const recap = recapFor(name, turnLog, handOf(outcome.table, actor).length);
    return { ...next, turnLog: [], curtain: { seat: outcome.table.turn, recap }, message: recap };
  }
  return { ...next, turnLog, message: againMessage(outcome.event, name, victimName) };
}
