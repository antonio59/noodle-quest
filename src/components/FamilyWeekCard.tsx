import { useQuery } from 'convex/react';
import { CalendarHeart } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '@/contexts/AuthContext';
import { getGameName } from '@/lib/game-registry';

const MAX_ROWS = 5;

/** Rolling 7-day family summary: totals, star of the week, highlights. */
export function FamilyWeekCard() {
  const { player } = useAuth();
  const week = useQuery(api.recap.getFamilyWeek, player ? { sessionToken: player.sessionToken } : 'skip');
  if (!week) return null;

  const star = week.players[0];
  const maxPlays = Math.max(1, ...week.players.map(p => p.plays));
  const highlights = [
    week.topGame && `🎲 Most played: ${getGameName(week.topGame.gameId)} (${week.topGame.plays})`,
    ...week.challengeWins.slice(0, 2).map(c => `⚔️ ${c.winner} beat ${c.loser} at ${getGameName(c.gameId)}`),
  ].filter((h): h is string => !!h);

  return (
    <section aria-labelledby="family-week" className="bg-card rounded-2xl border border-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 id="family-week" className="text-base font-bold flex items-center gap-2">
          <CalendarHeart size={16} className="text-primary" aria-hidden /> This week in the family
        </h2>
        <span className="text-xs text-text-muted">last 7 days</span>
      </div>

      {week.totalPlays === 0 ? (
        <p className="text-sm text-text-muted">A quiet week so far — how about a game together? 🎲</p>
      ) : (
        <>
          <p className="text-sm mb-3">
            <span className="font-display font-bold text-accent text-lg">{week.totalPlays}</span> games ·{' '}
            <span className="font-display font-bold text-warning text-lg">{week.totalStars}</span> stars
            {star && <> · 🌟 <span className="font-semibold">{star.avatar} {star.name}</span> is star of the week</>}
          </p>

          <ul className="flex flex-col gap-1.5 mb-3" aria-label="Games played this week">
            {week.players.slice(0, MAX_ROWS).map(p => (
              <li key={p.name} className="flex items-center gap-2 text-xs">
                <span className="w-24 truncate font-semibold"><span aria-hidden>{p.avatar}</span> {p.name}</span>
                <span className="flex-1 h-2 rounded-full bg-surface overflow-hidden" aria-hidden>
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${(p.plays / maxPlays) * 100}%` }} />
                </span>
                <span className="w-20 text-right text-text-muted tabular-nums">{p.plays} · {p.stars}⭐</span>
              </li>
            ))}
          </ul>

          {highlights.length > 0 && (
            <ul className="text-xs text-text-dim space-y-1">
              {highlights.map(h => <li key={h}>{h}</li>)}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
