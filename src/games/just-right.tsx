import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { GameProps } from '@/types';
import { scaleFromLast } from '@/lib/endless-stage';
import { GameArt } from '@/components/GameArt';

const CONFIG: Record<number, { target: number; time: number; tolerance: number }> = {
  1: { target: 5, time: 0, tolerance: 2 },
  2: { target: 7, time: 0, tolerance: 2 },
  3: { target: 10, time: 0, tolerance: 2 },
  4: { target: 12, time: 0, tolerance: 3 },
  5: { target: 15, time: 45, tolerance: 3 },
  6: { target: 18, time: 40, tolerance: 3 },
  7: { target: 20, time: 35, tolerance: 3 },
  8: { target: 22, time: 30, tolerance: 4 },
  9: { target: 25, time: 28, tolerance: 4 },
  10: { target: 30, time: 25, tolerance: 4 },
};

const colors = ['#ff6e6c', '#c084fc', '#67e8f9', '#4ade80', '#fbbf24', '#f472b6'];

const tips = [
  '💡 Tip: Count out loud as you splat! It helps you keep track.',
  "💡 Tip: The target is a RANGE — you don't need to be exact!",
  '💡 Tip: Stopping at the right time is the skill — not going as fast as possible!',
  '💡 Tip: Take a breath before pressing STOP. Is it enough? Too much?',
  '💡 Tip: Trust your gut! When it FEELS right, stop!',
];

type Phase = 'intro' | 'playing' | 'done';

interface SplatterData {
  x: number;
  y: number;
  color: string;
  size: number;
  drops: { angle: number; dist: number; dropSize: number }[];
}

