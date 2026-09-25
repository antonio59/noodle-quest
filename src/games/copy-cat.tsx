import { useState, useCallback, useRef, useMemo } from 'react';
import type { GameProps } from '@/types';
import { scaleFromLast } from '@/lib/endless-stage';
import { GameArt } from '@/components/GameArt';

const COLOR_DATA = [
  { color: '#ff6e6c', emoji: '🔴' },
  { color: '#4ade80', emoji: '🟢' },
  { color: '#67e8f9', emoji: '🔵' },
  { color: '#fbbf24', emoji: '🟡' },
  { color: '#c084fc', emoji: '🟣' },
  { color: '#f472b6', emoji: '🩷' },
  { color: '#fb923c', emoji: '🟠' },
  { color: '#a3e635', emoji: '🟩' },
  { color: '#06b6d4', emoji: '💠' },
  { color: '#a0522d', emoji: '🟤' },
];

const CONFIG: Record<number, { colors: number; startLength: number; maxRounds: number; speed: number }> = {
  1:  { colors: 4, startLength: 2, maxRounds: 4,  speed: 700 },
  2:  { colors: 4, startLength: 2, maxRounds: 5,  speed: 650 },
  3:  { colors: 4, startLength: 3, maxRounds: 5,  speed: 600 },
  4:  { colors: 6, startLength: 3, maxRounds: 5,  speed: 550 },
  5:  { colors: 6, startLength: 3, maxRounds: 6,  speed: 500 },
  6:  { colors: 6, startLength: 4, maxRounds: 6,  speed: 480 },
  7:  { colors: 8, startLength: 4, maxRounds: 6,  speed: 450 },
  8:  { colors: 8, startLength: 4, maxRounds: 7,  speed: 420 },
  9:  { colors: 8, startLength: 5, maxRounds: 7,  speed: 400 },
  10: { colors: 8, startLength: 5, maxRounds: 8,  speed: 380 },
};

type Phase = 'intro' | 'announce' | 'watching' | 'playing' | 'done';
type Mode  = 'copy' | 'reverse';

