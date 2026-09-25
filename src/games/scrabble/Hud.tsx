// Top-of-board HUD: per-seat scores, round/bag counters, the race-to-target
// bars and whose turn it is. Pure presentation.
import type { ReactNode } from 'react';

interface ScrabbleHudProps {
  scores: number[];
  /** Short label per seat, e.g. "You", "AI 2", "🦊 Mia". */
  labels: string[];
  mySeat: number;
  currentSeat: number;
  round: number;
  maxRounds: number;
  bagCount: number;
  /** Score the progress bars race towards; omitted = no bars. */
  targetScore?: number;
  isHumanTurn: boolean;
  /** Replaces the built-in "Your turn / AI thinking" pill. */
  turnIndicator?: ReactNode;
  lastWord: string;
}

export function ScrabbleHud(props: ScrabbleHudProps) {
  const { scores, labels, mySeat, currentSeat, round, maxRounds, bagCount, targetScore } = props;
  return (
    <div className="w-full flex-shrink-0 flex flex-col gap-1">
      {/* Scores row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {scores.map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold ${
                i === mySeat
                  ? 'bg-accent/15 text-accent ring-1 ring-accent/40'
                  : i === currentSeat
                    ? 'bg-danger/20 text-danger ring-1 ring-danger/40'
                    : 'bg-card text-text-muted'
              }`}
            >
              <span className="text-[10px] opacity-70">{labels[i]}</span>
              <span className="text-sm">{s}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-text-muted">
          <span className="bg-card rounded-md px-1.5 py-0.5">
            Round <span className="text-text font-bold">{Math.min(round + 1, maxRounds)}</span>/{maxRounds}
          </span>
          <span className="bg-card rounded-md px-1.5 py-0.5">
            Bag: <span className="text-text font-bold">{bagCount}</span>
          </span>
        </div>
      </div>

      {targetScore !== undefined && (
        <ScoreBars scores={scores} labels={labels} mySeat={mySeat} targetScore={targetScore} />
      )}

      {/* Turn indicator + last move */}
      <div className="flex items-center justify-between gap-2">
        {props.turnIndicator ?? <TurnPill isHumanTurn={props.isHumanTurn} currentSeat={currentSeat} />}
        {props.lastWord && (
          <span className="text-[10px] text-text-muted truncate max-w-[50%]">
            {props.lastWord}
          </span>
        )}
      </div>
    </div>
  );
}

/** Score progress bars — race to targetScore. */
function ScoreBars({ scores, labels, mySeat, targetScore }: { scores: number[]; labels: string[]; mySeat: number; targetScore: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      {scores.map((s, i) => {
        const pct = Math.min(s / targetScore, 1);
        return (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-[9px] text-text-muted w-8 text-right shrink-0 truncate">{labels[i]}</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${i === mySeat ? 'bg-accent' : 'bg-red-400'}`}
                style={{ width: `${pct * 100}%` }}
              />
            </div>
            <span className="text-[9px] text-text-muted w-8 shrink-0">{Math.round(pct * 100)}%</span>
          </div>
        );
      })}
    </div>
  );
}

function TurnPill({ isHumanTurn, currentSeat }: { isHumanTurn: boolean; currentSeat: number }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold ${
      isHumanTurn
        ? 'bg-accent/20 text-accent'
        : 'bg-card text-text-muted'
    }`}>
      {isHumanTurn ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
          </span>
          Your turn
        </>
      ) : (
        <>
          <span className="animate-pulse">🤖</span>
          AI {currentSeat} is thinking...
        </>
      )}
    </div>
  );
}
