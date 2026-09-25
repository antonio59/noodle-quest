import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameProps } from '@/types';
import { Moon, Heart, Zap, Shield } from 'lucide-react';
import { GameArt } from '@/components/GameArt';

// 4-7-8 Breathing: inhale 4s, hold 7s, exhale 8s

type Phase = 'inhale' | 'hold' | 'exhale' | 'idle' | 'info' | 'done';

const BENEFITS = [
  { icon: Moon,   label: 'Reduces anxiety and aids sleep',                  color: 'text-accent' },
  { icon: Heart,  label: 'Activates the parasympathetic nervous system',    color: 'text-red-400' },
  { icon: Zap,    label: 'Natural tranquilizer for stress relief',          color: 'text-yellow-400' },
  { icon: Shield, label: 'Helps manage cravings and emotional reactions',   color: 'text-green-400' },
];

const BEST_FOR = [
  'Before bed — helps you fall asleep faster',
  'During anxiety or panic episodes',
  'When you need to calm down quickly',
  'Managing cravings or compulsive urges',
];

const PHASE_META: Record<string, { label: string; instruction: string; color: string; glow: string }> = {
  inhale: { label: 'Breathe In',  instruction: 'Slowly fill your lungs...',     color: '#f0a83a', glow: '#f0a83a60' },
  hold:   { label: 'Hold',        instruction: 'Hold the breath gently...',     color: '#fbbf24', glow: '#fbbf2460' },
  exhale: { label: 'Breathe Out', instruction: 'Release slowly — all the way...', color: '#4ade80', glow: '#4ade8060' },
};

