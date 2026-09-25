import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameProps } from '@/types';
import { Mountain, Brain, Leaf, Target } from 'lucide-react';
import { GameArt } from '@/components/GameArt';

// Triangle Breathing: inhale Ns, hold Ns, exhale Ns (3 sides of a triangle)

type Phase = 'inhale' | 'hold' | 'exhale' | 'idle' | 'info' | 'done';

const BENEFITS = [
  { icon: Mountain, label: 'Grounds and centers the mind',              color: 'text-accent' },
  { icon: Brain,    label: 'Improves concentration and mental clarity', color: 'text-yellow-400' },
  { icon: Leaf,     label: 'Simple pattern — easy for beginners',       color: 'text-green-400' },
  { icon: Target,   label: 'Builds breath awareness and control',       color: 'text-red-400' },
];

const BEST_FOR = [
  'Beginners new to breathing exercises',
  'Quick grounding during busy days',
  'Before focused work or study sessions',
  'When you need a simple, quick reset',
];

const PHASE_META: Record<string, { label: string; instruction: string; color: string; glow: string; vertex: [number, number] }> = {
  inhale: { label: 'Breathe In',  instruction: 'Fill your lungs slowly...',       color: '#f0a83a', glow: '#f0a83a60', vertex: [100, 20]  },
  hold:   { label: 'Hold',        instruction: 'Hold still at the peak...',       color: '#fbbf24', glow: '#fbbf2460', vertex: [180, 170] },
  exhale: { label: 'Breathe Out', instruction: 'Release steadily all the way...', color: '#4ade80', glow: '#4ade8060', vertex: [20, 170]  },
};

