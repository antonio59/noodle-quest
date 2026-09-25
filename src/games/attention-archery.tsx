import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { GameProps } from '@/types';
import { scaleFromLast } from '@/lib/endless-stage';
import { GameArt } from '@/components/GameArt';

interface ArcheryTarget {
  id: number;
  x: number;
  y: number;
  isTarget: boolean;
  color: string;
  pos: number;
  moveOffset: number;
  hit: boolean;
  hitAnim: boolean;
}

type Phase = 'ready' | 'playing' | 'done';

const CONFIG: Record<number, { spawnRate: number; duration: number; speed: number; move: boolean; decoyChance: number }> = {
  1: { spawnRate: 1800, duration: 25000, speed: 2, move: false, decoyChance: 0.3 },
  2: { spawnRate: 1600, duration: 28000, speed: 2.5, move: false, decoyChance: 0.35 },
  3: { spawnRate: 1500, duration: 30000, speed: 3, move: false, decoyChance: 0.4 },
  4: { spawnRate: 1400, duration: 32000, speed: 3.5, move: false, decoyChance: 0.4 },
  5: { spawnRate: 1300, duration: 33000, speed: 4, move: true, decoyChance: 0.4 },
  6: { spawnRate: 1200, duration: 35000, speed: 4.5, move: true, decoyChance: 0.45 },
  7: { spawnRate: 1100, duration: 36000, speed: 5, move: true, decoyChance: 0.45 },
  8: { spawnRate: 1000, duration: 38000, speed: 5.5, move: true, decoyChance: 0.5 },
  9: { spawnRate: 900, duration: 40000, speed: 6, move: true, decoyChance: 0.5 },
  10: { spawnRate: 800, duration: 45000, speed: 7, move: true, decoyChance: 0.55 },
};

const TARGET_COLORS = ['#ff6e6c', '#c084fc', '#4ade80'];
const DECOY_COLORS = ['#6b7280', '#4b5563', '#374151'];

const HIT_FEEDBACKS = ['Bullseye! 🎯', 'Sharp shooter! 🏹', 'Perfect aim! ⭐', 'Nice hit! 💫'];

let targetIdCounter = 0;

