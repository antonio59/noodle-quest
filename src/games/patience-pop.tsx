import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { GameProps } from '@/types';
import { scaleFromLast } from '@/lib/endless-stage';
import { GameArt } from '@/components/GameArt';

type BubbleState = 'waiting' | 'ready' | 'trap';

interface Bubble {
  id: number;
  x: number;
  size: number;
  state: BubbleState;
  pos: number;
  speed: number;
  popping: boolean;
  popFeedback: 'too-soon' | 'good' | 'trap' | null;
}

type Phase = 'ready' | 'playing' | 'done';

const CONFIG: Record<number, { spawnRate: number; duration: number; waitMin: number; waitMax: number; trapChance: number; sizeMin: number; sizeMax: number }> = {
  1: { spawnRate: 1800, duration: 25000, waitMin: 2000, waitMax: 3500, trapChance: 0, sizeMin: 65, sizeMax: 95 },
  2: { spawnRate: 1600, duration: 28000, waitMin: 1800, waitMax: 3200, trapChance: 0, sizeMin: 60, sizeMax: 90 },
  3: { spawnRate: 1500, duration: 30000, waitMin: 1500, waitMax: 3000, trapChance: 0, sizeMin: 55, sizeMax: 85 },
  4: { spawnRate: 1400, duration: 32000, waitMin: 1200, waitMax: 2800, trapChance: 0.1, sizeMin: 50, sizeMax: 80 },
  5: { spawnRate: 1300, duration: 33000, waitMin: 1000, waitMax: 2500, trapChance: 0.15, sizeMin: 48, sizeMax: 78 },
  6: { spawnRate: 1200, duration: 35000, waitMin: 900, waitMax: 2200, trapChance: 0.2, sizeMin: 45, sizeMax: 75 },
  7: { spawnRate: 1100, duration: 36000, waitMin: 800, waitMax: 2000, trapChance: 0.25, sizeMin: 42, sizeMax: 72 },
  8: { spawnRate: 1000, duration: 38000, waitMin: 700, waitMax: 1800, trapChance: 0.3, sizeMin: 40, sizeMax: 70 },
  9: { spawnRate: 900, duration: 40000, waitMin: 600, waitMax: 1600, trapChance: 0.35, sizeMin: 38, sizeMax: 68 },
  10: { spawnRate: 800, duration: 45000, waitMin: 500, waitMax: 1400, trapChance: 0.4, sizeMin: 35, sizeMax: 65 },
};

const POP_FEEDBACKS = ["Perfect patience! 🌟", "Great timing! ⏰", "You waited! 💪"];

let bubbleIdCounter = 0;

