import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { GameProps } from '@/types';
import { scaleFromLast } from '@/lib/endless-stage';
import { GameArt } from '@/components/GameArt';

const COLORS = ['#1a332e', '#ff6e6c', '#c084fc', '#67e8f9', '#4ade80', '#fbbf24'];

type PatternType = 'rings' | 'diagonal' | 'checkerboard' | 'spiral' | 'cross' | 'random';

function generatePattern(size: number, type?: PatternType): number[][] {
  const pattern = Array.from({ length: size }, () => Array(size).fill(0));
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  const t = type ?? (['rings', 'diagonal', 'checkerboard', 'cross', 'random'] as PatternType[])[Math.floor(Math.random() * 5)];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (t === 'rings') {
        const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDist;
        pattern[y][x] = d < 0.2 ? 4 : d < 0.4 ? 3 : d < 0.6 ? 2 : d < 0.8 ? 1 : 0;
      } else if (t === 'diagonal') {
        const v = Math.floor(((x + y) / (size * 2 - 2)) * 5);
        pattern[y][x] = Math.min(4, v) + 1 > 5 ? 5 : Math.min(4, v) + 1;
      } else if (t === 'checkerboard') {
        const qx = Math.floor(x / Math.max(1, Math.floor(size / 3)));
        const qy = Math.floor(y / Math.max(1, Math.floor(size / 3)));
        pattern[y][x] = ((qx + qy) % 4) + 1;
      } else if (t === 'cross') {
        const mx = Math.abs(x - cx) / cx;
        const my = Math.abs(y - cy) / cy;
        pattern[y][x] = mx < 0.2 || my < 0.2 ? 3 : mx < 0.5 && my < 0.5 ? 2 : 1;
      } else {
        pattern[y][x] = Math.floor(Math.random() * 5) + 1;
      }
    }
  }
  return pattern;
}

const CONFIG: Record<number, { size: number; time: number }> = {
  1: { size: 5, time: 0 },
  2: { size: 6, time: 0 },
  3: { size: 7, time: 0 },
  4: { size: 8, time: 0 },
  5: { size: 8, time: 90 },
  6: { size: 10, time: 85 },
  7: { size: 10, time: 80 },
  8: { size: 12, time: 75 },
  9: { size: 12, time: 70 },
  10: { size: 14, time: 65 },
};

const TIPS = [
  '💡 Tip: Start with one color — fill all of that color first, then move on!',
  '💡 Tip: Look at the SHAPE formed by each color in the target.',
  '💡 Tip: Work from the outside in, or inside out — pick a strategy!',
  '💡 Tip: The dark color (background) is already filled in — focus on the bright colors.',
  '💡 Tip: Take your time! Accuracy matters more than speed.',
];

type Phase = 'intro' | 'playing' | 'result';

