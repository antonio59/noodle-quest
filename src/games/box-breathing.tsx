import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameProps } from '@/types';
import { Clock, Heart, Brain, Shield } from 'lucide-react';
import { GameArt } from '@/components/GameArt';

type Phase = 'inhale' | 'hold1' | 'exhale' | 'hold2' | 'idle' | 'info' | 'done';

const BENEFITS = [
  { icon: Brain, label: 'Reduces stress & anxiety', color: 'text-accent' },
  { icon: Heart, label: 'Lowers heart rate & blood pressure', color: 'text-red-400' },
  { icon: Shield, label: 'Improves emotional regulation', color: 'text-green-400' },
  { icon: Clock, label: 'Used by Navy SEALs for calm under pressure', color: 'text-yellow-400' },
];

const BEST_FOR = [
  'Before stressful situations (exams, presentations)',
  'When feeling overwhelmed or anxious',
  'To improve focus before work or study',
  'As a daily mindfulness practice',
];

const PHASE_META: Record<string, { label: string; instruction: string; color: string; glow: string }> = {
  inhale: { label: 'Breathe In',  instruction: 'Fill your lungs slowly...',    color: '#f0a83a', glow: '#f0a83a60' },
  hold1:  { label: 'Hold',        instruction: 'Hold still, stay calm...',     color: '#fbbf24', glow: '#fbbf2460' },
  exhale: { label: 'Breathe Out', instruction: 'Release slowly and fully...',  color: '#4ade80', glow: '#4ade8060' },
  hold2:  { label: 'Hold',        instruction: 'Empty lungs, stay steady...', color: '#67e8f9', glow: '#67e8f960' },
};

