import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '@/contexts/AuthContext';
import { getAllGames, getGame } from '@/lib/game-registry';
import { Trophy, Star, ChevronDown, Crown, Gamepad2 } from 'lucide-react';
import { getRankTier } from '@/lib/rank-tiers';

interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  avatar: string;
  totalStars: number;
  totalScore: number;
  gamesPlayed: number;
  topGames: { gameId: string; stars: number; score: number }[];
}

const TOP3 = [
  { medal: '🥇', border: 'border-yellow-400/50', bg: 'bg-yellow-400/10', text: 'text-yellow-400', glow: 'shadow-[0_0_24px_rgba(251,191,36,0.18)]' },
  { medal: '🥈', border: 'border-slate-400/50',  bg: 'bg-slate-400/10',  text: 'text-slate-300',  glow: 'shadow-[0_0_16px_rgba(148,163,184,0.12)]' },
  { medal: '🥉', border: 'border-orange-400/50', bg: 'bg-orange-400/10', text: 'text-orange-400', glow: '' },
];

function RankTierBadge({ stars, size = 'sm' }: { stars: number; size?: 'sm' | 'xs' }) {
  const tier = getRankTier(stars);
  return (
    <span className={`inline-flex items-center gap-1 font-bold rounded-full border ${tier.bg} ${tier.border} ${tier.color} ${
      size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
    }`}>
      {tier.emoji} {tier.label}
    </span>
  );
}

