import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { GameProps } from '@/types';
import { scaleFromLast } from '@/lib/endless-stage';
import { GameArt } from '@/components/GameArt';

type Phase = 'intro' | 'playing' | 'done';

const CONFIG: Record<number, { bubbles: number; targetMin: number; targetMax: number; time: number }> = {
  1: { bubbles: 3, targetMin: 60, targetMax: 80, time: 0 },
  2: { bubbles: 3, targetMin: 55, targetMax: 75, time: 0 },
  3: { bubbles: 4, targetMin: 50, targetMax: 70, time: 0 },
  4: { bubbles: 4, targetMin: 45, targetMax: 65, time: 0 },
  5: { bubbles: 5, targetMin: 40, targetMax: 60, time: 60 },
  6: { bubbles: 5, targetMin: 35, targetMax: 55, time: 55 },
  7: { bubbles: 6, targetMin: 30, targetMax: 50, time: 50 },
  8: { bubbles: 6, targetMin: 28, targetMax: 48, time: 45 },
  9: { bubbles: 7, targetMin: 25, targetMax: 45, time: 42 },
  10: { bubbles: 8, targetMin: 22, targetMax: 42, time: 40 },
};

const TIPS = [
  "💡 Tip: Breathe in slowly through your nose, out slowly through your mouth!",
  "💡 Tip: Count '1...2...3...4' as you breathe out to stay steady.",
  "💡 Tip: Calm, slow breaths make the best bubbles!",
  "💡 Tip: If the bubble grows too fast, you're breathing too hard!",
  "💡 Tip: This breathing trick works when you feel worried too!",
];

