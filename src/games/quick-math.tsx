import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { GameProps } from '@/types';
import { scaleFromLast } from '@/lib/endless-stage';
import { GameArt } from '@/components/GameArt';

type Phase = 'ready' | 'playing' | 'done';
type AnswerState = 'correct' | 'wrong' | 'timeout' | null;

interface Problem {
  a: number;
  b: number;
  op: '+' | '-' | '×' | '÷';
  answer: number;
}

const CONFIG: Record<number, { problems: number; timeLimit: number; maxNum: number; useDivision: boolean }> = {
  1:  { problems: 10, timeLimit: 8000, maxNum: 10,  useDivision: false },
  2:  { problems: 12, timeLimit: 7000, maxNum: 12,  useDivision: false },
  3:  { problems: 14, timeLimit: 6500, maxNum: 15,  useDivision: false },
  4:  { problems: 16, timeLimit: 6000, maxNum: 18,  useDivision: false },
  5:  { problems: 18, timeLimit: 5500, maxNum: 20,  useDivision: true  },
  6:  { problems: 20, timeLimit: 5000, maxNum: 25,  useDivision: true  },
  7:  { problems: 22, timeLimit: 4800, maxNum: 30,  useDivision: true  },
  8:  { problems: 24, timeLimit: 4500, maxNum: 35,  useDivision: true  },
  9:  { problems: 26, timeLimit: 4200, maxNum: 40,  useDivision: true  },
  10: { problems: 30, timeLimit: 4000, maxNum: 50,  useDivision: true  },
};

function makeProblem(maxNum: number, useDivision: boolean): Problem {
  const ops: ('+' | '-' | '×' | '÷')[] = useDivision
    ? ['+', '+', '-', '-', '×', '÷']
    : ['+', '+', '-', '×'];
  const op = ops[Math.floor(Math.random() * ops.length)];

  if (op === '+') {
    const a = Math.floor(Math.random() * maxNum) + 1;
    const b = Math.floor(Math.random() * maxNum) + 1;
    return { a, b, op, answer: a + b };
  } else if (op === '-') {
    let a = Math.floor(Math.random() * maxNum) + 1;
    let b = Math.floor(Math.random() * maxNum) + 1;
    if (a < b) [a, b] = [b, a];
    return { a, b, op, answer: a - b };
  } else if (op === '×') {
    const a = Math.floor(Math.random() * Math.min(maxNum, 12)) + 1;
    const b = Math.floor(Math.random() * Math.min(maxNum, 12)) + 1;
    return { a, b, op, answer: a * b };
  } else {
    const b = Math.floor(Math.random() * 10) + 2;
    const answer = Math.floor(Math.random() * 10) + 1;
    return { a: b * answer, b, op: '÷', answer };
  }
}

function makeChoices(problem: Problem): number[] {
  const choices = new Set<number>();
  choices.add(problem.answer);
  let attempts = 0;
  while (choices.size < 4 && attempts < 100) {
    attempts++;
    const spread = Math.max(3, Math.floor(problem.answer * 0.4));
    const offset = Math.floor(Math.random() * spread * 2) - spread;
    if (offset === 0) continue;
    const fake = problem.answer + offset;
    if (fake >= 0) choices.add(fake);
  }
  return Array.from(choices).sort(() => Math.random() - 0.5);
}

