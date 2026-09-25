import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameProps } from '@/types';
import { Waves, Heart, Battery, Activity } from 'lucide-react';
import { GameArt } from '@/components/GameArt';

// Coherent/Resonance Breathing: inhale Ns, exhale Ns (~5.5 breaths/min)
// Activates parasympathetic nervous system

type Phase = 'inhale' | 'exhale' | 'idle' | 'info' | 'done';

const BENEFITS = [
  { icon: Heart,    label: 'Syncs heart rate variability (HRV)',         color: 'text-danger'  },
  { icon: Waves,    label: 'Activates parasympathetic nervous system',    color: 'text-accent'  },
  { icon: Battery,  label: 'Increases energy and reduces fatigue',        color: 'text-success' },
  { icon: Activity, label: 'Lowers blood pressure naturally',             color: 'text-warning' },
];

const BEST_FOR = [
  'Daily wellness practice (5-20 min)',
  'Heart rate variability training',
  'Sustained calm throughout the day',
  'Recovery after exercise or stress',
];

const PHASE_META = {
  inhale: { label: 'Breathe In',  instruction: 'Slow, smooth inhale through your nose...', color: '#f0a83a', glow: '#f0a83a60' },
  exhale: { label: 'Breathe Out', instruction: 'Long, steady exhale through your mouth...', color: '#4ade80', glow: '#4ade8060' },
};

