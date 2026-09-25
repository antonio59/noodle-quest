import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameProps } from '@/types';
import { GameArt } from '@/components/GameArt';

const allScenarios: Record<number, { trigger: string; emoji: string; heat: number }[]> = {
  1: [
    { trigger: 'Someone took the last cookie you wanted', emoji: '🍪', heat: 40 },
    { trigger: 'Your game froze and you lost progress', emoji: '🎮', heat: 50 },
  ],
  2: [
    { trigger: "Your sibling is being really annoying", emoji: '😤', heat: 45 },
    { trigger: "You can't find your favorite toy", emoji: '🧸', heat: 40 },
    { trigger: 'Someone said something mean', emoji: '💬', heat: 55 },
  ],
  3: [
    { trigger: 'You have to stop playing to do homework', emoji: '📚', heat: 45 },
    { trigger: 'Your friend cancelled your playdate', emoji: '😞', heat: 50 },
    { trigger: 'You made a mistake in front of everyone', emoji: '😳', heat: 60 },
  ],
  4: [
    { trigger: "Someone blamed you for something you didn't do", emoji: '😠', heat: 65 },
    { trigger: 'Your project got ruined by accident', emoji: '🎨', heat: 55 },
    { trigger: 'You lost an important game', emoji: '⚽', heat: 50 },
    { trigger: 'No one wants to play what you want', emoji: '🎯', heat: 45 },
  ],
  5: [
    { trigger: 'Your sibling got something you wanted', emoji: '🎁', heat: 55 },
    { trigger: 'Someone cut in front of you in line', emoji: '😤', heat: 50 },
    { trigger: 'You studied hard but got a bad grade', emoji: '📝', heat: 65 },
    { trigger: 'Your best friend is playing with someone else', emoji: '👫', heat: 60 },
  ],
  6: [
    { trigger: "You got blamed for your sibling's mess", emoji: '🗑️', heat: 70 },
    { trigger: 'Someone laughed at your idea', emoji: '💡', heat: 60 },
    { trigger: "You weren't picked for the team", emoji: '🏀', heat: 65 },
    { trigger: 'Your parents said no to something you really wanted', emoji: '🙅', heat: 55 },
  ],
  7: [
    { trigger: 'Someone shared your secret', emoji: '🤫', heat: 75 },
    { trigger: 'You feel like no one is listening to you', emoji: '🗣️', heat: 65 },
    { trigger: 'Everything is going wrong today', emoji: '😫', heat: 70 },
    { trigger: "You're being compared to someone else", emoji: '⚖️', heat: 60 },
  ],
  8: [
    { trigger: "You worked really hard but didn't win", emoji: '🏆', heat: 70 },
    { trigger: 'Someone broke your favorite thing', emoji: '💔', heat: 75 },
    { trigger: 'You feel left out of a group', emoji: '😔', heat: 65 },
    { trigger: 'Adults are treating you unfairly', emoji: '⚖️', heat: 70 },
    { trigger: "You can't do something everyone else can", emoji: '😰', heat: 60 },
  ],
  9: [
    { trigger: 'Someone is spreading rumors about you', emoji: '📢', heat: 80 },
    { trigger: 'You feel embarrassed in front of everyone', emoji: '😳', heat: 75 },
    { trigger: 'Things keep going wrong no matter what you try', emoji: '🌧️', heat: 70 },
    { trigger: 'Someone you trust let you down', emoji: '💔', heat: 75 },
    { trigger: "You're overwhelmed with too much to do", emoji: '📚', heat: 65 },
  ],
  10: [
    { trigger: 'Everything feels unfair and overwhelming', emoji: '😤', heat: 85 },
    { trigger: "You feel really angry but don't know why", emoji: '🌋', heat: 80 },
    { trigger: 'Someone hurt your feelings badly', emoji: '💔', heat: 85 },
    { trigger: 'You feel like giving up on everything', emoji: '😢', heat: 75 },
    { trigger: 'Multiple bad things happened at once', emoji: '⛈️', heat: 80 },
  ],
};

const coolingStrategies = [
  { name: 'Deep Breaths', emoji: '🌬️', power: 20, tip: 'Breathe in 4, hold 4, out 4' },
  { name: 'Count to 10', emoji: '🔢', power: 15, tip: 'Slowly count, feel calmer with each' },
  { name: 'Walk Away', emoji: '🚶', power: 25, tip: 'Take a break, come back when calm' },
  { name: 'Squeeze & Release', emoji: '✊', power: 18, tip: 'Squeeze fists tight, then relax them' },
  { name: 'Talk It Out', emoji: '💬', power: 22, tip: 'Tell someone how you feel' },
  { name: 'Happy Thoughts', emoji: '🌈', power: 15, tip: 'Remember something that makes you smile' },
  { name: 'Drink Water', emoji: '💧', power: 12, tip: 'A cool drink can help you cool down!' },
  { name: 'Move Your Body', emoji: '🏃', power: 20, tip: 'Jump, stretch, or dance it out!' },
];

