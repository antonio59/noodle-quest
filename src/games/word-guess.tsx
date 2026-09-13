import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { GameProps } from '@/types';
import { scaleFromLast } from '@/lib/endless-stage';
import { EN_GB_CORE_WORDS } from '@/data/words/en-gb-core';
import { playMove, playPlace } from '@/lib/feedback';

type Mark = 'correct' | 'present' | 'absent';
type Phase = 'ready' | 'playing' | 'done';

const WORD_LENGTH = 5;
const WORD_POOL = EN_GB_CORE_WORDS
  .filter(w => w.length === WORD_LENGTH && !w.banned)
  .map(w => w.normalised);

const CONFIG: Record<number, { rounds: number; maxGuesses: number }> = {
  1: { rounds: 3, maxGuesses: 6 },
  2: { rounds: 3, maxGuesses: 6 },
  3: { rounds: 4, maxGuesses: 6 },
  4: { rounds: 4, maxGuesses: 5 },
  5: { rounds: 5, maxGuesses: 5 },
};

const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const MARK_PRIORITY: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };

function pickTargets(rounds: number): string[] {
  const pool = [...WORD_POOL];
  const out: string[] = [];
  while (out.length < rounds && pool.length > 0) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

// Standard two-pass grade: exact matches first, then yellows count only
// against letters not already claimed by a green.
function gradeGuess(guess: string, target: string): Mark[] {
  const marks: Mark[] = Array(WORD_LENGTH).fill('absent');
  const remaining: Record<string, number> = {};
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === target[i]) marks[i] = 'correct';
    else remaining[target[i]] = (remaining[target[i]] ?? 0) + 1;
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (marks[i] === 'correct') continue;
    if ((remaining[guess[i]] ?? 0) > 0) {
      marks[i] = 'present';
      remaining[guess[i]]!--;
    }
  }
  return marks;
}

const TILE_STYLE: Record<Mark | 'empty' | 'typing', string> = {
  correct: 'bg-success border-success text-bg',
  present: 'bg-warning border-warning text-bg',
  absent: 'bg-surface border-white/10 text-text-muted',
  typing: 'bg-card border-accent/60 text-text',
  empty: 'bg-card/60 border-white/8 text-text',
};

const KEY_STYLE: Record<Mark | 'unused', string> = {
  correct: 'bg-success text-bg',
  present: 'bg-warning text-bg',
  absent: 'bg-surface text-text-muted/40',
  unused: 'bg-card text-text hover:bg-card-hover',
};