function PatiencePopGame({ stage, onScore, onProgress, onEnd }: GameProps) {
  const config = useMemo(() => scaleFromLast(stage, CONFIG, {
    spawnRate: -0.15, duration: 0.1, waitMin: -0.15, waitMax: -0.15, trapChance: 0.1, sizeMin: -0.1, sizeMax: -0.1,
  }, {
    spawnRate: 400, duration: 70000, waitMin: 200, waitMax: 600, trapChance: 0.8, sizeMin: 20, sizeMax: 45,
  }), [stage]);
  const [phase, setPhase] = useState<Phase>('ready');
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [score, setScore] = useState(0);
  const [popped, setPopped] = useState(0);
  const [missed, setMissed] = useState(0);
  const [feedback, setFeedback] = useState('Wait for GREEN! 💚');
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const gameActiveRef = useRef(false);
  const scoreRef = useRef(0);
  const poppedRef = useRef(0);
  const missedRef = useRef(0);

  const spawnBubble = useCallback(() => {
    if (!gameActiveRef.current || !gameAreaRef.current) return;

    const size = config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin);
    const maxX = Math.max(50, gameAreaRef.current.clientWidth - size);
    const x = Math.random() * maxX;
    const id = ++bubbleIdCounter;
    const speed = 1.2 + (stage * 0.3);

    const bubble: Bubble = { id, x, size, state: 'waiting', pos: -size, speed, popping: false, popFeedback: null };
    setBubbles(prev => [...prev, bubble]);

    const waitTime = config.waitMin + Math.random() * (config.waitMax - config.waitMin);
    const isTrap = Math.random() < config.trapChance;

    setTimeout(() => {
      setBubbles(prev => prev.map(b =>
        b.id === id ? { ...b, state: isTrap ? 'trap' : 'ready' } : b
      ));
    }, waitTime);
  }, [config, stage]);

  const handleBubblePop = useCallback((bubble: Bubble) => {
    if (!gameActiveRef.current || bubble.popping) return;

    const newState = bubble.state;

    if (newState === 'waiting') {
      missedRef.current++;
      setMissed(missedRef.current);
      scoreRef.current = Math.max(0, scoreRef.current - 5);
      setScore(scoreRef.current);
      setBubbles(prev => prev.map(b =>
        b.id === bubble.id ? { ...b, popping: true, popFeedback: 'too-soon' } : b
      ));
      setFeedback('⏳ Too soon! Wait for it to turn green.');
      setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== bubble.id)), 100);
    } else if (newState === 'ready') {
      poppedRef.current++;
      setPopped(poppedRef.current);
      scoreRef.current += 15;
      setScore(scoreRef.current);
      onScore(15);
      setBubbles(prev => prev.map(b =>
        b.id === bubble.id ? { ...b, popping: true, popFeedback: 'good' } : b
      ));

      if (poppedRef.current % 3 === 0) {
        setFeedback(POP_FEEDBACKS[Math.floor(Math.random() * POP_FEEDBACKS.length)]);
      } else {
        setFeedback('Nice pop! +15 💚');
      }
      setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== bubble.id)), 200);
    } else if (newState === 'trap') {
      missedRef.current++;
      setMissed(missedRef.current);
      scoreRef.current = Math.max(0, scoreRef.current - 10);
      setScore(scoreRef.current);
      setBubbles(prev => prev.map(b =>
        b.id === bubble.id ? { ...b, popping: true, popFeedback: 'trap' } : b
      ));
      setFeedback('🚫 That was a trap! Red = danger!');
      setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== bubble.id)), 300);
    }
  }, [onScore]);

  const startGame = useCallback(() => {
    setPhase('playing');
    gameActiveRef.current = true;
    scoreRef.current = 0;
    poppedRef.current = 0;
    missedRef.current = 0;
    setScore(0);
    setPopped(0);
    setMissed(0);
    setBubbles([]);
    setFeedback('Wait for GREEN! 💚');
  }, []);

  const handleStart = useCallback(() => {
    startGame();
  }, [startGame]);

  useEffect(() => {
    if (phase !== 'playing') return;

    gameActiveRef.current = true;

    const spawnTimer = setInterval(spawnBubble, config.spawnRate);
    const startedAt = Date.now();
    const progressTimer = setInterval(() => {
      if (gameActiveRef.current) {
        const elapsed = (Date.now() - startedAt) / config.duration;
        onProgress(Math.min(elapsed, 1));
      }
    }, 250);

    const gameTimer = setTimeout(() => {
      gameActiveRef.current = false;
      clearInterval(spawnTimer);
      clearInterval(progressTimer);

      const total = poppedRef.current + missedRef.current;
      const accuracy = total > 0 ? poppedRef.current / total : 0;
      const stars = accuracy > 0.75 ? 3 : accuracy > 0.5 ? 2 : 1;

      let summary = `You popped ${poppedRef.current} bubbles! `;
      if (accuracy > 0.75) summary += "Amazing patience! You're learning to wait for the right moment! 🌟";
      else if (accuracy > 0.5) summary += 'Good job! Remember: waiting for green = more points!';
      else summary += 'Keep practicing! The secret is patience — wait for the green glow!';

      setPhase('done');
      onEnd({ score: scoreRef.current, stars, summary });
    }, config.duration);

    return () => {
      gameActiveRef.current = false;
      clearInterval(spawnTimer);
      clearInterval(progressTimer);
      clearTimeout(gameTimer);
    };
  }, [phase, config, spawnBubble, onProgress, onEnd]);

  // Animate bubble positions
  useEffect(() => {
    if (phase !== 'playing') return;

    const animFrame = () => {
      setBubbles(prev => {
        const updated = prev.map(b => ({
          ...b,
          pos: b.pos + b.speed,
        }));

        updated.forEach(b => {
          if (gameAreaRef.current && b.pos > gameAreaRef.current.clientHeight + b.size && !b.popping) {
            if (b.state === 'ready') {
              missedRef.current++;
              setMissed(missedRef.current);
            }
          }
        });

        return updated.filter(b => {
          if (gameAreaRef.current && b.pos > gameAreaRef.current.clientHeight + b.size) {
            return false;
          }
          return true;
        });
      });
    };

    const interval = setInterval(animFrame, 16);
    return () => clearInterval(interval);
  }, [phase]);

  if (phase === 'ready') {
    return (
      <div className="flex flex-col h-full min-h-[350px] items-center justify-center gap-4">
        <GameArt gameId="patience-pop" emoji="🫧" size={80} />
        <h2 className="text-xl font-bold text-text">Patience Pop</h2>
        <p className="text-text-muted text-sm text-center max-w-xs">
          Bubbles will float up.<br />
          Wait until they turn <span className="text-green-400">green</span>, then pop them!<br />
          Avoid red traps.
        </p>
        <button
          onClick={handleStart}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 transition-all"
        >
          Start Game
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[350px]">
      <div className="flex justify-between items-center px-4 py-2 bg-[#1a332e] rounded-t-xl">
        <span className="text-green-400 font-bold">✓ {popped}</span>
        <span className="text-yellow-400 text-sm">Score: {score}</span>
        <span className="text-red-400 font-bold">✗ {missed}</span>
      </div>

      <div
        ref={gameAreaRef}
        className="flex-1 min-h-[280px] relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #1a332e 0%, #0f0e17 100%)' }}
      >
        {bubbles.map(bubble => {
          let bg = 'rgba(103,232,249,0.3)';
          let border = '#67e8f9';
          let shadow = 'none';

          if (bubble.state === 'ready') {
            bg = 'rgba(74,222,128,0.4)';
            border = '#4ade80';
            shadow = '0 0 20px #4ade80';
          } else if (bubble.state === 'trap') {
            bg = 'rgba(255,110,108,0.4)';
            border = '#ff6e6c';
            shadow = '0 0 20px #ff6e6c';
          }

          return (
            <div
              key={bubble.id}
              onPointerDown={() => handleBubblePop(bubble)}
              className="absolute rounded-full flex items-center justify-center select-none"
              style={{
                width: bubble.size,
                height: bubble.size,
                left: bubble.x,
                bottom: bubble.pos,
                background: bg,
                border: `3px solid ${border}`,
                boxShadow: shadow,
                fontSize: bubble.size * 0.45,
                cursor: 'pointer',
                transition: 'background 0.3s, border-color 0.3s, box-shadow 0.3s',
                transform: bubble.popping
                  ? bubble.popFeedback === 'good' ? 'scale(1.3)' : bubble.popFeedback === 'too-soon' ? 'scale(0.8)' : 'none'
                  : 'scale(1)',
                opacity: bubble.popping ? 0 : 1,
              }}
            >
              {bubble.popFeedback === 'good' ? '✨' : '🫧'}
            </div>
          );
        })}
      </div>

      <div className="text-center py-2 text-cyan-300 text-sm min-h-[24px]">{feedback}</div>
    </div>
  );
}

export default PatiencePopGame;