function BreathBubblesGame({ stage, onScore, onProgress, onEnd }: GameProps) {
  const config = useMemo(() => scaleFromLast(stage, CONFIG, {
    bubbles: 0.1, targetMin: -0.1, targetMax: -0.1, time: 0.15,
  }, {
    bubbles: 15, targetMin: 10, targetMax: 25, time: 90000,
  }), [stage]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [currentBubble, setCurrentBubble] = useState(0);
  const [bubbleSize, setBubbleSize] = useState(10);
  const [perfectCount, setPerfectCount] = useState(0);

  const [feedback, setFeedback] = useState('');
  const [feedbackColor, setFeedbackColor] = useState('#67e8f9');
  const [hint, setHint] = useState('Press and hold to blow!');
  const [hintColor, setHintColor] = useState('#f0a83a');
  const [timeLeft, setTimeLeft] = useState(0);
  const [floatAway, setFloatAway] = useState(false);

  const gameActiveRef = useRef(false);
  const isBreathingRef = useRef(false);
  const breathIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreRef = useRef(0);
  const perfectCountRef = useRef(0);
  const currentBubbleRef = useRef(0);
  const bubbleSizeRef = useRef(10);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

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
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const cleanupBreath = useCallback(() => {
    if (breathIntervalRef.current) {
      clearInterval(breathIntervalRef.current);
      breathIntervalRef.current = null;
    }
    isBreathingRef.current = false;
  }, []);

  const endGame = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    gameActiveRef.current = false;
    cleanupBreath();

    const accuracy = perfectCountRef.current / config.bubbles;
    const stars = accuracy >= 0.8 ? 3 : accuracy >= 0.5 ? 2 : 1;

    let summary = `You made ${perfectCountRef.current} perfect bubbles! `;
    if (stars === 3) summary += 'Amazing breath control! This slow breathing helps calm your body anytime you feel stressed! 🌟';
    else if (stars === 2) summary += "Good job! Remember: slow, steady breaths make the best bubbles AND help you feel calm!";
    else summary += "Keep practicing! The trick is breathing out slowly like you're blowing through a tiny straw.";

    setPhase('done');
    onEnd({ score: scoreRef.current, stars, summary });
  }, [config.bubbles, onEnd, cleanupBreath]);

  const resetBubble = useCallback(() => {
    bubbleSizeRef.current = 10;
    setBubbleSize(10);
    setFloatAway(false);
    setFeedback('');
    setFeedbackColor('#67e8f9');
    setHint('Press and hold to blow!');
    setHintColor('#f0a83a');
  }, []);

  const releaseBubble = useCallback((popped = false) => {
    if (!isBreathingRef.current) return;
    cleanupBreath();

    const inRange = bubbleSizeRef.current >= config.targetMin && bubbleSizeRef.current <= config.targetMax;

    if (popped) {
      setFeedback('💥 POP! Too big! Breathe slower next time.');
      setFeedbackColor('#ff6e6c');
    } else if (inRange) {
      perfectCountRef.current++;
      setPerfectCount(perfectCountRef.current);
      scoreRef.current += 50;
      onScore(50);
      setFeedback('🫧 Perfect bubble! Beautiful slow breath!');
      setFeedbackColor('#4ade80');
      setFloatAway(true);
    } else if (bubbleSizeRef.current < config.targetMin) {
      setFeedback('😤 Too small! Try a longer, slower breath.');
      setFeedbackColor('#fbbf24');
    } else {
      setFeedback('🌬️ A bit too big! Breathe even slower.');
      setFeedbackColor('#fbbf24');
    }

    currentBubbleRef.current++;
    setCurrentBubble(currentBubbleRef.current);
    onProgress(currentBubbleRef.current / config.bubbles);

    if (currentBubbleRef.current >= config.bubbles) {
      schedule(endGame, 1500);
    } else {
      schedule(resetBubble, 1500);
    }
  }, [config, onScore, onProgress, endGame, resetBubble, cleanupBreath, schedule]);

  const startBlowing = useCallback(() => {
    if (!gameActiveRef.current || currentBubbleRef.current >= config.bubbles) return;
    isBreathingRef.current = true;
    bubbleSizeRef.current = 10;
    setBubbleSize(10);
    setFloatAway(false);
    setHint('Slow and steady... 🌬️');

    breathIntervalRef.current = setInterval(() => {
      if (!isBreathingRef.current) return;
      bubbleSizeRef.current += 2;
      setBubbleSize(bubbleSizeRef.current);

      if (bubbleSizeRef.current >= config.targetMin && bubbleSizeRef.current <= config.targetMax) {
        setHint('✨ Perfect size! Release now!');
        setHintColor('#4ade80');
      } else if (bubbleSizeRef.current > config.targetMax) {
        setHint('⚠️ Too big! It might pop!');
        setHintColor('#ff6e6c');
      }

      if (bubbleSizeRef.current > config.targetMax + 30) {
        releaseBubble(true);
      }
    }, 50);
  }, [config, releaseBubble]);

  const startGame = useCallback(() => {
    setPhase('playing');
    gameActiveRef.current = true;
    currentBubbleRef.current = 0;
    perfectCountRef.current = 0;
    scoreRef.current = 0;
    bubbleSizeRef.current = 10;
    setCurrentBubble(0);
    setPerfectCount(0);
    setBubbleSize(10);
    setFeedback('');
    setFeedbackColor('#67e8f9');
    setHint('Press and hold to blow!');
    setHintColor('#f0a83a');
    setFloatAway(false);
    setTimeLeft(config.time);
  }, [config.time]);

  // Timer for timed stages
  useEffect(() => {
    if (phase !== 'playing' || config.time <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    timerIntervalRef.current = timer;

    return () => clearInterval(timer);
  }, [phase, config.time, endGame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      gameActiveRef.current = false;
      cleanupBreath();
    };
  }, [cleanupBreath]);

  const bubbleColor = bubbleSize >= config.targetMin && bubbleSize <= config.targetMax
    ? 'radial-gradient(circle at 30% 30%, #86efac, #22c55e)'
    : bubbleSize > config.targetMax
      ? 'radial-gradient(circle at 30% 30%, #fca5a5, #dc2626)'
      : 'radial-gradient(circle at 30% 30%, #a5f3fc, #0891b2)';

  const bubbleShadow = bubbleSize >= config.targetMin && bubbleSize <= config.targetMax
    ? '0 0 30px #4ade80'
    : '0 0 20px #67e8f9';

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-5 text-center">
        <GameArt gameId="breath-bubbles" emoji="🫧" size={80} className="mb-4" />
        <h2 className="text-2xl font-bold text-cyan-400 mb-2">Breath Bubbles</h2>
        <p className="text-cyan-200 mb-4 max-w-xs">Blow perfect bubbles by breathing slow and steady!</p>

        <div className="bg-[#1a332e] rounded-xl p-4 mb-5 max-w-xs">
          <div className="text-xl text-cyan-400 mb-2">🎯 Goal: {config.bubbles} perfect bubbles</div>
          <div className="text-amber-300 mb-3">Hold the button and breathe OUT slowly</div>
          <div className="flex gap-3 justify-center items-center">
            <div className="w-8 h-8 rounded-full bg-red-400 text-xs flex items-center justify-center">Too<br />small</div>
            <div className="w-12 h-12 rounded-full bg-green-400 text-xs flex items-center justify-center" style={{ boxShadow: '0 0 15px #4ade80' }}>Just<br />right!</div>
            <div className="w-16 h-16 rounded-full bg-red-400 text-xs flex items-center justify-center">Too<br />big!</div>
          </div>
        </div>

        <p className="text-cyan-300 text-sm mb-5 max-w-xs">{tip}</p>

        <button
          onClick={startGame}
          className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-8 py-3 rounded-xl text-lg active:scale-95 transition-transform"
        >
          Start Breathing! 🫧
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[350px] items-center">
      <div className="flex gap-4 px-4 py-2 bg-[#1a332e] rounded-xl mb-3">
        <span className="text-cyan-400 font-bold">Bubble {Math.min(currentBubble + 1, config.bubbles)}/{config.bubbles}</span>
        <span className="text-green-400">Perfect: {perfectCount}</span>
        {config.time > 0 && <span className="text-yellow-400">⏱️ {timeLeft}</span>}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <div className="relative w-[200px] h-[200px] flex items-center justify-center">
          <div
            className="absolute rounded-full border-2 border-dashed"
            style={{
              width: config.targetMax * 2,
              height: config.targetMax * 2,
              borderColor: '#4ade8066',
            }}
          />
          <div
            className="rounded-full"
            style={{
              width: bubbleSize,
              height: bubbleSize,
              background: bubbleColor,
              boxShadow: bubbleShadow,
              transition: 'width 0.05s, height 0.05s',
              animation: floatAway ? 'floatAway 1s forwards' : undefined,
              opacity: feedback.startsWith('💥') && !floatAway ? 0.3 : floatAway ? undefined : 1,
              transform: feedback.startsWith('💥') && !floatAway ? 'scale(2)' : undefined,
            }}
          />
        </div>

        <div className="text-cyan-400 text-xl mt-4">Size: {Math.round(bubbleSize)}</div>
        <div className="text-sm mt-2" style={{ color: hintColor }}>{hint}</div>
      </div>

      <div className="p-4 w-full flex justify-center">
        <button
          onPointerDown={(e) => { e.preventDefault(); startBlowing(); }}
          onPointerUp={() => releaseBubble(false)}
          onPointerLeave={() => { if (isBreathingRef.current) releaseBubble(false); }}
          className="w-full max-w-[300px] py-5 text-xl font-bold text-white rounded-xl active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(180deg, #0891b2, #0e7490)' }}
        >
          🌬️ BLOW (Hold)
        </button>
      </div>

      <div className="text-center text-sm min-h-[24px] pb-2" style={{ color: feedbackColor }}>{feedback}</div>

      <style>{`@keyframes floatAway{to{transform:translateY(-100px) scale(0.5);opacity:0}}`}</style>
    </div>
  );
}

export default BreathBubblesGame;
