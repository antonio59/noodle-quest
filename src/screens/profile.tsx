import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '@/contexts/AuthContext';
import { getAllGames } from '@/lib/game-registry';
import { AVATARS } from '@/lib/avatars';
import { LogOut, Star, Gamepad2, Trophy, Zap, AlertTriangle, Pencil, Check, ChevronRight, Users, Volume2, VolumeX } from 'lucide-react';
import { feedbackEnabled, setFeedbackEnabled, playWin } from '@/lib/feedback';
import { useNavigate } from 'react-router-dom';
import { getRankTier, RANK_TIERS } from '@/lib/rank-tiers';
import { GameArt } from '@/components/GameArt';

export function Profile() {
  const { player, logout, updateAvatar, updateName, updatePrefs } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(player?.name || '');
  const [nameError, setNameError] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [showAllAvatars, setShowAllAvatars] = useState(false);
  const [fxOn, setFxOn] = useState(feedbackEnabled);
  const kidMode = !!player?.kidMode;
  const lightTheme = player?.theme === 'light';
  const games = getAllGames();

  const toggleFx = () => {
    const next = !fxOn;
    setFeedbackEnabled(next);
    setFxOn(next);
    if (next) playWin();
  };

  const toggleKidMode = () => { void updatePrefs({ kidMode: !kidMode }); };
  const toggleTheme = () => { void updatePrefs({ theme: lightTheme ? 'dark' : 'light' }); };

  const stats = useQuery(api.games.getPlayerStats, player?.sessionToken ? { sessionToken: player.sessionToken } : 'skip' as any);

  const totalStars = stats?.totalStars ?? 0;
  const gamesPlayed = stats?.gamesPlayed ?? 0;
  const totalScore = stats?.totalScore ?? 0;
  const gameStages = stats?.gameStages ?? {};
  const totalPlays = Object.values(gameStages).reduce((sum, g) => sum + (g.timesPlayed || 0), 0);
  const highestScore = Object.values(gameStages).reduce((max, g) => Math.max(max, g.highScore || 0), 0);
  const avgStarsPerGame = gamesPlayed > 0 ? (totalStars / gamesPlayed).toFixed(1) : '0';

  // Top games by stars earned
  const topGames = Object.entries(gameStages)
    .map(([id, data]) => ({ id, ...data, game: games.find(g => g.id === id) }))
    .filter(e => e.game)
    .sort((a, b) => b.starsEarned - a.starsEarned)
    .slice(0, 5);

  const tier = getRankTier(totalStars);
  const nextTierStars = tier.next;
  const prevTierMin = nextTierStars !== null
    ? (RANK_TIERS.find(t => t.next === nextTierStars)?.min ?? 0)
    : tier.min;
  const tierProgress = nextTierStars !== null
    ? Math.min(((totalStars - tier.min) / (nextTierStars - tier.min)) * 100, 100)
    : 100;

  const avatarsToShow = showAllAvatars ? AVATARS : AVATARS.slice(0, 20);

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4 pb-8">

        {/* ── Hero Card ─────────────────────────────────────── */}
        <div className={`rounded-2xl border ${tier.border} ${tier.bg} p-5 relative overflow-hidden`}>
          {/* Subtle background glow blob */}
          <div className={`absolute -top-8 -right-8 w-40 h-40 rounded-full blur-3xl opacity-30 ${tier.bg}`} />

          <div className="relative flex items-start gap-4">
            {/* Avatar with glowing ring */}
            <div className={`relative flex-shrink-0`}>
              <div className={`w-20 h-20 rounded-2xl ${tier.bg} border-2 ${tier.border} flex items-center justify-center text-4xl ${tier.glow}`}>
                {player?.avatar || '🎮'}
              </div>
              <button
                onClick={() => setShowAllAvatars(a => !a)}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-card border border-white/15 rounded-full flex items-center justify-center hover:bg-card-hover transition-colors"
                title="Change avatar"
              >
                <Pencil size={10} className="text-text-muted" />
              </button>
            </div>

            {/* Name + tier */}
            <div className="flex-1 min-w-0 pt-1">
              {editingName ? (
                <div className="space-y-2">
                  <input
                    value={newName}
                    onChange={e => { setNewName(e.target.value); setNameError(''); }}
                    className="w-full bg-surface/80 rounded-xl px-3 py-1.5 font-bold text-base focus:outline-none focus:ring-2 focus:ring-accent"
                    maxLength={20}
                    autoFocus
                  />
                  {nameError && <p className="text-red-400 text-xs">{nameError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingName(false); setNewName(player?.name || ''); setNameError(''); }}
                      className="text-text-muted hover:text-text px-3 py-1 rounded-lg text-xs border border-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setNameSaving(true);
                        const err = await updateName(newName);
                        setNameSaving(false);
                        if (err) setNameError(err);
                        else setEditingName(false);
                      }}
                      disabled={nameSaving || !newName.trim()}
                      className="bg-accent text-bg font-semibold px-3 py-1 rounded-lg text-xs hover:opacity-90 disabled:opacity-50"
                    >
                      <Check size={12} className="inline mr-1" />
                      {nameSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-text truncate">{player?.name}</h2>
                  <button
                    onClick={() => { setEditingName(true); setNewName(player?.name || ''); }}
                    className="text-text-muted hover:text-accent transition-colors flex-shrink-0"
                    title="Edit name"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              )}

              {/* Rank tier badge */}
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${tier.bg} ${tier.border} ${tier.color}`}>
                {tier.emoji} {tier.label}
              </span>

              {/* Stars summary */}
              <p className="text-text-muted text-xs mt-1.5">
                {totalStars} star{totalStars !== 1 ? 's' : ''} earned · {gamesPlayed} game{gamesPlayed !== 1 ? 's' : ''} played
              </p>
            </div>
          </div>

          {/* Progress toward next tier */}
          {nextTierStars !== null && (
            <div className="relative mt-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wide">Progress to next tier</span>
                <span className={`text-[10px] font-bold ${tier.color}`}>
                  {totalStars} / {nextTierStars} ⭐
                </span>
              </div>
              <div className="w-full h-2 bg-black/20 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    tier.label === 'Bronze' ? 'bg-orange-400' :
                    tier.label === 'Silver' ? 'bg-slate-300' :
                    tier.label === 'Gold'   ? 'bg-yellow-400' :
                    'bg-emerald-400'
                  }`}
                  style={{ width: `${tierProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-text-muted mt-1">
                {nextTierStars - totalStars} more star{nextTierStars - totalStars !== 1 ? 's' : ''} to reach {RANK_TIERS.find(t => t.min === nextTierStars)?.emoji} {RANK_TIERS.find(t => t.min === nextTierStars)?.label}
              </p>
            </div>
          )}
          {nextTierStars === null && (
            <div className="relative mt-4 text-center">
              <p className={`text-xs font-bold ${tier.color}`}>
                💎 Maximum rank achieved! You are Diamond.
              </p>
            </div>
          )}
        </div>

        {/* ── Stats ─────────────────────────────────────────── */}
        <div className="space-y-2">
          {/* Two hero stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-card rounded-2xl p-4 border border-white/5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/15 flex items-center justify-center flex-shrink-0">
                <Star size={18} className="text-yellow-400" fill="currentColor" />
              </div>
              <div>
                <div className="text-2xl font-black text-text">{totalStars}</div>
                <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wide">Total Stars</div>
              </div>
            </div>
            <div className="bg-card rounded-2xl p-4 border border-white/5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
                <Trophy size={18} className="text-accent" />
              </div>
              <div>
                <div className="text-2xl font-black text-text">{totalScore.toLocaleString()}</div>
                <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wide">Total Score</div>
              </div>
            </div>
          </div>

          {/* Four secondary stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Gamepad2, color: 'text-sky-400',     bg: 'bg-sky-500/12',     val: gamesPlayed,              label: 'Games' },
              { icon: Zap,      color: 'text-emerald-400', bg: 'bg-emerald-500/12', val: totalPlays,               label: 'Plays' },
              { icon: Trophy,   color: 'text-amber-400',  bg: 'bg-amber-500/12',  val: highestScore.toLocaleString(), label: 'Best' },
              { icon: Star,     color: 'text-amber-400',   bg: 'bg-amber-500/12',   val: avgStarsPerGame,          label: 'Avg ⭐' },
            ].map(({ icon: Icon, color, bg, val, label }) => (
              <div key={label} className="bg-card rounded-xl p-3 text-center border border-white/5">
                <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center mx-auto mb-1`}>
                  <Icon size={13} className={color} />
                </div>
                <div className="text-sm font-bold text-text leading-none">{val}</div>
                <div className="text-[9px] text-text-muted mt-0.5 font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Top Games ─────────────────────────────────────── */}
        {topGames.length > 0 && (
          <div className="bg-card rounded-2xl border border-white/5 overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-text">Top Games</h3>
              <span className="text-[10px] text-text-muted">{topGames.length} played</span>
            </div>
            <div className="divide-y divide-white/5">
              {topGames.map(({ id, game, starsEarned, highScore, timesPlayed }, idx) => (
                <div key={id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-[10px] font-bold text-text-muted w-4 text-center">{idx + 1}</span>
                  <GameArt gameId={id} emoji={game!.emoji} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text truncate">{game!.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Star
                          key={i}
                          size={10}
                          className={i < starsEarned ? 'text-yellow-400' : 'text-white/10'}
                          fill="currentColor"
                        />
                      ))}
                      <span className="text-[10px] text-text-muted ml-1">{timesPlayed} play{timesPlayed !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-bold text-accent">{highScore.toLocaleString()}</div>
                    <div className="text-[9px] text-text-muted">best score</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Avatar Picker ─────────────────────────────────── */}
        <div className="bg-card rounded-2xl border border-white/5 overflow-hidden">
          <button
            onClick={() => setShowAllAvatars(a => !a)}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-card-hover transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{player?.avatar || '🎮'}</span>
              <div className="text-left">
                <p className="text-sm font-bold text-text">Change Avatar</p>
                <p className="text-[11px] text-text-muted">{AVATARS.length} avatars available</p>
              </div>
            </div>
            <ChevronRight size={16} className={`text-text-muted transition-transform ${showAllAvatars ? 'rotate-90' : ''}`} />
          </button>
          {showAllAvatars && (
            <div className="px-4 pb-4 border-t border-white/5 pt-3">
              <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5">
                {AVATARS.map(a => (
                  <button
                    key={a}
                    onClick={() => updateAvatar(a)}
                    className={`text-2xl p-2 rounded-xl transition-all aspect-square flex items-center justify-center ${
                      player?.avatar === a
                        ? 'bg-accent/20 ring-2 ring-accent scale-110'
                        : 'hover:bg-card-hover hover:scale-105 opacity-60 hover:opacity-100'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Settings ──────────────────────────────────────── */}
        <button
          onClick={toggleFx}
          role="switch"
          aria-checked={fxOn}
          className="w-full flex items-center justify-between bg-card hover:bg-card-hover py-3 px-5 rounded-2xl border border-white/8 transition-all active:scale-[0.99]"
        >
          <span className="flex items-center gap-2 font-semibold text-sm">
            {fxOn ? <Volume2 size={16} className="text-accent" aria-hidden /> : <VolumeX size={16} className="text-text-muted" aria-hidden />}
            Sound effects & vibration
          </span>
          <span
            className={`relative w-10 h-6 rounded-full transition-colors ${fxOn ? 'bg-accent' : 'bg-card-hover'}`}
            aria-hidden
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${fxOn ? 'left-[18px]' : 'left-0.5'}`}
            />
          </span>
        </button>

        <button
          onClick={toggleTheme}
          role="switch"
          aria-checked={lightTheme}
          className="w-full flex items-center justify-between bg-card hover:bg-card-hover py-3 px-5 rounded-2xl border border-white/8 transition-all active:scale-[0.99]"
        >
          <span className="flex items-center gap-2 font-semibold text-sm">
            Light mode
            <span className="text-text-muted text-xs font-normal">easier in bright rooms</span>
          </span>
          <span
            className={`relative w-10 h-6 rounded-full transition-colors ${lightTheme ? 'bg-accent' : 'bg-card-hover'}`}
            aria-hidden
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${lightTheme ? 'left-[18px]' : 'left-0.5'}`}
            />
          </span>
        </button>

        <button
          onClick={toggleKidMode}
          role="switch"
          aria-checked={kidMode}
          className="w-full flex items-center justify-between bg-card hover:bg-card-hover py-3 px-5 rounded-2xl border border-white/8 transition-all active:scale-[0.99]"
        >
          <span className="flex flex-col items-start gap-0.5 text-left">
            <span className="font-semibold text-sm">Kid mode</span>
            <span className="text-text-muted text-xs font-normal">Activity feed only — no free chat or GIFs</span>
          </span>
          <span
            className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${kidMode ? 'bg-accent' : 'bg-card-hover'}`}
            aria-hidden
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${kidMode ? 'left-[18px]' : 'left-0.5'}`}
            />
          </span>
        </button>

        {/* ── Switch Player ─────────────────────────────────── */}
        <button
          onClick={() => { logout(); navigate('/auth'); }}
          className="w-full flex items-center justify-center gap-2 bg-accent/10 hover:bg-accent/20 text-accent font-semibold py-3 px-6 rounded-2xl border border-accent/30 hover:border-accent/50 transition-all active:scale-[0.98]"
        >
          <Users size={16} /> Switch Player
        </button>

        {/* ── Log Out ───────────────────────────────────────── */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center justify-center gap-2 bg-red-500/8 hover:bg-red-500/15 text-red-400 font-semibold py-3 px-6 rounded-2xl border border-red-500/20 hover:border-red-500/40 transition-all active:scale-[0.98]"
        >
          <LogOut size={16} /> Log Out
        </button>
      </div>

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-500/15 p-2.5 rounded-xl">
                <AlertTriangle size={22} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold">Log out?</h3>
                <p className="text-text-muted text-xs mt-0.5">Your progress is saved</p>
              </div>
            </div>
            <p className="text-text-muted text-sm mb-5 leading-relaxed">
              You can sign back in anytime and all your stars, scores, and rank will be waiting for you.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 bg-card-hover text-text font-semibold py-2.5 rounded-xl transition-colors hover:bg-white/10 active:scale-95"
              >
                Stay
              </button>
              <button
                onClick={() => { setShowLogoutConfirm(false); logout(); }}
                className="flex-1 bg-red-500 hover:bg-red-400 text-white font-semibold py-2.5 rounded-xl transition-colors active:scale-95"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
