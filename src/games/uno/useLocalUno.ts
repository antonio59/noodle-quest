// State for pass & play UNO: the pure table rules plus the bits a shared
// device needs — the between-turns curtain, wild colour choice, and telling
// play.tsx who won exactly once.
import { useRef, useState } from 'react';
import type { GameProps, LocalSeat } from '@/types';
import { seatAt } from '@/lib/pass-and-play';
import type { UnoCard, UnoColor } from './logic';
import { advance, beginMatch, drawCard, playCard, type LocalUnoState, type TurnOutcome } from './local-rules';

const canAct = (s: LocalUnoState) => !s.curtain && !s.pendingWild && !s.winner;

export function useLocalUno(seats: readonly LocalSeat[], onEnd: GameProps['onEnd']) {
  const names = [seatAt(seats, 1).name, seatAt(seats, 2).name] as const;
  const [state, setState] = useState<LocalUnoState>(() => beginMatch(names));
  const endedRef = useRef(false);

  const commit = (outcome: TurnOutcome | null) => {
    if (!outcome) {
      setState(s => ({ ...s, message: "Can't play that card!" }));
      return;
    }
    const next = advance(state, outcome, names);
    setState(next);
    if (next.winner && !endedRef.current) {
      endedRef.current = true;
      onEnd({ score: 0, stars: 0, summary: `${names[next.winner - 1]} wins!`, winnerSeat: next.winner });
    }
  };

  const play = (card: UnoCard) => {
    if (!canAct(state)) return;
    if (card.type === 'wild' || card.type === 'wild4') {
      setState(s => ({ ...s, pendingWild: card, message: 'Choose a color!' }));
      return;
    }
    commit(playCard(state.table, card.id));
  };

  const chooseColor = (color: UnoColor) => {
    if (!state.pendingWild || state.winner) return;
    commit(playCard(state.table, state.pendingWild.id, color));
  };

  const draw = () => {
    if (canAct(state)) commit(drawCard(state.table));
  };

  const reveal = () => setState(s => ({ ...s, curtain: null }));

  return { state, play, chooseColor, draw, reveal };
}
