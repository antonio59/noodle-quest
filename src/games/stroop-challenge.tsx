import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { GameProps } from '@/types';
import { scaleFromLast } from '@/lib/endless-stage';
import { GameArt } from '@/components/GameArt';

const COLORS = [
  { name: 'RED',    hex: '#ef4444' },
  { name: 'BLUE',   hex: '#3b82f6' },
  { name: 'GREEN',  hex: '#4ade80' },
  { name: 'YELLOW', hex: '#fbbf24' },
  { name: 'PURPLE', hex: '#9b59b6' },
  { name: 'ORANGE', hex: '#fb923c' },
];

type Mode = 'color' | 'word';
type Phase = 'ready' | 'playing' | 'done';

const CONFIG: Record<number, { rounds: number; timeLimit: number; colorCount: number }> = {
  1:  { rounds: 10, timeLimit: 5000, colorCount: 4 },
  2:  { rounds: 12, timeLimit: 4500, colorCount: 4 },
  3:  { rounds: 14, timeLimit: 4000, colorCount: 4 },
  4:  { rounds: 16, timeLimit: 3500, colorCount: 5 },
  5:  { rounds: 18, timeLimit: 3000, colorCount: 5 },
  6:  { rounds: 20, timeLimit: 2800, colorCount: 5 },
  7:  { rounds: 22, timeLimit: 2600, colorCount: 6 },
  8:  { rounds: 24, timeLimit: 2400, colorCount: 6 },
  9:  { rounds: 26, timeLimit: 2200, colorCount: 6 },
  10: { rounds: 30, timeLimit: 2000, colorCount: 6 },
};

