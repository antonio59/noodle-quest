import { useState, useEffect, createElement, Suspense, useRef, useMemo, useCallback } from 'react';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Star, ChevronRight, ChevronDown, ArrowRight, Lock, Flag, Loader2, Copy, Check } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '@/contexts/AuthContext';
import { getGameMeta, getGameComponent, getAllGames } from '@/lib/game-registry';
import { playWin, playPerfect, playLose } from '@/lib/feedback';
import { difficultyForStage, DIFFICULTY_STYLE } from '@/lib/difficulty';
import { Confetti } from '@/components/Confetti';
import { ChallengePlayerModal } from '@/components/ChallengePlayerModal';
import { Swords } from 'lucide-react';
import { computeBonusTiers, getBonusTier, applyBonus } from '@/lib/bonus-multiplier';
import type { GameResult } from '@/types';
import { ReportIssueModal } from '@/components/ReportIssueModal';
import { GameErrorBoundary } from '@/components/GameErrorBoundary';

export function PlayGame() {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const location = useLocation();
  const { player } = useAuth();

  const stage = (location.state as any)?.stage ?? 1;
  const fromTab = (location.state as any)?.fromTab ?? 'brain';
  const isMultiplayer = (location.state as any)?.multiplayer ?? false;
  const joinerSessionId = (location.state as any)?.sessionId as string | undefined;
  // Set when this play-through answers a "beat my score" challenge.
  const challengeId = (location.state as any)?.challengeId as string | undefined;
  const challengeTarget = (location.state as any)?.challengeTarget as number | undefined;
  const challengerName = (location.state as any)?.challengerName as string | undefined;

  const [currentStage, setCurrentStage] = useState(stage);
  const [score, setScore] = useState(0);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [ended, setEnded] = useState<GameResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [nextStage, setNextStage] = useState<number | null>(null);
  const [numPlayers, setNumPlayers] = useState<number>(2);
  const [lobbyDone, setLobbyDone] = useState(false);
  const [showStagePicker, setShowStagePicker] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeOutcome, setChallengeOutcome] = useState<'won' | 'lost' | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  // Page-visibility pause (tab switch, lock screen, incoming call)
  const isPageHidden = usePageVisibility();
  const [needsResume, setNeedsResume] = useState(false);
  const wasHiddenRef = useRef(false);
  useEffect(() => {
    if (isPageHidden) {
      wasHiddenRef.current = true;
    } else if (wasHiddenRef.current) {
      wasHiddenRef.current = false;
      // Only show resume screen for active single-player games (not end screen, not multiplayer)
      if (!ended && !isMultiplayer) setNeedsResume(true);
    }
  }, [isPageHidden, ended, isMultiplayer]);
  // Clear the resume screen whenever the game ends or user navigates
  useEffect(() => { if (ended) setNeedsResume(false); }, [ended]);
  const gamePaused = (isPageHidden || needsResume) && !isMultiplayer;

  const saveScore = useMutation(api.games.saveScore);
  const respondToChallenge = useMutation(api.challenges.respondToChallenge);

  // Look up game metadata (no component import)
  const gameMeta = gameId ? getGameMeta(gameId) : undefined;

  // Fetch player's progress for this game to enable stage selection
  const playerProgress = useQuery(
    api.games.getPlayerProgress,
    player?.sessionToken && gameId ? { sessionToken: player.sessionToken, gameId } : 'skip' as any,
  );
  const maxUnlocked = playerProgress?.maxUnlockedStage ?? 1;
  // Difficulty follows the stage on the board, so replaying stage 1 is a
  // gentle match no matter how far the player has progressed.
  const aiDifficulty = difficultyForStage(currentStage);

  // Monthly bonus pool: the 3 least-played games globally earn 3×, next 3 earn 2×.
  const monthlyPlays = useQuery(api.games.getMonthlyPlayCounts, {});
  const bonusTiers = monthlyPlays
    ? computeBonusTiers(monthlyPlays.counts, getAllGames().map(g => g.id))
    : {};
  const bonusMultiplier = gameId ? bonusTiers[gameId] ?? 1 : 1;
  const bonusTier = getBonusTier(bonusMultiplier);

  // Retrieve pre-built lazy component (created at registration time, not during render)
  const GameComponent = gameId ? getGameComponent(gameId) : undefined;

  // Redirect if game not found
  useEffect(() => {
    if (!gameMeta) {
      navigate('/games', { replace: true });
    }
  }, [gameMeta, navigate]);

  const createInvite = useMutation(api.multiplayer.createInvite);
  const startSession = useMutation(api.multiplayer.startSession);
  const makeMove = useMutation(api.multiplayer.makeMove);
  const resignSession = useMutation(api.multiplayer.resignSession);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(joinerSessionId ?? null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  // Auto-create an invite as soon as the host enters multiplayer mode
  useEffect(() => {
    if (!isMultiplayer || !player || inviteCode || sessionId || creatingInvite || joinerSessionId) return;
    if (!gameId) return;
    const minP = gameMeta?.minPlayers ?? 2;
    const maxP = gameMeta?.maxPlayers ?? 2;
    setCreatingInvite(true);
    createInvite({ gameId, sessionToken: player.sessionToken, minPlayers: minP, maxPlayers: maxP })
      .then((result: any) => {
        if (result && result.inviteCode) {
          setInviteCode(result.inviteCode as string);
          if (result.sessionId) setSessionId(result.sessionId as string);
        }
        setCreatingInvite(false);
      })
      .catch(() => setCreatingInvite(false));
  }, [isMultiplayer, player?.playerId, gameId]);

  // Live lobby state — roster of players who've joined so far. The token
  // lets the server reveal our own hidden state (e.g. our UNO hand).
  const liveSession = useQuery(
    api.multiplayer.getSession,
    sessionId && player
      ? { sessionId: sessionId as any, sessionToken: player.sessionToken }
      : 'skip' as any,
  );

  const isLivePlaying = isMultiplayer && !!liveSession && liveSession.status === 'playing';
  const mySeat = liveSession?.players.find(
    p => player && p.id === (player.playerId as any),
  );

  // Keep this object identity stable across local score/message re-renders.
  // Games hydrate from multiplayerState in effects; a fresh literal every
  // paint was overwriting in-flight local boards with the pre-move server copy.
  const multiplayerView = useMemo(() => {
    if (!isLivePlaying || !liveSession || !mySeat) return undefined;
    const other = liveSession.players.find(p => p.seat !== mySeat.seat);
    return {
      sessionId: sessionId ?? '',
      playerNumber: mySeat.seat,
      currentPlayer: liveSession.currentPlayer,
      boardState: liveSession.boardState,
      opponentName: other?.name ?? '',
      opponentAvatar: other?.avatar ?? '',
      players: liveSession.players,
      status: liveSession.status as 'waiting' | 'lobby' | 'playing' | 'finished',
      winner: liveSession.winner,
    };
  }, [
    isLivePlaying,
    sessionId,
    mySeat?.id,
    mySeat?.seat,
    liveSession?.currentPlayer,
    liveSession?.boardState,
    liveSession?.winner,
    liveSession?.status,
    liveSession?.players,
  ]);

  // If the server session ends without the local game noticing (e.g. the
  // opponent resigned or their tab closed mid-move), close out locally so
  // the remaining player isn't stuck on a live board forever.
  const liveStatus = liveSession?.status;
  const liveWinner = liveSession?.winner;
  useEffect(() => {
    if (!isMultiplayer || liveStatus !== 'finished' || ended) return;
    const iWon = liveWinner !== undefined && liveWinner === mySeat?.seat;
    handleEnd({
      score: iWon ? 60 : 10,
      stars: iWon ? 3 : 1,
      summary: iWon ? 'Your opponent left — you win by forfeit!' : 'The game has ended.',
    });
  }, [isMultiplayer, liveStatus, liveWinner, ended, mySeat?.seat]);

  const handleMultiplayerMove = useCallback((move: unknown) => {
    if (!sessionId || !player) return;
    makeMove({
      sessionId: sessionId as any,
      sessionToken: player.sessionToken,
      move,
    })
      .then(res => {
        const err = (res as { error?: string } | undefined)?.error;
        if (err) setMessage(`Move rejected: ${err}`);
      })
      .catch(() => setMessage('Connection problem — move not sent.'));
  }, [sessionId, player?.sessionToken, makeMove]);

  if (!gameMeta || !gameId || !GameComponent) return null;

  const minPlayers = gameMeta.minPlayers ?? 2;
  const maxPlayers = gameMeta.maxPlayers ?? 2;
  // Lobby only appears for multi-player games so the user can choose how many AI opponents
  const showLobby = !lobbyDone && maxPlayers > 2 && !isMultiplayer;

  // Joiner waiting-in-lobby screen: has sessionId, no inviteCode of their own,
  // and the session isn't playing yet.
  if (isMultiplayer && sessionId && !inviteCode && liveSession && liveSession.status !== 'playing') {
    const roster = liveSession.players ?? [];
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">{gameMeta.emoji}</div>
        <h2 className="text-2xl font-bold mb-2">{gameMeta.name}</h2>
        <p className="text-text-muted text-sm mb-5">
          Waiting for {liveSession.player1Name} to start the game...
        </p>
        <div className="w-full max-w-xs mb-6">
          <div className="text-xs font-semibold text-text-dim mb-2">
            {roster.length} of {liveSession.maxPlayers} joined
          </div>
          <div className="flex flex-col gap-1.5">
            {roster.map(seat => (
              <div
                key={seat.id}
                className="flex items-center gap-2 bg-card rounded-lg px-3 py-2 text-left"
              >
                <span className="text-lg">{seat.avatar}</span>
                <span className="text-sm font-semibold flex-1">{seat.name}</span>
                {seat.seat === 1 && (
                  <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full font-bold">
                    Host
                  </span>
                )}
                {player && seat.id === (player.playerId as any) && (
                  <span className="text-[10px] bg-success/20 text-success px-2 py-0.5 rounded-full font-bold">
                    You
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={() => navigate('/games')}
          className="text-text-muted text-sm hover:text-text transition-colors"
        >
          <ArrowLeft size={14} className="inline mr-1" /> Back to Games
        </button>
      </div>
    );
  }

  // Multiplayer invite flow — generating link (auto-triggered by useEffect above)
  if (isMultiplayer && !inviteCode && !isLivePlaying) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">{gameMeta.emoji}</div>
        <h2 className="text-2xl font-bold mb-2">{gameMeta.name}</h2>
        <p className="text-text-muted text-sm mb-6">Setting up your game room...</p>
        <Loader2 className="animate-spin text-accent" size={36} />
        <button
          onClick={() => navigate(`/games?tab=board`)}
          className="text-text-muted text-xs hover:text-text transition-colors mt-8"
        >
          <ArrowLeft size={13} className="inline mr-1" /> Back to Games
        </button>
      </div>
    );
  }

  if (isMultiplayer && inviteCode && !isLivePlaying) {
    const inviteUrl = `${window.location.origin}/invite/${gameId}/${inviteCode}`;
    const handleCopy = () => {
      navigator.clipboard.writeText(inviteUrl)
        .then(() => { setHasCopied(true); setTimeout(() => setHasCopied(false), 2500); })
        .catch(() => {});
    };
    const handleShare = () => {
      if (navigator.share) {
        navigator.share({ title: `Play ${gameMeta.name}!`, text: `Join me for ${gameMeta.name} on Noodle Quest!`, url: inviteUrl }).catch(() => {});
      } else {
        handleCopy();
      }
    };

    const roster = liveSession?.players ?? [];
    const joinedCount = roster.length;
    const canStart = joinedCount >= minPlayers;
    const roomFull = joinedCount >= maxPlayers;
    const isHost = player && liveSession && liveSession.player1Id === (player.playerId as any);

    const handleStart = async () => {
      if (!sessionId || !player) return;
      try {
        await startSession({ sessionId: sessionId as any, sessionToken: player.sessionToken });
      } catch {
        // ignore — next poll will reflect state
      }
    };

    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-3">{gameMeta.emoji}</div>
        <h2 className="text-2xl font-bold mb-1">{gameMeta.name}</h2>
        <p className="text-text-muted text-sm mb-4">Share this link with your friend to start playing!</p>
        <div className="bg-card rounded-xl px-5 py-4 mb-3 w-full max-w-xs">
          <div className="text-3xl font-mono font-bold text-accent tracking-widest mb-2">{inviteCode}</div>
          <div className="text-[11px] text-text-muted break-all leading-relaxed">{inviteUrl}</div>
        </div>
        <div className="flex gap-2 mb-5 w-full max-w-xs">
          <button
            onClick={handleCopy}
            className={`flex-1 flex items-center justify-center gap-1.5 font-bold px-4 py-2.5 rounded-xl transition-all active:scale-95 ${
              hasCopied ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-card text-text hover:bg-card-hover'
            }`}
          >
            {hasCopied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy Link</>}
          </button>
          <button onClick={handleShare} className="flex-1 bg-accent text-bg font-bold px-4 py-2.5 rounded-xl hover:opacity-90 active:scale-95">
            Share
          </button>
        </div>

        {maxPlayers > 2 && (
          <div className="w-full max-w-xs mb-5">
            <div className="text-xs font-semibold text-text-dim mb-2">
              {joinedCount} of {maxPlayers} joined{canStart ? '' : ` · need ${minPlayers}`}
            </div>
            <div className="flex flex-col gap-1.5">
              {roster.map(seat => (
                <div
                  key={seat.id}
                  className="flex items-center gap-2 bg-card rounded-lg px-3 py-2 text-left"
                >
                  <span className="text-lg">{seat.avatar}</span>
                  <span className="text-sm font-semibold flex-1">{seat.name}</span>
                  {seat.seat === 1 && (
                    <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full font-bold">
                      Host
                    </span>
                  )}
                </div>
              ))}
              {Array.from({ length: Math.max(0, minPlayers - joinedCount) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex items-center gap-2 bg-card/40 rounded-lg px-3 py-2 text-left border border-dashed border-white/10"
                >
                  <span className="text-lg opacity-40">◌</span>
                  <span className="text-sm text-text-muted italic">Waiting for player...</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {maxPlayers > 2 && isHost ? (
          <button
            onClick={handleStart}
            disabled={!canStart}
            className={`font-bold px-6 py-2.5 rounded-xl mb-4 transition ${
              canStart
                ? 'bg-success text-bg hover:opacity-90 active:scale-95'
                : 'bg-card text-text-muted cursor-not-allowed'
            }`}
          >
            {canStart ? `Start Game (${joinedCount} players)` : `Need ${minPlayers - joinedCount} more`}
          </button>
        ) : (
          <p className="text-text-dim text-xs mb-4 animate-pulse">
            {roomFull ? 'Starting...' : 'Waiting for opponent to join...'}
          </p>
        )}

        <button
          onClick={() => navigate(`/games?tab=board`)}
          className="text-text-muted text-sm hover:text-text transition-colors"
        >
          <ArrowLeft size={14} className="inline mr-1" /> Back to Games
        </button>
      </div>
    );
  }

  // Pre-game lobby: only shown for multi-player games so user can pick number of AI opponents
  if (showLobby) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">{gameMeta.emoji}</div>
        <h2 className="text-2xl font-bold mb-2">{gameMeta.name}</h2>
        <p className="text-text-muted text-sm mb-6 max-w-xs">{gameMeta.description}</p>

        <div className="w-full max-w-xs mb-6">
          <h3 className="text-sm font-semibold text-text-dim mb-3">How many players?</h3>
          <div className="flex gap-2 justify-center">
            {Array.from({ length: maxPlayers - 1 }, (_, i) => i + 2).map(n => (
              <button
                key={n}
                onClick={() => setNumPlayers(n)}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                  numPlayers === n
                    ? 'bg-accent text-bg'
                    : 'bg-card text-text hover:bg-card-hover'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-text-dim mt-2 text-center">
            You + {numPlayers - 1} AI opponent{numPlayers > 2 ? 's' : ''}
          </p>
        </div>

        <button
          onClick={() => setLobbyDone(true)}
          className="bg-accent text-bg font-bold px-10 py-3 rounded-xl text-lg hover:opacity-90 active:scale-95 mb-4"
        >
          Play!
        </button>

        <button
          onClick={() => navigate(`/games${fromTab !== 'brain' ? `?tab=${fromTab}` : ''}`)}
          className="text-text-muted text-sm hover:text-text transition-colors"
        >
          <ArrowLeft size={14} className="inline mr-1" /> Back to Games
        </button>
      </div>
    );
  }

  const handleEnd = async (result: GameResult) => {
    // Guarantee minimum 10 points for participation, then apply under-played bonus.
    const baseScore = Math.max(result.score, 10);
    const finalScore = applyBonus(baseScore, bonusMultiplier);
    const finalResult = { ...result, score: finalScore };

    setEnded(finalResult);
    setSaving(true);

    if (result.stars >= 3) playPerfect();
    else if (result.stars >= 2) playWin();
    else playLose();

    if (player && saveScore) {
      try {
        await saveScore({
          sessionToken: player.sessionToken,
          gameId,
          stage: currentStage,
          score: finalScore,
          stars: result.stars,
        });
      } catch (err) {
        // save failed silently
      }
    }
    // Resolve a pending challenge with this score
    if (challengeId && player) {
      try {
        const res = await respondToChallenge({
          sessionToken: player.sessionToken,
          challengeId: challengeId as never,
          toScore: finalScore,
        });
        if (res && 'won' in res) setChallengeOutcome(res.won ? 'won' : 'lost');
      } catch {
        // challenge result is decoration — the score itself was saved
      }
    }
    setSaving(false);

    // Auto-advance on success (2+ stars) after a brief pause
    if (result.stars >= 2 && currentStage < gameMeta.stages) {
      setNextStage(currentStage + 1);
      setTimeout(() => {
        setEnded(null);
        setScore(0);
        setProgress(0);
        setCurrentStage(currentStage + 1);
        setNextStage(null);
        setMessage('');
      }, 2200);
    } else if (result.stars > 0 && currentStage < gameMeta.stages) {
      setNextStage(currentStage + 1);
    }
  };

  const renderStars = (count: number) => (
    <div className="flex justify-center gap-2 my-4">
      {[1, 2, 3].map(i => (
        <Star
          key={i}
          size={36}
          className={i <= count ? 'text-warning' : 'text-card-hover'}
          fill={i <= count ? 'currentColor' : 'none'}
        />
      ))}
    </div>
  );

  const goBackToGames = () => {
    // Quitting mid-game resigns the session so the opponent isn't left waiting.
    if (isMultiplayer && sessionId && player && liveSession && liveSession.status !== 'finished') {
      resignSession({ sessionId: sessionId as any, sessionToken: player.sessionToken })
        .catch(() => {});
    }
    navigate(`/games${fromTab !== 'brain' ? `?tab=${fromTab}` : ''}`);
  };

  if (ended) {
    const prevBestEntry = playerProgress?.stages?.find(s => s.stage === currentStage);
    const prevBest = prevBestEntry?.highScore ?? 0;
    const isNewBest = ended.score > prevBest;
    const isPerfect = ended.stars === 3;
    const isGood = ended.stars >= 2;
    const backLabel = fromTab === 'breathe' ? 'Breathe' : fromTab === 'board' ? 'Board' : fromTab === 'tracks' ? 'Tracks' : 'Games';
    return (
      <div className="h-full overflow-y-auto flex flex-col items-center justify-center p-5">
        {isGood && <Confetti count={isPerfect ? 56 : 32} />}
        <div className={`w-full max-w-sm rounded-3xl p-6 border text-center transition-all ${
          isPerfect
            ? 'bg-yellow-500/8 border-yellow-500/25 shadow-[0_0_40px_rgba(253,224,71,0.15)]'
            : isGood
            ? 'bg-accent/8 border-accent/25 shadow-[0_0_32px_rgba(167,139,250,0.12)]'
            : 'bg-card border-white/8'
        }`}>

          {/* Result emoji */}
          <div className={`text-6xl mb-2 ${isGood ? 'animate-[celebrate_0.4s_ease]' : ''}`}>
            {isPerfect ? '🏆' : isGood ? '🎉' : '👏'}
          </div>

          {/* Title */}
          <h2 className={`text-2xl font-black mb-4 ${
            isPerfect ? 'text-yellow-300' : isGood ? 'text-accent' : 'text-text'
          }`}>
            {isPerfect ? 'Perfect!' : isGood ? 'Great job!' : 'Good effort!'}
          </h2>

          {/* Stars */}
          <div className="flex justify-center gap-3 mb-5">
            {[1, 2, 3].map(i => (
              <Star
                key={i}
                size={36}
                className={i <= ended.stars ? 'text-yellow-400' : 'text-white/10'}
                fill="currentColor"
              />
            ))}
          </div>

          {/* Score block */}
          <div className={`rounded-2xl px-6 py-4 mb-4 ${isPerfect ? 'bg-yellow-500/12' : 'bg-surface/60'}`}>
            <div className={`font-display text-4xl font-black tracking-tight ${isPerfect ? 'text-yellow-300' : 'text-accent'}`}>
              {ended.score.toLocaleString()}
            </div>
            <div className="text-text-muted text-xs mt-1">points · Stage {currentStage}/{gameMeta.stages}</div>
            {bonusTier && (
              <div className={`text-xs font-bold mt-1.5 ${bonusTier.color}`}>
                {bonusTier.label} bonus · {bonusTier.multiplier}× multiplier
              </div>
            )}
          </div>

          {/* New best banner */}
          {isNewBest && prevBest > 0 && (
            <div className="bg-emerald-500/12 border border-emerald-500/25 rounded-xl px-4 py-2.5 mb-4">
              <p className="text-emerald-400 text-sm font-bold">
                New personal best! +{ended.score - prevBest} over previous
              </p>
            </div>
          )}
          {isNewBest && prevBest === 0 && (
            <p className="text-emerald-400 text-xs font-bold mb-3">
              First time completing Stage {currentStage}!
            </p>
          )}
          {!isNewBest && prevBest > 0 && (
            <p className="text-text-muted text-xs mb-3">Stage {currentStage} best: {prevBest.toLocaleString()}</p>
          )}

          {/* Summary */}
          {ended.summary && (
            <p className="text-text-muted text-xs mb-4 leading-relaxed">{ended.summary}</p>
          )}

          {challengeOutcome && challengerName && (
            <div className={`rounded-xl px-4 py-3 mb-4 text-sm font-bold border ${
              challengeOutcome === 'won'
                ? 'bg-success/10 border-success/30 text-success'
                : 'bg-card border-white/10 text-text-muted'
            }`} role="status">
              {challengeOutcome === 'won'
                ? `⚔️ You beat ${challengerName}'s challenge!`
                : `⚔️ Not this time — ${challengerName} keeps the crown.`}
            </div>
          )}

          {saving && <p className="text-text-muted text-xs mb-3 animate-pulse">Saving...</p>}

          {isGood && nextStage && (
            <p className="text-accent text-sm font-semibold mb-4 animate-pulse">
              Advancing to Stage {nextStage}...
            </p>
          )}

          {/* Primary actions */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              onClick={() => { setEnded(null); setScore(0); setProgress(0); setNextStage(null); }}
              className="bg-card hover:bg-card-hover text-text font-bold py-3 rounded-2xl transition-colors active:scale-95 text-sm"
            >
              Play Again
            </button>
            {nextStage ? (
              <button
                onClick={() => { setEnded(null); setScore(0); setProgress(0); setNextStage(null); setCurrentStage(nextStage); }}
                className={`font-bold py-3 rounded-2xl hover:opacity-90 active:scale-95 text-sm flex items-center justify-center gap-1 ${
                  isPerfect ? 'bg-yellow-400 text-bg' : 'bg-accent text-bg'
                }`}
              >
                Stage {nextStage} <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={goBackToGames}
                className="bg-accent text-bg font-bold py-3 rounded-2xl hover:opacity-90 active:scale-95 text-sm"
              >
                Done
              </button>
            )}
          </div>

          {/* Challenge a player with this score */}
          {!isMultiplayer && !challengeId && ended.score > 0 && player && (
            <button
              onClick={() => setShowChallengeModal(true)}
              className="w-full flex items-center justify-center gap-1.5 bg-card hover:bg-card-hover text-accent font-bold py-2.5 rounded-2xl border border-accent/30 transition-colors active:scale-95 text-sm mb-1"
            >
              <Swords size={14} aria-hidden /> Challenge a player
            </button>
          )}

          {/* Secondary link */}
          <button
            onClick={goBackToGames}
            className="w-full text-text-muted text-sm hover:text-text transition-colors py-2 flex items-center justify-center gap-1"
          >
            <ArrowLeft size={13} /> Back to {backLabel}
          </button>

          {showChallengeModal && gameMeta && (
            <ChallengePlayerModal
              gameId={gameId!}
              gameName={gameMeta.name}
              stage={currentStage}
              score={ended.score}
              onClose={() => setShowChallengeModal(false)}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-3 bg-surface border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={goBackToGames}
            className="flex items-center gap-1.5 text-text-muted hover:text-text bg-card hover:bg-card-hover px-3 py-2 rounded-xl transition-colors active:scale-95"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-semibold">Quit</span>
          </button>
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1.5 text-text-muted hover:text-warning bg-card hover:bg-card-hover px-3 py-2 rounded-xl transition-colors active:scale-95"
            title="Report an issue"
          >
            <Flag size={16} />
            <span className="text-sm font-semibold hidden sm:inline">Report</span>
          </button>
        </div>
        <button
          onClick={() => maxUnlocked > 1 && setShowStagePicker(!showStagePicker)}
          className="text-center px-2 py-1 rounded-lg hover:bg-card/40 transition-colors"
          aria-label={maxUnlocked > 1 ? 'Change stage' : 'Stage selector'}
        >
          <div className="font-semibold text-sm">{gameMeta.emoji} {gameMeta.name}</div>
          <div className="text-text-muted text-xs flex items-center justify-center gap-1">
            <span>Stage {currentStage}/{gameMeta.stages}</span>
            <span className={`font-bold ${DIFFICULTY_STYLE[aiDifficulty].className}`}>
              · {DIFFICULTY_STYLE[aiDifficulty].label}
            </span>
            <ChevronDown
              size={12}
              className={`transition-transform ${
                maxUnlocked > 1 ? 'opacity-80' : 'opacity-25'
              } ${showStagePicker ? 'rotate-180' : ''}`}
            />
          </div>
        </button>
        <div className="flex items-center gap-2 min-w-[60px] justify-end pr-2">
          {bonusTier && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-card border border-white/5 ${bonusTier.color}`}
              title={`Score multiplied by ${bonusTier.multiplier}× for trying this game`}
            >
              {bonusTier.label}
            </span>
          )}
          <div className="text-accent font-bold">{score}</div>
        </div>
      </div>

      {showStagePicker && maxUnlocked > 1 && (
        <div className="bg-surface border-b border-white/5 p-2 flex-shrink-0">
          <div className="flex gap-1 flex-wrap justify-center">
            {Array.from({ length: gameMeta.stages }, (_, i) => i + 1).map(s => {
              const unlocked = s <= maxUnlocked;
              const isCurrent = s === currentStage;
              return (
                <button
                  key={s}
                  disabled={!unlocked}
                  onClick={() => {
                    setCurrentStage(s);
                    setScore(0);
                    setProgress(0);
                    setEnded(null);
                    setMessage('');
                    setShowStagePicker(false);
                  }}
                  className={`relative w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    isCurrent
                      ? 'bg-accent text-bg'
                      : unlocked
                        ? 'bg-card text-text hover:bg-card-hover'
                        : 'bg-card/50 text-text-muted/30'
                  }`}
                  title={unlocked ? `Stage ${s} · ${DIFFICULTY_STYLE[difficultyForStage(s)].label}` : 'Locked'}
                >
                  {unlocked ? s : <Lock size={10} />}
                  {unlocked && (
                    <span
                      className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                        isCurrent ? 'bg-bg/70' : DIFFICULTY_STYLE[difficultyForStage(s)].dot
                      }`}
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="h-2 bg-card flex-shrink-0 border-b border-white/5">
        <div
          className="h-full bg-accent transition-all duration-300 rounded-r"
          style={{
            width: `${Math.min(progress * 100, 100)}%`,
            boxShadow: progress > 0 ? '0 0 8px var(--color-accent, #f0a83a)' : 'none',
          }}
        />
      </div>

      {challengeId && challengeTarget !== undefined && !ended && (
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-warning bg-warning/10 border-b border-warning/20 py-1.5 px-4">
          <Swords size={12} aria-hidden /> Beat {challengerName ?? 'their'} score: {challengeTarget.toLocaleString()} pts
        </div>
      )}
      {message && (
        <div role="status" aria-live="polite" className="text-center text-text-dim text-sm py-2 px-4">{message}</div>
      )}

      <div className="flex-1 overflow-hidden relative">
        <GameErrorBoundary
          gameId={gameId}
          gameName={gameMeta.name}
          onReset={() => {
            setScore(0);
            setProgress(0);
            setMessage('');
            setEnded(null);
          }}
        >
        <Suspense fallback={
          <div className="h-full flex items-center justify-center">
            <div className="text-4xl animate-pulse">{gameMeta.emoji}</div>
          </div>
        }>
          {GameComponent && createElement(GameComponent, {
            key: `${gameId}-${currentStage}-${numPlayers}-${sessionId ?? 'solo'}`,
            stage: currentStage,
            onScore: (pts: number) => setScore(s => s + pts),
            onProgress: setProgress,
            onMessage: setMessage,
            onEnd: handleEnd,
            paused: gamePaused,
            multiplayerState: multiplayerView,
            onMultiplayerMove: handleMultiplayerMove,
            aiDifficulty,
            numPlayers,
          })}
        </Suspense>
        </GameErrorBoundary>

        {/* Pause overlay — shown when tab is hidden or user returns after switching away */}
        {gamePaused && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-bg/90 backdrop-blur-lg">
            <div className="text-6xl">{isPageHidden ? '🌙' : '⏸️'}</div>
            <div className="text-center">
              <p className="text-xl font-black text-text">Game Paused</p>
              <p className="text-sm text-text-muted mt-1">
                {isPageHidden ? 'Come back to resume' : 'You switched away — ready to continue?'}
              </p>
            </div>
            {!isPageHidden && (
              <button
                onClick={() => setNeedsResume(false)}
                className="bg-accent text-bg font-bold px-10 py-3.5 rounded-2xl text-lg active:scale-95 transition-all hover:opacity-90"
              >
                ▶ Resume
              </button>
            )}
          </div>
        )}
      </div>

      {showReportModal && gameMeta && (
        <ReportIssueModal
          gameId={gameMeta.id}
          gameName={gameMeta.name}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
}
