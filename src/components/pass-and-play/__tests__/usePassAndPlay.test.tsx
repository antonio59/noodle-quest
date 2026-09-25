import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const postLocalMatch = vi.fn();
let signedIn = true;

vi.mock('convex/react', () => ({ useMutation: () => postLocalMatch }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ player: signedIn ? { sessionToken: 'tok', name: 'Dad', avatar: '🐻' } : null }),
}));
vi.mock('@/lib/feedback', () => ({ playWin: vi.fn(), playLose: vi.fn() }));

import { usePassAndPlay } from '../usePassAndPlay';

const DAD = { name: 'Dad', avatar: '🐻' };
const MIA = { name: 'Mia', avatar: '🦊' };
const LEO = { name: 'Leo', avatar: '🐸' };
const round = (winnerSeat?: number) => ({ score: 0, stars: 0, summary: '', winnerSeat });

afterEach(() => {
  postLocalMatch.mockReset();
  signedIn = true;
});

describe('usePassAndPlay', () => {
  test('records each round and tallies wins by name across rotated rematches', () => {
    const { result } = renderHook(() => usePassAndPlay('chess', 'Chess'));
    act(() => result.current.start([DAD, MIA, LEO]));
    act(() => result.current.finishRound(round(2)));
    expect(result.current.result).toEqual({ seats: [DAD, MIA, LEO], winnerSeat: 2 });
    expect(result.current.tally).toEqual({ Mia: 1 });

    act(() => result.current.rematch());
    expect(result.current.seats).toEqual([MIA, LEO, DAD]);
    expect(result.current.round).toBe(1);
    expect(result.current.result).toBeNull();

    // Seat 1 is now Mia, so a seat-1 win still counts for Mia.
    act(() => result.current.finishRound(round(1)));
    expect(result.current.tally).toEqual({ Mia: 2 });
    act(() => result.current.finishRound(round(0)));
    expect(result.current.tally).toEqual({ Mia: 2 });
  });

  test('sharing posts the match summary and reports success', async () => {
    postLocalMatch.mockResolvedValue({ postId: 'p1' });
    const { result } = renderHook(() => usePassAndPlay('chess', 'Chess'));
    act(() => result.current.start([DAD, MIA]));
    act(() => result.current.finishRound(round(2)));
    await act(async () => { await result.current.share!(); });
    expect(postLocalMatch).toHaveBeenCalledWith({ sessionToken: 'tok', gameId: 'chess', summary: 'Mia beat Dad at Chess' });
    expect(result.current.shareState).toBe('shared');
  });

  test('a rejected or failed post shows as failed', async () => {
    postLocalMatch.mockResolvedValueOnce({ error: 'nope' }).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => usePassAndPlay('chess', 'Chess'));
    act(() => result.current.start([DAD, MIA]));
    act(() => result.current.finishRound(round(1)));
    await act(async () => { await result.current.share!(); });
    expect(result.current.shareState).toBe('failed');
    await act(async () => { await result.current.share!(); });
    await waitFor(() => expect(result.current.shareState).toBe('failed'));
  });

  test('no share action without a signed-in player', () => {
    signedIn = false;
    const { result } = renderHook(() => usePassAndPlay('chess', 'Chess'));
    expect(result.current.share).toBeNull();
  });
});
