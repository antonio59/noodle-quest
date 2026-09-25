import { useCallback, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '@/contexts/AuthContext';
import { playLose, playWin } from '@/lib/feedback';
import { addToTally, rotateSeats, type MatchTally } from '@/lib/pass-and-play';
import type { GameResult, LocalSeat } from '@/types';

export type ShareState = 'idle' | 'sharing' | 'shared' | 'failed';

interface RoundResult {
  /** Turn order the round was played in (seat numbers refer to this). */
  seats: LocalSeat[];
  winnerSeat: number | undefined;
}

/** Table state for one pass & play sitting: seats, rounds, tally, sharing. */
export function usePassAndPlay(gameId: string | undefined) {
  const { player } = useAuth();
  const postLocalMatch = useMutation(api.feed.postLocalMatch);

  const [seats, setSeats] = useState<LocalSeat[] | null>(null);
  const [round, setRound] = useState(0);
  const [tally, setTally] = useState<MatchTally>({});
  const [result, setResult] = useState<RoundResult | null>(null);
  const [shareState, setShareState] = useState<ShareState>('idle');

  const finishRound = useCallback((r: GameResult) => {
    if (!seats) return;
    setResult({ seats, winnerSeat: r.winnerSeat });
    setTally(t => addToTally(t, seats, r.winnerSeat));
    setShareState('idle');
    if (r.winnerSeat) playWin(); else playLose();
  }, [seats]);

  const rematch = useCallback(() => {
    setSeats(s => (s ? rotateSeats(s) : s));
    setResult(null);
    setRound(n => n + 1);
  }, []);

  const sessionToken = player?.sessionToken;
  const share = useCallback(async () => {
    if (!sessionToken || !gameId || !result) return;
    setShareState('sharing');
    try {
      const res = await postLocalMatch({
        sessionToken,
        gameId,
        seatNames: result.seats.map(s => s.name),
        winnerSeat: result.winnerSeat,
      });
      setShareState(res && 'postId' in res ? 'shared' : 'failed');
    } catch {
      setShareState('failed');
    }
  }, [sessionToken, gameId, result, postLocalMatch]);

  return {
    seats,
    start: setSeats,
    round,
    tally,
    result,
    finishRound,
    rematch,
    shareState,
    share: sessionToken ? share : null,
  };
}
