import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { GameProps } from '@/types';
import type { QuizAnswer } from './types';
import { getDatasetByStage, DATASETS } from './data';
import { isMatch, formatTime, computeStars } from './utils';
import { Eye, EyeOff, MapPin, MapPinOff, RotateCcw, Play, Trophy, Clock, ChevronRight, Shuffle, Keyboard } from 'lucide-react';

type Phase = 'ready' | 'playing' | 'review';

export default function MapQuiz({ stage, onScore, onProgress, onEnd }: GameProps) {
  const stageDataset = useMemo(() => getDatasetByStage(stage), [stage]);
  const [overrideDataset, setOverrideDataset] = useState<typeof stageDataset | null>(null);
  const dataset = overrideDataset ?? stageDataset;
  const [phase, setPhase] = useState<Phase>('ready');
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [input, setInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(dataset.timeLimit);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showLabels, setShowLabels] = useState(true);
  const [showLocations, setShowLocations] = useState(true);
  const [practiceMode, setPracticeMode] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [missed, setMissed] = useState<QuizAnswer[]>([]);
  const [lastSolved, setLastSolved] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = dataset.answers.length;
  const solvedCount = solvedIds.size;
  const pct = total > 0 ? solvedCount / total : 0;
  const MapComponent = dataset.mapComponent;

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    timerRef.current = null;
    feedbackTimerRef.current = null;
  }, []);

  const startGame = useCallback(() => {
    clearTimers();
    setSolvedIds(new Set());
    setInput('');
    setScore(0);
    setStreak(0);
    setFeedback('');
    setMissed([]);
    setLastSolved(null);
    setTimeLeft(practiceMode ? 0 : dataset.timeLimit);
    setPhase('playing');
    onProgress(0);
  }, [clearTimers, dataset.timeLimit, practiceMode, onProgress]);

  const endGame = useCallback((timeRemaining: number, timeExpired: boolean) => {
    clearTimers();
    const missedAnswers = dataset.answers.filter(a => !solvedIds.has(a.id));
    setMissed(missedAnswers);
    setPhase('review');
  }, [clearTimers, dataset.answers, solvedIds]);

  const finishAndReport = useCallback(() => {
    const stars = computeStars(solvedCount, total);
    const summary =
      stars === 3
        ? `Amazing! You named ${solvedCount}/${total} places! 🌍`
        : stars === 2
        ? `Great job! You got ${solvedCount}/${total} places. Keep exploring!`
        : `Good effort! You named ${solvedCount}/${total} places. Try again!`;
    onEnd({ score, stars, summary });
  }, [onEnd, score, solvedCount, total]);

  // Timer
  useEffect(() => {
    if (phase !== 'playing') return;
    if (practiceMode) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearTimers();
          endGame(0, true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearTimers();
  }, [phase, practiceMode, clearTimers, endGame]);

  // Keep input focused
  useEffect(() => {
    if (phase === 'playing' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [phase, solvedIds, input]);

  const handleInputChange = (value: string) => {
    setInput(value);
    if (phase !== 'playing') return;

    for (const answer of dataset.answers) {
      if (solvedIds.has(answer.id)) continue;
      if (isMatch(value, answer)) {
        // Found a match!
        const newStreak = streak + 1;
        setStreak(newStreak);
        const basePts = 10;
        const streakBonus = Math.min(newStreak * 2, 20);
        const speedBonus =
          !practiceMode && dataset.timeLimit > 0 && timeLeft > dataset.timeLimit * 0.5 ? 5 : 0;
        const pts = basePts + streakBonus + speedBonus;
        setScore(s => s + pts);
        onScore(pts);

        const next = new Set(solvedIds);
        next.add(answer.id);
        setSolvedIds(next);
        setLastSolved(answer.id);
        setInput('');
        onProgress(next.size / total);

        setFeedback(`✅ ${answer.label}`);
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => setFeedback(''), 1200);

        if (next.size >= total) {
          endGame(timeLeft, false);
        }
        return;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (input.trim()) {
        setFeedback('❌ Not found');
        setStreak(0);
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => setFeedback(''), 800);
        setInput('');
      }
    }
  };

  // Ready screen
  if (phase === 'ready') {
    return (
      <div className="flex flex-col h-full min-h-[350px] items-center justify-center gap-5 px-4 overflow-y-auto">
        <div className="text-6xl">{dataset.emoji}</div>
        <h2 className="text-xl font-bold text-foreground text-center">{dataset.title}</h2>
        <p className="text-muted text-sm text-center max-w-xs">{dataset.description}</p>

        <div className="flex items-center gap-4 text-sm text-muted">
          <div className="flex items-center gap-1.5">
            <Clock size={16} />
            <span>{practiceMode ? 'Practice' : formatTime(dataset.timeLimit)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Trophy size={16} />
            <span>{total} answers</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => setPracticeMode(p => !p)}
            className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm border transition-all active:scale-95 ${
              practiceMode
                ? 'bg-accent/20 text-accent border-accent/40'
                : 'bg-card text-muted border-foreground/5 hover:bg-card-hover'
            }`}
          >
            <Clock size={16} />
            {practiceMode ? 'Practice Mode On' : 'Practice Mode Off'}
          </button>

          <div className="flex gap-3">
            <button
              onClick={() => setShowLabels(p => !p)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm border transition-all active:scale-95 ${
                showLabels
                  ? 'bg-accent/20 text-accent border-accent/40'
                  : 'bg-card text-muted border-foreground/5 hover:bg-card-hover'
              }`}
            >
              {showLabels ? <Eye size={16} /> : <EyeOff size={16} />}
              Labels
            </button>
            <button
              onClick={() => setShowLocations(p => !p)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm border transition-all active:scale-95 ${
                showLocations
                  ? 'bg-accent/20 text-accent border-accent/40'
                  : 'bg-card text-muted border-foreground/5 hover:bg-card-hover'
              }`}
            >
              {showLocations ? <MapPin size={16} /> : <MapPinOff size={16} />}
              Markers
            </button>
          </div>
        </div>

        <button
          onClick={startGame}
          className="bg-accent text-accent-foreground font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
        >
          <Play size={20} /> Start Quiz
        </button>

        {DATASETS.length > 1 && (
          <button
            onClick={() => {
              const randomDs = DATASETS[Math.floor(Math.random() * DATASETS.length)];
              setOverrideDataset(randomDs);
              setFeedback(`${randomDs.emoji} ${randomDs.title} selected!`);
              setTimeout(() => setFeedback(''), 1200);
            }}
            className="text-muted text-sm hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Shuffle size={14} /> Play Random Quiz
          </button>
        )}
      </div>
    );
  }

  // Review screen
  if (phase === 'review') {
    const stars = computeStars(solvedCount, total);
    return (
      <div className="flex flex-col h-full min-h-[350px] items-center justify-start gap-4 px-4 py-6 overflow-y-auto">
        <div className="text-6xl">{stars === 3 ? '🏆' : stars === 2 ? '🎉' : '👏'}</div>
        <h2 className="text-xl font-bold text-foreground">
          {stars === 3 ? 'Amazing!' : stars === 2 ? 'Great Job!' : 'Good Effort!'}
        </h2>

        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <div className="text-accent text-2xl font-bold">{solvedCount}/{total}</div>
            <div className="text-muted">Correct</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{Math.round(pct * 100)}%</div>
            <div className="text-muted">Complete</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{score}</div>
            <div className="text-muted">Score</div>
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm">
              {missed.length > 0 ? `Missed (${missed.length})` : 'Perfect score!'}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLabels(p => !p)}
                className="text-muted hover:text-foreground transition-colors"
                title="Toggle labels"
              >
                {showLabels ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button
                onClick={() => setShowLocations(p => !p)}
                className="text-muted hover:text-foreground transition-colors"
                title="Toggle markers"
              >
                {showLocations ? <MapPin size={16} /> : <MapPinOff size={16} />}
              </button>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-foreground/5 overflow-hidden mb-4" style={{ aspectRatio: '2/1' }}>
            <MapComponent solvedIds={new Set(dataset.answers.map(a => a.id))} showLabels={showLabels} showLocations={showLocations} answers={dataset.answers} />
          </div>

          {missed.length > 0 && (
            <div className="bg-card rounded-xl border border-foreground/5 p-3 mb-4">
              <div className="flex flex-wrap gap-1.5">
                {missed.map(a => (
                  <span key={a.id} className="text-xs bg-danger/10 text-danger px-2 py-1 rounded-lg font-medium">
                    {a.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={startGame}
            className="bg-accent text-accent-foreground font-bold px-6 py-2.5 rounded-xl hover:opacity-90 active:scale-95 flex items-center gap-2"
          >
            <RotateCcw size={16} /> Play Again
          </button>
          <button
            onClick={finishAndReport}
            className="bg-success text-accent-foreground font-bold px-6 py-2.5 rounded-xl hover:opacity-90 active:scale-95 flex items-center gap-2"
          >
            Finish <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Playing screen
  const allSolved = solvedCount >= total;

  return (
    <div className="flex flex-col h-full min-h-[350px]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface border-b border-foreground/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="text-accent font-bold text-sm">
            {solvedCount}/{total}
          </div>
          {!practiceMode && dataset.timeLimit > 0 && (
            <div className={`text-sm font-semibold ${timeLeft < 30 ? 'text-danger animate-pulse' : 'text-muted'}`}>
              <Clock size={14} className="inline mr-1" />
              {formatTime(timeLeft)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-warning text-sm font-bold">🔥 {streak}</div>
          <div className="text-accent font-bold text-sm">{score}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-card flex-shrink-0">
        <div
          className="h-full bg-accent transition-all duration-300 rounded-r"
          style={{
            width: `${Math.min(pct * 100, 100)}%`,
            boxShadow: pct > 0 ? '0 0 8px var(--color-accent, #f0a83a)' : 'none',
          }}
        />
      </div>

      {/* Map */}
      <div className="flex-1 relative min-h-0 bg-surface">
        <div className="absolute inset-0 p-2">
          <div className="w-full h-full rounded-xl overflow-hidden border border-foreground/5">
            <MapComponent solvedIds={solvedIds} showLabels={showLabels} showLocations={showLocations} answers={dataset.answers} />
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 bg-surface border-t border-foreground/5 p-3 space-y-2">
        {feedback && (
          <div className={`text-center text-sm font-bold min-h-[20px] ${feedback.startsWith('✅') ? 'text-success' : 'text-danger'}`}>
            {feedback}
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Keyboard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a place name..."
              className="w-full bg-card text-foreground placeholder-muted rounded-xl pl-9 pr-4 py-3 text-base border border-foreground/5 focus:border-accent focus:outline-none"
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          <button
            onClick={() => endGame(timeLeft, false)}
            className="bg-card hover:bg-card-hover text-muted hover:text-foreground font-semibold px-4 py-2 rounded-xl border border-foreground/5 transition-colors active:scale-95 text-sm"
            title="Give up & review"
          >
            End
          </button>
        </div>

        <div className="flex items-center justify-between px-1">
          <div className="flex gap-2">
            <button
              onClick={() => setShowLabels(p => !p)}
              className={`text-2xs font-semibold px-2 py-1 rounded-lg border transition-colors ${
                showLabels ? 'bg-accent/20 text-accent border-accent/30' : 'bg-card text-muted border-foreground/5'
              }`}
            >
              {showLabels ? <Eye size={12} className="inline mr-1" /> : <EyeOff size={12} className="inline mr-1" />}
              Labels
            </button>
            <button
              onClick={() => setShowLocations(p => !p)}
              className={`text-2xs font-semibold px-2 py-1 rounded-lg border transition-colors ${
                showLocations ? 'bg-accent/20 text-accent border-accent/30' : 'bg-card text-muted border-foreground/5'
              }`}
            >
              {showLocations ? <MapPin size={12} className="inline mr-1" /> : <MapPinOff size={12} className="inline mr-1" />}
              Markers
            </button>
          </div>
          <div className="text-2xs text-muted">
            {allSolved ? 'All found!' : `${total - solvedCount} remaining`}
          </div>
        </div>
      </div>
    </div>
  );
}