function BoxBreathingGame({ stage, onScore, onProgress, onMessage, onEnd }: GameProps) {
  const totalRounds = 3 + stage;
  const [phase, setPhase] = useState<Phase>('info');
  const [round, setRound] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>('info');
  const roundRef = useRef(0);
  const endedRef = useRef(false);
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => {
    endedRef.current = false;
    return () => {
      endedRef.current = true;
      intervalsRef.current.forEach(clearInterval);
    };
  }, []);

  const phaseDurations: Record<string, number> = {
    inhale: 4, hold1: 4, exhale: 4, hold2: 4,
  };

  const nextPhase = useCallback((current: Phase): Phase => {
    switch (current) {
      case 'inhale': return 'hold1';
      case 'hold1':  return 'exhale';
      case 'exhale': return 'hold2';
      case 'hold2':  return 'inhale';
      default: return 'inhale';
    }
  }, []);

  const startCycle = useCallback(() => {
    setPhase('inhale');
    phaseRef.current = 'inhale';
    setSecondsLeft(4);
    setRound(1);
    roundRef.current = 1;
    onMessage('Round 1 — Box Breathing');
  }, [onMessage]);

  useEffect(() => {
    if (phase === 'idle' || phase === 'done' || phase === 'info') return;

    const id = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          const current = phaseRef.current;
          const next = nextPhase(current);
          phaseRef.current = next;
          setPhase(next);

          if (current === 'hold2') {
            const newRound = roundRef.current + 1;
            roundRef.current = newRound;
            setRound(newRound);
            onScore(10);
            onProgress(newRound / totalRounds);
            onMessage(`Round ${newRound}/${totalRounds}`);

            if (newRound > totalRounds) {
              setPhase('done');
              phaseRef.current = 'done';
              if (timerRef.current) clearInterval(timerRef.current);
              if (!endedRef.current) {
                endedRef.current = true;
                const stars = totalRounds >= 10 ? 3 : totalRounds >= 6 ? 2 : 1;
                onEnd({
                  score: totalRounds * 10,
                  stars,
                  summary: `You completed ${totalRounds} rounds of box breathing! Your nervous system is calmer now. 🌿`,
                });
              }
              return 0;
            }
          }

          return phaseDurations[next];
        }
        return prev - 1;
      });
    }, 1000);
    timerRef.current = id;
    intervalsRef.current.push(id);

    return () => {
      clearInterval(id);
      intervalsRef.current = intervalsRef.current.filter(x => x !== id);
    };
  }, [phase, totalRounds, nextPhase, onScore, onProgress, onMessage, onEnd]);

  const estimatedMinutes = Math.ceil(totalRounds * 16 / 60);

  if (phase === 'info') {
    return (
      <div className="h-full overflow-y-auto">
        <div className="p-6 max-w-md mx-auto">
          <div className="text-center mb-6">
            <GameArt gameId="box-breathing" emoji="📦" size={80} className="mb-3" />
            <h2 className="text-2xl font-bold text-accent">Box Breathing</h2>
            <p className="text-text-muted text-sm mt-1">The 4-4-4-4 calm-down technique</p>
          </div>

          <div className="bg-card rounded-2xl p-4 mb-5">
            <div className="text-xs font-semibold text-text-muted mb-3 text-center uppercase tracking-wide">The Pattern</div>
            <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
              {[
                { label: 'In', sub: '4s',   color: 'bg-accent/20 text-accent' },
                { label: 'Hold', sub: '4s', color: 'bg-yellow-500/20 text-yellow-400' },
                { label: 'Out', sub: '4s',  color: 'bg-green-500/20 text-green-400' },
                { label: 'Hold', sub: '4s', color: 'bg-cyan-500/20 text-cyan-400' },
              ].map((p, i) => (
                <div key={i} className={`${p.color} rounded-xl py-2.5 font-bold`}>
                  <div>{p.label}</div>
                  <div className="opacity-70">{p.sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-2xl p-4 mb-5">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-muted">Rounds</span>
              <span className="font-bold text-text">{totalRounds}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-muted">Estimated time</span>
              <span className="font-bold text-text">~{estimatedMinutes} min</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Stage</span>
              <span className="font-bold text-accent">{stage}</span>
            </div>
          </div>

          <div className="mb-5">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wide mb-3">Benefits</h3>
            <div className="space-y-2">
              {BENEFITS.map((b, i) => (
                <div key={i} className="flex items-center gap-3 bg-card rounded-xl p-3">
                  <b.icon size={16} className={b.color} />
                  <span className="text-sm text-text">{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wide mb-3">Best For</h3>
            <div className="space-y-2">
              {BEST_FOR.map((item, i) => (
                <div key={i} className="flex items-start gap-2 bg-card rounded-xl p-3">
                  <span className="text-accent text-xs mt-0.5">◆</span>
                  <span className="text-sm text-text-muted">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={startCycle}
            className="w-full bg-accent text-bg font-bold py-3.5 rounded-xl text-lg hover:opacity-90 active:scale-95 transition-all"
          >
            Begin Session
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'idle') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <GameArt gameId="box-breathing" emoji="📦" size={80} className="mb-4" />
        <h2 className="text-2xl font-bold text-accent mb-2">Box Breathing</h2>
        <p className="text-text-muted mb-6 max-w-xs">4-4-4-4: In → Hold → Out → Hold. {totalRounds} rounds.</p>
        <button
          onClick={startCycle}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95"
        >
          Begin
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="text-7xl mb-4">🧘</div>
        <h2 className="text-2xl font-bold mb-2 text-accent">Session Complete</h2>
        <p className="text-text-muted mb-2">{totalRounds} rounds finished</p>
        <p className="text-text-muted text-sm mb-6 max-w-xs">Your nervous system has been reset. Enjoy this calm feeling.</p>
        <button
          onClick={() => { setPhase('idle'); setRound(0); endedRef.current = false; }}
          className="bg-accent text-bg font-bold px-6 py-2.5 rounded-xl hover:opacity-90"
        >
          Again
        </button>
      </div>
    );
  }

  const meta = PHASE_META[phase] || PHASE_META.inhale;
  const totalPhaseTime = phaseDurations[phase] || 4;
  const elapsed = totalPhaseTime - secondsLeft;
  const pct = Math.min(1, elapsed / totalPhaseTime);

  // Circle scale: inhale = grow 0.3→1, exhale = shrink 1→0.3, holds = static
  const circleScale = phase === 'inhale'
    ? 0.3 + pct * 0.7
    : phase === 'exhale'
      ? 1 - pct * 0.7
      : phase === 'hold1' ? 1 : 0.3;

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-sm text-text-muted">Round {round}/{totalRounds}</div>

      <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
        {/* Outer glow ring */}
        <div
          className="absolute rounded-full transition-all duration-1000"
          style={{
            width: 200,
            height: 200,
            background: 'transparent',
            boxShadow: `0 0 ${30 + circleScale * 40}px ${meta.glow}, 0 0 ${60 + circleScale * 60}px ${meta.glow}40`,
            borderRadius: '50%',
            opacity: 0.6,
          }}
        />
        {/* Animated circle */}
        <div
          className="rounded-full transition-all duration-1000"
          style={{
            width: 160,
            height: 160,
            transform: `scale(${circleScale})`,
            background: `radial-gradient(circle at 35% 35%, ${meta.color}80, ${meta.color}30)`,
            boxShadow: `0 0 30px ${meta.glow}`,
            border: `3px solid ${meta.color}60`,
          }}
        />
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-black text-white">{secondsLeft}</div>
          <div className="text-sm font-semibold mt-1" style={{ color: meta.color }}>{meta.label}</div>
        </div>
      </div>

      <div className="text-center">
        <p className="text-text-muted text-sm italic">{meta.instruction}</p>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 flex-wrap justify-center max-w-xs">
        {Array.from({ length: totalRounds }, (_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-500"
            style={{
              width: i < round - 1 ? 10 : 8,
              height: i < round - 1 ? 10 : 8,
              background: i < round - 1 ? meta.color : i === round - 1 ? meta.color + '80' : '#ffffff15',
              boxShadow: i === round - 1 ? `0 0 8px ${meta.color}` : 'none',
            }}
          />
        ))}
      </div>

      {/* Phase indicator strip */}
      <div className="flex gap-1 w-full max-w-xs">
        {(['inhale', 'hold1', 'exhale', 'hold2'] as Phase[]).map(p => (
          <div
            key={p}
            className="flex-1 h-1.5 rounded-full transition-all duration-500"
            style={{
              background: phase === p ? PHASE_META[p].color : `${PHASE_META[p].color}25`,
              boxShadow: phase === p ? `0 0 6px ${PHASE_META[p].color}` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default BoxBreathingGame;