function AttentionArcheryGame({ stage, onScore, onProgress, onEnd }: GameProps) {
  const config = useMemo(() => scaleFromLast(stage, CONFIG, {
    spawnRate: -0.15, duration: 0.1, speed: 0.2, decoyChance: 0.1,
  }, {
    spawnRate: 400, duration: 70000, speed: 10, decoyChance: 0.85,
  }), [stage]);

  const [phase, setPhase] = useState<Phase>('ready');
  const [targets, setTargets] = useState<ArcheryTarget[]>([]);
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [feedback, setFeedback] = useState('Hit the glowing targets! 🎯');
  const [timeLeft, setTimeLeft] = useState(0);

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const gameActiveRef = useRef(false);
  const scoreRef = useRef(0);
  const hitsRef = useRef(0);
  const missesRef = useRef(0);
  const moveTimeRef = useRef(0);

  const spawnTarget = useCallback(() => {
    if (!gameActiveRef.current || !gameAreaRef.current) return;

    const isTarget = Math.random() > config.decoyChance;
    const colorIdx = Math.floor(Math.random() * 3);
    const color = isTarget ? TARGET_COLORS[colorIdx] : DECOY_COLORS[colorIdx];
    const maxY = Math.max(50, gameAreaRef.current.clientHeight - 70);
    const y = 10 + Math.random() * maxY;
    const id = ++targetIdCounter;

    const target: ArcheryTarget = { id, x: -50, y, isTarget, color, pos: -50, moveOffset: 0, hit: false, hitAnim: false };
    setTargets(prev => [...prev, target]);
  }, [config]);

  const handleTargetClick = useCallback((target: ArcheryTarget) => {
    if (!gameActiveRef.current || target.hit) return;

    setTargets(prev => prev.map(t =>
      t.id === target.id ? { ...t, hit: true, hitAnim: true } : t
    ));

    if (target.isTarget) {
      hitsRef.current++;
      setHits(hitsRef.current);
      scoreRef.current += 20;
      setScore(scoreRef.current);
      onScore(20);

      if (hitsRef.current % 4 === 0) {
        setFeedback(HIT_FEEDBACKS[Math.floor(Math.random() * HIT_FEEDBACKS.length)]);
      } else {
        setFeedback('+20 Hit! 🎯');
      }
    } else {
      missesRef.current++;
      setMisses(missesRef.current);
      scoreRef.current = Math.max(0, scoreRef.current - 10);
      setScore(scoreRef.current);
      setFeedback('💡 Decoy! Look for the bright colored targets.');
    }

    setTimeout(() => {
      setTargets(prev => prev.filter(t => t.id !== target.id));
    }, 200);
  }, [onScore]);

  const startGame = useCallback(() => {
    setPhase('playing');
    gameActiveRef.current = true;
    scoreRef.current = 0;
    hitsRef.current = 0;
    missesRef.current = 0;
    moveTimeRef.current = 0;
    setScore(0);
    setHits(0);
    setMisses(0);
    setTargets([]);
    setFeedback('Hit the glowing targets! 🎯');
    setTimeLeft(Math.ceil(config.duration / 1000));
  }, [config.duration]);

  useEffect(() => {
    if (phase !== 'playing') return;

    gameActiveRef.current = true;

    const spawnTimer = setInterval(spawnTarget, config.spawnRate);
    const startTime = Date.now();

    const progressTimer = setInterval(() => {
      if (gameActiveRef.current) {
        const elapsed = (Date.now() - startTime) / config.duration;
        onProgress(Math.min(elapsed, 1));
        setTimeLeft(Math.max(0, Math.ceil((config.duration - (Date.now() - startTime)) / 1000)));
      }
    }, 200);

    const gameTimer = setTimeout(() => {
      gameActiveRef.current = false;
      clearInterval(spawnTimer);
      clearInterval(progressTimer);

      const total = hitsRef.current + missesRef.current;
      const accuracy = total > 0 ? hitsRef.current / total : 0;
      const stars = accuracy > 0.7 ? 3 : accuracy > 0.45 ? 2 : 1;

      let summary = `${hitsRef.current} targets hit! `;
      if (accuracy > 0.7) summary += "You're an archery champion! Amazing focus on the right targets! 🏆";
      else if (accuracy > 0.45) summary += 'Good shooting! Remember: bright color + glow = real target!';
      else summary += 'Keep practicing! Focus on the bright GLOWING targets, ignore the dark ones.';

      setPhase('done');
      onEnd({ score: scoreRef.current, stars, summary });
    }, config.duration);

    return () => {
      gameActiveRef.current = false;
      clearInterval(spawnTimer);
      clearInterval(progressTimer);
      clearTimeout(gameTimer);
    };
  }, [phase, config, spawnTarget, onProgress, onEnd]);

  useEffect(() => {
    if (phase !== 'playing') return;

    const interval = setInterval(() => {
      moveTimeRef.current += 16;

      setTargets(prev => {
        const updated = prev.map(t => {
          const newPos = t.pos + config.speed;
          const yOffset = config.move ? Math.sin(moveTimeRef.current * 0.003) * 25 : 0;
          return { ...t, pos: newPos, moveOffset: yOffset };
        });

        if (!gameAreaRef.current) return updated;

        return updated.filter(t => {
          if (t.pos > gameAreaRef.current!.clientWidth + 50) {
            if (t.isTarget && !t.hit) {
              missesRef.current++;
              setMisses(missesRef.current);
            }
            return false;
          }
          return true;
        });
      });
    }, 16);

    return () => clearInterval(interval);
  }, [phase, config]);

  const totalDuration = Math.ceil(config.duration / 1000);
  const timerPct = timeLeft / totalDuration;
  const timerColor = timerPct > 0.5 ? '#4ade80' : timerPct > 0.25 ? '#fbbf24' : '#ff6e6c';

  if (phase === 'ready') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 p-6 text-center">
        <GameArt gameId="attention-archery" emoji="🏹" size={80} />
        <h2 className="text-2xl font-bold text-accent">Attention Archery</h2>
        <div className="bg-card rounded-2xl p-4 max-w-xs w-full space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ background: TARGET_COLORS[0], boxShadow: `0 0 12px ${TARGET_COLORS[0]}` }} />
            <span className="text-sm text-text">Bright, glowing targets = <span className="text-green-400 font-bold">HIT! +20</span></span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex-shrink-0 bg-gray-600" />
            <span className="text-sm text-text">Dark, dull decoys = <span className="text-red-400 font-bold">Avoid! -10</span></span>
          </div>
        </div>
        <div className="text-text-muted text-sm">Time limit: {Math.ceil(config.duration / 1000)}s · Stage {stage}</div>
        <button
          onClick={startGame}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 transition-all"
        >
          Start! 🏹
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[350px]">
      <div className="flex justify-between items-center px-4 py-2 bg-[#1a332e] rounded-t-xl gap-2">
        <span className="text-green-400 font-bold">🎯 {hits}</span>
        <div className="flex items-center gap-2 flex-1 mx-2">
          <div className="flex-1 h-1.5 bg-[#1a1833] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{ width: `${timerPct * 100}%`, background: timerColor, boxShadow: `0 0 6px ${timerColor}` }}
            />
          </div>
          <span className="text-xs font-bold" style={{ color: timerColor }}>{timeLeft}s</span>
        </div>
        <span className="text-yellow-400 text-sm font-bold">{score}</span>
        <span className="text-red-400 font-bold">💨 {misses}</span>
      </div>

      <div
        ref={gameAreaRef}
        className="flex-1 min-h-[280px] relative overflow-hidden"
        style={{ background: 'linear-gradient(90deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)' }}
      >
        {/* Distant forest silhouette */}
        <div className="absolute bottom-0 left-0 right-0 h-12 opacity-20"
          style={{ background: 'repeating-linear-gradient(90deg, #2d4a22 0px, #2d4a22 15px, transparent 15px, transparent 25px)' }}
        />

        {targets.map(target => (
          <div
            key={target.id}
            onPointerDown={(e) => { e.stopPropagation(); handleTargetClick(target); }}
            className="absolute rounded-full flex items-center justify-center text-lg cursor-pointer select-none"
            style={{
              width: 52,
              height: 52,
              left: target.pos,
              top: target.y + target.moveOffset,
              background: target.isTarget
                ? `radial-gradient(circle at 35% 35%, ${target.color}cc, ${target.color})`
                : `radial-gradient(circle at 35% 35%, #6b728088, #374151)`,
              boxShadow: target.isTarget ? `0 0 18px ${target.color}, 0 0 36px ${target.color}50` : 'none',
              border: `2px solid ${target.isTarget ? target.color : '#4b5563'}`,
              opacity: target.hit ? 0 : 1,
              transform: `translateY(0)${target.hitAnim ? ' scale(1.6)' : ''}`,
              transition: target.hitAnim ? 'transform 0.15s, opacity 0.15s' : 'none',
            }}
          >
            {target.isTarget ? '🎯' : '⚫'}
          </div>
        ))}
      </div>

      <div className="text-center py-2 text-amber-300 text-sm min-h-[24px]">{feedback}</div>
    </div>
  );
}

export default AttentionArcheryGame;