export default function StroopChallenge({ stage, onScore, onProgress, onEnd }: GameProps) {
  const config = useMemo(() => scaleFromLast(stage, CONFIG, {
    rounds: 0.1, timeLimit: -0.1, colorCount: 0,
  }, {
    rounds: 50, timeLimit: 800, colorCount: 6,
  }), [stage]);

  const colors = useMemo(() => COLORS.slice(0, Math.min(config.colorCount ?? 4, 6)), [config.colorCount]);

  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [mode, setMode] = useState<Mode>('color');
  const [wordColor, setWordColor] = useState(colors[0]);
  const [textColor, setTextColor] = useState(colors[1]);
  const [feedback, setFeedback] = useState('');
  const [feedbackGood, setFeedbackGood] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [chosenName, setChosenName] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreRef = useRef(0);
  const correctRef = useRef(0);
  const roundRef = useRef(0);
  const nextRoundRef = useRef<() => void>(() => {});

  const generateRound = useCallback(() => {
    const wordIdx = Math.floor(Math.random() * colors.length);
    let textIdx = Math.floor(Math.random() * colors.length);
    while (textIdx === wordIdx && colors.length > 1) {
      textIdx = Math.floor(Math.random() * colors.length);
    }
    setWordColor(colors[wordIdx]);
    setTextColor(colors[textIdx]);
    setMode(Math.random() > 0.5 ? 'color' : 'word');
    setTimeLeft(config.timeLimit);
    setChosenName(null);
    setLocked(false);
  }, [config.timeLimit, colors]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timerRef.current = null;
    intervalRef.current = null;
  }, []);

  const nextRound = useCallback(() => {
    clearTimers();
    const next = roundRef.current + 1;
    roundRef.current = next;
    setRound(next);
    onProgress(Math.min(next / config.rounds, 1));

    if (next >= config.rounds) {
      const accuracy = config.rounds > 0 ? correctRef.current / config.rounds : 0;
      const stars = accuracy > 0.8 ? 3 : accuracy > 0.5 ? 2 : 1;
      const summary = accuracy > 0.8
        ? `Amazing flexibility! ${correctRef.current}/${config.rounds} correct! 🧠`
        : accuracy > 0.5
          ? `Good job! ${correctRef.current}/${config.rounds} correct. Keep training!`
          : `Keep practicing! The Stroop effect is tricky — you'll get faster!`;
      setPhase('done');
      onEnd({ score: scoreRef.current, stars, summary });
      return;
    }

    setFeedback('');
    generateRound();

    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setTimeLeft(Math.max(0, config.timeLimit - elapsed));
    }, 50);

    timerRef.current = setTimeout(() => {
      setStreak(0);
      setLocked(true);
      setFeedback('⏰ Too slow!');
      setFeedbackGood(false);
      setTimeout(() => nextRoundRef.current(), 700);
    }, config.timeLimit);
  }, [config, clearTimers, generateRound, onProgress, onEnd]);

  useEffect(() => { nextRoundRef.current = nextRound; }, [nextRound]);

  const handleAnswer = useCallback((chosen: typeof COLORS[0]) => {
    if (phase !== 'playing' || locked) return;
    clearTimers();
    setLocked(true);
    setChosenName(chosen.name);

    const correctAnswer = mode === 'color' ? textColor : wordColor;
    const isCorrect = chosen.name === correctAnswer.name;

    if (isCorrect) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      const pts = 10 + Math.min(newStreak * 2, 20);
      scoreRef.current += pts;
      setScore(scoreRef.current);
      onScore(pts);
      correctRef.current += 1;
      setCorrect(c => c + 1);
      setFeedback(newStreak >= 5 ? `🔥 ${newStreak} streak! +${pts}` : `✓ +${pts}`);
      setFeedbackGood(true);
    } else {
      setStreak(0);
      setFeedback(`✗ It was "${correctAnswer.name}"`);
      setFeedbackGood(false);
    }

    setTimeout(() => nextRoundRef.current(), 700);
  }, [phase, locked, mode, textColor, wordColor, streak, clearTimers, onScore]);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    correctRef.current = 0;
    roundRef.current = 0;
    setScore(0);
    setRound(0);
    setCorrect(0);
    setStreak(0);
    setFeedback('');
    setLocked(false);
    setChosenName(null);
    setPhase('playing');
    generateRound();

    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setTimeLeft(Math.max(0, config.timeLimit - elapsed));
    }, 50);

    timerRef.current = setTimeout(() => {
      setStreak(0);
      setLocked(true);
      setFeedback('⏰ Too slow!');
      setFeedbackGood(false);
      setTimeout(() => nextRoundRef.current(), 700);
    }, config.timeLimit);
  }, [config.timeLimit, generateRound]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  if (phase === 'ready') {
    return (
      <div className="flex flex-col h-full min-h-[350px] items-center justify-center gap-5 px-4">
        <GameArt gameId="stroop-challenge" emoji="🧩" size={80} />
        <h2 className="text-xl font-bold text-text">Stroop Challenge</h2>
        <div className="bg-card rounded-2xl p-4 w-full max-w-sm space-y-3 text-sm">
          <div className="text-center text-text-muted mb-1 font-semibold text-xs uppercase tracking-wide">How it works</div>
          <div className="bg-surface rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="bg-accent/20 text-accent text-xs font-bold px-2 py-1 rounded-lg">TEXT COLOR</span>
              <span className="text-text-muted text-sm">= tap the <em>ink color</em> of the word</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-teal-500/20 text-teal-300 text-xs font-bold px-2 py-1 rounded-lg">WORD</span>
              <span className="text-text-muted text-sm">= tap what the <em>word says</em></span>
            </div>
          </div>
          <div className="text-center">
            <span className="text-3xl font-black" style={{ color: '#4ade80' }}>RED</span>
            <span className="block text-xs text-text-muted mt-1">Example: this says "RED" but is written in green</span>
          </div>
        </div>
        <button
          onClick={startGame}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 transition-all"
        >
          Start Game
        </button>
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, (timeLeft / config.timeLimit) * 100));
  const barColor = pct > 60 ? '#4ade80' : pct > 30 ? '#fbbf24' : '#ef4444';
  const correctAnswer = mode === 'color' ? textColor : wordColor;

  return (
    <div className="flex flex-col h-full min-h-[350px]">
      <div className="flex justify-between items-center px-4 py-2 bg-surface rounded-t-xl border-b border-white/5">
        <div className="text-accent font-bold text-sm">Score: {score}</div>
        <div className="text-text-muted text-sm">{round + 1}/{config.rounds}</div>
        <div className={`text-sm font-bold ${streak >= 3 ? 'text-orange-400' : 'text-text-muted'}`}>
          {streak >= 3 ? '🔥' : '⭐'} {streak}
        </div>
      </div>

      <div className="w-full h-1.5 bg-card">
        <div
          className="h-full transition-none"
          style={{ width: `${pct}%`, background: barColor, transition: 'width 0.05s linear, background 0.5s ease' }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4">
        <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${
          mode === 'color' ? 'bg-accent/20 text-accent' : 'bg-teal-500/20 text-teal-300'
        }`}>
          {mode === 'color' ? '🎨 Tap the TEXT COLOR' : '📝 Tap the WORD'}
        </div>

        <div
          className="text-5xl sm:text-6xl font-black tracking-wider select-none"
          style={{ color: textColor.hex }}
        >
          {wordColor.name}
        </div>

        {feedback ? (
          <div className={`text-base font-bold min-h-[24px] text-center ${feedbackGood ? 'text-green-400' : 'text-red-400'}`}>
            {feedback}
          </div>
        ) : (
          <div className="min-h-[24px]" />
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 w-full max-w-sm">
          {colors.map(c => {
            const isChosen = chosenName === c.name;
            const isCorrectBtn = c.name === correctAnswer.name;
            let border = `2px solid ${c.hex}40`;
            let bg = `${c.hex}15`;
            if (locked && isChosen && isCorrectBtn) { border = `2px solid #4ade80`; bg = '#4ade8025'; }
            else if (locked && isChosen && !isCorrectBtn) { border = `2px solid #ef4444`; bg = '#ef444425'; }
            else if (locked && isCorrectBtn && chosenName && !isCorrectBtn) { border = `2px solid #4ade80`; bg = '#4ade8015'; }
            return (
              <button
                key={c.name}
                onClick={() => handleAnswer(c)}
                disabled={locked}
                className="py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 hover:opacity-90 disabled:cursor-default"
                style={{ borderWidth: 2, borderStyle: 'solid', borderColor: border.replace('2px solid ', ''), color: c.hex, background: bg }}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