export function Leaderboard() {
  const { player } = useAuth();
  const games = getAllGames();
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<string>('');
  const [window, setWindow] = useState<'all' | 'month' | 'week'>('all');

  // Stable to the hour so the realtime subscription doesn't churn.
  const since = useMemo(() => {
    if (window === 'all') return undefined;
    const hour = Math.floor(Date.now() / 3_600_000) * 3_600_000;
    return hour - (window === 'week' ? 7 : 30) * 24 * 3_600_000;
  }, [window]);
  const listRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);

  const overallData = useQuery(
    api.games.getLeaderboard,
    player?.sessionToken ? { since, sessionToken: player.sessionToken } : 'skip' as any,
  );
  const gameData = useQuery(
    api.games.getLeaderboard,
    selectedGame && player?.sessionToken ? { gameId: selectedGame, since, sessionToken: player.sessionToken } : 'skip' as any,
  );

  const isLoading = selectedGame ? gameData === undefined : overallData === undefined;
  const rawEntries: LeaderboardEntry[] = (selectedGame ? gameData : overallData) ?? [];

  const entries = useMemo(() => {
    return rawEntries
      .filter(e => e && e.playerName)
      .sort((a, b) => b.totalStars - a.totalStars);
  }, [rawEntries]);

  const maxStars = useMemo(() => entries.length > 0 ? entries[0].totalStars : 1, [entries]);

  const currentPlayerIndex = useMemo(() => entries.findIndex(e => e.playerName === player?.name), [entries, player]);
  const currentPlayerEntry = currentPlayerIndex >= 0 ? entries[currentPlayerIndex] : null;

  useEffect(() => {
    const el = listRef.current;
    if (!el || currentPlayerIndex < 3) { setShowSticky(false); return; }
    const onScroll = () => {
      const playerEl = el.querySelector(`[data-player="${player?.name}"]`) as HTMLElement;
      if (!playerEl) { setShowSticky(false); return; }
      const rect = playerEl.getBoundingClientRect();
      const containerRect = el.getBoundingClientRect();
      setShowSticky(!(rect.top >= containerRect.top && rect.bottom <= containerRect.bottom));
    };
    el.addEventListener('scroll', onScroll);
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [currentPlayerIndex, player?.name, entries]);

  const getGameName = (gameId: string) => {
    const game = getGame(gameId);
    return game ? `${game.emoji} ${game.name}` : gameId;
  };

  const filterLabel = selectedGame ? getGameName(selectedGame) : 'All Games';
  const myRank = currentPlayerIndex >= 0 ? currentPlayerIndex + 1 : null;
  const myTier = currentPlayerEntry ? getRankTier(currentPlayerEntry.totalStars) : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header — stacked on mobile so filters don't fight the title */}
      <div className="px-3 pt-3 pb-2.5 sm:p-4 bg-surface border-b border-white/5 flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Trophy size={18} className="text-yellow-400 flex-shrink-0" />
              Rankings
            </h1>
            <p className="text-text-muted text-[11px] sm:text-xs mt-0.5 truncate">
              {entries.length} player{entries.length !== 1 ? 's' : ''} · by stars
            </p>
          </div>
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-card hover:bg-card-hover border border-white/10 px-2.5 py-1.5 rounded-xl transition-colors"
            >
              <Gamepad2 size={13} className="text-text-muted" />
              <span className="max-w-[88px] sm:max-w-[120px] truncate">{filterLabel}</span>
              <ChevronDown size={13} className={`text-text-muted transition-transform flex-shrink-0 ${filterOpen ? 'rotate-180' : ''}`} />
            </button>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-card rounded-2xl shadow-2xl border border-white/8 z-50 py-1.5 max-h-72 overflow-y-auto">
                  <button
                    onClick={() => { setSelectedGame(''); setFilterOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-card-hover transition-colors ${!selectedGame ? 'text-accent font-bold' : 'text-text'}`}
                  >
                    🎮 All Games
                  </button>
                  {games.map(g => (
                    <button
                      key={g.id}
                      onClick={() => { setSelectedGame(g.id); setFilterOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-card-hover transition-colors ${selectedGame === g.id ? 'text-accent font-bold' : 'text-text'}`}
                    >
                      {g.emoji} {g.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Time window — own row so pills stay tappable on narrow screens */}
        <div className="flex gap-1 bg-card rounded-full p-0.5 border border-white/8 w-full sm:w-auto" role="radiogroup" aria-label="Time period">
          {([['all', 'All'], ['month', 'Month'], ['week', 'Week']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setWindow(id)}
              role="radio"
              aria-checked={window === id}
              className={`flex-1 sm:flex-none px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                window === id ? 'bg-accent text-bg' : 'text-text-muted hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Your rank — one-line on phones, fuller card on wider screens */}
        {currentPlayerEntry && myTier && (
          <>
            <div className={`sm:hidden flex items-center gap-2 rounded-lg px-2.5 py-1.5 border ${myTier.border} ${myTier.bg}`}>
              <span className="text-base leading-none">{currentPlayerEntry.avatar || '🎮'}</span>
              <span className={`text-xs font-bold ${myTier.color}`}>#{myRank}</span>
              <span className="text-[11px] text-text-muted flex-1 truncate">
                {currentPlayerEntry.totalStars}⭐ · {currentPlayerEntry.gamesPlayed} games
              </span>
              <RankTierBadge stars={currentPlayerEntry.totalStars} size="xs" />
            </div>
            <div className={`hidden sm:flex items-center gap-3 rounded-xl px-3 py-2.5 border ${myTier.border} ${myTier.bg}`}>
              <span className="text-2xl">{currentPlayerEntry.avatar || '🎮'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-text truncate">You</span>
                  <RankTierBadge stars={currentPlayerEntry.totalStars} size="xs" />
                </div>
                <p className={`text-xs font-semibold ${myTier.color}`}>
                  Rank #{myRank} · {currentPlayerEntry.totalStars} ⭐ · {currentPlayerEntry.gamesPlayed} games played
                </p>
              </div>
              {myRank === 1 && <Crown size={18} className="text-yellow-400 flex-shrink-0" />}
            </div>
          </>
        )}
      </div>

      {/* List */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 space-y-2" aria-busy="true" aria-label="Loading rankings">
            {/* Skeleton podium + rows — mirrors the loaded layout so nothing jumps */}
            {[0, 1, 2].map(i => (
              <div key={`sp${i}`} className="rounded-2xl p-4 border border-white/5 bg-card animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-card-hover flex-shrink-0" />
                  <div className="w-10 h-10 rounded-xl bg-card-hover flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 rounded bg-card-hover" />
                    <div className="h-1.5 w-full rounded-full bg-card-hover" />
                  </div>
                  <div className="h-6 w-10 rounded bg-card-hover flex-shrink-0" />
                </div>
              </div>
            ))}
            {[0, 1, 2, 3].map(i => (
              <div key={`sr${i}`} className="flex items-center gap-3 px-3 py-3 rounded-xl bg-card border border-white/5 animate-pulse">
                <div className="w-7 h-4 rounded bg-card-hover flex-shrink-0" />
                <div className="w-8 h-8 rounded-full bg-card-hover flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-20 rounded bg-card-hover" />
                  <div className="h-2.5 w-28 rounded bg-card-hover" />
                </div>
                <div className="h-4 w-8 rounded bg-card-hover flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <Star size={40} className="mb-3 text-card-hover" />
            <p className="text-sm font-semibold">{window === 'all' ? 'No scores yet' : `No games ${window === 'week' ? 'this week' : 'this month'} yet`}</p>
            <p className="text-xs mt-1 text-center px-8">Play games to earn stars and climb the ranks!</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">

            {/* Top 3 podium */}
            {entries.slice(0, 3).map((entry, idx) => {
              const s = TOP3[idx];
              const isMe = entry.playerName === player?.name;
              const tier = getRankTier(entry.totalStars);
              const barPct = maxStars > 0 ? (entry.totalStars / maxStars) * 100 : 0;
              return (
                <div
                  key={entry.playerId}
                  data-player={entry.playerName}
                  className={`relative rounded-2xl p-4 border ${s.border} ${s.bg} ${s.glow} ${isMe ? 'ring-2 ring-accent' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Medal + rank */}
                    <div className="flex flex-col items-center w-9 flex-shrink-0">
                      <span className="text-2xl leading-none">{s.medal}</span>
                      <span className={`text-[10px] font-black mt-0.5 ${s.text}`}>#{idx + 1}</span>
                    </div>
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <span className="text-4xl">{entry.avatar || '🎮'}</span>
                      {idx === 0 && (
                        <Crown size={14} className="text-yellow-400 absolute -top-2 -right-1" />
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="font-bold text-sm text-text truncate">{entry.playerName}</span>
                        {isMe && <span className="text-[10px] bg-accent text-bg font-bold px-1.5 py-0.5 rounded-full">YOU</span>}
                        <RankTierBadge stars={entry.totalStars} size="xs" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-black/20 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-slate-300' : 'bg-orange-400'}`} style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                      <p className="text-[10px] text-text-muted mt-1">{entry.gamesPlayed} games played</p>
                    </div>
                    {/* Star count */}
                    <div className="text-right flex-shrink-0">
                      <div className={`flex items-center gap-0.5 ${s.text} font-black text-xl`}>
                        <Star size={15} fill="currentColor" />
                        {entry.totalStars}
                      </div>
                      <p className="text-[10px] text-text-muted">{entry.totalScore.toLocaleString()} pts</p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Divider */}
            {entries.length > 3 && (
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">Everyone else</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>
            )}

            {/* Positions 4+ */}
            {entries.slice(3).map((entry, idx) => {
              const rank = idx + 4;
              const isMe = entry.playerName === player?.name;
              const tier = getRankTier(entry.totalStars);
              return (
                <div
                  key={entry.playerId}
                  data-player={entry.playerName}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors border ${
                    isMe
                      ? 'bg-accent/10 border-accent/30 ring-1 ring-accent/20'
                      : 'bg-card border-white/5 hover:bg-card-hover'
                  }`}
                >
                  <span className={`w-7 text-center text-xs font-bold flex-shrink-0 ${rank <= 10 ? 'text-text' : 'text-text-muted'}`}>
                    {rank}
                  </span>
                  <span className="text-2xl flex-shrink-0">{entry.avatar || '🎮'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm text-text truncate">{entry.playerName}</span>
                      {isMe && <span className="text-[10px] bg-accent text-bg font-bold px-1.5 py-0.5 rounded-full">YOU</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <RankTierBadge stars={entry.totalStars} size="xs" />
                      <span className="text-[10px] text-text-muted">{entry.gamesPlayed} games</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-0.5 text-warning">
                      <Star size={12} fill="currentColor" />
                      <span className="font-bold text-sm">{entry.totalStars}</span>
                    </div>
                    <p className="text-[10px] text-text-muted">{entry.totalScore.toLocaleString()} pts</p>
                  </div>
                </div>
              );
            })}

            <div className="h-4" />
          </div>
        )}
      </div>

      {/* Sticky "Your Rank" footer when scrolled away */}
      {showSticky && currentPlayerEntry && myTier && (
        <div className="flex-shrink-0 px-3 pb-3 pt-2 bg-surface/90 backdrop-blur border-t border-white/5">
          <div className={`rounded-xl px-3 py-2.5 flex items-center gap-3 border ${myTier.border} ${myTier.bg}`}>
            <span className={`text-xs font-black ${myTier.color}`}>#{myRank}</span>
            <span className="text-xl">{currentPlayerEntry.avatar || '🎮'}</span>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-sm text-text truncate block">{currentPlayerEntry.playerName}</span>
              <RankTierBadge stars={currentPlayerEntry.totalStars} size="xs" />
            </div>
            <div className="flex items-center gap-0.5 text-warning">
              <Star size={14} fill="currentColor" />
              <span className="font-bold">{currentPlayerEntry.totalStars}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
