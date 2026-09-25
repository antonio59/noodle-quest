// Pass & play for Scrabble: every rack belongs to a person sharing this
// device. Between turns the play area sits behind a curtain so the next
// player can take the device without seeing anyone else's tiles.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameResult, LocalSeat } from '@/types';
import { seatAt } from '@/lib/pass-and-play';
import { PassDeviceCurtain } from '@/components/pass-and-play/PassDeviceCurtain';

/** Beat between the last word landing and play.tsx's result screen. */
const END_DELAY_MS = 800;

/** Seat name for a 0-indexed Scrabble seat. */
export function localSeatName(seats: readonly LocalSeat[], seat: number): string {
  return seatAt(seats, seat + 1).name;
}

/** Score-chip label, e.g. "🦊 Mia". */
export function localSeatBadge(seats: readonly LocalSeat[], seat: number): string {
  const { avatar, name } = seatAt(seats, seat + 1);
  return `${avatar} ${name}`;
}

export function localIntro(maxRounds: number): string {
  return `Take turns on this device — highest score after ${maxRounds} rounds wins. Racks stay hidden between turns.`;
}

/** What the next player sees on the curtain: the last move, then the table. */
export function turnRecap(seats: readonly LocalSeat[], lastMove: string, scores: readonly number[]): string | undefined {
  if (!lastMove) return undefined;
  const table = scores.map((s, i) => `${localSeatName(seats, i)} ${s}`).join(', ');
  return `${lastMove} · scores ${table}`;
}

/** Highest score wins; a shared top score is a draw (winnerSeat 0). */
export function localResult(seats: readonly LocalSeat[], scores: readonly number[]): GameResult {
  const best = Math.max(...scores);
  const leaders = scores.flatMap((s, i) => (s === best ? [i] : []));
  if (leaders.length > 1) {
    const names = leaders.map(i => localSeatName(seats, i)).join(' & ');
    return { score: 0, stars: 0, summary: `It's a tie — ${names} on ${best} points!`, winnerSeat: 0 };
  }
  const winner = localSeatName(seats, leaders[0]);
  return { score: 0, stars: 0, summary: `${winner} wins with ${best} points!`, winnerSeat: leaders[0] + 1 };
}

interface LocalTurnsOptions {
  enabled: boolean;
  seats: readonly LocalSeat[];
  /** Changes whenever the turn passes, e.g. `${round}:${seat}`. */
  turnKey: string;
  onEnd: (result: GameResult) => void;
}

/**
 * Curtain + end-of-game state for pass & play. The hand is only visible
 * once the current seat has tapped "show me" for this exact turn, so any
 * turn change (play or pass) re-covers the device automatically.
 */
export function useLocalTurns({ enabled, seats, turnKey, onEnd }: LocalTurnsOptions) {
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const endedRef = useRef(false);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
  }, []);

  const reveal = useCallback(() => setRevealedKey(turnKey), [turnKey]);

  const finish = useCallback((finalScores: number[]) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setOver(true);
    endTimerRef.current = setTimeout(() => onEnd(localResult(seats, finalScores)), END_DELAY_MS);
  }, [seats, onEnd]);

  return {
    showCurtain: enabled && !over && revealedKey !== turnKey,
    handVisible: !enabled || (!over && revealedKey === turnKey),
    reveal,
    finish,
  };
}

interface LocalCurtainProps {
  seats: readonly LocalSeat[];
  /** 0-indexed seat about to play. */
  seat: number;
  lastMove: string;
  scores: readonly number[];
  onReady: () => void;
}

export function LocalCurtain({ seats, seat, lastMove, scores, onReady }: LocalCurtainProps) {
  return (
    <PassDeviceCurtain
      seat={seatAt(seats, seat + 1)}
      recap={turnRecap(seats, lastMove, scores)}
      onReady={onReady}
    />
  );
}