function JustRightGame({ stage, onScore, onProgress, onEnd }: GameProps) {
  const config = useMemo(() => scaleFromLast(stage, CONFIG, {
    target: 0.1, time: 0.1, tolerance: 0.05,
  }, {
    target: 50, time: 45, tolerance: 6,
  }), [stage]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [splatters, setSplatters] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.time);
  const [feedback, setFeedback] = useState('');
  const [feedbackColor, setFeedbackColor] = useState('#67e8f9');
  const [tip] = useState(() => tips[Math.floor(Math.random() * tips.length)]);
  const [splatterData, setSplatterData] = useState<SplatterData[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreRef = useRef(0);
  const splattersRef = useRef(0);

  const minTarget = Math.max(1, config.target - config.tolerance);
  const maxTarget = config.target + config.tolerance;

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const endGame = useCallback((stopped: boolean) => {
    cleanup();
    const finalSplatters = splattersRef.current;
    const diff = Math.abs(finalSplatters - config.target);
    let stars: number;
    let message: string;
    let bonus = 0;

    if (diff <= 1) {
      stars = 3;
      message = `Perfect! ${finalSplatters} splatters is JUST RIGHT! You nailed it! 🌟`;
      bonus = 100;
    } else if (diff <= config.tolerance) {
      stars = 2;
      message = `Great job! ${finalSplatters} splatters (target was ${config.target}). Very close! 👍`;
      bonus = 60;
    } else if (diff <= config.tolerance + 2) {
      stars = 1;
      message = `${finalSplatters} splatters, target was ${config.target}. Almost there! Keep practicing that stopping power!`;
      bonus = 30;
    } else {
      stars = 1;
      message = stopped
        ? `${finalSplatters} splatters... target was ${config.target}. Try counting as you go!`
        : `Too many splatters! Target was ${config.target}. Remember: knowing when to stop is the skill!`;
    }

    onEnd({ score: scoreRef.current + bonus, stars, summary: message });
  }, [config, cleanup, onEnd]);

  const splatter = useCallback(() => {
    if (phase !== 'playing') return;

    const newCount = splattersRef.current + 1;
    splattersRef.current = newCount;
    setSplatters(newCount);
    scoreRef.current += 5;
    onScore(5);
    onProgress(Math.min(newCount / config.target, 1));

    const canvas = canvasRef.current;
    if (!canvas) return;

    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 25 + Math.random() * 45;
    const drops = Array.from({ length: 8 }, (_, i) => ({
      angle: (i / 8) * Math.PI * 2 + Math.random() * 0.5,
      dist: Math.random() * size,
      dropSize: 4 + Math.random() * 12,
    }));

    setSplatterData(prev => [...prev, { x, y, color, size, drops }]);

    const diff = newCount - config.target;
    if (diff >= -config.tolerance && diff <= config.tolerance) {
      setFeedback("✨ Looking good! You're in the sweet spot!");
      setFeedbackColor('#4ade80');
    } else if (diff < -config.tolerance) {
      setFeedback(`Keep going... ${config.target - newCount} more to target`);
      setFeedbackColor('#67e8f9');
    } else {
      setFeedback('⚠️ Getting a bit much... maybe stop?');
      setFeedbackColor('#fbbf24');
    }

    if (stage >= 8 && newCount > config.target + config.tolerance + 3) {
      endGame(false);
    }
  }, [phase, config, stage, onScore, onProgress, endGame]);

  // Draw splatters on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || splatterData.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const latest = splatterData[splatterData.length - 1];
    ctx.fillStyle = latest.color;
    ctx.globalAlpha = 0.75;

    latest.drops.forEach(d => {
      ctx.beginPath();
      ctx.arc(
        latest.x + Math.cos(d.angle) * d.dist,
        latest.y + Math.sin(d.angle) * d.dist,
        d.dropSize, 0, Math.PI * 2
      );
      ctx.fill();
    });

    ctx.beginPath();
    ctx.arc(latest.x, latest.y, latest.size * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }, [splatterData]);

  // Timer
  useEffect(() => {
    if (phase !== 'playing' || config.time <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          cleanup();
          endGame(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return cleanup;
  }, [phase, config.time, cleanup, endGame]);

  // Resize canvas
  useEffect(() => {
    if (phase !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [phase]);

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-5 text-center">
        <GameArt gameId="just-right" emoji="🎨" size={80} className="mb-4" />
        <h2 className="text-2xl font-bold text-[#c084fc] mb-2">Just Right</h2>
        <p className="text-[#f0a83a] mb-4 max-w-xs">Splatter paint, then stop when you have JUST the right amount!</p>
        <div className="bg-[#1a332e] rounded-xl p-4 mb-5 max-w-xs">
          <div className="text-3xl mb-2">🎯 Target: {config.target}</div>
          <div className="text-[#4ade80] text-base">Sweet spot: {minTarget} - {maxTarget} splatters</div>
          {config.time > 0 && <div className="text-[#fbbf24] mt-2">⏱️ Time limit: {config.time} seconds</div>}
        </div>
        <div className="bg-[#1a1833] rounded-lg p-3 mb-4 max-w-xs">
          <div className="text-[#67e8f9] text-sm">How to play:</div>
          <div className="text-[#f0a83a] text-sm mt-1">1. Tap SPLAT to add paint 🎨</div>
          <div className="text-[#f0a83a] text-sm">2. Tap STOP when you&apos;re close to {config.target} ✋</div>
        </div>
        <p className="text-[#67e8f9] text-sm mb-5 max-w-xs">{tip}</p>
        <button
          onClick={() => {
            splattersRef.current = 0;
            scoreRef.current = 0;
            setSplatters(0);
            setSplatterData([]);
            setFeedback('');
            setFeedbackColor('#67e8f9');
            if (config.time > 0) setTimeLeft(config.time);
            setPhase('playing');
          }}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95"
        >
          Start Painting! 🎨
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[350px]">
      <div className="flex justify-between items-center px-4 py-2 bg-[#1a332e] rounded-t-xl">
        <span className="text-[#c084fc] font-bold">Splatters: {splatters}</span>
        <span className="text-[#4ade80] text-sm">Target: {minTarget}-{maxTarget}</span>
        {config.time > 0 && (
          <span className="text-[#ff6e6c] font-bold">
            ⏱️ <span style={{ color: timeLeft <= 5 ? '#ff6e6c' : '#ff6e6c', animation: timeLeft <= 5 ? 'pulse 0.5s infinite' : 'none' }}>{timeLeft}</span>
          </span>
        )}
      </div>
      <div className="flex-1 min-h-[200px] relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full bg-[#1a332e] block"
        />
      </div>
      <div className="text-center py-1 text-sm" style={{ color: feedbackColor }}>
        {feedback}
      </div>
      {phase === 'playing' && (
        <div className="flex gap-3 p-3 justify-center bg-[#1a1833] rounded-b-xl">
          <button
            onPointerDown={splatter}
            className="bg-[#ff6e6c] text-white font-bold text-lg px-6 py-3 rounded-xl hover:opacity-90 active:scale-95"
          >
            🎨 SPLAT!
          </button>
          <button
            onPointerDown={() => endGame(true)}
            className="bg-[#4ade80] text-white font-bold text-lg px-6 py-3 rounded-xl hover:opacity-90 active:scale-95"
          >
            ✋ STOP!
          </button>
        </div>
      )}
    </div>
  );
}

export default JustRightGame;
