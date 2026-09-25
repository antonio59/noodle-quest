import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameProps } from '@/types';
import { GameArt } from '@/components/GameArt';

interface Texture {
  name: string;
  emoji: string;
  color: string;
  bg: string;
  feel: string;
}

const ALL_TEXTURES: Record<number, Texture[]> = {
  1: [
    { name: 'Fluffy Cloud', emoji: '☁️', color: '#e0e7ff', bg: '#c7d2fe', feel: 'soft and fluffy' },
    { name: 'Warm Sand', emoji: '🏖️', color: '#fbbf24', bg: '#fde68a', feel: 'warm and grainy' },
  ],
  2: [
    { name: 'Fluffy Cloud', emoji: '☁️', color: '#e0e7ff', bg: '#c7d2fe', feel: 'soft and fluffy' },
    { name: 'Jelly Blob', emoji: '🫧', color: '#c084fc', bg: '#e9d5ff', feel: 'jiggly and wobbly' },
    { name: 'Slime Pool', emoji: '🟢', color: '#4ade80', bg: '#bbf7d0', feel: 'stretchy and gooey' },
  ],
  3: [
    { name: 'Warm Sand', emoji: '🏖️', color: '#fbbf24', bg: '#fde68a', feel: 'warm and grainy' },
    { name: 'Jelly Blob', emoji: '🫧', color: '#c084fc', bg: '#e9d5ff', feel: 'jiggly and wobbly' },
    { name: 'Slime Pool', emoji: '🟢', color: '#4ade80', bg: '#bbf7d0', feel: 'stretchy and gooey' },
    { name: 'Sticky Honey', emoji: '🍯', color: '#f59e0b', bg: '#fde68a', feel: 'sticky and slow' },
  ],
  4: [
    { name: 'Sticky Honey', emoji: '🍯', color: '#f59e0b', bg: '#fde68a', feel: 'sticky and slow' },
    { name: 'Cold Mud', emoji: '🟤', color: '#92400e', bg: '#d6d3d1', feel: 'cold and squishy' },
    { name: 'Pop Rocks', emoji: '💥', color: '#ef4444', bg: '#fecaca', feel: 'bubbly and fizzy' },
    { name: 'Jelly Blob', emoji: '🫧', color: '#c084fc', bg: '#e9d5ff', feel: 'jiggly and wobbly' },
  ],
  5: [
    { name: 'Pop Rocks', emoji: '💥', color: '#ef4444', bg: '#fecaca', feel: 'bubbly and fizzy' },
    { name: 'Spider Silk', emoji: '🕸️', color: '#f0a83a', bg: '#ede9fe', feel: 'thin and tickly' },
    { name: 'Mystery Goo', emoji: '🔮', color: '#8b5cf6', bg: '#ddd6fe', feel: 'unpredictable' },
    { name: 'Cold Mud', emoji: '🟤', color: '#92400e', bg: '#d6d3d1', feel: 'cold and squishy' },
  ],
  6: [
    { name: 'Spider Silk', emoji: '🕸️', color: '#f0a83a', bg: '#ede9fe', feel: 'thin and tickly' },
    { name: 'Mystery Goo', emoji: '🔮', color: '#8b5cf6', bg: '#ddd6fe', feel: 'unpredictable' },
    { name: 'Oobleck', emoji: '💧', color: '#06b6d4', bg: '#cffafe', feel: 'solid AND liquid' },
    { name: 'Magnetic Slime', emoji: '🧲', color: '#6b7280', bg: '#e5e7eb', feel: 'pulls at your fingers' },
  ],
  7: [
    { name: 'Oobleck', emoji: '💧', color: '#06b6d4', bg: '#cffafe', feel: 'solid AND liquid' },
    { name: 'Magnetic Slime', emoji: '🧲', color: '#6b7280', bg: '#e5e7eb', feel: 'pulls at your fingers' },
    { name: 'Foam Pit', emoji: '🫧', color: '#ec4899', bg: '#fbcfe8', feel: 'light and everywhere' },
    { name: 'Cactus Gel', emoji: '🌵', color: '#22c55e', bg: '#dcfce7', feel: 'tingly and cool' },
    { name: 'Mystery Goo', emoji: '🔮', color: '#8b5cf6', bg: '#ddd6fe', feel: 'unpredictable' },
  ],
  8: [
    { name: 'Foam Pit', emoji: '🫧', color: '#ec4899', bg: '#fbcfe8', feel: 'light and everywhere' },
    { name: 'Cactus Gel', emoji: '🌵', color: '#22c55e', bg: '#dcfce7', feel: 'tingly and cool' },
    { name: 'Brain Jello', emoji: '🧠', color: '#f472b6', bg: '#fce7f3', feel: 'wobbly like a brain' },
    { name: 'Galaxy Gunk', emoji: '🌌', color: '#6366f1', bg: '#e0e7ff', feel: 'thick and sparkly' },
    { name: 'Magnetic Slime', emoji: '🧲', color: '#6b7280', bg: '#e5e7eb', feel: 'pulls at your fingers' },
  ],
  9: [
    { name: 'Brain Jello', emoji: '🧠', color: '#f472b6', bg: '#fce7f3', feel: 'wobbly like a brain' },
    { name: 'Galaxy Gunk', emoji: '🌌', color: '#6366f1', bg: '#e0e7ff', feel: 'thick and sparkly' },
    { name: 'Electric Gel', emoji: '⚡', color: '#facc15', bg: '#fef9c3', feel: 'tingly and buzzy' },
    { name: 'Alien Ooze', emoji: '👽', color: '#a3e635', bg: '#ecfccb', feel: 'weirdly warm' },
    { name: 'Cactus Gel', emoji: '🌵', color: '#22c55e', bg: '#dcfce7', feel: 'tingly and cool' },
  ],
  10: [
    { name: 'Brain Jello', emoji: '🧠', color: '#f472b6', bg: '#fce7f3', feel: 'wobbly like a brain' },
    { name: 'Galaxy Gunk', emoji: '🌌', color: '#6366f1', bg: '#e0e7ff', feel: 'thick and sparkly' },
    { name: 'Electric Gel', emoji: '⚡', color: '#facc15', bg: '#fef9c3', feel: 'tingly and buzzy' },
    { name: 'Alien Ooze', emoji: '👽', color: '#a3e635', bg: '#ecfccb', feel: 'weirdly warm' },
    { name: 'Lava Blob', emoji: '🌋', color: '#dc2626', bg: '#fecaca', feel: 'warm and gloopy' },
    { name: 'Time Slime', emoji: '⏰', color: '#0891b2', bg: '#cffafe', feel: 'changes as you touch' },
  ],
};

