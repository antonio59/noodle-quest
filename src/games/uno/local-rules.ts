// Pass & play UNO: the solo game's rules with two people instead of a
// person and the AI. Pure and immutable — every move returns a new table —
// plus the curtain recaps that tell the next person what they missed.
import { canPlay, dealInitial, shuffle, type UnoCard, type UnoColor } from './logic';
import { cardName, colorName } from './display';

/** 1-indexed seat; seat 1 holds the hand that plays first. */
export type Seat = 1 | 2;
type SeatNames = readonly [string, string];

export interface LocalTable {
  /** hands[0] belongs to seat 1, hands[1] to seat 2. */
  hands: readonly [UnoCard[], UnoCard[]];
  deck: UnoCard[];
  discard: UnoCard[];
  color: UnoColor;
  turn: Seat;
}

export type TurnEvent =
  | { kind: 'play'; card: UnoCard; color: UnoColor; penalty: number }
  | { kind: 'draw'; card: UnoCard | null; playable: boolean };

export interface TurnOutcome {
  table: LocalTable;
  event: TurnEvent;
  /** True when play moves to the other seat, i.e. the device changes hands. */
  passes: boolean;
  /** The seat that just emptied their hand. */
  winner: Seat | null;
}

export const otherSeat = (seat: Seat): Seat => (seat === 1 ? 2 : 1);
export const handOf = (table: LocalTable, seat: Seat): UnoCard[] => table.hands[seat - 1];
export const topOf = (table: LocalTable): UnoCard | undefined => table.discard[table.discard.length - 1];

const isWild = (card: UnoCard) => card.type === 'wild' || card.type === 'wild4';
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function withHand(hands: LocalTable['hands'], seat: Seat, hand: UnoCard[]): LocalTable['hands'] {
  return seat === 1 ? [hand, hands[1]] : [hands[0], hand];
}

/** One deal: seat 1 gets the hand that plays first. */
export function newTable(): LocalTable {
  const { pHand, aHand, deck, discard, color } = dealInitial();
  return { hands: [pHand, aHand], deck, discard, color, turn: 1 };
}

/** Take `count` cards; a short deck is topped up by reshuffling the discard pile under its top card. */
export function takeCards(deck: UnoCard[], discard: UnoCard[], count: number) {
  if (deck.length >= count) return { drawn: deck.slice(0, count), deck: deck.slice(count), discard };
  const pool = [...deck, ...shuffle(discard.slice(0, -1))];
  return { drawn: pool.slice(0, count), deck: pool.slice(count), discard: discard.slice(-1) };
}

// With two players, skip and reverse (and the draw cards) hand the same seat another turn.
function keepsTurn(card: UnoCard): boolean {
  return card.symbol === 'skip' || card.symbol === 'reverse' || card.symbol === 'draw2' || card.type === 'wild4';
}

function penaltyFor(card: UnoCard): number {
  if (card.symbol === 'draw2') return 2;
  return card.type === 'wild4' ? 4 : 0;
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

  const victim = otherSeat(seat);
  const { drawn, deck, discard } = takeCards(played.deck, played.discard, penaltyFor(card));
  const hands = withHand(played.hands, victim, [...handOf(played, victim), ...drawn]);
  const passes = !keepsTurn(card);
  return {
    table: { ...played, hands, deck, discard, turn: passes ? victim : seat },
    event: { kind: 'play', card, color, penalty: drawn.length },
    passes,
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
  return {
    table: { ...table, hands: withHand(table.hands, seat, hand), deck, discard, turn: playable ? seat : otherSeat(seat) },
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
export function beginMatch(names: SeatNames): LocalUnoState {
  const table = newTable();
  return {
    table,
    curtain: { seat: 1, recap: `${names[0]} goes first · ${names[1]} has ${plural(handOf(table, 2).length, 'card')}` },
    turnLog: [],
    pendingWild: null,
    message: `${names[0]} goes first — match the color or number.`,
    winner: null,
  };
}

/** Folds a move into the state: a new curtain when the device changes hands, otherwise the same seat goes on. */
export function advance(state: LocalUnoState, outcome: TurnOutcome, names: SeatNames): LocalUnoState {
  const actor = state.table.turn;
  const name = names[actor - 1];
  const otherName = names[otherSeat(actor) - 1];
  const turnLog = [...state.turnLog, describeEvent(outcome.event, otherName)];
  const next = { ...state, table: outcome.table, pendingWild: null };

  if (outcome.winner) return { ...next, turnLog, winner: outcome.winner, message: `${name} wins!` };
  if (outcome.passes) {
    const recap = recapFor(name, turnLog, handOf(outcome.table, actor).length);
    return { ...next, turnLog: [], curtain: { seat: outcome.table.turn, recap }, message: recap };
  }
  return { ...next, turnLog, message: againMessage(outcome.event, name, otherName) };
}