function PixelPaintGame({ stage, onScore, onProgress, onMessage, onEnd }: GameProps) {
  const config = useMemo(() => scaleFromLast(stage, CONFIG, {
    size: 0.08, time: 0.1,
  }, {
    size: 20, time: 120,
  }), [stage]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [selectedColor, setSelectedColor] = useState(1);
  const [playerGrid, setPlayerGrid] = useState<number[][]>([]);
  const [target, setTarget] = useState<number[][]>([]);
  const [timeLeft, setTimeLeft] = useState(config.time);
  const [feedback, setFeedback] = useState('');
  const [feedbackColor, setFeedbackColor] = useState('#67e8f9');
  const [animatingPixel, setAnimatingPixel] = useState<string | null>(null);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameActiveRef = useRef(false);

  const startGame = useCallback(() => {
    const t = generatePattern(config.size);
    setTarget(t);
    setPlayerGrid(Array.from({ length: config.size }, () => Array(config.size).fill(0)));
    setSelectedColor(1);
    setTimeLeft(config.time);
    setFeedback('');
    setPhase('playing');
    gameActiveRef.current = true;
  }, [config.size, config.time]);

  useEffect(() => {
    if (phase !== 'playing' || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const canvasSize = 100;
    const cellSize = canvasSize / config.size;
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    target.forEach((row, y) => {
      row.forEach((color, x) => {
        ctx.fillStyle = COLORS[color];
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      });
    });
  }, [phase, target, config.size]);

  useEffect(() => {
    if (phase !== 'playing' || config.time <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          checkArt();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
     
  }, [phase]);

  const handlePixelClick = useCallback((y: number, x: number) => {
    if (!gameActiveRef.current) return;
    setPlayerGrid(prev => {
      const next = prev.map(r => [...r]);
      next[y][x] = selectedColor;
      // Update progress based on matching pixels
      let correct = 0;
      const total = config.size * config.size;
      for (let yy = 0; yy < config.size; yy++) {
        for (let xx = 0; xx < config.size; xx++) {
          if (next[yy]?.[xx] === target[yy]?.[xx]) correct++;
        }
      }
      onProgress(correct / total);
      return next;
    });
    setAnimatingPixel(`${y}-${x}`);
    setTimeout(() => setAnimatingPixel(null), 100);
  }, [selectedColor, config.size, target, onProgress]);

  const checkArt = useCallback(() => {
    gameActiveRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);

    setPlayerGrid(current => {
      let correct = 0;
      const total = config.size * config.size;
      for (let y = 0; y < config.size; y++) {
        for (let x = 0; x < config.size; x++) {
          if (current[y]?.[x] === target[y]?.[x]) correct++;
        }
      }

      const accuracy = correct / total;
      const finalScore = Math.round(accuracy * 300);
      onScore(finalScore);
      onProgress(1);

      let stars: number, summary: string;
      if (accuracy > 0.95) {
        stars = 3;
        summary = "Pixel perfect! You're an amazing artist! Every square matched! 🌟";
      } else if (accuracy > 0.8) {
        stars = 2;
        summary = `Great job! ${Math.round(accuracy * 100)}% match! Try one color at a time for perfection.`;
      } else if (accuracy > 0.6) {
        stars = 1;
        summary = `Good start! ${Math.round(accuracy * 100)}% match. Focus on matching one color completely before moving on.`;
      } else {
        stars = 1;
        summary = `${Math.round(accuracy * 100)}% match. Tip: Compare the target closely and work on one color at a time!`;
      }

      setFeedback(`${Math.round(accuracy * 100)}% match!`);
      setFeedbackColor(accuracy > 0.8 ? '#4ade80' : '#fbbf24');
      onMessage(`${Math.round(accuracy * 100)}% match`);

      setTimeout(() => {
        onEnd({ score: finalScore, stars, summary });
      }, 1000);

      return current;
    });
  }, [config.size, target, onScore, onProgress, onMessage, onEnd]);

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-6 text-center">
        <GameArt gameId="pixel-paint" emoji="🟦" size={80} className="mb-4" />
        <h2 className="text-2xl font-bold text-accent mb-2">Pixel Paint</h2>
        <p className="text-text-dim mb-4 max-w-xs">Copy the pixel art by tapping squares!</p>

        <div className="bg-card rounded-xl p-4 mb-5 max-w-sm">
          <div className="flex gap-1.5 justify-center flex-wrap mb-3">
            {COLORS.slice(1).map((c, i) => (
              <div key={i} className="w-7 h-7 rounded-md" style={{ background: c }} />
            ))}
          </div>
          <div className="text-primary text-sm">Match the {config.size}x{config.size} grid!</div>
          {config.time > 0 ? (
            <div className="text-warning text-sm mt-1">⏱️ Time limit: {config.time} seconds</div>
          ) : (
            <div className="text-success text-sm mt-1">✓ No time limit</div>
          )}
        </div>

        <div className="bg-surface rounded-lg p-3 mb-4 max-w-xs">
          <div className="text-accent text-sm">How to play:</div>
          <div className="text-text-dim text-xs mt-1">
            1. Select a color below<br />2. Tap squares to paint<br />3. Match the target image!
          </div>
        </div>

        <p className="text-primary text-sm mb-5 max-w-xs">{tip}</p>

        <button
          onClick={startGame}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95"
        >
          Start Painting! 🎨
        </button>
      </div>
    );
  }

  const gridSize = 280;
  const pixelSize = (gridSize - 12 - (config.size - 1) * 2) / config.size;

  return (
    <div className="flex flex-col h-full min-h-[350px] items-center">
      <div className="flex gap-3 p-2 bg-card rounded-xl mb-2 items-center">
        <div className="flex flex-col items-center">
          <span className="text-primary text-xs">TARGET</span>
          <canvas
            ref={canvasRef}
            width={100}
            height={100}
            className="w-[100px] h-[100px] bg-card rounded-md border-2 border-accent"
          />
        </div>
        {config.time > 0 && (
          <span className={`font-bold ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : timeLeft <= 30 ? 'text-yellow-400' : 'text-green-400'}`}>
            ⏱️ {timeLeft}s
          </span>
        )}
      </div>

      <div
        className="grid gap-0.5 bg-bg p-1.5 rounded-lg mb-2"
        style={{
          gridTemplateColumns: `repeat(${config.size}, 1fr)`,
          width: gridSize,
          height: gridSize,
        }}
      >
        {playerGrid.map((row, y) =>
          row.map((color, x) => (
            <div
              key={`${y}-${x}`}
              onPointerDown={() => handlePixelClick(y, x)}
              className="rounded-sm cursor-pointer transition-transform duration-100"
              style={{
                width: pixelSize,
                height: pixelSize,
                background: COLORS[color],
                transform: animatingPixel === `${y}-${x}` ? 'scale(0.9)' : 'scale(1)',
              }}
            />
          ))
        )}
      </div>

      <div className="flex gap-1.5 flex-wrap justify-center mb-2">
        {COLORS.map((c, i) => (
          <button
            key={i}
            onClick={() => setSelectedColor(i)}
            className="w-9 h-9 rounded-lg cursor-pointer transition-all"
            style={{
              background: c,
              border: `3px solid ${i === selectedColor ? '#fff' : 'transparent'}`,
            }}
          />
        ))}
      </div>

      <button
        onClick={checkArt}
        className="bg-success text-bg font-bold px-6 py-2.5 rounded-xl hover:opacity-90 active:scale-95"
      >
        Check My Art! ✓
      </button>

      {feedback && (
        <div className="text-center py-1.5 text-sm" style={{ color: feedbackColor }}>
          {feedback}
        </div>
      )}
    </div>
  );
}

export default PixelPaintGame;
