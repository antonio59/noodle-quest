import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { GameProps } from '@/types';
import { scaleFromLast } from '@/lib/endless-stage';
import { GameArt } from '@/components/GameArt';

const CONFIG: Record<number, { beats: number; tolerance: number; bpm: number }> = {
  1: { beats: 3, tolerance: 400, bpm: 80 },
  2: { beats: 4, tolerance: 380, bpm: 85 },
  3: { beats: 4, tolerance: 350, bpm: 90 },
  4: { beats: 5, tolerance: 330, bpm: 90 },
  5: { beats: 5, tolerance: 300, bpm: 95 },
  6: { beats: 6, tolerance: 280, bpm: 100 },
  7: { beats: 6, tolerance: 260, bpm: 105 },
  8: { beats: 7, tolerance: 240, bpm: 110 },
  9: { beats: 7, tolerance: 220, bpm: 115 },
  10: { beats: 8, tolerance: 200, bpm: 120 },
};

const ROUNDS_NEEDED = 5;

type Phase = 'ready' | 'listening' | 'tapping' | 'evaluating' | 'done';

const LISTEN_PITCHES = [523, 659, 784, 1047, 880, 988];
const TAP_PITCHES = [659, 784, 988, 1319, 1175, 1397];

function playBeatSound(audioCtx: AudioContext, isTap: boolean, beatIndex = 0) {
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const pitch = isTap
    ? TAP_PITCHES[beatIndex % TAP_PITCHES.length]
    : LISTEN_PITCHES[beatIndex % LISTEN_PITCHES.length];

  if (isTap) {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.6, now + 0.08);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
    const click = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();
    click.type = 'square';
    click.frequency.value = pitch * 1.8;
    clickGain.gain.setValueAtTime(0.08, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    click.connect(clickGain);
    clickGain.connect(audioCtx.destination);
    click.start(now);
    click.stop(now + 0.03);
  } else {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, now + 0.12);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
    const thump = audioCtx.createOscillator();
    const thumpGain = audioCtx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(pitch * 0.25, now);
    thump.frequency.exponentialRampToValueAtTime(pitch * 0.15, now + 0.1);
    thumpGain.gain.setValueAtTime(0.2, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    thump.connect(thumpGain);
    thumpGain.connect(audioCtx.destination);
    thump.start(now);
    thump.stop(now + 0.1);
  }
  if (navigator.vibrate) navigator.vibrate(isTap ? 10 : 20);
}

function getIntervals(times: number[]) {
  const intervals: number[] = [];
  for (let i = 1; i < times.length; i++) intervals.push(times[i] - times[i - 1]);
  return intervals;
}

