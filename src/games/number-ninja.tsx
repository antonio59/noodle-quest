import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { GameProps } from '@/types';
import { scaleFromLast } from '@/lib/endless-stage';
import { GameArt } from '@/components/GameArt';

const CONFIG: Record<number, { minLen: number; maxLen: number; showTime: number; maxRounds: number }> = {
  1: { minLen: 2, maxLen: 3, showTime: 2500, maxRounds: 4 },
  2: { minLen: 3, maxLen: 4, showTime: 2300, maxRounds: 4 },
  3: { minLen: 3, maxLen: 4, showTime: 2100, maxRounds: 5 },
  4: { minLen: 4, maxLen: 5, showTime: 2000, maxRounds: 5 },
  5: { minLen: 4, maxLen: 6, showTime: 2500, maxRounds: 5 },
  6: { minLen: 5, maxLen: 6, showTime: 2500, maxRounds: 5 },
  7: { minLen: 5, maxLen: 7, showTime: 3000, maxRounds: 5 },
  8: { minLen: 6, maxLen: 8, showTime: 3500, maxRounds: 5 },
  9: { minLen: 7, maxLen: 9, showTime: 4000, maxRounds: 5 },
  10: { minLen: 8, maxLen: 10, showTime: 4500, maxRounds: 5 },
};

const DIGIT_COLORS = ['#ff6e6c', '#c084fc', '#67e8f9', '#4ade80', '#fbbf24', '#ff6e6c', '#f0a83a', '#34d399', '#f472b6', '#60a5fa'];

type Phase = 'ready' | 'memorize' | 'input' | 'result' | 'done';