const tips = [
  "💡 Everyone's volcano rumbles sometimes — it's what you DO that matters!",
  '💡 Noticing your feelings getting big is the FIRST step to cooling down.',
  '💡 Different strategies work for different people. Find YOUR favorites!',
  "💡 It's okay to feel angry. It's NOT okay to hurt others.",
  "💡 Cooling down takes practice. You're getting better every time!",
];

type Phase = 'intro' | 'playing' | 'cooldown' | 'done';

function getHeatStyle(heat: number): { text: string; color: string; lava: string; glow: string } {
  if (heat >= 80) return { text: '🌋 Eruption warning!', color: '#ff6e6c', lava: 'linear-gradient(180deg, #ff4444, #dc2626)', glow: '#ff6e6c' };
  if (heat >= 60) return { text: '🔥 Getting very hot!', color: '#f97316', lava: 'linear-gradient(180deg, #fb923c, #dc2626)', glow: '#f97316' };
  if (heat >= 30) return { text: '🌡️ Getting warmer...', color: '#fbbf24', lava: 'linear-gradient(180deg, #fbbf24, #f97316)', glow: '#fbbf24' };
  return { text: '❄️ Almost cooled down!', color: '#4ade80', lava: 'linear-gradient(180deg, #4ade80, #16a34a)', glow: '#4ade80' };
}

