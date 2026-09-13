import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { GameProps } from '@/types';
import { scaleFromLast } from '@/lib/endless-stage';

const EMOJI_SETS = [
  ['🦄','🚀','🌈','🍕','🐙','🎸','🌺','🎨','🦋','🍦','🎪','🌟','🎯','🐶','🌻'],
  ['🦁','🐯','🦊','🐺','🐸','🐧','🦜','🐬','🦈','🦕','🐉','🦋','🐝','🦔','🦦'],
  ['🍎','🍊','🍋','🍇','🍓','🥝','🍑','🥭','🍒','🍍','🥥','🍌','🍉','🫐','🍈'],
];

const CONFIG: Record<number, { pairs: number; cols: number; time: number }> = {
  1:  { pairs: 3,  cols: 3, time: 0   },
  2:  { pairs: 4,  cols: 4, time: 0   },
  3:  { pairs: 6,  cols: 4, time: 0   },
  4:  { pairs: 8,  cols: 4, time: 0   },
  5:  { pairs: 8,  cols: 4, time: 120 },
  6:  { pairs: 10, cols: 5, time: 110 },
  7:  { pairs: 10, cols: 5, time: 100 },
  8:  { pairs: 12, cols: 6, time: 95  },
  9:  { pairs: 12, cols: 6, time: 85  },
  10: { pairs: 15, cols: 6, time: 80  },
};

type Phase = 'playing' | 'done';