function NumberNinjaGame({ stage, onScore, onProgress, onEnd }: GameProps) {
  const config = useMemo(() => scaleFromLast(stage, CONFIG, {
    minLen: 0.1, maxLen: 0.08, showTime: -0.1, maxRounds: 0.05,
  }, {
    minLen: 12, maxLen: 16, showTime: 1500, maxRounds: 8,
  }), [stage]);

  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [sequence, setSequence] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackColor, setFeedbackColor] = useState('#f0a83a');
  const [message, setMessage] = useState('');
  const [messageColor, setMessageColor] = useState('#67e8f9');
  const [timeLeft, setTimeLeft] = useState(0);
  const [memorizeDuration, setMemorizeDuration] = useState(0);
  const [inputCorrectMask, setInputCorrectMask] = useState<boolean[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const endedRef = useRef(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

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
      intervalsRef.current.forEach(clearInterval);
    };
  }, []);

  const generateSequence = useCallback((roundNum: number) => {
    const baseLen = config.minLen + Math.floor(roundNum / 2);
    const len = Math.min(config.maxLen, baseLen + Math.floor(Math.random() * 2));
    return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('');
  }, [config]);

  const showNextSequence = useCallback((roundNum: number) => {
    const seq = generateSequence(roundNum);
    setSequence(seq);
    setInputValue('');
    setInputCorrectMask([]);
    setMessage('🧠 Memorize!');
    setMessageColor('#67e8f9');
    setFeedback(`${seq.length} digits — try grouping in pairs!`);
    setFeedbackColor('#f0a83a');
    setPhase('memorize');

    const showDuration = config.showTime + (roundNum * 150);
    setMemorizeDuration(showDuration);
    setTimeLeft(showDuration);

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 50;
        if (next <= 0) {
          clearInterval(timer);
          intervalsRef.current = intervalsRef.current.filter(x => x !== timer);
          return 0;
        }
        return next;
      });
    }, 50);
    intervalsRef.current.push(timer);

    schedule(() => {
      clearInterval(timer);
      intervalsRef.current = intervalsRef.current.filter(x => x !== timer);
      setPhase('input');
      setMessage('⌨️ Type what you remember!');
      setMessageColor('#4ade80');
      setFeedback('');
      schedule(() => inputRef.current?.focus(), 50);
    }, showDuration);
  }, [generateSequence, config.showTime, schedule]);

  const checkAnswer = useCallback((seq: string, input: string, currentScore: number, currentRound: number) => {
    if (phase === 'done') return;
    const answer = input.trim();

    const mask = seq.split('').map((ch, i) => answer[i] === ch);
    setInputCorrectMask(mask);

    if (answer === seq) {
      const points = 20 + (seq.length * 5);
      const newScore = currentScore + points;
      setScore(newScore);
      onScore(points);
      setMessage('✅ Correct!');
      setMessageColor('#4ade80');
      setFeedback(`+${points} points! 🌟`);
      setFeedbackColor('#4ade80');

      if (currentRound >= config.maxRounds) {
        setPhase('done');
        const stars = 3;
        if (endedRef.current) return;
        endedRef.current = true;
        onEnd({
          score: newScore + 50,
          stars,
          summary: `Number Ninja Master! You completed all ${config.maxRounds} rounds! Your memory is incredible! 🏆`,
        });
      } else {
        onProgress(currentRound / config.maxRounds);
        schedule(() => {
          setRound(r => {
            const next = r + 1;
            showNextSequence(next);
            return next;
          });
        }, 1600);
      }
    } else {
      setMessage('❌ Not quite!');
      setMessageColor('#ff6e6c');

      let wrongIdx = -1;
      for (let i = 0; i < Math.max(answer.length, seq.length); i++) {
        if (answer[i] !== seq[i]) { wrongIdx = i; break; }
      }

      if (wrongIdx >= 0) {
        setFeedback(`Position ${wrongIdx + 1}: you typed "${answer[wrongIdx] || '?'}", correct is "${seq[wrongIdx]}"`);
      } else {
        setFeedback(`The sequence was: ${seq}`);
      }
      setFeedbackColor('#ff6e6c');

      schedule(() => {
        setPhase('done');
        const ratio = currentRound / config.maxRounds;
        const stars = ratio >= 0.75 ? 3 : ratio >= 0.4 ? 2 : 1;
        let summary = `You made it to round ${currentRound}! `;
        if (stars === 3) summary += 'So close to perfect! Your number memory is great!';
        else if (stars === 2) summary += 'Good effort! Try grouping numbers in pairs to remember better.';
        else summary += 'Keep practicing! Say the numbers out loud as you memorize.';
        if (endedRef.current) return;
        endedRef.current = true;
        onEnd({ score: currentScore, stars, summary });
      }, 3000);
    }
  }, [phase, config, onScore, onProgress, onEnd, schedule, showNextSequence]);

  const handleSubmit = useCallback(() => {
    checkAnswer(sequence, inputValue, score, round);
  }, [checkAnswer, sequence, inputValue, score, round]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  }, [handleSubmit]);

  if (phase === 'ready') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 p-6 text-center">
        <GameArt gameId="number-ninja" emoji="🥷" size={80} />
        <h2 className="text-2xl font-bold text-accent">Number Ninja</h2>
        <div className="bg-card rounded-2xl p-4 max-w-xs w-full space-y-2 text-sm text-text-muted">
          <p>👁️ <span className="text-text">See</span> the number sequence</p>
          <p>🧠 <span className="text-text">Memorize</span> as fast as you can</p>
          <p>⌨️ <span className="text-text">Type</span> it from memory!</p>
        </div>
        <div className="text-text-muted text-sm">{config.maxRounds} rounds · Stage {stage} · up to {config.maxLen} digits</div>
        <button
          onClick={() => { setRound(1); setScore(0); schedule(() => showNextSequence(1), 300); }}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 transition-all"
        >
          Start! 🥷
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-4 gap-4">
      <div className="flex gap-4 bg-card rounded-xl px-4 py-2">
        <span className="text-warning font-bold text-sm">Round {round}/{config.maxRounds}</span>
        <span className="text-accent text-sm font-bold">{score} pts</span>
      </div>

      {/* Sequence display */}
      <div className="bg-card rounded-2xl px-6 py-5 w-full max-w-xs text-center min-h-[90px] flex flex-col items-center justify-center">
        {phase === 'memorize' && (
          <>
            <div className="flex gap-2 justify-center flex-wrap">
              {sequence.split('').map((digit, i) => (
                <span
                  key={i}
                  className="text-3xl font-bold font-mono w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{
                    color: DIGIT_COLORS[parseInt(digit)],
                    background: `${DIGIT_COLORS[parseInt(digit)]}18`,
                    boxShadow: `0 0 8px ${DIGIT_COLORS[parseInt(digit)]}40`,
                  }}
                >
                  {digit}
                </span>
              ))}
            </div>
            <div className="mt-3 w-32 h-1.5 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-none"
                style={{ width: `${Math.max(0, Math.min(100, (timeLeft / memorizeDuration) * 100))}%`, transition: 'width 0.05s linear' }}
              />
            </div>
          </>
        )}
        {phase === 'input' && (
          <div className="flex gap-2 justify-center flex-wrap">
            {Array.from({ length: sequence.length }, (_, i) => (
              <span
                key={i}
                className="text-3xl font-bold font-mono w-9 h-9 rounded-lg flex items-center justify-center text-text-muted"
                style={{ background: '#1a332e', border: '2px dashed #f0a83a40' }}
              >
                {inputValue[i] !== undefined
                  ? <span style={{ color: inputCorrectMask[i] !== undefined ? (inputCorrectMask[i] ? '#4ade80' : '#ff6e6c') : '#fff' }}>{inputValue[i]}</span>
                  : '?'}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="text-center font-semibold" style={{ color: messageColor }}>
        {message}
      </div>

      {phase === 'input' && (
        <div className="flex flex-col items-center gap-3 w-full max-w-xs">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]*"
            value={inputValue}
            onChange={e => setInputValue(e.target.value.replace(/\D/g, '').slice(0, sequence.length))}
            onKeyDown={handleKeyDown}
            placeholder="Type numbers here..."
            className="w-full px-4 py-3 text-xl text-center bg-card border-2 border-accent rounded-xl text-white font-mono tracking-widest"
          />
          <button
            onClick={handleSubmit}
            disabled={inputValue.length === 0}
            className="bg-success text-bg font-bold px-8 py-3 rounded-xl hover:opacity-90 active:scale-95 disabled:opacity-40"
          >
            Submit! ✓
          </button>
        </div>
      )}

      {feedback && (
        <div className="text-sm text-center max-w-xs" style={{ color: feedbackColor }}>
          {feedback}
        </div>
      )}
    </div>
  );
}

export default NumberNinjaGame;
