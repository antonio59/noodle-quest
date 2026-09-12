import { afterEach, describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { GameProps, MultiplayerState } from '@/types';
import LudoGame from '@/games/ludo';

const props: GameProps = {
  stage: 1,
  onScore: () => {},
  onProgress: () => {},
  onMessage: () => {},
  onEnd: () => {},
};

function startGame() {
  fireEvent.click(screen.getByRole('button', { name: /start game/i }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ludo piece chooser', () => {
  test('rolling a 6 with several options shows accessible piece buttons', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // rollDie → 6
    render(<LudoGame {...props} />);
    startGame();

    fireEvent.click(screen.getByRole('button', { name: /roll/i }));

    const group = screen.getByRole('group', { name: /choose a piece to move/i });
    expect(group).toBeInTheDocument();
    const options = screen.getAllByRole('button', { name: /piece \d/i });
    expect(options).toHaveLength(4); // all four can enter the track on a 6

    // Choosing one moves it out of the base and dismisses the chooser
    fireEvent.click(options[0]);
    expect(screen.queryByRole('group', { name: /choose a piece to move/i })).not.toBeInTheDocument();
  });
});

describe('ludo online multiplayer', () => {
  const online: MultiplayerState = {
    sessionId: 's1',
    playerNumber: 1,
    currentPlayer: 1,
    opponentName: 'Remotey',
    opponentAvatar: '🐱',
    status: 'playing',
    boardState: {
      pieces: [[5, -1, -1, -1], [10, 54, -1, -1]],
      lastRoll: 3,
      turnSeat: 2,
    },
  };

  test('renders the opponent name and syncs pieces from the server', () => {
    render(<LudoGame {...props} multiplayerState={online} />);
    startGame();
    expect(screen.getAllByText(/remotey/i).length).toBeGreaterThan(0);
    // Opponent has one piece home (54)
    expect(screen.getByText('1/4 home')).toBeInTheDocument();
    // Our side has none home
    expect(screen.getByText('0/4 home')).toBeInTheDocument();
  });

  test("the roll button is disabled when it is the opponent's turn", () => {
    render(<LudoGame {...props} multiplayerState={online} />);
    startGame();
    expect(screen.getByRole('button', { name: /waiting/i })).toBeDisabled();
  });

  test('requests a server roll then dispatches the resolved move', () => {
    const onMove = vi.fn();
    const myTurn: MultiplayerState = {
      ...online,
      boardState: { pieces: [[5, -1, -1, -1], [10, -1, -1, -1]], lastRoll: 2, turnSeat: 1 },
    };
    const { rerender } = render(<LudoGame {...props} multiplayerState={myTurn} onMultiplayerMove={onMove} />);
    startGame();

    fireEvent.click(screen.getByRole('button', { name: /roll/i }));
    // The client asks the server to roll — it never rolls locally online.
    expect(onMove).toHaveBeenCalledWith({ action: 'roll' });

    // Server echoes a pending roll of 3; only piece 0 can move → auto-dispatch.
    rerender(
      <LudoGame
        {...props}
        multiplayerState={{
          ...myTurn,
          boardState: {
            pieces: [[5, -1, -1, -1], [10, -1, -1, -1]],
            lastRoll: 2,
            turnSeat: 1,
            pendingRoll: { seat: 1, value: 3 },
          },
        }}
        onMultiplayerMove={onMove}
      />,
    );
    expect(onMove).toHaveBeenCalledTimes(2);
    const payload = onMove.mock.calls[1][0] as { boardState: { pieces: number[][]; lastRoll: number } };
    expect(payload.boardState.pieces[0][0]).toBe(8); // 5 + 3
    expect(payload.boardState.lastRoll).toBe(3);
    // The server derives the next turn — the client sends no turnSeat.
    expect(payload.boardState).not.toHaveProperty('turnSeat');
  });

  test('a server-rolled 6 offers every movable piece', () => {
    const onMove = vi.fn();
    const myTurn: MultiplayerState = {
      ...online,
      boardState: { pieces: [[5, -1, -1, -1], [10, -1, -1, -1]], lastRoll: 2, turnSeat: 1 },
    };
    render(
      <LudoGame
        {...props}
        multiplayerState={{
          ...myTurn,
          boardState: {
            pieces: [[5, -1, -1, -1], [10, -1, -1, -1]],
            lastRoll: 2,
            turnSeat: 1,
            pendingRoll: { seat: 1, value: 6 },
          },
        }}
        onMultiplayerMove={onMove}
      />,
    );
    startGame();

    // With a 6, four options (advance piece 0, or bring a base piece out).
    const options = screen.getAllByRole('button', { name: /piece \d/i });
    expect(options).toHaveLength(4);
    fireEvent.click(options[0]);
    expect(onMove).toHaveBeenCalledTimes(1);
    const payload = onMove.mock.calls[0][0] as { boardState: { pieces: number[][]; lastRoll: number } };
    expect(payload.boardState.pieces[0][0]).toBe(11); // 5 + 6
    expect(payload.boardState.lastRoll).toBe(6);
  });

  test('4-player online resolves a pending roll for seat 4', () => {
    const onMove = vi.fn();
    const four: MultiplayerState = {
      sessionId: 's4',
      playerNumber: 4,
      currentPlayer: 4,
      opponentName: 'P1',
      opponentAvatar: '🐱',
      status: 'playing',
      players: [
        { id: 'a', name: 'P1', avatar: '🐱', seat: 1 },
        { id: 'b', name: 'P2', avatar: '🐶', seat: 2 },
        { id: 'c', name: 'P3', avatar: '🦊', seat: 3 },
        { id: 'd', name: 'P4', avatar: '🐻', seat: 4 },
      ],
      boardState: {
        pieces: [
          [-1, -1, -1, -1],
          [-1, -1, -1, -1],
          [-1, -1, -1, -1],
          [5, -1, -1, -1],
        ],
        lastRoll: 2,
        turnSeat: 4,
        pendingRoll: { seat: 4, value: 3 },
      },
    };
    render(<LudoGame {...props} multiplayerState={four} onMultiplayerMove={onMove} />);
    startGame();

    expect(onMove).toHaveBeenCalledTimes(1);
    const payload = onMove.mock.calls[0][0] as { boardState: { pieces: number[][]; lastRoll: number } };
    expect(payload.boardState.pieces).toHaveLength(4);
    expect(payload.boardState.pieces[3][0]).toBe(8);
    expect(payload.boardState.lastRoll).toBe(3);
  });
});