function CoherentBreathingGame({ stage, onScore, onProgress, onMessage, onEnd }: GameProps) {
  const breathLen = Math.min(5 + Math.floor(stage / 3), 10);
  const totalRounds = 2 + stage;
  const [phase, setPhase] = useState<Phase>('info');
  const [round, setRound] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
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

  const startCycle = useCallback(() => {
    setPhase('inhale');
    phaseRef.current = 'inhale';
    setSecondsLeft(breathLen);
    setRound(1);
    roundRef.current = 1;
    onMessage(`Round 1 — ${breathLen}s Coherent Breathing`);
  }, [breathLen, onMessage]);

  useEffect(() => {
    if (phase === 'idle' || phase === 'done' || phase === 'info') return;
    const id = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          const current = phaseRef.current;
          if (current === 'inhale') {
            phaseRef.current = 'exhale';
            setPhase('exhale');
            return breathLen;
          } else {
            const newRound = roundRef.current + 1;
            roundRef.current = newRound;
            setRound(newRound);
            onScore(12);
            onProgress(newRound / totalRounds);
            if (newRound > totalRounds) {
              setPhase('done');
              phaseRef.current = 'done';
              if (!endedRef.current) {
                endedRef.current = true;
                const stars = totalRounds >= 8 ? 3 : totalRounds >= 4 ? 2 : 1;
                onEnd({
                  score: totalRounds * 12,
                  stars,
                  summary: `${totalRounds} rounds of coherent breathing! Your heart and breath are in perfect sync. 💚`,
                });
              }
              return 0;
            }
            onMessage(`Round ${newRound}/${totalRounds}`);
            phaseRef.current = 'inhale';
            setPhase('inhale');
            return breathLen;
          }
        }
        return prev - 1;
      });
    }, 1000);
    intervalsRef.current.push(id);
    return () => {
      clearInterval(id);
      intervalsRef.current = intervalsRef.current.filter(x => x !== id);
    };
  }, [phase, totalRounds, breathLen, onScore, onProgress, onMessage, onEnd]);

  const breathsPerMin = Math.round(60 / (breathLen * 2) * 10) / 10;
  const estimatedMinutes = Math.ceil(totalRounds * (breathLen * 2) / 60);
  const phaseProgress = (breathLen - secondsLeft) / breathLen;
  const circleScale = phase === 'inhale'
    ? 0.6 + phaseProgress * 0.5
    : phase === 'exhale'
    ? 1.1 - phaseProgress * 0.5
    : 0.6;

  if (phase === 'info') {
    return (
      <div className="h-full overflow-y-auto">
        <div className="p-6 max-w-md mx-auto">
          <div className="text-center mb-6">
            <GameArt gameId="coherent-breathing" emoji="☯️" size={80} className="mb-3" />
            <h2 className="text-2xl font-bold text-accent">Coherent Breathing</h2>
            <p className="text-text-muted text-sm mt-1">Heart-breath synchronization at ~{breathsPerMin} breaths/min</p>
          </div>

          <div className="bg-card rounded-2xl p-4 mb-5">
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3 text-center">The Pattern</div>
            <div className="flex items-center justify-center gap-2 text-sm">
              <div className="bg-accent/20 text-accent px-3 py-2 rounded-xl font-bold text-center">
                <div>Inhale</div><div className="text-xs opacity-70">{breathLen}s</div>
              </div>
              <span className="text-text-muted">→</span>
              <div className="bg-green-500/20 text-green-400 px-3 py-2 rounded-xl font-bold text-center">
                <div>Exhale</div><div className="text-xs opacity-70">{breathLen}s</div>
              </div>
            </div>
            <div className="text-center text-xs text-text-muted mt-2">~{breathsPerMin} breaths/min (optimal HRV zone)</div>
          </div>

          <div className="bg-card rounded-2xl p-4 mb-5 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-text-muted">Rounds</span><span className="font-bold text-text">{totalRounds}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Breath length</span><span className="font-bold text-text">{breathLen}s each</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Estimated time</span><span className="font-bold text-text">~{estimatedMinutes} min</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Stage</span><span className="font-bold text-accent">{stage}</span></div>
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
            Start Session
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'idle') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <GameArt gameId="coherent-breathing" emoji="☯️" size={80} className="mb-4" />
        <h2 className="text-2xl font-bold text-accent mb-2">Coherent Breathing</h2>
        <p className="text-text-muted mb-6 max-w-xs">
          Inhale {breathLen}s, Exhale {breathLen}s. ~{breathsPerMin} breaths/min.
          Syncs heart rate and breath for maximum calm.
        </p>
        <button onClick={startCycle} className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95">
          Begin
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="text-7xl mb-4">☮️</div>
        <h2 className="text-2xl font-bold mb-2 text-accent">In Sync</h2>
        <p className="text-text-muted mb-2">{totalRounds} rounds completed</p>
        <p className="text-text-muted text-sm mb-6 max-w-xs">Your heart and breath are now in harmonious rhythm.</p>
        <button onClick={() => { setPhase('idle'); setRound(0); endedRef.current = false; }} className="bg-accent text-bg font-bold px-6 py-2.5 rounded-xl hover:opacity-90">Again</button>
      </div>
    );
  }

  const meta = PHASE_META[phase as 'inhale' | 'exhale'] || PHASE_META.inhale;

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-5">
      <div className="text-sm text-text-muted">Round {round}/{totalRounds} · {breathLen}s per phase</div>

      {/* Glowing animated circle */}
      <div className="relative flex items-center justify-center" style={{ width: 180, height: 180 }}>
        {/* Outer glow ring */}
        <div
          className="absolute inset-0 rounded-full transition-all duration-1000"
          style={{
            background: `radial-gradient(circle, ${meta.glow} 0%, transparent 70%)`,
            transform: `scale(${circleScale + 0.3})`,
          }}
        />
        {/* Main circle */}
        <div
          className="absolute inset-0 rounded-full transition-all duration-1000"
          style={{
            border: `4px solid ${meta.color}`,
            boxShadow: `0 0 30px ${meta.color}70, 0 0 60px ${meta.color}30`,
            transform: `scale(${circleScale})`,
            background: `${meta.color}12`,
          }}
        />
        {/* Countdown */}
        <div className="relative text-center z-10">
          <div className="text-5xl font-black text-white">{secondsLeft}</div>
        </div>
      </div>

      {/* Phase label */}
      <div className="text-center">
        <div className="text-xl font-bold" style={{ color: meta.color }}>{meta.label}</div>
        <div className="text-text-muted text-sm mt-1 italic">{meta.instruction}</div>
      </div>

      {/* Phase indicator strip */}
      <div className="flex gap-1 w-full max-w-xs">
        {(['inhale', 'exhale'] as const).map(p => (
          <div
            key={p}
            className="flex-1 h-1.5 rounded-full transition-all duration-500"
            style={{
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
              background: i < round - 1 ? meta.color : i === round - 1 ? `${meta.color}80` : '#ffffff15',
              boxShadow: i === round - 1 ? `0 0 8px ${meta.color}` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default CoherentBreathingGame;
