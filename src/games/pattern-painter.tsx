import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameProps } from '@/types';
import { GameArt } from '@/components/GameArt';

interface ShapeDef {
  type: string;
  name: string;
  tolerance: number;
}

const SHAPES_BY_STAGE: Record<number, ShapeDef[]> = {
  1: [
    { type: 'circle', name: 'Circle', tolerance: 35 },
    { type: 'square', name: 'Square', tolerance: 35 },
  ],
  2: [
    { type: 'circle', name: 'Circle', tolerance: 32 },
    { type: 'square', name: 'Square', tolerance: 32 },
    { type: 'triangle', name: 'Triangle', tolerance: 32 },
  ],
  3: [
    { type: 'star', name: 'Star', tolerance: 30 },
    { type: 'diamond', name: 'Diamond', tolerance: 30 },
  ],
  4: [
    { type: 'star', name: 'Star', tolerance: 28 },
    { type: 'spiral', name: 'Spiral', tolerance: 28 },
  ],
  5: [
    { type: 'heart', name: 'Heart', tolerance: 26 },
    { type: 'spiral', name: 'Spiral', tolerance: 26 },
  ],
  6: [
    { type: 'heart', name: 'Heart', tolerance: 24 },
    { type: 'infinity', name: 'Infinity', tolerance: 24 },
    { type: 'star', name: 'Star', tolerance: 24 },
  ],
  7: [
    { type: 'heart', name: 'Heart', tolerance: 22 },
    { type: 'infinity', name: 'Infinity', tolerance: 22 },
    { type: 'flower', name: 'Flower', tolerance: 22 },
  ],
  8: [
    { type: 'flower', name: 'Flower', tolerance: 20 },
    { type: 'infinity', name: 'Infinity', tolerance: 20 },
    { type: 'wave', name: 'Wave', tolerance: 20 },
  ],
  9: [
    { type: 'flower', name: 'Flower', tolerance: 18 },
    { type: 'wave', name: 'Wave', tolerance: 18 },
    { type: 'zigzag', name: 'Zigzag', tolerance: 18 },
  ],
  10: [
    { type: 'heart', name: 'Heart', tolerance: 16 },
    { type: 'flower', name: 'Flower', tolerance: 16 },
    { type: 'infinity', name: 'Infinity', tolerance: 16 },
    { type: 'zigzag', name: 'Zigzag', tolerance: 16 },
  ],
};

const TIPS = [
  '💡 Tip: Focus on TWO DOTS at a time — connect them, then move to the next pair!',
  '💡 Tip: Go SLOW! Accuracy beats speed. Follow the dotted path carefully.',
  '💡 Tip: Start at any gold dot and trace around the whole shape.',
  '💡 Tip: Keep your finger/mouse ON the dotted line as much as possible.',
  '💡 Tip: If you mess up, tap CLEAR and try again — practice makes perfect!',
];

interface Point {
  x: number;
  y: number;
}

