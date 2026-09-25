import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { GameProps, LocalSeat } from '@/types';
import ScrabbleGame from '@/games/scrabble';
import { clearDictionaryCache } from '@/games/scrabble/dictionary';

// Stack the bag so every rack is known: seat 1 can play CAT, and each
// other seat holds letters seat 1 doesn't, so a leaked rack is obvious.
const { RACKS } = vi.hoisted(() => ({
  RACKS: [
    ['C', 'A', 'T', 'X', 'Y', 'Z', 'W'],
    ['D', 'E', 'F', 'G', 'H', 'I', 'J'],
    ['K', 'L', 'M', 'N', 'O', 'P', 'R'],
  ],
}));
vi.mock('@/games/scrabble/logic', async importOriginal => {
  const actual = await importOriginal<typeof import('@/games/scrabble/logic')>();
  return { ...actual, buildTilePool: () => [...RACKS.flat(), ...Array<string>(40).fill('S')] };
});

// CAT plus enough filler to pass the corrupt-file guard.
const filler = (n: number): string => {
  let s = ''; let x = n;
  do { s = String.fromCharCode(65 + (x % 26)) + s; x = Math.floor(x / 26); } while (x > 0);
  return 'Q' + s.padStart(4, 'A');
};
const dict = ['CAT', ...Array.from({ length: 20000 }, (_, i) => filler(i))].join('\n');

const DAD: LocalSeat = { name: 'Dad', avatar: '🐻' };
const MIA: LocalSeat = { name: 'Mia', avatar: '🦊' };
const LEO: LocalSeat = { name: 'Leo', avatar: '🐸' };
// Stage 1 → 12 rounds; each seat takes one turn per round.
const ROUNDS = 12;

function makeProps(seats: LocalSeat[]): GameProps {
  return {
    stage: 1,
    onScore: vi.fn(),
    onProgress: vi.fn(),
    onMessage: vi.fn(),
    onEnd: vi.fn(),
    numPlayers: seats.length,
    localSeats: seats,
  };
}

/** Render, wait for the dictionary, press Start, then freeze time. */
async function startGame(props: GameProps) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(dict) }));
  render(<ScrabbleGame {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: /start game/i }));
  vi.useFakeTimers();
}

const tiles = (letter: string) => screen.queryAllByRole('button', { name: new RegExp(`^tile ${letter},`, 'i') });
const lettersOnBoard = () => screen.queryAllByRole('button', { name: /^row \d+, column \d+: [A-Z]$/i });
const curtainFor = (name: string) => screen.queryByRole('dialog', { name: `Pass the device to ${name}` });
const imReady = (name: string) => fireEvent.click(screen.getByRole('button', { name: `I'm ${name} — show me` }));
const pass = () => fireEvent.click(screen.getByRole('button', { name: 'Pass' }));

