import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { GameProps } from '@/types';
import { scaleFromLast } from '@/lib/endless-stage';
import { playMove, playCapture, playLose } from '@/lib/feedback';

type Phase = 'ready' | 'playing' | 'done';
type MoleType = 'mole' | 'gold' | 'decoy';

interface Mole {
  hole: number;
  type: MoleType;
  /** Virtual-clock ms when this mole retreats. */
  until: number;
  id: number;
}

const HOLES = 9;
const TICK_MS = 100;

const CONFIG: Record<number, { duration: number; spawnMs: number; upMs: number; decoyPct: number; goldPct: number }> = {
  1: { duration: 30, spawnMs: 1300, upMs: 1700, decoyPct: 0.08, goldPct: 0.10 },
  2: { duration: 30, spawnMs: 1200, upMs: 1500, decoyPct: 0.10, goldPct: 0.10 },
  3: { duration: 35, spawnMs: 1100, upMs: 1400, decoyPct: 0.12, goldPct: 0.10 },
  4: { duration: 35, spawnMs: 1000, upMs: 1250, decoyPct: 0.14, goldPct: 0.12 },
  5: { duration: 40, spawnMs: 900,  upMs: 1150, decoyPct: 0.16, goldPct: 0.12 },
};

const MOLE_EMOJI: Record<MoleType, string> = { mole: '🐹', gold: '⭐', decoy: '💣' };

