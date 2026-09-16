import { useState, useEffect } from 'react';
import { ArrowLeft, Search, GitMerge, KeyRound, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Player {
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
  lastActive: number;
}

interface PlayerDetails {
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
  lastActive: number;
  progressCount: number;
  scoresCount: number;
  challengesSent: number;
  challengesReceived: number;
}

export function Admin() {
  const navigate = useNavigate();
  const [secret, setSecret] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState('');
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [selectedForReset, setSelectedForReset] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<Record<string, PlayerDetails>>({});

  const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;

  const fetchPlayers = async () => {
    try {
      const res = await fetch(`${CONVEX_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Convex-Client': 'npm-1.33.1' },
        body: JSON.stringify({ path: 'auth:adminGetAllPlayers', format: 'convex_encoded_json', args: [{ adminSecret: secret }] }),
      });
      const data = await res.json();
      if (data.value?.players) {
        setPlayers(data.value.players);
      } else if (data.value?.error) {
        setError(data.value.error);
      }
    } catch (e) {
      setError('Failed to load players');
    }
  };

  const fetchDetails = async (playerId: string) => {
    if (details[playerId]) return;
    try {
      const res = await fetch(`${CONVEX_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Convex-Client': 'npm-1.33.1' },
        body: JSON.stringify({ path: 'auth:adminGetPlayerDetails', format: 'convex_encoded_json', args: [{ playerId, adminSecret: secret }] }),
      });
      const data = await res.json();
      if (data.value && !data.value.error) {
        setDetails(prev => ({ ...prev, [playerId]: data.value }));
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (authenticated) fetchPlayers();
  }, [authenticated]);

  const handleAuthenticate = () => {
    if (secret.length < 4) {
      setError('Enter admin secret');
      return;
    }
    setAuthenticated(true);
    setError('');
  };

  const toggleMergeSelection = (id: string) => {
    setSelectedForMerge(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
    fetchDetails(id);
  };

  const handleMerge = async () => {
    if (selectedForMerge.length !== 2) return;
    setLoading(true);
    setMessage('');
    setError('');

    const [sourceId, targetId] = selectedForMerge;
    try {
      const res = await fetch(`${CONVEX_URL}/api/mutation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Convex-Client': 'npm-1.33.1' },
        body: JSON.stringify({ path: 'auth:adminMergePlayers', format: 'convex_encoded_json', args: [{ sourceId, targetId, adminSecret: secret }] }),
      });
      const data = await res.json();
      if (data.value?.error) {
        setError(data.value.error);
      } else if (data.value?.success) {
        setMessage(data.value.message);
        setSelectedForMerge([]);
        await fetchPlayers();
      }
    } catch {
      setError('Merge failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async () => {
    if (!selectedForReset || !/^\d{6}$/.test(newPin)) {
      setError('Select a player and enter a 6-digit PIN');
      return;
    }
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch(`${CONVEX_URL}/api/mutation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Convex-Client': 'npm-1.33.1' },
        body: JSON.stringify({ path: 'auth:adminResetPin', format: 'convex_encoded_json', args: [{ playerId: selectedForReset, newPin, adminSecret: secret }] }),
      });
      const data = await res.json();
      if (data.value?.error) {
        setError(data.value.error);
      } else if (data.value?.success) {
        setMessage('PIN reset successfully');
        setSelectedForReset(null);
        setNewPin('');
      }
    } catch {
      setError('PIN reset failed');
    } finally {
      setLoading(false);
    }
  };

  const filtered = players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  if (!authenticated) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-bg via-surface to-bg">
        <div className="bg-card rounded-3xl shadow-2xl p-8 w-full max-w-sm">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate('/')} className="text-text-muted hover:text-text p-2 -ml-2">
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-xl font-bold text-text">Admin</h2>
            <div className="w-8" />
          </div>

          <div className="space-y-4">
            <input
              type="password"
              placeholder="Admin secret"
              value={secret}
              onChange={e => { setSecret(e.target.value); setError(''); }}
              className="w-full bg-surface rounded-xl px-4 py-3 text-text placeholder-text-muted border border-transparent focus:border-accent outline-none"
              onKeyDown={e => e.key === 'Enter' && handleAuthenticate()}
            />
            {error && <p className="text-danger text-sm text-center">{error}</p>}
            <button
              onClick={handleAuthenticate}
              className="w-full bg-accent text-bg font-bold py-3 rounded-xl hover:opacity-90 transition-opacity active:scale-95"
            >
              Enter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 bg-gradient-to-br from-bg via-surface to-bg overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-text-muted hover:text-text">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <Users size={24} /> Player Admin
          </h1>
          <div className="w-6" />
        </div>

        {(message || error) && (
          <div className={`rounded-xl p-4 text-center font-medium ${error ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
            {error || message}
          </div>
        )}

        {/* Reset PIN */}
        <div className="bg-card rounded-2xl p-6 shadow-lg">
          <h2 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
            <KeyRound size={20} /> Reset Passcode
          </h2>
          <div className="flex gap-2 mb-3">
            <select
              value={selectedForReset || ''}
              onChange={e => setSelectedForReset(e.target.value || null)}
              className="flex-1 bg-surface rounded-xl px-3 py-2 text-text border border-transparent focus:border-accent outline-none"
            >
              <option value="">Select player...</option>
              {players.map(p => (
                <option key={p.id} value={p.id}>{p.avatar} {p.name}</option>
              ))}
            </select>
            <input
              type="password"
              placeholder="6-digit PIN"
              value={newPin}
              onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-32 bg-surface rounded-xl px-3 py-2 text-text border border-transparent focus:border-accent outline-none"
              inputMode="numeric"
              maxLength={6}
            />
            <button
              onClick={handleResetPin}
              disabled={loading}
              className="bg-accent text-bg font-bold px-4 rounded-xl hover:opacity-90 disabled:opacity-50 active:scale-95"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Merge Players */}
        <div className="bg-card rounded-2xl p-6 shadow-lg">
          <h2 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
            <GitMerge size={20} /> Merge Accounts
          </h2>
          <p className="text-text-muted text-sm mb-3">
            Select 2 players. The first selected will be <strong>merged into</strong> the second (first is deleted, second keeps everything).
          </p>

          {selectedForMerge.length === 2 && (
            <div className="bg-surface rounded-xl p-4 mb-4">
              <p className="text-sm text-text mb-2">
                Merge <strong>{players.find(p => p.id === selectedForMerge[0])?.name}</strong> into <strong>{players.find(p => p.id === selectedForMerge[1])?.name}</strong>?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleMerge}
                  disabled={loading}
                  className="flex-1 bg-danger text-white font-bold py-2 rounded-xl hover:opacity-90 disabled:opacity-50 active:scale-95"
                >
                  {loading ? 'Merging...' : 'Confirm Merge'}
                </button>
                <button
                  onClick={() => setSelectedForMerge([])}
                  className="px-4 bg-surface text-text font-bold rounded-xl hover:bg-card-hover"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Player List */}
        <div className="bg-card rounded-2xl p-6 shadow-lg">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              type="text"
              placeholder="Search players..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-surface rounded-xl pl-10 pr-4 py-2 text-text placeholder-text-muted border border-transparent focus:border-accent outline-none"
            />
          </div>

          <div className="space-y-2">
            {filtered.map(p => {
              const isSelected = selectedForMerge.includes(p.id);
              const detail = details[p.id];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleMergeSelection(p.id)}
                  aria-pressed={isSelected}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors text-left ${
                    isSelected ? 'bg-accent/20 ring-1 ring-accent' : 'bg-surface hover:bg-card-hover'
                  }`}
                >
                  <span className="text-2xl">{p.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-text truncate">{p.name}</p>
                    {detail ? (
                      <p className="text-xs text-text-muted">
                        Progress: {detail.progressCount} · Scores: {detail.scoresCount} · Challenges: {detail.challengesSent + detail.challengesReceived}
                      </p>
                    ) : (
                      <p className="text-xs text-text-muted">Tap to load details</p>
                    )}
                  </div>
                  {isSelected && (
                    <span className="text-accent font-bold text-sm">
                      {selectedForMerge.indexOf(p.id) === 0 ? 'Source' : 'Target'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