function EmotionVolcanoGame({ stage, onScore, onProgress, onEnd }: GameProps) {
  const cycledStage = ((stage - 1) % 10) + 1;
  const scenarios = allScenarios[cycledStage] || allScenarios[1];
  const [phase, setPhase] = useState<Phase>('intro');
  const [score, setScore] = useState(0);
  const [currentScenario, setCurrentScenario] = useState(0);
  const [heat, setHeat] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [usedStrategies, setUsedStrategies] = useState<Set<number>>(new Set());
  const [strategies, setStrategies] = useState<typeof coolingStrategies>([]);
  const [tip] = useState(() => tips[Math.floor(Math.random() * tips.length)]);
  const heatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreRef = useRef(0);

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
    if (heatIntervalRef.current) { clearInterval(heatIntervalRef.current); heatIntervalRef.current = null; }
  }, []);

  useEffect(() => {
    endedRef.current = false;
    return () => {
      endedRef.current = true;
      timeoutsRef.current.forEach(clearTimeout);
      cleanup();
    };
  }, [cleanup]);

  const advanceScenario = useCallback((currentScore: number) => {
    cleanup();
    const next = currentScenario + 1;
    onProgress(next / scenarios.length);
    if (next >= scenarios.length) {
      if (endedRef.current) return;
      endedRef.current = true;
      setPhase('done');
      const stars = currentScore >= 200 ? 3 : currentScore >= 120 ? 2 : 1;
      let summary = 'You practiced cooling down your volcano! ';
      if (stars === 3) summary += 'Amazing emotional regulation! You know lots of ways to calm big feelings. 🌟';
      else if (stars === 2) summary += 'Good work! Remember these strategies when your volcano heats up in real life!';
      else summary += 'Keep practicing! The more you use calming strategies, the easier they become!';
      onEnd({ score: currentScore, stars, summary });
    } else {
      setCurrentScenario(next);
      const scenario = scenarios[next];
      setHeat(scenario.heat);
      setFeedback('');
      setUsedStrategies(new Set());
      setStrategies([...coolingStrategies].sort(() => Math.random() - 0.5).slice(0, 4));
    }
  }, [currentScenario, scenarios, cleanup, onProgress, onEnd]);

  const startScenario = useCallback((idx: number) => {
    cleanup();
    const scenario = scenarios[idx];
    setHeat(scenario.heat);
    setFeedback('');
    setUsedStrategies(new Set());
    setStrategies([...coolingStrategies].sort(() => Math.random() - 0.5).slice(0, 4));
    setPhase('playing');
  }, [scenarios, cleanup]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const heatIntervalMs = Math.max(400, 1500 - (stage - 1) * 20);
    heatIntervalRef.current = setInterval(() => {
      setHeat(prev => {
        const next = Math.min(100, prev + 2);
        if (next >= 100) {
          cleanup();
          setFeedback("Feelings got too big! Next time, start cooling sooner!");
          setPhase('cooldown');
          schedule(() => advanceScenario(scoreRef.current), 3000);
        }
        return next;
      });
    }, heatIntervalMs);
    return cleanup;
  }, [phase, stage, cleanup, advanceScenario, schedule]);

  const handleStrategy = useCallback((strat: typeof coolingStrategies[number], idx: number) => {
    if (phase !== 'playing' || usedStrategies.has(idx)) return;
    setUsedStrategies(prev => new Set(prev).add(idx));
    setHeat(prev => {
      const next = Math.max(0, prev - strat.power);
      if (next < 30) {
        cleanup();
        setPhase('cooldown');
        scoreRef.current += 40;
        setScore(scoreRef.current);
        schedule(() => advanceScenario(scoreRef.current), 1500);
      }
      return next;
    });
    scoreRef.current += 10;
    setScore(scoreRef.current);
    onScore(10);
    setFeedback(`${strat.emoji} ${strat.tip}`);
  }, [phase, usedStrategies, onScore, cleanup, advanceScenario, schedule]);

  const heatStyle = getHeatStyle(heat);

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-5 text-center">
        <GameArt gameId="emotion-volcano" emoji="🌋" size={80} className="mb-3" />
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-danger, #ff6e6c)' }}>Emotion Volcano</h2>
        <p className="text-text-muted mb-4 max-w-xs text-sm">Keep your volcano from erupting using calming strategies!</p>
        <div className="bg-card rounded-2xl p-4 mb-4 max-w-xs w-full">
          <div className="text-warning text-sm mb-3">When something frustrating happens...</div>
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="text-center">
              <div className="text-3xl mb-1">😤</div>
              <div className="text-xs text-red-400">Heat rises</div>
            </div>
            <div className="text-text-muted text-xl">→</div>
            <div className="text-center">
              <div className="text-lg">🌬️🔢🚶</div>
              <div className="text-xs text-cyan-400">Cool down</div>
            </div>
            <div className="text-text-muted text-xl">→</div>
            <div className="text-center">
              <div className="text-3xl mb-1">😌</div>
              <div className="text-xs text-green-400">Calm!</div>
            </div>
          </div>
          <div className="text-success text-sm">Tap strategies to cool down below 30%!</div>
        </div>
        <p className="text-text-muted text-xs mb-4 max-w-xs">{tip}</p>
        <button
          onClick={() => startScenario(0)}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95"
        >
          Start Cooling! ❄️
        </button>
      </div>
    );
  }

  const scenario = scenarios[currentScenario];

  return (
    <div className="flex flex-col h-full min-h-[350px] items-center p-3 gap-2">
      <div className="flex gap-4 px-3 py-1.5 bg-card rounded-xl">
        <span className="text-danger font-bold text-sm">Situation {currentScenario + 1}/{scenarios.length}</span>
        <span className="text-warning text-sm font-bold">Score: {score}</span>
      </div>

      <div className="bg-card rounded-xl p-3 text-center w-full max-w-xs">
        <div className="text-3xl mb-1">{scenario.emoji}</div>
        <div className="text-text text-sm">{scenario.trigger}</div>
      </div>

      <div className="flex items-center gap-4 w-full max-w-xs">
        {/* Volcano visual */}
        <div className="relative w-[72px] h-[110px] flex-shrink-0">
          <svg viewBox="0 0 72 110" className="absolute inset-0 w-full h-full">
            <defs>
              <clipPath id="volcano-clip">
                <polygon points="14,110 58,110 72,66 64,33 50,0 22,0 8,33 0,66" />
              </clipPath>
            </defs>
            <polygon points="14,110 58,110 72,66 64,33 50,0 22,0 8,33 0,66"
              fill="#23423b" stroke="#f0a83a" strokeWidth="1" />
            <rect
              x="0" y={110 - heat * 1.1} width="72" height={heat * 1.1}
              fill="url(#lava-grad)"
              clipPath="url(#volcano-clip)"
              style={{ transition: 'y 0.3s, height 0.3s' }}
            />
            <defs>
              <linearGradient id="lava-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={heatStyle.glow} />
                <stop offset="100%" stopColor="#dc2626" />
              </linearGradient>
            </defs>
          </svg>
          {heat >= 80 && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-lg animate-bounce">💨</div>
          )}
        </div>

        {/* Heat meter */}
        <div className="flex-1">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-text-muted">Heat</span>
            <span className="font-bold" style={{ color: heatStyle.color }}>{heat}%</span>
          </div>
          <div className="h-4 bg-surface rounded-full overflow-hidden mb-1">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${heat}%`,
                background: heatStyle.lava,
                boxShadow: `0 0 8px ${heatStyle.glow}`,
              }}
            />
          </div>
          <div className="text-xs font-medium" style={{ color: heatStyle.color }}>{heatStyle.text}</div>
          <div className="text-xs text-text-muted mt-1">Cool below 30% to pass!</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 w-full max-w-xs">
        {strategies.map((strat, idx) => {
          const used = usedStrategies.has(idx);
          return (
            <button
              key={idx}
              onClick={() => handleStrategy(strat, idx)}
              disabled={used || phase !== 'playing'}
              className="p-2.5 rounded-xl text-sm flex flex-col items-center gap-0.5 transition-all active:scale-95"
              style={{
                background: used ? '#16534440' : 'var(--color-card, #1a332e)',
                border: `2px solid ${used ? '#4ade80' : 'var(--color-accent, #f0a83a)'}`,
                opacity: used ? 0.65 : 1,
              }}
            >
              <span className="text-2xl">{strat.emoji}</span>
              <span className="text-text text-xs font-medium">{strat.name}</span>
              <span className="text-green-400 text-xs">-{strat.power}%</span>
            </button>
          );
        })}
      </div>

      {feedback && (
        <div className="text-success text-sm text-center max-w-xs min-h-[20px]">{feedback}</div>
      )}
      {phase === 'cooldown' && (
        <div className="text-accent text-sm text-center">❄️ Cooled down! Next situation...</div>
      )}
    </div>
  );
}

export default EmotionVolcanoGame;