function place(letter: string, row: number, col: number) {
  fireEvent.click(tiles(letter)[0]);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^row ${row}, column ${col}$`, 'i') }));
}

/** Each remaining turn: whoever is up takes the device and passes. */
function passTurns(count: number) {
  for (let i = 0; i < count; i++) {
    fireEvent.click(screen.getByRole('button', { name: /— show me$/ }));
    pass();
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
  clearDictionaryCache();
});

describe('scrabble pass & play', () => {
  test('keeps the lexicon choice (UK default) but no stage target', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(dict) }));
    render(<ScrabbleGame {...makeProps([DAD, MIA])} />);
    expect(screen.getByRole('radio', { name: /uk & international/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /us & canada/i })).toBeInTheDocument();
    expect(screen.getByText(/highest score after 12 rounds wins/i)).toBeInTheDocument();
    expect(screen.queryByText(/first to reach/i)).not.toBeInTheDocument();
    await screen.findByRole('button', { name: /start game/i });
  });

  test('seat 1 starts behind the curtain and only sees their rack after tapping ready', async () => {
    await startGame(makeProps([DAD, MIA, LEO]));

    expect(curtainFor('Dad')).toBeInTheDocument();
    expect(tiles('C')).toHaveLength(0);

    imReady('Dad');

    expect(curtainFor('Dad')).not.toBeInTheDocument();
    expect(tiles('C')).toHaveLength(1);
    // Only the current seat's rack is ever shown.
    expect(tiles('D')).toHaveLength(0);
    expect(tiles('K')).toHaveLength(0);
    expect(screen.getByText("Dad's turn")).toBeInTheDocument();
    // Every seat's score is on show by name; nobody is "You" or "AI".
    expect(screen.getByText('🐻 Dad')).toBeInTheDocument();
    expect(screen.getByText('🦊 Mia')).toBeInTheDocument();
    expect(screen.getByText('🐸 Leo')).toBeInTheDocument();
    expect(screen.queryByText(/\bAI\b/)).not.toBeInTheDocument();
    expect(screen.queryByText('You')).not.toBeInTheDocument();
  });

  test('after seat 1 passes the curtain covers the device for seat 2 and no AI moves', async () => {
    const props = makeProps([DAD, MIA, LEO]);
    await startGame(props);
    imReady('Dad');

    // A tile laid but not submitted goes back to Dad's rack, not onto the board.
    place('C', 8, 8);
    expect(lettersOnBoard()).toHaveLength(1);
    pass();

    expect(curtainFor('Mia')).toBeInTheDocument();
    expect(screen.getByText('Dad passed · scores Dad 0, Mia 0, Leo 0')).toBeInTheDocument();
    expect(tiles('C')).toHaveLength(0);
    expect(tiles('D')).toHaveLength(0);
    expect(lettersOnBoard()).toHaveLength(0);

    // Well past the 700ms AI delay: nothing plays for Mia.
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(curtainFor('Mia')).toBeInTheDocument();
    expect(lettersOnBoard()).toHaveLength(0);
    expect(props.onMessage).not.toHaveBeenCalledWith(expect.stringMatching(/\bAI\b/));

    imReady('Mia');
    expect(tiles('D')).toHaveLength(1);
    expect(tiles('C')).toHaveLength(0);
    expect(screen.getByText("Mia's turn")).toBeInTheDocument();
  });

  test('after seat 1 plays a word the next seat sees the word and running scores', async () => {
    await startGame(makeProps([DAD, MIA]));
    imReady('Dad');

    place('C', 8, 8);
    place('A', 8, 9);
    place('T', 8, 10);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(curtainFor('Mia')).toBeInTheDocument();
    expect(screen.getByText('Dad played "CAT" for 15 · scores Dad 15, Mia 0')).toBeInTheDocument();
    // Dad's refilled rack (4 left + S draws) stays hidden.
    expect(tiles('X')).toHaveLength(0);
    expect(tiles('S')).toHaveLength(0);
    expect(lettersOnBoard()).toHaveLength(3);
  });

  test('the game ends once with the top scorer as winnerSeat', async () => {
    const props = makeProps([DAD, MIA]);
    await startGame(props);
    imReady('Dad');
    place('C', 8, 8);
    place('A', 8, 9);
    place('T', 8, 10);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    passTurns(ROUNDS * 2 - 1);

    // The final turn hides every rack and raises no further curtain.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /^tile /i })).toHaveLength(0);
    expect(props.onEnd).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(10_000); });
    expect(props.onEnd).toHaveBeenCalledTimes(1);
    expect(props.onEnd).toHaveBeenCalledWith({
      score: 0, stars: 0, summary: 'Dad wins with 15 points!', winnerSeat: 1,
    });
  });

  test('a shared top score is a draw (winnerSeat 0)', async () => {
    const props = makeProps([DAD, MIA, LEO]);
    await startGame(props);

    passTurns(ROUNDS * 3);

    act(() => { vi.advanceTimersByTime(10_000); });
    expect(props.onEnd).toHaveBeenCalledTimes(1);
    expect(props.onEnd).toHaveBeenCalledWith(expect.objectContaining({ score: 0, stars: 0, winnerSeat: 0 }));
    expect(vi.mocked(props.onEnd).mock.calls[0][0].summary).toMatch(/tie/i);
  });
});