function CalmBreathingGame({ stage, onScore, onProgress, onMessage, onEnd }: GameProps) {
  const totalRounds = 2 + Math.floor(stage / 2);
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

  const phaseDurations: Record<string, number> = { inhale: 4, hold: 7, exhale: 8 };

  const startCycle = useCallback(() => {
    setPhase('inhale');
    phaseRef.current = 'inhale';
    setSecondsLeft(4);
    setRound(1);
    roundRef.current = 1;
    onMessage('Round 1 — 4-7-8 Breathing');
  }, [onMessage]);

  useEffect(() => {
    if (phase === 'idle' || phase === 'done' || phase === 'info') return;

    const id = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          const current = phaseRef.current;
          let next: Phase;
          if (current === 'inhale') {
            next = 'hold';
          } else if (current === 'hold') {
            next = 'exhale';
          } else {
            const newRound = roundRef.current + 1;
            roundRef.current = newRound;
            setRound(newRound);
            onScore(15);
            onProgress(newRound / totalRounds);
            if (newRound > totalRounds) {
              setPhase('done');
              phaseRef.current = 'done';
              if (timerRef.current) clearInterval(timerRef.current);
              if (!endedRef.current) {
                endedRef.current = true;
                const stars = totalRounds >= 6 ? 3 : totalRounds >= 3 ? 2 : 1;
                onEnd({
                  score: totalRounds * 15,
                  stars,
                  summary: `${totalRounds} rounds of 4-7-8 breathing complete! You've activated your body's natural calm response. 🌙`,
                });
              }
              return 0;
            }
            onMessage(`Round ${newRound}/${totalRounds}`);
            next = 'inhale';
          }
          phaseRef.current = next;
          setPhase(next);
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
  }, [phase, totalRounds, onScore, onProgress, onMessage, onEnd]);

  const estimatedMinutes = Math.ceil(totalRounds * 19 / 60);

  if (phase === 'info') {
    return (
      <div className="h-full overflow-y-auto">
        <div className="p-6 max-w-md mx-auto">
          <div className="text-center mb-6">
            <GameArt gameId="calm-breathing" emoji="🌊" size={80} className="mb-3" />
            <h2 className="text-2xl font-bold text-accent">4-7-8 Calm Breathing</h2>
            <p className="text-text-muted text-sm mt-1">Dr. Andrew Weil's natural tranquilizer</p>
          </div>

          <div className="bg-card rounded-2xl p-4 mb-5">
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3 text-center">The Pattern</div>
            <div className="flex items-center justify-center gap-2 text-sm">
              <div className="bg-accent/20 text-accent px-3 py-2 rounded-xl font-bold text-center">
                <div>In</div><div className="text-xs opacity-70">4s</div>
              </div>
              <span className="text-text-muted">→</span>
              <div className="bg-yellow-500/20 text-yellow-400 px-3 py-2 rounded-xl font-bold text-center">
                <div>Hold</div><div className="text-xs opacity-70">7s</div>
              </div>
              <span className="text-text-muted">→</span>
              <div className="bg-green-500/20 text-green-400 px-3 py-2 rounded-xl font-bold text-center">
                <div>Out</div><div className="text-xs opacity-70">8s</div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-4 mb-5 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Rounds</span>
              <span className="font-bold text-text">{totalRounds}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Estimated time</span>
              <span className="font-bold text-text">~{estimatedMinutes} min</span>
            </div>
            <div className="flex justify-between">
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
        <GameArt gameId="calm-breathing" emoji="🌊" size={80} className="mb-4" />
        <h2 className="text-2xl font-bold text-accent mb-2">4-7-8 Calm</h2>
        <p className="text-text-muted mb-6 max-w-xs">In 4s → Hold 7s → Out 8s. Repeat {totalRounds} rounds.</p>
        <button onClick={startCycle} className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95">
          Begin
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="text-7xl mb-4">😌</div>
        <h2 className="text-2xl font-bold mb-2 text-accent">Deep Calm</h2>
        <p className="text-text-muted mb-2">{totalRounds} rounds completed</p>
        <p className="text-text-muted text-sm mb-6 max-w-xs">Sit with this feeling of calm for a moment before moving on.</p>
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
  const dur = phaseDurations[phase] || 4;
  const pct = Math.min(1, (dur - secondsLeft) / dur);

  const circleScale = phase === 'inhale'
    ? 0.35 + pct * 0.65
    : phase === 'exhale'
      ? 1 - pct * 0.65
      : 1;

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-sm text-text-muted">Round {round}/{totalRounds}</div>

      <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
        <div
          className="absolute rounded-full"
          style={{
            width: 200, height: 200,
            boxShadow: `0 0 ${30 + circleScale * 40}px ${meta.glow}, 0 0 ${60 + circleScale * 60}px ${meta.glow}40`,
            opacity: 0.5,
          }}
        />
        <div
          className="rounded-full transition-all duration-1000"
          style={{
            width: 160,
            height: 160,
            transform: `scale(${circleScale})`,
            background: `radial-gradient(circle at 35% 35%, ${meta.color}80, ${meta.color}20)`,
            boxShadow: `0 0 40px ${meta.glow}`,
            border: `3px solid ${meta.color}50`,
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-black text-white">{secondsLeft}</div>
          <div className="text-sm font-semibold mt-1" style={{ color: meta.color }}>{meta.label}</div>
        </div>
      </div>

      <p className="text-text-muted text-sm italic text-center">{meta.instruction}</p>

      {/* Phase progress bar */}
      <div className="flex gap-1 w-full max-w-xs">
        {(['inhale', 'hold', 'exhale'] as Phase[]).map(p => (
          <div
            key={p}
            className="h-1.5 rounded-full transition-all duration-500"
            style={{
              flex: phaseDurations[p],
              background: phase === p ? PHASE_META[p].color : `${PHASE_META[p].color}25`,
              boxShadow: phase === p ? `0 0 8px ${PHASE_META[p].color}` : 'none',
            }}
          />
        ))}
      </div>

      {/* Round dots */}
      <div className="flex gap-1.5 justify-center flex-wrap max-w-xs">
        {Array.from({ length: totalRounds }, (_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-500"
            style={{
              width: 8, height: 8,
              background: i < round - 1 ? meta.color : i === round - 1 ? meta.color + '80' : '#ffffff15',
              boxShadow: i === round - 1 ? `0 0 8px ${meta.color}` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default CalmBreathingGame;