function CopyCatGame({ stage, onScore, onProgress, onMessage, onEnd }: GameProps) {
  const config = useMemo(() => scaleFromLast(stage, CONFIG, {
    colors: 0.15, startLength: 0.15, maxRounds: 0.1, speed: -0.15,
  }, { colors: 12, startLength: 8, maxRounds: 12, speed: 250 }), [stage]);

  const [phase, setPhase]           = useState<Phase>('intro');
  const [mode, setMode]             = useState<Mode>('copy');
  const [sequence, setSequence]     = useState<number[]>([]);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [score, setScore]           = useState(0);
  const [round, setRound]           = useState(1);
  const [flashIndex, setFlashIndex] = useState<number | null>(null);

  const endedRef   = useRef(false);
  const timersRef  = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(() => {
      timersRef.current = timersRef.current.filter(x => x !== id);
      if (!endedRef.current) fn();
    }, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  const clearAll = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const getColorCount = useCallback((seqLen: number): number => {
    const max = Math.min(config.colors, COLOR_DATA.length);
    if (seqLen <= 3) return Math.min(4, max);
    if (seqLen <= 5) return Math.min(6, max);
    if (seqLen <= 7) return Math.min(8, max);
    return max;
  }, [config.colors]);

  const colorCount = getColorCount(sequence.length);

  const finishGame = useCallback((finalScore: number, rounds: number, perfect: boolean) => {
    if (endedRef.current) return;
    endedRef.current = true;
    clearAll();
    const ratio = rounds / config.maxRounds;
    const stars  = perfect ? 3 : ratio >= 0.75 ? 3 : ratio >= 0.4 ? 2 : 1;
    let summary  = perfect
      ? `Perfect! All ${config.maxRounds} rounds complete! 🏆`
      : `You completed ${rounds} round${rounds !== 1 ? 's' : ''}! `;
    if (!perfect) {
      if (stars === 3) summary += 'Amazing pattern memory!';
      else if (stars === 2) summary += 'Good work — keep practising both modes!';
      else summary += 'Keep going! Watch the full sequence before tapping.';
    }
    onEnd({ score: finalScore, stars, summary });
  }, [config.maxRounds, clearAll, onEnd]);

  const playSequence = useCallback((seq: number[], m: Mode, roundNum: number) => {
    if (endedRef.current) return;
    setPhase('watching');
    setPlayerIndex(0);
    onMessage(m === 'copy' ? '👀 Watch the pattern...' : '👀 Watch — then REVERSE it...');

    seq.forEach((colorIdx, i) => {
      schedule(() => {
        setFlashIndex(colorIdx);
        schedule(() => setFlashIndex(null), config.speed * 0.4);
      }, i * config.speed);
    });

    schedule(() => {
      setPhase('playing');
      onMessage(m === 'copy' ? '🐱 Copy it!' : '🔄 Tap in REVERSE order!');
    }, seq.length * config.speed);

    onProgress((roundNum - 1) / config.maxRounds);
  }, [config.speed, config.maxRounds, schedule, onMessage, onProgress]);

  const startRound = useCallback((seq: number[], m: Mode, roundNum: number) => {
    setPhase('announce');
    setMode(m);
    setSequence(seq);
    setPlayerIndex(0);
    schedule(() => playSequence(seq, m, roundNum), 900);
  }, [schedule, playSequence]);

  const startGame = useCallback(() => {
    endedRef.current = false;
    clearAll();
    const count = getColorCount(config.startLength);
    const seq   = Array.from({ length: config.startLength }, () => Math.floor(Math.random() * count));
    setScore(0);
    setRound(1);
    startRound(seq, 'copy', 1);
  }, [config.startLength, getColorCount, clearAll, startRound]);

  const handleTap = useCallback((tapIndex: number) => {
    if (phase !== 'playing') return;

    setFlashIndex(tapIndex);
    schedule(() => setFlashIndex(null), 180);

    const expectedIndex = mode === 'copy'
      ? playerIndex
      : sequence.length - 1 - playerIndex;

    if (tapIndex !== sequence[expectedIndex]) {
      setPhase('done');
      const rounds = round - 1;
      finishGame(score, rounds, false);
      return;
    }

    const pts = mode === 'copy' ? 15 : 20;
    const newScore = score + pts;
    const newPlayerIndex = playerIndex + 1;
    setScore(newScore);
    setPlayerIndex(newPlayerIndex);
    onScore(pts);

    if (newPlayerIndex >= sequence.length) {
      if (round >= config.maxRounds) {
        setPhase('done');
        onProgress(1);
        finishGame(newScore + 100, round, true);
      } else {
        onMessage('✨ Next round...');
        const nextRound = round + 1;
        setRound(nextRound);
        const nextMode: Mode = mode === 'copy' ? 'reverse' : 'copy';
        const nextCount = getColorCount(sequence.length + 1);
        const newSeq    = [...sequence, Math.floor(Math.random() * nextCount)];
        schedule(() => startRound(newSeq, nextMode, nextRound), 600);
      }
    }
  }, [phase, mode, sequence, playerIndex, round, score, config.maxRounds,
      getColorCount, onScore, onProgress, onMessage, schedule, startRound, finishGame]);

  // ── Intro ────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center gap-4">
        <GameArt gameId="copy-cat" emoji="🐱" size={80} />
        <h2 className="text-2xl font-bold text-accent">Copy Cat</h2>
        <p className="text-text-dim max-w-xs">Watch the pattern light up, then tap it — sometimes forwards, sometimes backwards!</p>

        <div className="bg-card rounded-2xl p-4 max-w-xs w-full space-y-3">
          <div className="flex items-center justify-around text-sm">
            <div className="text-center">
              <div className="text-xl font-bold text-cyan-400 mb-1">🐱 Copy</div>
              <div className="text-text-muted text-xs">Tap same order</div>
              <div className="mt-1 text-base">🔴🟢🔵 → 🔴🟢🔵</div>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="text-center">
              <div className="text-xl font-bold text-orange-400 mb-1">🔄 Reverse</div>
              <div className="text-text-muted text-xs">Tap backwards</div>
              <div className="mt-1 text-base">🔴🟢🔵 → 🔵🟢🔴</div>
            </div>
          </div>
          <div className="text-xs text-text-muted border-t border-white/5 pt-3">
            The mode alternates each round — up to {config.maxRounds} rounds total
          </div>
        </div>

        <button
          onClick={startGame}
          className="bg-accent text-bg font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 transition-all"
        >
          Start! 🐱
        </button>
      </div>
    );
  }

  // ── Announce mode for this round ─────────────────────────────────────────
  if (phase === 'announce') {
    const isCopy = mode === 'copy';
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 text-center p-6">
        <div className="text-sm text-text-muted font-semibold">Round {round} / {config.maxRounds}</div>
        <div className={`rounded-3xl px-8 py-5 border ${
          isCopy
            ? 'bg-cyan-500/12 border-cyan-500/30'
            : 'bg-orange-500/12 border-orange-500/30'
        }`}>
          <div className="text-5xl mb-2">{isCopy ? '🐱' : '🔄'}</div>
          <div className={`text-2xl font-black ${isCopy ? 'text-cyan-300' : 'text-orange-300'}`}>
            {isCopy ? 'Copy Round' : 'Reverse Round'}
          </div>
          <div className="text-text-muted text-sm mt-1">
            {isCopy ? 'Tap in the same order' : 'Tap in the opposite order'}
          </div>
        </div>
        <div className="text-text-muted text-xs animate-pulse">Get ready...</div>
      </div>
    );
  }

  // ── Game board ───────────────────────────────────────────────────────────
  const cols = colorCount <= 4 ? 2 : colorCount <= 6 ? 3 : colorCount <= 8 ? 4 : 5;
  const isCopy = mode === 'copy';

  const progressDots = Array.from({ length: sequence.length }, (_, i) => {
    const tappedIndex = mode === 'copy' ? i : sequence.length - 1 - i;
    const isDone  = i < playerIndex;
    const isNext  = i === playerIndex && phase === 'playing';
    return { isDone, isNext, tappedIndex };
  });

  return (
    <div className="h-full flex flex-col items-center p-4 gap-3">
      {/* Header */}
      <div className="flex gap-3 bg-card rounded-xl px-4 py-2 items-center">
        <span className="text-warning font-bold text-sm">Round {round}/{config.maxRounds}</span>
        <span className="text-accent text-sm">Score: {score}</span>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
          isCopy
            ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
            : 'bg-orange-500/15 border-orange-500/30 text-orange-300'
        }`}>
          {isCopy ? '🐱 Copy' : '🔄 Reverse'}
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 items-center min-h-[20px]">
        {progressDots.map((dot, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-150"
            style={{
              width:  dot.isNext ? 14 : 10,
              height: dot.isNext ? 14 : 10,
              background: dot.isDone ? '#4ade80' : dot.isNext ? '#fbbf24' : 'rgba(255,255,255,0.15)',
              boxShadow:  dot.isNext ? '0 0 8px #fbbf24' : dot.isDone ? '0 0 6px #4ade80' : 'none',
            }}
          />
        ))}
      </div>

      {/* Colour grid */}
      <div
        className="grid gap-2 p-4 bg-card rounded-2xl shadow-lg"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {COLOR_DATA.slice(0, colorCount).map((c, i) => (
          <button
            key={i}
            onPointerDown={() => handleTap(i)}
            disabled={phase !== 'playing'}
            className="w-16 h-16 rounded-xl text-2xl transition-all duration-100 disabled:cursor-default select-none"
            style={{
              background: c.color,
              opacity:   flashIndex === i ? 1 : phase === 'watching' ? 0.4 : 0.7,
              transform: flashIndex === i ? 'scale(0.88)' : 'scale(1)',
              boxShadow: flashIndex === i
                ? `0 0 28px ${c.color}, 0 0 10px ${c.color}99`
                : '0 4px 0 rgba(0,0,0,0.3)',
            }}
          >
            {c.emoji}
          </button>
        ))}
      </div>

      <div className="text-text-muted text-xs text-center min-h-[16px]">
        {phase === 'playing'
          ? isCopy
            ? `Tap ${playerIndex + 1} of ${sequence.length}`
            : `Reverse tap ${playerIndex + 1} of ${sequence.length}`
          : phase === 'watching'
          ? 'Memorise the order...'
          : ''}
      </div>
    </div>
  );
}

export default CopyCatGame;