interface Card {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
  justMatched: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function MemoryMatchGame({ stage, onScore, onProgress, onEnd }: GameProps) {
  const config = useMemo(() => scaleFromLast(stage, CONFIG, {
    pairs: 0.1, cols: 0.05, time: 0.1,
  }, {
    pairs: 24, cols: 8, time: 120,
  }), [stage]);

  const [phase, setPhase] = useState<Phase>('playing');
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matched, setMatched] = useState(0);
  const [moves, setMoves] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.time);
  const [feedback, setFeedback] = useState('');
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [wrongFlash, setWrongFlash] = useState(false);

  const checkingRef = useRef(false);
  const matchedRef = useRef(matched);
  const movesRef = useRef(moves);
  const scoreRef = useRef(score);
  const streakRef = useRef(streak);
  const timeLeftRef = useRef(timeLeft);
  useEffect(() => { matchedRef.current = matched; }, [matched]);
  useEffect(() => { movesRef.current = moves; }, [moves]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { streakRef.current = streak; }, [streak]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  useEffect(() => {
    if (phase !== 'playing' || config.time <= 0) return;
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(id);
          finishGame(false, matchedRef.current, movesRef.current, scoreRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, config.time]);

  const emojiSet = useMemo(() => EMOJI_SETS[Math.floor(Math.random() * EMOJI_SETS.length)], []);

  const startGame = useCallback(() => {
    const deck: Card[] = [];
    for (let i = 0; i < config.pairs; i++) {
      const emoji = emojiSet[i % emojiSet.length];
      deck.push({ id: i * 2,     emoji, flipped: false, matched: false, justMatched: false });
      deck.push({ id: i * 2 + 1, emoji, flipped: false, matched: false, justMatched: false });
    }
    setCards(shuffle(deck));
    setFlippedIndices([]);
    setMatched(0);
    setMoves(0);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setTimeLeft(config.time);
    setFeedback('');
    setPhase('playing');
  }, [config, emojiSet]);

  useEffect(() => { startGame(); }, [startGame]);

  function finishGame(won: boolean, finalMatched: number, finalMoves: number, finalScore: number) {
    setPhase('done');
    const efficiency = config.pairs > 0 ? finalMoves / config.pairs : 99;
    let stars: number;
    let summary: string;

    if (won) {
      if (efficiency < 1.4) {
        stars = 3;
        summary = `Amazing memory! All ${config.pairs} pairs in just ${finalMoves} moves! Your brain is incredible! 🌟`;
      } else if (efficiency < 2) {
        stars = 2;
        summary = `Great job! ${finalMoves} moves for ${config.pairs} pairs. Try to remember positions for fewer moves!`;
      } else {
        stars = 1;
        summary = `You found all pairs in ${finalMoves} moves! Focus on one row at a time to remember better.`;
      }
      const bonus = config.time > 0 ? timeLeftRef.current * 3 : 50;
      onEnd({ score: finalScore + bonus, stars, summary });
    } else {
      stars = 1;
      summary = `Time's up! You found ${finalMatched}/${config.pairs} pairs. Take a mental snapshot of each row!`;
      onEnd({ score: finalScore, stars, summary });
    }
  }

  const flipCard = useCallback((index: number) => {
    if (phase !== 'playing' || checkingRef.current) return;
    const card = cards[index];
    if (card.flipped || card.matched) return;
    if (flippedIndices.length >= 2) return;

    const newCards = [...cards];
    newCards[index] = { ...card, flipped: true };
    const newFlipped = [...flippedIndices, index];
    setCards(newCards);
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      checkingRef.current = true;
      const newMoves = moves + 1;
      setMoves(newMoves);

      const [i1, i2] = newFlipped;
      const c1 = newCards[i1];
      const c2 = newCards[i2];

      if (c1.emoji === c2.emoji) {
        setTimeout(() => {
          const updated = [...newCards];
          updated[i1] = { ...c1, matched: true, flipped: true, justMatched: true };
          updated[i2] = { ...c2, matched: true, flipped: true, justMatched: true };
          setCards(updated);

          const newMatched = matched + 1;
          const newStreak = streakRef.current + 1;
          const streakBonus = Math.min(newStreak * 10, 50);
          const newScore = score + 50 + streakBonus;

          setMatched(newMatched);
          setScore(newScore);
          setStreak(newStreak);
          setBestStreak(prev => Math.max(prev, newStreak));
          onScore(50 + streakBonus);
          onProgress(newMatched / config.pairs);

          if (newStreak >= 4) setFeedback(`🔥 ${newStreak}x Streak! +${50 + streakBonus}`);
          else if (newStreak >= 2) setFeedback(`⚡ ${newStreak}x Combo! +${50 + streakBonus}`);
          else setFeedback(`✨ Match! +${50 + streakBonus}`);

          setTimeout(() => {
            setCards(prev => prev.map(c => ({ ...c, justMatched: false })));
          }, 600);

          setFlippedIndices([]);
          checkingRef.current = false;

          if (newMatched >= config.pairs) {
            finishGame(true, newMatched, newMoves, newScore);
          }
        }, 500);
      } else {
        setTimeout(() => {
          setWrongFlash(true);
          setTimeout(() => setWrongFlash(false), 400);
          const updated = [...newCards];
          updated[i1] = { ...c1, flipped: false };
          updated[i2] = { ...c2, flipped: false };
          setCards(updated);
          setFlippedIndices([]);
          setStreak(0);
          setFeedback('💡 Not a match — remember where those are!');
          checkingRef.current = false;
        }, 800);
      }
    }
  }, [phase, cards, flippedIndices, matched, moves, score, config, onScore, onProgress, finishGame]);

  // Fluid cells: columns share the available width so 5–6 col boards fit
  // narrow phones; emoji scale with the viewport, capped for desktop.
  const fontCap = config.pairs >= 12 ? 26 : config.pairs >= 8 ? 30 : 34;
  const fontSize = `min(${fontCap}px, ${Math.round(52 / config.cols)}vw)`;

  return (
    <div className="h-full flex flex-col items-center p-3">
      <div className="flex gap-3 mb-3 bg-card rounded-xl px-4 py-2 text-sm">
        <span className="text-accent font-bold">Moves: {moves}</span>
        <span className="text-success font-bold">Pairs: {matched}/{config.pairs}</span>
        {streak >= 2 && <span className="text-orange-400 font-bold">🔥 {streak}x</span>}
        {config.time > 0 && (
          <span className={`font-bold ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : timeLeft <= 30 ? 'text-yellow-400' : 'text-text-muted'}`}>
            ⏱ {timeLeft}s
          </span>
        )}
      </div>

      <div
        className={`grid gap-1.5 p-3 bg-card rounded-xl transition-all w-full ${wrongFlash ? 'ring-2 ring-red-400/60' : ''}`}
        style={{
          gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))`,
          maxWidth: Math.min(config.cols * 64, 430),
        }}
      >
        {cards.map((card, i) => (
          <button
            key={card.id}
            onPointerDown={() => flipCard(i)}
            disabled={card.matched || card.flipped}
            className="rounded-xl flex items-center justify-center select-none transition-all duration-200 relative overflow-hidden w-full aspect-square"
            style={{
              fontSize,
              background: card.matched
                ? `linear-gradient(135deg, #4ade80, #22c55e)`
                : card.flipped
                  ? `linear-gradient(135deg, #f0a83a, #e85d4c)`
                  : `linear-gradient(135deg, #3730a3, #4c1d95)`,
              boxShadow: card.justMatched
                ? '0 0 20px #4ade80, 0 0 40px #4ade8060'
                : card.flipped
                  ? '0 0 15px #f0a83a60'
                  : '0 3px 0 rgba(0,0,0,0.4)',
              transform: card.justMatched ? 'scale(1.08)' : 'scale(1)',
              cursor: card.matched ? 'default' : 'pointer',
            }}
          >
            {card.flipped || card.matched ? card.emoji : (
              <span style={{ fontSize: '0.6em', opacity: 0.5 }}>?</span>
            )}
          </button>
        ))}
      </div>

      {feedback && (
        <div className={`text-sm mt-3 text-center font-medium ${streak >= 2 ? 'text-orange-400' : 'text-info'}`}>
          {feedback}
        </div>
      )}
    </div>
  );
}

export default MemoryMatchGame;