export default function MoleMash({ stage, onScore, onProgress, onEnd, onMessage, paused }: GameProps) {
  const config = useMemo(() => scaleFromLast(stage, CONFIG, {
    spawnMs: -0.06, upMs: -0.06, decoyPct: 0.05, goldPct: 0.02,
  }, {
    spawnMs: 550, upMs: 750, decoyPct: 0.25, goldPct: 0.15,
  }), [stage]);

  const [phase, setPhase] = useState<Phase>('ready');
  const [moles, setMoles] = useState<Mole[]>([]);
  const [timeLeft, setTimeLeft] = useState(config.duration);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [whacked, setWhacked] = useState<number | null>(null); // hole flashed on hit

  // Virtual clock: only advances on unpaused ticks, so backgrounding the
  // app freezes moles in place instead of letting them all expire.
  const clockRef = useRef(0);
  const nextSpawnAtRef = useRef(0);
  const moleIdRef = useRef(0);
  const molesRef = useRef<Mole[]>([]);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const hitsRef = useRef(0);
  const missesRef = useRef(0);
  const pausedRef = useRef(!!paused);
  const endedRef = useRef(false);
  const onEndRef = useRef(onEnd);
  const onScoreRef = useRef(onScore);
  const onProgressRef = useRef(onProgress);
  const onMessageRef = useRef(onMessage);
  useEffect(() => { pausedRef.current = !!paused; }, [paused]);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);
  useEffect(() => { onScoreRef.current = onScore; }, [onScore]);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { molesRef.current = moles; }, [moles]);

  const finish = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    setPhase('done');
    setMoles([]);
    const spawns = Math.floor((config.duration * 1000) / config.spawnMs);
    const par = Math.round(spawns * (1 - config.decoyPct) * 10 * 0.75);
    const finalScore = scoreRef.current;
    const stars = finalScore >= par ? 3 : finalScore >= Math.round(par * 0.55) ? 2 : 1;
    const summary = finalScore >= par
      ? `Super smashing! ${hitsRef.current} moles whacked — lightning reflexes! ⚡`
      : hitsRef.current > 0
        ? `You whacked ${hitsRef.current} moles${missesRef.current > 0 ? ` — ${missesRef.current} got away` : ''}. Watch for the golden ones — they're worth triple!`
        : `The moles were too sneaky this time. Tap them before they hide!`;
    onEndRef.current({ score: finalScore, stars, summary });
  }, [config.duration, config.spawnMs, config.decoyPct]);

  // Game loop on the virtual clock.
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => {
      if (pausedRef.current) return;
      clockRef.current += TICK_MS;
      const now = clockRef.current;

      // Retire expired moles — unwhacked normal/gold moles break the streak.
      const expired = molesRef.current.filter(m => m.until <= now);
      if (expired.length > 0) {
        if (expired.some(m => m.type !== 'decoy')) {
          missesRef.current += expired.filter(m => m.type !== 'decoy').length;
          streakRef.current = 0;
          setStreak(0);
        }
        setMoles(prev => prev.filter(m => m.until > now));
      }

      // Spawn
      if (now >= nextSpawnAtRef.current) {
        const occupied = new Set(molesRef.current.map(m => m.hole));
        const free = Array.from({ length: HOLES }, (_, i) => i).filter(h => !occupied.has(h));
        if (free.length > 0) {
          const hole = free[Math.floor(Math.random() * free.length)];
          const roll = Math.random();
          const type: MoleType = roll < config.decoyPct ? 'decoy' : roll < config.decoyPct + config.goldPct ? 'gold' : 'mole';
          const mole: Mole = { hole, type, until: now + config.upMs, id: ++moleIdRef.current };
          molesRef.current = [...molesRef.current, mole];
          setMoles(molesRef.current);
        }
        nextSpawnAtRef.current = now + config.spawnMs * (0.75 + Math.random() * 0.5);
      }

      // Countdown + end
      const remaining = Math.max(0, config.duration * 1000 - now);
      setTimeLeft(Math.ceil(remaining / 1000));
      onProgressRef.current(Math.min(1, now / (config.duration * 1000)));
      if (remaining <= 0) finish();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase, config.duration, config.spawnMs, config.upMs, config.decoyPct, config.goldPct, finish]);

  const whack = useCallback((hole: number) => {
    if (phase !== 'playing') return;
    const mole = molesRef.current.find(m => m.hole === hole);
    if (!mole) return;
    molesRef.current = molesRef.current.filter(m => m.id !== mole.id);
    setMoles(molesRef.current);
    setWhacked(hole);
    setTimeout(() => setWhacked(h => (h === hole ? null : h)), 250);

    if (mole.type === 'decoy') {
      const pts = Math.min(15, scoreRef.current);
      scoreRef.current -= pts;
      streakRef.current = 0;
      setScore(scoreRef.current);
      setStreak(0);
      if (pts > 0) onScoreRef.current(-pts);
      onMessageRef.current('💥 Ouch! That was a stink bomb! -15');
      playLose();
      return;
    }

    const base = mole.type === 'gold' ? 30 : 10;
    const newStreak = streakRef.current + 1;
    const bonus = newStreak >= 3 ? Math.min(newStreak * 2, 20) : 0;
    const pts = base + bonus;
    scoreRef.current += pts;
    hitsRef.current += 1;
    streakRef.current = newStreak;
    setScore(scoreRef.current);
    setStreak(newStreak);
    onScoreRef.current(pts);
    if (mole.type === 'gold') onMessageRef.current(`⭐ Golden mole! +${pts}`);
    else if (newStreak >= 5) onMessageRef.current(`🔥 ${newStreak}x streak! +${pts}`);
    playCapture();
  }, [phase]);

  const startGame = useCallback(() => {
    endedRef.current = false;
    clockRef.current = 0;
    nextSpawnAtRef.current = 600; // small beat before the first mole
    moleIdRef.current = 0;
    molesRef.current = [];
    scoreRef.current = 0;
    streakRef.current = 0;
    hitsRef.current = 0;
    missesRef.current = 0;
    setMoles([]);
    setScore(0);
    setStreak(0);
    setTimeLeft(config.duration);
    setPhase('playing');
    onProgressRef.current(0);
  }, [config.duration]);

  if (phase === 'ready') {
    return (
      <div className="flex flex-col h-full min-h-[350px] items-center justify-center gap-5 px-4">
        <div className="text-6xl">🔨</div>
        <h2 className="text-xl font-bold text-text">Mole Mash</h2>
        <div className="bg-card rounded-2xl p-4 w-full max-w-xs space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Time</span>
            <span className="font-bold text-text">{config.duration}s</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Golden moles</span>
            <span className="font-bold text-warning">3× points</span>
          </div>
        </div>
        <p className="text-text-muted text-sm text-center max-w-xs">
          Tap the moles 🐹 before they hide! Golden ones are worth triple —
          but don't touch the stink bombs 💣!
        </p>
        <button
          onClick={startGame}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 transition-all"
        >
          Start Game
        </button>
      </div>
    );
  }

  const moleAt = (hole: number) => moles.find(m => m.hole === hole);

  return (
    <div className="h-full flex flex-col items-center p-3 gap-3">
      <div className="flex gap-3 bg-card rounded-xl px-4 py-2 text-sm">
        <span className="text-accent font-bold">Score: {score}</span>
        <span className={`font-bold ${timeLeft <= 5 ? 'text-danger animate-pulse' : 'text-text-muted'}`}>
          ⏱ {timeLeft}s
        </span>
        {streak >= 3 && <span className="text-orange-400 font-bold">🔥 {streak}x</span>}
      </div>

      <div
        className="grid grid-cols-3 gap-3 w-full max-w-[340px]"
        role="group"
        aria-label="Mole holes"
      >
        {Array.from({ length: HOLES }, (_, i) => {
          const mole = moleAt(i);
          return (
            <button
              key={i}
              onPointerDown={() => whack(i)}
              aria-label={mole ? `Hole ${i + 1}: ${mole.type === 'decoy' ? 'stink bomb — avoid!' : mole.type === 'gold' ? 'golden mole!' : 'mole!'}` : `Hole ${i + 1}: empty`}
              className={`game-cell aspect-square rounded-2xl flex items-center justify-center text-4xl transition-all select-none ${
                whacked === i
                  ? 'bg-success/30 ring-2 ring-success'
                  : mole
                    ? mole.type === 'decoy'
                      ? 'bg-danger/20 border border-danger/40'
                      : mole.type === 'gold'
                        ? 'bg-warning/25 border border-warning/50 animate-[pop-in_0.15s_ease]'
                        : 'bg-card-hover border border-white/15 animate-[pop-in_0.15s_ease]'
                    : 'bg-card border border-white/5'
              }`}
            >
              {mole ? MOLE_EMOJI[mole.type] : <span className="text-white/5 text-2xl">●</span>}
            </button>
          );
        })}
      </div>

      <p className="text-text-muted text-xs text-center">
        🐹 +10 · ⭐ +30 · 💣 −15 · streaks earn bonus points
      </p>
    </div>
  );
}