export default function QuickMath({ stage, onScore, onProgress, onEnd, paused }: GameProps) {
  const config = useMemo(() => scaleFromLast(stage, CONFIG, {
    problems: 0.1, timeLimit: -0.1, maxNum: 0.1,
  }, {
    problems: 50, timeLimit: 1500, maxNum: 100,
  }), [stage]);

  const [phase, setPhase] = useState<Phase>('ready');
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [problem, setProblem] = useState<Problem>(() => makeProblem(config.maxNum, config.useDivision));
  const [choices, setChoices] = useState<number[]>([]);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'good' | 'bad' | ''>('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [answerState, setAnswerState] = useState<AnswerState>(null);
  const [chosenIdx, setChosenIdx] = useState<number | null>(null);
  const [scorePopup, setScorePopup] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreRef = useRef(0);
  const correctRef = useRef(0);
  // Mirror of state the timer callbacks need after a pause/resume — the
  // timeout closure is recreated on resume so it can't capture stale values.
  const timeLeftRef = useRef(0);
  const problemRef = useRef(problem);
  const indexRef = useRef(index);
  const countdownActiveRef = useRef(false);
  const advancePendingRef = useRef(false);
  const advanceRef = useRef<(nextIndex: number, newCorrect: number) => void>(() => {});
  useEffect(() => { problemRef.current = problem; }, [problem]);
  useEffect(() => { indexRef.current = index; }, [index]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timerRef.current = null;
    intervalRef.current = null;
    countdownActiveRef.current = false;
    advancePendingRef.current = false;
  }, []);

  // (Re)starts the per-problem countdown for `ms` — used at problem start
  // and when resuming from pause with time remaining.
  const beginCountdown = useCallback((ms: number) => {
    const startTime = Date.now();
    countdownActiveRef.current = true;
    timeLeftRef.current = ms;
    setTimeLeft(ms);
    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, ms - (Date.now() - startTime));
      timeLeftRef.current = remaining;
      setTimeLeft(remaining);
    }, 50);
    timerRef.current = setTimeout(() => {
      countdownActiveRef.current = false;
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      const p = problemRef.current;
      setAnswerState('timeout');
      setStreak(0);
      setFeedback(`⏰ ${p.a} ${p.op} ${p.b} = ${p.answer}`);
      setFeedbackType('bad');
      advancePendingRef.current = true;
      timerRef.current = setTimeout(() => {
        advancePendingRef.current = false;
        advanceRef.current(indexRef.current + 1, correctRef.current);
      }, 900);
    }, ms);
  }, []);

  const advance = useCallback((nextIndex: number, newCorrect: number) => {
    clearTimers();
    setIndex(nextIndex);
    setAnswerState(null);
    setChosenIdx(null);
    onProgress(Math.min(nextIndex / config.problems, 1));

    if (nextIndex >= config.problems) {
      const accuracy = config.problems > 0 ? newCorrect / config.problems : 0;
      const stars = accuracy > 0.85 ? 3 : accuracy > 0.55 ? 2 : 1;
      const summary = accuracy > 0.85
        ? `Lightning fast! ${newCorrect}/${config.problems} correct! ⚡`
        : accuracy > 0.55
          ? `Nice work! ${newCorrect}/${config.problems} correct. Keep sharpening your mind!`
          : `Practice makes perfect! ${newCorrect}/${config.problems} correct. Try again!`;
      setPhase('done');
      onEnd({ score: scoreRef.current, stars, summary });
      return;
    }

    setFeedback('');
    setFeedbackType('');
    setScorePopup(null);
    const p = makeProblem(config.maxNum, config.useDivision);
    const ch = makeChoices(p);
    setProblem(p);
    setChoices(ch);
    beginCountdown(config.timeLimit);
  }, [config.maxNum, config.useDivision, config.timeLimit, config.problems, clearTimers, beginCountdown, onProgress, onEnd]);

  useEffect(() => { advanceRef.current = advance; }, [advance]);

  // Freeze the countdown while the page is hidden / pause overlay is up,
  // and pick it back up where it left off on resume.
  useEffect(() => {
    if (paused) {
      clearTimers();
      return;
    }
    if (phase !== 'playing' || countdownActiveRef.current || advancePendingRef.current) return;
    if (answerState === null) {
      if (timeLeftRef.current > 0) beginCountdown(timeLeftRef.current);
    } else {
      // A post-answer advance was frozen by the pause — resume it.
      advancePendingRef.current = true;
      timerRef.current = setTimeout(() => {
        advancePendingRef.current = false;
        advanceRef.current(indexRef.current + 1, correctRef.current);
      }, 400);
    }
  }, [paused, phase, answerState, clearTimers, beginCountdown]);

  const handleAnswer = useCallback((choice: number, idx: number) => {
    if (phase !== 'playing' || answerState !== null) return;
    clearTimers();
    setChosenIdx(idx);

    if (choice === problem.answer) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      const speedBonus = timeLeft > config.timeLimit * 0.5 ? 5 : 0;
      const pts = 10 + Math.min(newStreak * 2, 20) + speedBonus;
      scoreRef.current += pts;
      correctRef.current += 1;
      setScore(scoreRef.current);
      onScore(pts);
      setCorrect(c => c + 1);
      setAnswerState('correct');
      setFeedback(newStreak >= 5 ? '🔥 Streak!' : newStreak >= 3 ? '⚡ Nice streak!' : '✓ Correct!');
      setFeedbackType('good');
      setScorePopup(`+${pts}`);
    } else {
      setStreak(0);
      setAnswerState('wrong');
      setFeedback(`${problem.a} ${problem.op} ${problem.b} = ${problem.answer}`);
      setFeedbackType('bad');
    }

    const snap = correctRef.current;
    advancePendingRef.current = true;
    timerRef.current = setTimeout(() => {
      advancePendingRef.current = false;
      advance(index + 1, snap);
    }, 800);
  }, [phase, answerState, problem, streak, timeLeft, config.timeLimit, clearTimers, advance, index, onScore]);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    correctRef.current = 0;
    setScore(0);
    setIndex(0);
    setCorrect(0);
    setStreak(0);
    setFeedback('');
    setFeedbackType('');
    setAnswerState(null);
    setChosenIdx(null);
    setScorePopup(null);
    setPhase('playing');

    const p = makeProblem(config.maxNum, config.useDivision);
    const ch = makeChoices(p);
    setProblem(p);
    setChoices(ch);
    beginCountdown(config.timeLimit);
  }, [config, beginCountdown]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  if (phase === 'ready') {
    return (
      <div className="flex flex-col h-full min-h-[350px] items-center justify-center gap-5 px-4">
        <GameArt gameId="quick-math" emoji="🧮" size={80} />
        <h2 className="text-xl font-bold text-text">Quick Math</h2>
        <div className="bg-card rounded-2xl p-4 w-full max-w-xs space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Problems</span>
            <span className="font-bold text-text">{config.problems}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Time per problem</span>
            <span className="font-bold text-text">{(config.timeLimit / 1000).toFixed(1)}s</span>
          </div>
          {config.useDivision && (
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Operations</span>
              <span className="font-bold text-accent">+ − × ÷</span>
            </div>
          )}
        </div>
        <p className="text-text-muted text-sm text-center max-w-xs">
          Faster answers = bonus points. Build a streak for even more!
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

  const pct = Math.max(0, Math.min(100, (timeLeft / config.timeLimit) * 100));
  const barColor = pct > 50 ? '#4ade80' : pct > 25 ? '#fbbf24' : '#ef4444';

  return (
    <div className="flex flex-col h-full min-h-[350px]">
      <div className="flex justify-between items-center px-4 py-2 bg-surface rounded-t-xl border-b border-white/5">
        <div className="text-accent font-bold">Score: {score}</div>
        <div className="text-text-muted text-sm">{index + 1}/{config.problems}</div>
        <div className={`text-sm font-bold flex items-center gap-1 ${streak >= 3 ? 'text-orange-400' : 'text-text-muted'}`}>
          {streak >= 3 ? '🔥' : '⭐'} {streak}
        </div>
      </div>

      <div className="w-full h-1.5 bg-card">
        <div
          className="h-full transition-none"
          style={{ width: `${pct}%`, background: barColor, transition: 'width 0.05s linear, background 0.5s ease' }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4 relative">
        {scorePopup && (
          <div
            key={scorePopup + index}
            className="absolute top-4 right-8 text-2xl font-black text-green-400 pointer-events-none"
            style={{ animation: 'floatUp 0.8s ease-out forwards' }}
          >
            {scorePopup}
          </div>
        )}

        <div className="text-4xl sm:text-5xl font-black text-text tracking-wide text-center">
          {problem.a} <span className="text-accent">{problem.op}</span> {problem.b} <span className="text-text-muted">=</span> <span className="text-accent">?</span>
        </div>

        {feedback && (
          <div className={`text-base font-bold min-h-[24px] text-center ${feedbackType === 'good' ? 'text-green-400' : 'text-red-400'}`}>
            {feedback}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
          {choices.map((c, i) => {
            const isChosen = chosenIdx === i;
            const isCorrectChoice = c === problem.answer;
            let bg = 'bg-card hover:bg-card-hover border-white/5';
            if (isChosen && answerState === 'correct') bg = 'bg-green-500/30 border-green-400';
            else if (isChosen && answerState === 'wrong') bg = 'bg-red-500/30 border-red-400';
            else if (!isChosen && answerState === 'wrong' && isCorrectChoice) bg = 'bg-green-500/20 border-green-500/50';
            return (
              <button
                key={`${index}-${i}`}
                onClick={() => handleAnswer(c, i)}
                disabled={answerState !== null}
                className={`text-text font-bold py-4 rounded-xl text-xl border-2 transition-all active:scale-95 ${bg}`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-40px); }
        }
      `}</style>
    </div>
  );
}
