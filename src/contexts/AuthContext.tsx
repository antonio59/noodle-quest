import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Player } from '@/types';

interface AuthCtx {
  player: Player | null;
  login: (name: string, pin: string) => Promise<string | null>;
  /** Returns { pending: true } when the signup needs owner approval. */
  signup: (name: string, pin: string, avatar?: string, inviteCode?: string) => Promise<{ error?: string; pending?: boolean }>;
  logout: () => void;
  updateAvatar: (emoji: string) => Promise<void>;
  updateName: (name: string) => Promise<string | null>;
  updatePrefs: (prefs: { kidMode?: boolean; theme?: 'dark' | 'light' }) => Promise<string | null>;
}

const Ctx = createContext<AuthCtx>(null!);

const STORAGE_KEY = 'nq_session_v2';
const LEGACY_STORAGE_KEY = 'nq_session';

async function callConvex(kind: 'mutation' | 'query', path: string, args: Record<string, unknown>) {
  const res = await fetch(`${import.meta.env.VITE_CONVEX_URL}/api/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Convex-Client': 'npm-1.33.1' },
    body: JSON.stringify({ path, format: 'convex_encoded_json', args: [args] }),
  });
  return res.json();
}

function applyTheme(theme: 'dark' | 'light' | undefined) {
  const t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return stored?.sessionToken ? stored : null;
    } catch { return null; }
  });

  useEffect(() => {
    if (player) localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
    else localStorage.removeItem(STORAGE_KEY);
    applyTheme(player?.theme);
  }, [player]);

  // Guest / logged-out: keep dark (landing brand).
  useEffect(() => {
    if (!player) applyTheme('dark');
  }, [player]);

  const login = async (name: string, pin: string): Promise<string | null> => {
    try {
      const data = await callConvex('mutation', 'auth:logIn', { name, pin });
      if (data.status === 'error') return data.errorMessage;
      if (data.value?.error) return data.value.error;
      const p: Player = {
        playerId: data.value.playerId,
        name: data.value.name,
        avatar: data.value.avatar,
        sessionToken: data.value.sessionToken,
        kidMode: !!data.value.kidMode,
        theme: data.value.theme === 'light' ? 'light' : 'dark',
      };
      setPlayer(p);
      return null;
    } catch {
      return 'Connection error. Check your internet.';
    }
  };

  const signup = async (name: string, pin: string, avatar?: string, inviteCode?: string): Promise<{ error?: string; pending?: boolean }> => {
    if (name.length < 2) return { error: 'Name needs at least 2 characters!' };
    if (!/^\d{6}$/.test(pin)) return { error: 'Passcode must be 6 digits' };
    try {
      const data = await callConvex('mutation', 'auth:signUp', { name: name.trim(), pin, avatar, inviteCode });
      if (data.status === 'error') return { error: data.errorMessage };
      if (data.value?.error) return { error: data.value.error };
      if (data.value?.pending) return { pending: true };
      const p: Player = {
        playerId: data.value.playerId,
        name: name.trim(),
        avatar: data.value.avatar,
        sessionToken: data.value.sessionToken,
        kidMode: false,
        theme: 'dark',
      };
      setPlayer(p);
      return {};
    } catch {
      return { error: 'Connection error. Check your internet.' };
    }
  };

  const logout = () => {
    const token = player?.sessionToken;
    setPlayer(null);
    if (token) {
      callConvex('mutation', 'auth:logOut', { sessionToken: token }).catch(() => {});
    }
  };

  const updateAvatar = async (emoji: string) => {
    setPlayer(prev => prev ? { ...prev, avatar: emoji } : null);
    if (player) {
      try {
        await callConvex('mutation', 'auth:updateAvatar', { sessionToken: player.sessionToken, avatar: emoji });
      } catch { /* offline */ }
    }
  };

  const updateName = async (name: string): Promise<string | null> => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return 'Name needs at least 2 characters!';
    if (player) {
      try {
        const data = await callConvex('mutation', 'auth:updateName', { sessionToken: player.sessionToken, name: trimmed });
        if (data.status === 'error' || data.value?.error) {
          return data.value?.error || data.errorMessage || 'Failed to update name';
        }
        setPlayer(prev => prev ? { ...prev, name: trimmed } : null);
        return null;
      } catch {
        return 'Connection error. Check your internet.';
      }
    }
    return null;
  };

  const updatePrefs = async (prefs: { kidMode?: boolean; theme?: 'dark' | 'light' }): Promise<string | null> => {
    if (!player) return 'Not signed in.';
    setPlayer(prev => prev ? { ...prev, ...prefs } : null);
    try {
      const data = await callConvex('mutation', 'auth:updatePrefs', {
        sessionToken: player.sessionToken,
        ...prefs,
      });
      if (data.status === 'error' || data.value?.error) {
        return data.value?.error || data.errorMessage || 'Failed to save preferences';
      }
      return null;
    } catch {
      return 'Connection error. Check your internet.';
    }
  };

  return (
    <Ctx.Provider value={{ player, login, signup, logout, updateAvatar, updateName, updatePrefs }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