function TriangleBreathingGame({ stage, onScore, onProgress, onMessage, onEnd }: GameProps) {
  const breathLen = Math.min(4 + Math.floor(stage / 3), 10);
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

  const startCycle = useCallback(() => {
    setPhase('inhale');
    phaseRef.current = 'inhale';
    setSecondsLeft(breathLen);
    setRound(1);
    roundRef.current = 1;
    onMessage(`Round 1 — ${breathLen}s Triangle`);
  }, [breathLen, onMessage]);

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
            onScore(10);
            onProgress(newRound / totalRounds);
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
                  summary: `${totalRounds} rounds of triangle breathing complete! You are grounded and centered. ✨`,
                });
              }
              return 0;
            }
            onMessage(`Round ${newRound}/${totalRounds}`);
            next = 'inhale';
          }
          phaseRef.current = next;
          setPhase(next);
          return breathLen;
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
  }, [phase, totalRounds, breathLen, onScore, onProgress, onMessage, onEnd]);

  const estimatedMinutes = Math.ceil(totalRounds * (breathLen * 3) / 60);

  if (phase === 'info') {
    return (
      <div className="h-full overflow-y-auto">
        <div className="p-6 max-w-md mx-auto">
          <div className="text-center mb-6">
            <GameArt gameId="triangle-breathing" emoji="🔺" size={80} className="mb-3" />
            <h2 className="text-2xl font-bold text-accent">Triangle Breathing</h2>
            <p className="text-text-muted text-sm mt-1">Equal inhale-hold-exhale, visual triangle guide</p>
          </div>

          <div className="bg-card rounded-2xl p-4 mb-5">
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3 text-center">The Pattern</div>
            <div className="flex items-center justify-center gap-2 text-sm">
              <div className="bg-accent/20 text-accent px-3 py-2 rounded-xl font-bold text-center">
                <div>In</div><div className="text-xs opacity-70">{breathLen}s</div>
              </div>
              <span className="text-text-muted">→</span>
              <div className="bg-yellow-500/20 text-yellow-400 px-3 py-2 rounded-xl font-bold text-center">
                <div>Hold</div><div className="text-xs opacity-70">{breathLen}s</div>
              </div>
              <span className="text-text-muted">→</span>
              <div className="bg-green-500/20 text-green-400 px-3 py-2 rounded-xl font-bold text-center">
                <div>Out</div><div className="text-xs opacity-70">{breathLen}s</div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-4 mb-5 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Rounds</span>
              <span className="font-bold text-text">{totalRounds}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Breath length</span>
              <span className="font-bold text-text">{breathLen}s per phase</span>
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
        <GameArt gameId="triangle-breathing" emoji="🔺" size={80} className="mb-4" />
        <h2 className="text-2xl font-bold text-accent mb-2">Triangle Breathing</h2>
        <p className="text-text-muted mb-6 max-w-xs">In {breathLen}s → Hold {breathLen}s → Out {breathLen}s. {totalRounds} rounds.</p>
        <button onClick={startCycle} className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95">
          Begin
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="text-7xl mb-4">✨</div>
        <h2 className="text-2xl font-bold mb-2 text-accent">Grounded</h2>
        <p className="text-text-muted mb-2">{totalRounds} rounds completed</p>
        <p className="text-text-muted text-sm mb-6 max-w-xs">Notice how calm and present you feel right now.</p>
        <button onClick={() => { setPhase('idle'); setRound(0); endedRef.current = false; }} className="bg-accent text-bg font-bold px-6 py-2.5 rounded-xl hover:opacity-90">Again</button>
      </div>
    );
  }

  const meta = PHASE_META[phase] || PHASE_META.inhale;
  const sideProgress = (breathLen - secondsLeft) / breathLen;

  // Dot position along the triangle path
  // inhale: bottom-left (20,170) → top (100,20)
  // hold: top (100,20) → bottom-right (180,170)
  // exhale: bottom-right (180,170) → bottom-left (20,170)
  let dotX = 20, dotY = 170;
  if (phase === 'inhale') {
    dotX = 20 + sideProgress * 80;
    dotY = 170 - sideProgress * 150;
  } else if (phase === 'hold') {
    dotX = 100 + sideProgress * 80;
    dotY = 20 + sideProgress * 150;
  } else if (phase === 'exhale') {
    dotX = 180 - sideProgress * 160;
    dotY = 170;
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-5">
      <div className="text-sm text-text-muted">Round {round}/{totalRounds} · {breathLen}s each side</div>

      <div className="relative" style={{ width: 200, height: 200 }}>
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Background triangle */}
          <polygon points="100,20 180,170 20,170" fill="none" stroke={`${meta.color}25`} strokeWidth="3" strokeLinejoin="round" />

          {/* Completed sides */}
          {(phase === 'hold' || phase === 'exhale') && (
            <line x1="20" y1="170" x2="100" y2="20" stroke={meta.color} strokeWidth="4" strokeLinecap="round" opacity="0.7" />
          )}
          {phase === 'exhale' && (
            <line x1="100" y1="20" x2="180" y2="170" stroke={meta.color} strokeWidth="4" strokeLinecap="round" opacity="0.7" />
          )}

          {/* Active side being traced */}
          {phase === 'inhale' && (
            <line x1="20" y1="170" x2={dotX} y2={dotY} stroke={meta.color} strokeWidth="5" strokeLinecap="round" />
          )}
          {phase === 'hold' && (
            <line x1="100" y1="20" x2={dotX} y2={dotY} stroke={meta.color} strokeWidth="5" strokeLinecap="round" />
          )}
          {phase === 'exhale' && (
            <line x1="180" y1="170" x2={dotX} y2={dotY} stroke={meta.color} strokeWidth="5" strokeLinecap="round" />
          )}

          {/* Moving dot */}
          <circle cx={dotX} cy={dotY} r="8" fill={meta.color} style={{ filter: `drop-shadow(0 0 8px ${meta.color})` }} />

          {/* Corner labels */}
          <text x="100" y="12" textAnchor="middle" fill={phase === 'hold' ? meta.color : '#ffffff40'} fontSize="11" fontWeight="bold">HOLD</text>
          <text x="8" y="190" textAnchor="start" fill={phase === 'inhale' ? meta.color : '#ffffff40'} fontSize="11" fontWeight="bold">IN</text>
          <text x="192" y="190" textAnchor="end" fill={phase === 'exhale' ? meta.color : '#ffffff40'} fontSize="11" fontWeight="bold">OUT</text>
        </svg>

        {/* Center countdown */}
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: 20 }}>
          <div className="text-4xl font-black text-white">{secondsLeft}</div>
        </div>
      </div>

      <div className="text-center">
        <div className="text-lg font-bold" style={{ color: meta.color }}>{meta.label}</div>
        <div className="text-text-muted text-sm mt-1 italic">{meta.instruction}</div>
      </div>

      {/* Phase indicator strip */}
      <div className="flex gap-1 w-full max-w-xs">
        {(['inhale', 'hold', 'exhale'] as Phase[]).map(p => (
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
              background: i < round - 1 ? meta.color : i === round - 1 ? meta.color + '80' : '#ffffff15',
              boxShadow: i === round - 1 ? `0 0 8px ${meta.color}` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default TriangleBreathingGame;
