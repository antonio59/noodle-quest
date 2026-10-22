import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '@/contexts/AuthContext';
import { Swords, Search } from 'lucide-react';
import { ModalShell } from './ModalShell';

interface ChallengePlayerModalProps {
  gameId: string;
  gameName: string;
  stage: number;
  score: number;
  onClose: () => void;
}

/**
 * Post-game "beat my score" challenge: search for a player and send them
 * your score to beat. They'll see it on their home screen.
 */
export function ChallengePlayerModal({ gameId, gameName, stage, score, onClose }: ChallengePlayerModalProps) {
  const { player } = useAuth();
  const sendChallenge = useMutation(api.challenges.sendChallenge);
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);

  const results = useQuery(
    api.auth.searchPlayers,
    query.trim().length >= 2 && player
      ? { query: query.trim(), sessionToken: player.sessionToken }
      : 'skip',
  );

  const handleSend = async (toId: string, toName: string) => {
    if (!player || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await sendChallenge({
        sessionToken: player.sessionToken,
        toId: toId as never,
        gameId,
        stage,
      });
      if (res && 'error' in res && res.error) {
        setError(res.error);
      } else {
        setSentTo(toName);
      }
    } catch {
      setError('Something went wrong — try again.');
    } finally {
      setSending(false);
    }
  };

  if (sentTo) {
    return (
      <ModalShell
        title="Challenge sent"
        onClose={onClose}
        hideHeader
        panelClassName="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/10 text-center focus:outline-none"
      >
        <div className="text-4xl mb-3" aria-hidden>⚔️</div>
        <h3 className="text-lg font-bold mb-2">Challenge sent!</h3>
        <p className="text-text-muted text-sm mb-4">
          {sentTo} has been challenged to beat your <span className="text-accent font-bold">{score.toLocaleString()} pts</span> in {gameName}.
        </p>
        <button
          onClick={onClose}
          className="bg-accent text-bg font-bold px-6 py-2.5 rounded-xl hover:opacity-90 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Done
        </button>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Challenge a player" onClose={onClose}>
      <p className="text-text-muted text-xs mb-3">
        Dare someone to beat your <span className="text-accent font-bold">{score.toLocaleString()} pts</span> in {gameName} (stage {stage}).
      </p>

      <div className="relative mb-2">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden />
        <label htmlFor="challenge-search" className="sr-only">Search players</label>
        <input
          id="challenge-search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search players by name…"
          className="w-full bg-surface rounded-xl pl-9 pr-3 py-2.5 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {error && <p className="text-danger text-xs mb-2" role="alert">{error}</p>}

      <div className="space-y-1.5 min-h-[120px] max-h-56 overflow-y-auto">
        {query.trim().length < 2 ? (
          <p className="text-text-dim text-xs text-center py-8">Type at least 2 letters to find a player</p>
        ) : results === undefined ? (
          <p className="text-text-dim text-xs text-center py-8">Searching…</p>
        ) : results.length === 0 ? (
          <p className="text-text-dim text-xs text-center py-8">No players match "{query.trim()}"</p>
        ) : (
          results.map(p => (
            <button
              key={p.id}
              onClick={() => handleSend(p.id, p.name)}
              disabled={sending}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface hover:bg-card-hover text-left transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="text-2xl" aria-hidden>{p.avatar}</span>
              <span className="flex-1 text-sm font-semibold truncate">{p.name}</span>
              <span className="flex items-center gap-1 text-xs font-bold text-accent">
                <Swords size={13} aria-hidden /> Challenge
              </span>
            </button>
          ))
        )}
      </div>
    </ModalShell>
  );
}