export default function WordGuess({ stage, onScore, onProgress, onEnd, onMessage }: GameProps) {
  const config = useMemo(() => scaleFromLast(stage, CONFIG, {
    rounds: 0.15, maxGuesses: -0.05,
  }, {
    rounds: 8, maxGuesses: 4,
  }), [stage]);

  const [phase, setPhase] = useState<Phase>('ready');
  const [targets, setTargets] = useState<string[]>([]);
  const [round, setRound] = useState(0);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [marks, setMarks] = useState<Mark[][]>([]);
  const [current, setCurrent] = useState('');
  const [keyState, setKeyState] = useState<Record<string, Mark>>({});
  const [solvedCount, setSolvedCount] = useState(0);
  const [score, setScore] = useState(0);
  const [banner, setBanner] = useState('');
  const [shakeRow, setShakeRow] = useState(false);

  const scoreRef = useRef(0);
  const solvedRef = useRef(0);
  const endedRef = useRef(false);
  const roundLockRef = useRef(false); // true during the between-words banner
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onEndRef = useRef(onEnd);
  const onScoreRef = useRef(onScore);
  const onProgressRef = useRef(onProgress);
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);
  useEffect(() => { onScoreRef.current = onScore; }, [onScore]);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current = timersRef.current.filter(x => x !== id);
      if (!endedRef.current) fn();
    }, ms);
    timersRef.current.push(id);
  }, []);

  useEffect(() => {
    endedRef.current = false;
    return () => {
      endedRef.current = true;
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  const target = targets[round] ?? '';

  const finishRound = useCallback((didSolve: boolean, usedGuesses: number) => {
    roundLockRef.current = true;
    const solved = solvedRef.current + (didSolve ? 1 : 0);
    if (didSolve) {
      solvedRef.current = solved;
      setSolvedCount(solved);
      const pts = (config.maxGuesses - usedGuesses + 1) * 10;
      scoreRef.current += pts;
      setScore(scoreRef.current);
      onScoreRef.current(pts);
      setBanner(`🎉 ${target} — +${pts}`);
      onMessageRef.current(`Solved in ${usedGuesses}! +${pts} pts`);
    } else {
      setBanner(`It was ${target}`);
      onMessageRef.current(`The word was ${target}`);
    }
    onProgressRef.current((round + 1) / config.rounds);

    schedule(() => {
      setBanner('');
      if (round + 1 >= config.rounds) {
        if (endedRef.current) return;
        endedRef.current = true;
        setPhase('done');
        const stars = solved >= config.rounds ? 3 : solved >= Math.ceil(config.rounds / 2) ? 2 : 1;
        const summary = solved >= config.rounds
          ? `Word wizard! All ${config.rounds} words solved! 🧙`
          : solved > 0
            ? `You solved ${solved} of ${config.rounds} words. Nice guessing!`
            : `Tough words! Watch which letters turn green and yellow.`;
        onEndRef.current({ score: scoreRef.current, stars, summary });
      } else {
        setRound(r => r + 1);
        setGuesses([]);
        setMarks([]);
        setCurrent('');
        roundLockRef.current = false;
      }
    }, 1600);
  }, [round, config.maxGuesses, config.rounds, target, schedule]);

  const submitGuess = useCallback(() => {
    if (phase !== 'playing' || roundLockRef.current) return;
    if (current.length !== WORD_LENGTH) {
      setShakeRow(true);
      schedule(() => setShakeRow(false), 450);
      return;
    }
    const m = gradeGuess(current, target);
    const nextGuesses = [...guesses, current];
    setGuesses(nextGuesses);
    setMarks(prev => [...prev, m]);
    setKeyState(prev => {
      const next = { ...prev };
      for (let i = 0; i < WORD_LENGTH; i++) {
        const letter = current[i];
        const existing = next[letter];
        if (!existing || MARK_PRIORITY[m[i]] > MARK_PRIORITY[existing]) {
          next[letter] = m[i];
        }
      }
      return next;
    });
    setCurrent('');
    playPlace();

    if (current === target) finishRound(true, nextGuesses.length);
    else if (nextGuesses.length >= config.maxGuesses) finishRound(false, nextGuesses.length);
  }, [phase, current, target, guesses, config.maxGuesses, finishRound, schedule]);

  const pressKey = useCallback((key: string) => {
    if (phase !== 'playing' || roundLockRef.current) return;
    if (key === 'ENTER') { submitGuess(); return; }
    if (key === 'DEL') { setCurrent(c => c.slice(0, -1)); return; }
    if (current.length >= WORD_LENGTH) return;
    setCurrent(c => c + key);
    playMove();
  }, [phase, current.length, submitGuess]);

  // Physical keyboard support (desktop / tablets with keyboards)
  useEffect(() => {
    if (phase !== 'playing') return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter') { e.preventDefault(); pressKey('ENTER'); }
      else if (e.key === 'Backspace') { e.preventDefault(); pressKey('DEL'); }
      else if (/^[a-zA-Z]$/.test(e.key)) pressKey(e.key.toUpperCase());
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, pressKey]);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    solvedRef.current = 0;
    endedRef.current = false;
    roundLockRef.current = false;
    setTargets(pickTargets(config.rounds));
    setRound(0);
    setGuesses([]);
    setMarks([]);
    setCurrent('');
    setKeyState({});
    setSolvedCount(0);
    setScore(0);
    setBanner('');
    setPhase('playing');
    onProgressRef.current(0);
  }, [config.rounds]);

  if (phase === 'ready') {
    return (
      <div className="flex flex-col h-full min-h-[350px] items-center justify-center gap-5 px-4">
        <div className="text-6xl">🟩</div>
        <h2 className="text-xl font-bold text-text">Word Guess</h2>
        <div className="bg-card rounded-2xl p-4 w-full max-w-xs space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Words to solve</span>
            <span className="font-bold text-text">{config.rounds}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Guesses per word</span>
            <span className="font-bold text-text">{config.maxGuesses}</span>
          </div>
        </div>
        <div className="text-text-muted text-sm text-center max-w-xs space-y-1">
          <p>Guess the 5-letter word before you run out of tries.</p>
          <p>
            <span className="text-success font-bold">Green</span> = right spot ·{' '}
            <span className="text-warning font-bold">Yellow</span> = wrong spot
          </p>
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

  if (phase === 'done' || !target) return null;

  const rows: { letters: string; marks?: Mark[]; isCurrent?: boolean }[] = [];
  for (let i = 0; i < config.maxGuesses; i++) {
    if (i < guesses.length) rows.push({ letters: guesses[i], marks: marks[i] });
    else if (i === guesses.length) rows.push({ letters: current.padEnd(WORD_LENGTH, ' '), isCurrent: true });
    else rows.push({ letters: '     ' });
  }

  return (
    <div className="h-full flex flex-col items-center p-3 gap-3">
      <div className="flex justify-between items-center w-full max-w-sm">
        <span className="text-sm font-bold text-text-muted">
          Word {round + 1}/{config.rounds}{solvedCount > 0 ? ` · ${solvedCount} solved` : ''}
        </span>
        <span className="bg-accent/20 text-accent rounded-lg px-2.5 py-1 text-sm font-bold">
          {score} pts
        </span>
      </div>

      {/* Guess grid */}
      <div
        className="grid gap-1.5 w-full max-w-[280px] flex-shrink-0"
        role="grid"
        aria-label="Word guess board"
        style={{ gridTemplateRows: `repeat(${config.maxGuesses}, 1fr)` }}
      >
        {rows.map((row, ri) => (
          <div
            key={ri}
            role="row"
            className={`grid grid-cols-5 gap-1.5 ${shakeRow && row.isCurrent ? 'animate-[shake_0.4s_ease]' : ''}`}
          >
            {row.letters.split('').map((ch, ci) => {
              const mark: Mark | 'empty' | 'typing' = row.marks
                ? row.marks[ci]
                : ch.trim() ? 'typing' : 'empty';
              return (
                <div
                  key={ci}
                  role="gridcell"
                  aria-label={ch.trim() ? `Letter ${ch}` : 'Empty'}
                  className={`aspect-square rounded-lg border-2 flex items-center justify-center text-xl font-black uppercase transition-colors ${TILE_STYLE[mark]}`}
                  style={row.marks ? { animation: `pop-in 0.25s ease ${ci * 60}ms both` } : undefined}
                >
                  {ch.trim()}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Round banner */}
      <div className="min-h-[28px] flex items-center">
        {banner && (
          <span className="text-sm font-bold text-accent animate-[pop-in_0.25s_ease]">{banner}</span>
        )}
      </div>

      {/* On-screen keyboard */}
      <div className="w-full max-w-md mt-auto space-y-1.5 pb-1" role="group" aria-label="Keyboard">
        {KEY_ROWS.map((rowKeys, ri) => (
          <div key={ri} className="flex gap-1.5 justify-center">
            {ri === 2 && (
              <button
                onClick={() => pressKey('ENTER')}
                aria-label="Submit guess"
                className="game-cell flex-[1.6] h-12 rounded-lg bg-accent text-bg text-xs font-black tracking-wide active:scale-95 transition-all"
              >
                ENTER
              </button>
            )}
            {rowKeys.split('').map(k => (
              <button
                key={k}
                onClick={() => pressKey(k)}
                aria-label={`Letter ${k}`}
                className={`game-cell flex-1 max-w-11 h-12 rounded-lg text-base font-bold active:scale-90 transition-all ${KEY_STYLE[keyState[k] ?? 'unused']}`}
              >
                {k}
              </button>
            ))}
            {ri === 2 && (
              <button
                onClick={() => pressKey('DEL')}
                aria-label="Delete letter"
                className="game-cell flex-[1.6] h-12 rounded-lg bg-card text-text text-lg font-bold hover:bg-card-hover active:scale-95 transition-all"
              >
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