const TIPS = [
  '💡 Tip: The weird feeling gets easier the longer you hold! Your brain adapts!',
  '💡 Tip: Take deep breaths while touching — it helps you stay calm.',
  "💡 Tip: It's okay to feel uncomfortable! That's how you build tolerance.",
  '💡 Tip: Focus on the POINTS, not the weird feeling!',
  "💡 Tip: Your brain is learning that 'weird' doesn't mean 'bad'!",
];

type Phase = 'intro' | 'playing' | 'done';

function SquishLabGame({ stage, onScore, onProgress, onMessage, onEnd }: GameProps) {
  const cycledStage = ((stage - 1) % 10) + 1;
  const items = ALL_TEXTURES[cycledStage] || ALL_TEXTURES[1];
  const [phase, setPhase] = useState<Phase>('intro');
  const [currentItem, setCurrentItem] = useState(0);
  const [holdTime, setHoldTime] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [holding, setHolding] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimeRef = useRef(0);
  const totalScoreRef = useRef(0);
  const currentItemRef = useRef(0);
  const MAX_HOLD = 10;

  const endedRef = useRef(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter(x => x !== id);
      if (!endedRef.current) fn();
    }, delay);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  const cleanup = useCallback(() => {
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    if (timerTimeoutRef.current) clearTimeout(timerTimeoutRef.current);
  }, []);

  useEffect(() => {
    endedRef.current = false;
    return () => {
      endedRef.current = true;
      timeoutsRef.current.forEach(clearTimeout);
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      if (timerTimeoutRef.current) clearTimeout(timerTimeoutRef.current);
    };
  }, []);

  const startHold = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setHolding(true);
      holdTimeRef.current = 0;
      setHoldTime(0);
      setFeedback('');

      holdIntervalRef.current = setInterval(() => {
        holdTimeRef.current += 0.1;
        setHoldTime(holdTimeRef.current);

        if (holdTimeRef.current >= 2 && holdTimeRef.current < 2.2) {
          setFeedback("Weird at first? That's normal. Keep going!");
        }
        if (holdTimeRef.current >= 5 && holdTimeRef.current < 5.2) {
          setFeedback("You're doing great! The feeling gets easier!");
        }
        if (holdTimeRef.current >= 8 && holdTimeRef.current < 8.2) {
          setFeedback('Almost maxed! Your brain is adapting! 🧠');
        }
      }, 100);
    },
    [],
  );

  const endHold = useCallback(() => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHolding(false);

    const points = Math.floor(holdTimeRef.current * 10);
    const newTotal = totalScoreRef.current + points;
    totalScoreRef.current = newTotal;
    setTotalScore(newTotal);
    onScore(newTotal);
    onProgress((currentItemRef.current + 1) / items.length);

    if (holdTimeRef.current >= 8) {
      setFeedback('🏆 Max tolerance! You\'re a squish scientist!');
      onMessage('Max tolerance achieved!');
    } else if (holdTimeRef.current >= 4) {
      setFeedback(`+${points} — Good hold! Longer = more points!`);
    } else {
      setFeedback(`+${points} — Quick touch! Try holding longer!`);
    }

    timerTimeoutRef.current = schedule(() => {
      const next = currentItemRef.current + 1;
      currentItemRef.current = next;
      setCurrentItem(next);
    }, 1500);
  }, [items.length, onScore, onProgress, onMessage, schedule]);

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-6 text-center">
        <GameArt gameId="squish-lab" emoji="🧪" size={80} className="mb-4" />
        <h2 className="text-2xl font-bold text-accent mb-2">Squish Lab</h2>
        <p className="text-text-dim mb-4 max-w-xs">
          Touch squishy experiments and hold on as long as you can!
        </p>

        <div className="bg-card rounded-xl p-4 mb-5 max-w-sm">
          <div className="text-primary text-sm mb-2">{items.length} experiments to try!</div>
          <div className="flex gap-1.5 justify-center flex-wrap">
            {items.map((item, i) => (
              <span key={i} className="text-2xl">{item.emoji}</span>
            ))}
          </div>
          <div className="text-warning text-sm mt-2">Hold longer = more points! 💪</div>
        </div>

        <div className="bg-surface rounded-lg p-2.5 mb-4 max-w-xs">
          <div className="text-success text-xs">
            Some textures feel weird — that's the challenge! 🧠
          </div>
        </div>

        <p className="text-primary text-sm mb-5 max-w-xs">{tip}</p>

        <button
          onClick={() => setPhase('playing')}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95"
        >
          Start Experiment! 🧪
        </button>
      </div>
    );
  }

  if (phase === 'done') return null;

  if (currentItem >= items.length) {
    return null;
  }

  const item = items[currentItem];
  const pct = Math.min(100, (holdTime / MAX_HOLD) * 100);
  const points = Math.floor(holdTime * 10);

  return (
    <div className="flex flex-col h-full min-h-[350px] items-center p-4">
      <div className="flex gap-4 px-4 py-2 bg-card rounded-xl mb-3">
        <span className="text-primary">
          Experiment {currentItem + 1}/{items.length}
        </span>
        <span className="text-warning">Score: {totalScore}</span>
      </div>

      <div
        className="rounded-2xl p-6 mb-4 text-center"
        style={{ background: `${item.bg}22`, border: `3px solid ${item.color}44` }}
      >
        <div
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
          className="w-[120px] h-[120px] mx-auto rounded-full flex items-center justify-center text-5xl cursor-pointer select-none transition-all duration-150"
          style={{
            background: item.bg,
            transform: holding ? 'scale(0.88)' : 'scale(1)',
            boxShadow: holding ? `0 0 30px ${item.color}` : `0 0 0 ${item.color}`,
            touchAction: 'none',
          }}
        >
          {item.emoji}
        </div>
      </div>

      <h3 className="text-lg font-bold mb-1" style={{ color: item.color }}>
        {item.name}
      </h3>
      <p className="text-text-dim text-sm mb-3">Feels: {item.feel}</p>

      <div className="bg-card rounded-lg p-3 w-full max-w-xs mb-2">
        <p className="text-primary text-xs mb-1.5">Hold your finger on it!</p>
        <div className="bg-surface rounded-md h-3.5 overflow-hidden">
          <div
            className="h-full rounded-md transition-all duration-100"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${item.color}, #4ade80)`,
            }}
          />
        </div>
        <p className="text-warning text-sm mt-1.5">+{points} points</p>
      </div>

      <div className="text-text-dim text-xs min-h-[22px] text-center">{feedback}</div>
    </div>
  );
}

export default SquishLabGame;