function getShapePoints(type: string, cx: number, cy: number, size: number): Point[] {
  const pts: Point[] = [];

  if (type === 'circle') {
    for (let i = 0; i <= 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(angle) * size, y: cy + Math.sin(angle) * size });
    }
  } else if (type === 'square') {
    const s = size * 0.8;
    for (let i = 0; i <= 20; i++) pts.push({ x: cx - s + (i / 20) * s * 2, y: cy - s });
    for (let i = 0; i <= 20; i++) pts.push({ x: cx + s, y: cy - s + (i / 20) * s * 2 });
    for (let i = 0; i <= 20; i++) pts.push({ x: cx + s - (i / 20) * s * 2, y: cy + s });
    for (let i = 0; i <= 20; i++) pts.push({ x: cx - s, y: cy + s - (i / 20) * s * 2 });
  } else if (type === 'triangle') {
    const h = size * 0.9;
    for (let i = 0; i <= 25; i++) pts.push({ x: cx + (i / 25) * size, y: cy - h / 2 + (i / 25) * h });
    for (let i = 0; i <= 25; i++) pts.push({ x: cx + size - (i / 25) * size * 2, y: cy + h / 2 });
    for (let i = 0; i <= 25; i++) pts.push({ x: cx - size + (i / 25) * size, y: cy + h / 2 - (i / 25) * h });
  } else if (type === 'diamond') {
    const s = size * 0.9;
    for (let i = 0; i <= 20; i++) pts.push({ x: cx + (i / 20) * s, y: cy - s + (i / 20) * s });
    for (let i = 0; i <= 20; i++) pts.push({ x: cx + s - (i / 20) * s, y: cy + (i / 20) * s });
    for (let i = 0; i <= 20; i++) pts.push({ x: cx - (i / 20) * s, y: cy + s - (i / 20) * s });
    for (let i = 0; i <= 20; i++) pts.push({ x: cx - s + (i / 20) * s, y: cy - (i / 20) * s });
  } else if (type === 'star') {
    for (let i = 0; i <= 50; i++) {
      const angle = (i / 10) * Math.PI * 2 / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? size : size * 0.4;
      pts.push({
        x: cx + Math.cos(angle + (i / 50) * Math.PI * 2) * r,
        y: cy + Math.sin(angle + (i / 50) * Math.PI * 2) * r,
      });
    }
  } else if (type === 'spiral') {
    for (let i = 0; i <= 100; i++) {
      const angle = (i / 100) * Math.PI * 4;
      const r = (i / 100) * size;
      pts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
    }
  } else if (type === 'heart') {
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      pts.push({ x: cx + (x * size) / 16, y: cy + (y * size) / 16 });
    }
  } else if (type === 'infinity') {
    for (let i = 0; i <= 80; i++) {
      const t = (i / 80) * Math.PI * 2;
      const scale = 1 / (1 + Math.sin(t) * Math.sin(t));
      const x = Math.cos(t) * size * scale;
      const y = Math.sin(t) * Math.cos(t) * size * scale;
      pts.push({ x: cx + x, y: cy + y });
    }
  } else if (type === 'flower') {
    for (let i = 0; i <= 80; i++) {
      const angle = (i / 80) * Math.PI * 2;
      const r = size * (0.5 + 0.5 * Math.cos(angle * 6));
      pts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
    }
  } else if (type === 'wave') {
    for (let i = 0; i <= 80; i++) {
      const x = cx - size + (i / 80) * size * 2;
      const y = cy + Math.sin((i / 80) * Math.PI * 4) * size * 0.5;
      pts.push({ x, y });
    }
  } else if (type === 'zigzag') {
    const segments = 6;
    for (let i = 0; i <= segments * 10; i++) {
      const seg = Math.floor(i / 10);
      const t = (i % 10) / 10;
      const x = cx - size + (i / (segments * 10)) * size * 2;
      const y =
        cy +
        (seg % 2 === 0 ? -1 : 1) * size * 0.4 * (1 - t) +
        (seg % 2 === 0 ? 1 : -1) * size * 0.4 * t;
      pts.push({ x, y });
    }
  }

  return pts;
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pathPoints: Point[],
  drawnPoints: Point[],
) {
  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(192,132,252,0.4)';
  ctx.lineWidth = 6;
  ctx.setLineDash([10, 10]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  pathPoints.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  pathPoints.forEach((p, i) => {
    if (i % 8 === 0) {
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  if (drawnPoints.length > 1) {
    ctx.strokeStyle = '#ff6e6c';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    drawnPoints.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }
}

type Phase = 'intro' | 'playing';

function PatternPainterGame({ stage, onScore, onProgress, onMessage, onEnd }: GameProps) {
  const cycledStage = ((stage - 1) % 10) + 1;
  const shapes = SHAPES_BY_STAGE[cycledStage] || SHAPES_BY_STAGE[1];
  const toleranceMult = Math.max(0.35, 1 - (stage - 1) * 0.012);
  const [phase, setPhase] = useState<Phase>('intro');
  const [currentShape, setCurrentShape] = useState(0);
  const [drawnPoints, setDrawnPoints] = useState<Point[]>([]);
  const [tracing, setTracing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackColor, setFeedbackColor] = useState('#67e8f9');
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const [cumulativeScore, setCumulativeScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathPointsRef = useRef<Point[]>([]);
  const gameActiveRef = useRef(false);
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

  useEffect(() => {
    endedRef.current = false;
    return () => {
      endedRef.current = true;
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  const resizeAndDraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const size = Math.min(canvas.width, canvas.height) * 0.32;
    const shape = shapes[currentShape];
    if (!shape) return;
    pathPointsRef.current = getShapePoints(shape.type, cx, cy, size);
    const ctx = canvas.getContext('2d');
    if (ctx) drawScene(ctx, canvas.width, canvas.height, pathPointsRef.current, drawnPoints);
  }, [shapes, currentShape, drawnPoints]);

  useEffect(() => {
    if (phase !== 'playing') return;
    resizeAndDraw();
    window.addEventListener('resize', resizeAndDraw);
    return () => window.removeEventListener('resize', resizeAndDraw);
  }, [phase, resizeAndDraw]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;
    drawScene(ctx, canvasRef.current.width, canvasRef.current.height, pathPointsRef.current, drawnPoints);
  }, [drawnPoints, phase]);

  const getCanvasPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      setTracing(true);
      setDrawnPoints([getCanvasPoint(e)]);
      setFeedback('Keep tracing along the dotted line...');
      setFeedbackColor('#67e8f9');
    },
    [getCanvasPoint],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!tracing) return;
      e.preventDefault();
      setDrawnPoints(prev => [...prev, getCanvasPoint(e)]);
    },
    [tracing, getCanvasPoint],
  );

  const handlePointerUp = useCallback(() => {
    setTracing(false);
  }, []);

  const handleClear = useCallback(() => {
    setDrawnPoints([]);
    setFeedback('Cleared! Try again — trace the dotted line.');
    setFeedbackColor('#67e8f9');
  }, []);

  const handleDone = useCallback(() => {
    if (drawnPoints.length < 15) {
      setFeedback('✏️ Draw more! Trace along the whole shape.');
      setFeedbackColor('#fbbf24');
      return;
    }

    const path = pathPointsRef.current;
    const shape = shapes[currentShape];
    let closePoints = 0;

    drawnPoints.forEach(p => {
      let minDist = Infinity;
      path.forEach(pp => {
        const dist = Math.hypot(p.x - pp.x, p.y - pp.y);
        minDist = Math.min(minDist, dist);
      });
      if (minDist < shape.tolerance * toleranceMult) closePoints++;
    });

    const accuracy = closePoints / drawnPoints.length;
    const shapeScore = Math.round(accuracy * 100);
    let passed = false;

    if (accuracy > 0.7) {
      passed = true;
      setCumulativeScore(prev => prev + shapeScore);
      onScore(shapeScore);
      setFeedback(`✨ Great tracing! ${shapeScore}% accuracy!`);
      setFeedbackColor('#4ade80');
    } else if (accuracy > 0.5) {
      passed = true;
      const pts = Math.round(shapeScore * 0.7);
      setCumulativeScore(prev => prev + pts);
      onScore(pts);
      setFeedback(`👍 Good effort! ${shapeScore}% — try to stay closer to the dots next time.`);
      setFeedbackColor('#fbbf24');
    } else if (accuracy > 0.3) {
      setFeedback(`💡 ${shapeScore}% — Focus on connecting the gold dots one at a time!`);
      setFeedbackColor('#fbbf24');
    } else {
      setFeedback('💡 Try following the dotted line more closely. Start at any dot and trace around!');
      setFeedbackColor('#ff6e6c');
    }

    if (passed) {
      const nextShape = currentShape + 1;
      onProgress(nextShape / shapes.length);

      if (nextShape >= shapes.length) {
        setCumulativeScore(prev => {
          const final = prev;
          const avgScore = final / shapes.length;
          const stars = avgScore > 75 ? 3 : avgScore > 50 ? 2 : 1;
          let summary = `You traced all ${shapes.length} shapes! `;
          if (stars === 3) summary += 'Beautiful work! Your hand-eye coordination is fantastic! 🌟';
          else if (stars === 2) summary += 'Good tracing! Keep practicing to get even more precise.';
          else summary += 'Nice effort! Remember: slow and steady, follow those dots!';
          onMessage('All shapes traced!');
          schedule(() => {
            if (endedRef.current) return;
            endedRef.current = true;
            onEnd({ score: final, stars, summary });
          }, 0);
          return final;
        });
      } else {
        schedule(() => {
          setCurrentShape(nextShape);
          setDrawnPoints([]);
          const name = shapes[nextShape].name;
          setFeedback(`Next shape: ${name}! Trace the dotted line.`);
          setFeedbackColor('#67e8f9');
        }, 1200);
      }
    }
  }, [drawnPoints, shapes, currentShape, onScore, onProgress, onMessage, onEnd, schedule]);

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-6 text-center">
        <GameArt gameId="pattern-painter" emoji="🎨" size={80} className="mb-4" />
        <h2 className="text-2xl font-bold text-accent mb-2">Pattern Painter</h2>
        <p className="text-text-dim mb-4 max-w-xs">Trace the dotted shapes with your finger or mouse!</p>

        <div className="bg-card rounded-xl p-4 mb-5 max-w-sm">
          <div className="text-primary text-sm mb-2">
            You'll trace {shapes.length} shape{shapes.length > 1 ? 's' : ''}:
          </div>
          <div className="flex gap-2 justify-center flex-wrap text-accent text-lg">
            {shapes.map(s => s.name).join(' → ')}
          </div>
        </div>

        <div className="bg-surface rounded-lg p-3 mb-4 max-w-xs">
          <div className="text-accent text-sm mb-1">How to trace well:</div>
          <div className="text-text-dim text-xs text-left">
            • Follow the <span className="text-accent">gold dotted line</span><br />
            • Hit the <span className="text-accent">gold dots</span> as you go<br />
            • Tap <span className="text-success">Done</span> when finished
          </div>
        </div>

        <p className="text-primary text-sm mb-5 max-w-xs">{tip}</p>

        <button
          onClick={() => { gameActiveRef.current = true; setPhase('playing'); }}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95"
        >
          Start Tracing! ✏️
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[350px]">
      <div className="flex justify-between items-center px-4 py-2 bg-card rounded-t-xl">
        <span className="text-accent font-bold">
          Draw: <span>{shapes[currentShape]?.name}</span>
        </span>
        <span className="text-primary text-sm">
          {currentShape + 1}/{shapes.length}
        </span>
      </div>

      <div ref={containerRef} className="flex-1 min-h-[250px] relative">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="w-full h-full bg-card cursor-crosshair block"
          style={{ touchAction: 'none' }}
        />
      </div>

      <div className="text-center py-1.5 text-sm min-h-[22px]" style={{ color: feedbackColor }}>
        {feedback || 'Trace the dotted line!'}
      </div>

      <div className="flex gap-3 px-3 py-2.5 justify-center bg-surface rounded-b-xl">
        <button
          onClick={handleClear}
          className="bg-text-muted text-bg font-bold px-5 py-2.5 rounded-xl hover:opacity-90 active:scale-95"
        >
          🗑️ Clear
        </button>
        <button
          onClick={handleDone}
          className="bg-success text-bg font-bold px-5 py-2.5 rounded-xl hover:opacity-90 active:scale-95"
        >
          ✓ Done!
        </button>
      </div>
    </div>
  );
}

export default PatternPainterGame;