function EchoTapGame({ stage, onScore, onProgress, onEnd }: GameProps) {
  const config = useMemo(() => scaleFromLast(stage, CONFIG, {
    beats: 0.1, tolerance: -0.1, bpm: 0.05,
  }, {
    beats: 12, tolerance: 100, bpm: 160,
  }), [stage]);
  const beatInterval = 60000 / config.bpm;

  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [statusColor, setStatusColor] = useState('#67e8f9');
  const [feedback, setFeedback] = useState('');
  const [feedbackColor, setFeedbackColor] = useState('#f0a83a');
  const [beatDots, setBeatDots] = useState<Array<'off' | 'on' | 'tap'>>(Array(config.beats).fill('off'));
  const [tapBtnActive, setTapBtnActive] = useState(false);
  const [tapBtnFlash, setTapBtnFlash] = useState(false);
  const [timingBarPct, setTimingBarPct] = useState(0);
  const [timingBarColor, setTimingBarColor] = useState('#4ade80');
  const [accuracyDisplay, setAccuracyDisplay] = useState<number | null>(null);
  const [ripples, setRipples] = useState<{ id: number; size: number }[]>([]);
  const rippleIdRef = useRef(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const patternTimesRef = useRef<number[]>([]);
  const tapTimesRef = useRef<number[]>([]);
  const beatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      timeoutsRef.current = [];
      if (beatTimerRef.current) { clearInterval(beatTimerRef.current); beatTimerRef.current = null; }
      if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    };
  }, []);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  const finishGame = useCallback((finalScore: number, roundsCompleted: number) => {
    if (endedRef.current) return;
    endedRef.current = true;
    const ratio = roundsCompleted / ROUNDS_NEEDED;
    const scoreStars = finalScore >= 120 ? 3 : finalScore >= 70 ? 2 : 1;
    const stars = ratio >= 0.75 ? scoreStars : 1;
    let summary = `Final score: ${finalScore}. `;
    if (stars === 3) summary += 'Incredible rhythm! You have perfect timing! 🥁';
    else if (stars === 2) summary += 'Good beat! Practice counting along to improve your timing.';
    else summary += 'Rhythm takes practice! Try tapping your foot to the beat first.';
    onEnd({ score: finalScore, stars, summary });
  }, [onEnd]);

  const playBeatSequence = useCallback(() => {
    if (endedRef.current) return;
    setPhase('listening');
    setTapBtnActive(false);
    setStatusText('🔊 Listen...');
    setStatusColor('#67e8f9');
    setFeedback('');
    setAccuracyDisplay(null);
    setBeatDots(Array(config.beats).fill('off') as Array<'off' | 'on' | 'tap'>);
    tapTimesRef.current = [];

    const beatTimes: number[] = [];
    let beatCount = 0;

    if (beatTimerRef.current) clearInterval(beatTimerRef.current);
    beatTimerRef.current = setInterval(() => {
      if (endedRef.current) { if (beatTimerRef.current) clearInterval(beatTimerRef.current); return; }
      if (beatCount >= config.beats) {
        if (beatTimerRef.current) clearInterval(beatTimerRef.current);
        patternTimesRef.current = beatTimes;
        setPhase('tapping');
        setTapBtnActive(true);
        setStatusText('🥁 Your turn! Tap to match.');
        setStatusColor('#4ade80');
        setTimingBarPct(0);
        setBeatDots(Array(config.beats).fill('off') as Array<'off' | 'on' | 'tap'>);
        return;
      }

      beatTimes.push(performance.now());
      setBeatDots(prev => {
        const next = [...prev] as ('off' | 'on' | 'tap')[];
        next[beatCount] = 'on';
        return next;
      });
      playBeatSound(getAudioCtx(), false, beatCount);
      const thisBeat = beatCount;
      schedule(() => {
        setBeatDots(prev => {
          const next = [...prev] as ('off' | 'on' | 'tap')[];
          next[thisBeat] = 'off';
          return next;
        });
      }, beatInterval * 0.4);
      beatCount++;
    }, beatInterval);
  }, [config, beatInterval, getAudioCtx, schedule]);

  const advanceRound = useCallback((currentScore: number, currentRound: number) => {
    if (endedRef.current) return;
    onProgress(currentRound / ROUNDS_NEEDED);

    if (currentRound >= ROUNDS_NEEDED) {
      setPhase('done');
      setStatusText('🎉 All done!');
      setStatusColor('#c084fc');
      finishGame(currentScore, currentRound);
    } else {
      setStatusText('✨ Next round...');
      setPhase('evaluating');
      setRound(currentRound + 1);
      schedule(playBeatSequence, 1400);
    }
  }, [onProgress, playBeatSequence, schedule, finishGame]);

  const evaluateRhythm = useCallback((currentScore: number, currentRound: number) => {
    if (endedRef.current) return;
    setPhase('evaluating');

    const patternIntervals = getIntervals(patternTimesRef.current);
    const tapIntervals = getIntervals(tapTimesRef.current);

    if (tapIntervals.length === 0 || patternIntervals.length === 0) {
      const newScore = currentScore + 15;
      setScore(newScore);
      onScore(15);
      setFeedback('✓ Good try!');
      setFeedbackColor('#4ade80');
      setAccuracyDisplay(50);
      setTimingBarPct(50);
      setTimingBarColor('#fbbf24');
      schedule(() => advanceRound(newScore, currentRound), 1500);
      return;
    }

    let totalError = 0;
    const compared = Math.min(patternIntervals.length, tapIntervals.length);
    for (let i = 0; i < compared; i++) totalError += Math.abs(patternIntervals[i] - tapIntervals[i]);
    const avgError = totalError / compared;

    const accuracy = Math.max(0, Math.min(100, Math.round((1 - avgError / (beatInterval * 1.5)) * 100)));
    setTimingBarPct(accuracy);
    const barColor = accuracy >= 70 ? '#4ade80' : accuracy >= 40 ? '#fbbf24' : '#ef4444';
    setTimingBarColor(barColor);
    setAccuracyDisplay(accuracy);

    let points: number;
    let message: string;
    let msgColor: string;

    if (avgError <= config.tolerance * 0.4) {
      points = 30; message = '🎯 Perfect rhythm!'; msgColor = '#4ade80';
    } else if (avgError <= config.tolerance) {
      points = 20; message = '👍 Great timing!'; msgColor = '#4ade80';
    } else if (avgError <= config.tolerance * 1.8) {
      points = 10; message = '🤔 Almost on beat'; msgColor = '#fbbf24';
    } else {
      points = 5; message = '😅 Keep practicing!'; msgColor = '#ef4444';
    }

    const newScore = currentScore + points;
    setScore(newScore);
    onScore(points);
    setFeedback(`${message} — ${accuracy}% accurate (+${points}pts)`);
    setFeedbackColor(msgColor);

    schedule(() => advanceRound(newScore, currentRound), 1600);
  }, [config, beatInterval, onScore, advanceRound, schedule]);

  const handleTap = useCallback(() => {
    if (phase !== 'tapping' || !tapBtnActive) return;

    const now = performance.now();
    tapTimesRef.current.push(now);

    setTapBtnFlash(true);
    setTimeout(() => setTapBtnFlash(false), 80);

    const newRipple = { id: rippleIdRef.current++, size: Math.random() * 30 + 80 };
    setRipples(prev => [...prev, newRipple]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== newRipple.id)), 600);

    const currentBeat = tapTimesRef.current.length - 1;
    playBeatSound(getAudioCtx(), true, currentBeat);
    setBeatDots(prev => {
      const next = [...prev] as ('off' | 'on' | 'tap')[];
      if (currentBeat < next.length) next[currentBeat] = 'tap';
      return next;
    });
    schedule(() => {
      setBeatDots(p => {
        const n = [...p] as ('off' | 'on' | 'tap')[];
        if (currentBeat < n.length) n[currentBeat] = 'off';
        return n;
      });
    }, 200);

    if (patternTimesRef.current.length > 1 && currentBeat > 0) {
      setTimingBarPct((currentBeat / config.beats) * 100);
    }

    if (tapTimesRef.current.length >= config.beats) {
      setTapBtnActive(false);
      evaluateRhythm(score, round);
    }
  }, [phase, tapBtnActive, config, getAudioCtx, evaluateRhythm, score, round, schedule]);

  if (phase === 'ready') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 p-6 text-center">
        <GameArt gameId="echo-tap" emoji="🥁" size={80} />
        <h2 className="text-2xl font-bold text-accent">Echo Tap</h2>
        <div className="bg-card rounded-2xl p-4 max-w-xs w-full space-y-2 text-sm text-text-muted">
          <p>🔊 <span className="text-text">Listen</span> to the beat pattern</p>
          <p>🥁 <span className="text-text">Tap</span> the big button to copy it</p>
          <p>⭐ Match the rhythm as closely as you can!</p>
        </div>
        <div className="text-text-muted text-sm">{ROUNDS_NEEDED} rounds · Stage {stage} · {config.bpm} BPM</div>
        <button
          onClick={() => { setPhase('listening'); schedule(playBeatSequence, 500); }}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 transition-all"
        >
          Let's Play! 🥁
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-between p-4 min-h-[380px]">
      <div className="flex gap-4 bg-card rounded-xl px-4 py-2 w-full max-w-xs justify-between">
        <span className="text-warning font-bold text-sm">Round {round}/{ROUNDS_NEEDED}</span>
        <span className="text-accent text-sm font-bold">{score} pts</span>
        <span className="text-text-muted text-sm">{config.bpm} BPM</span>
      </div>

      <div className="text-base py-2 min-h-[28px] font-semibold text-center" style={{ color: statusColor }}>
        {statusText}
      </div>

      {/* Beat dots */}
      <div className="flex gap-3 py-2 justify-center flex-wrap min-h-[48px]">
        {beatDots.map((state, i) => (
          <div
            key={i}
            className="w-6 h-6 rounded-full transition-all duration-100"
            style={{
              background: state === 'on' ? '#c084fc' : state === 'tap' ? '#4ade80' : '#1a332e',
              transform: state !== 'off' ? 'scale(1.5)' : 'scale(1)',
              boxShadow: state === 'on' ? '0 0 16px #c084fc' : state === 'tap' ? '0 0 16px #4ade80' : 'none',
              border: `2px solid ${state === 'tap' ? '#4ade80' : '#c084fc'}`,
            }}
          />
        ))}
      </div>

      {/* Big tap button */}
      <div className="relative flex items-center justify-center my-2">
        {ripples.map(r => (
          <div
            key={r.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: r.size,
              height: r.size,
              background: 'radial-gradient(circle, #4ade8060, transparent)',
              animation: 'ping 0.6s ease-out forwards',
            }}
          />
        ))}
        <button
          onPointerDown={handleTap}
          disabled={!tapBtnActive}
          className="w-40 h-40 rounded-full text-6xl select-none transition-all duration-75 active:scale-90 disabled:opacity-40 relative overflow-hidden"
          style={{
            border: `5px solid ${tapBtnActive ? '#4ade80' : '#c084fc'}`,
            background: tapBtnFlash
              ? 'radial-gradient(circle, #4ade8060, #1a332e)'
              : 'radial-gradient(circle, #2d2a5e, #1a1833)',
            boxShadow: tapBtnActive
              ? '0 0 30px #4ade8060, 0 0 60px #4ade8020, inset 0 0 20px #4ade8015'
              : '0 0 15px #c084fc30',
            transform: tapBtnFlash ? 'scale(0.93)' : 'scale(1)',
          }}
        >
          🥁
        </button>
      </div>

      {/* Timing bar */}
      <div className="w-full max-w-xs">
        <div className="flex justify-between text-xs text-text-muted mb-1">
          <span>Timing accuracy</span>
          {accuracyDisplay !== null && (
            <span style={{ color: timingBarColor }} className="font-bold">{accuracyDisplay}%</span>
          )}
        </div>
        <div className="w-full h-2.5 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${timingBarPct}%`, background: timingBarColor, boxShadow: `0 0 6px ${timingBarColor}` }}
          />
        </div>
      </div>

      {feedback && (
        <div className="text-sm text-center mt-1 font-medium" style={{ color: feedbackColor }}>
          {feedback}
        </div>
      )}
    </div>
  );
}

export default EchoTapGame;
