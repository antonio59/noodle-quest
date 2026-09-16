import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AVATARS } from '@/lib/avatars';
import { ArrowLeft, Lock, Plus } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const PIN_LENGTH = 6;
const PROFILE_COLORS = [
  'from-amber-400 to-orange-500',
  'from-teal-400 to-emerald-600',
  'from-sky-400 to-cyan-600',
  'from-rose-400 to-red-500',
  'from-lime-400 to-green-600',
  'from-yellow-300 to-amber-500',
];

function safeReturnTo(raw: string | null): string {
  if (!raw) return '/';
  // Only same-origin relative paths — blocks open redirects / backslash tricks.
  if (!/^\/(?!\/|\\)[A-Za-z0-9/_\-?=&.%]*$/.test(raw)) return '/';
  return raw;
}

interface Profile {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

export function Auth() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'));
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [signupName, setSignupName] = useState('');
  const [signupAvatar, setSignupAvatar] = useState('🦊');
  const [signupPin, setSignupPin] = useState('');
  const [signupPinConfirm, setSignupPinConfirm] = useState('');

  // Nudge toward unique avatars so profile cards stay distinguishable.
  const takenAvatars = new Set(profiles.map(p => p.avatar));

  useEffect(() => {
    fetchPlayers();
  }, []);

  // Allow physical keyboard / number-pad input on the PIN screen
  useEffect(() => {
    if (!selectedProfile || showSignup) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (loading) return;

      const num = e.key;
      const numpadMap: Record<string, string> = {
        Numpad0: '0', Numpad1: '1', Numpad2: '2', Numpad3: '3', Numpad4: '4',
        Numpad5: '5', Numpad6: '6', Numpad7: '7', Numpad8: '8', Numpad9: '9',
      };

      const digit = numpadMap[e.code] ?? num;

      if (digit >= '0' && digit <= '9') {
        e.preventDefault();
        handlePinPress(digit);
      } else if (num === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedProfile, showSignup, loading, pin]);

  const fetchPlayers = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_CONVEX_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Convex-Client': 'npm-1.33.1' },
        body: JSON.stringify({ path: 'auth:getAllPlayers', format: 'convex_encoded_json', args: {} }),
      });
      const data = await res.json();
      if (data.value) {
        const mapped = data.value.map((p: { id: string; name: string; avatar: string }, i: number) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          color: PROFILE_COLORS[i % PROFILE_COLORS.length],
        }));
        setProfiles(mapped);
        if (mapped.length === 0) setShowSignup(true);
      }
    } catch (e) { console.error('Failed to fetch players:', e); /* offline fallback */ }
  };

  const handlePinPress = async (num: string) => {
    if (pin.length >= PIN_LENGTH || !selectedProfile || loading) return;
    const newPin = pin + num;
    setPin(newPin);

    if (newPin.length === PIN_LENGTH) {
      setLoading(true);
      const err = await login(selectedProfile.name, newPin);
      setLoading(false);
      if (err) {
        // Server errors carry useful context (lockout, pending approval).
        setError(err);
        setPin('');
        setTimeout(() => setError(''), 4000);
      } else {
        navigate(returnTo);
      }
    }
  };

  const handleBackspace = () => setPin(pin.slice(0, -1));

  const handleBack = () => {
    setSelectedProfile(null);
    setPin('');
    setError('');
  };

  // If we arrived via a game invite link, carry its code so the invitee
  // is auto-approved instead of queued for the owner.
  const inviteCode = returnTo.startsWith('/invite/')
    ? returnTo.split('/')[3]
    : undefined;

  const handleSignup = async () => {
    if (!signupName.trim()) { setError('Enter your name!'); return; }
    if (signupName.trim().length < 2) { setError('Name needs 2+ characters!'); return; }
    if (!/^\d{6}$/.test(signupPin)) { setError('Passcode must be 6 digits'); return; }
    if (signupPin !== signupPinConfirm) { setError('Passcodes don\'t match!'); return; }
    setLoading(true);
    const res = await signup(signupName.trim(), signupPin, signupAvatar, inviteCode);
    setLoading(false);
    if (res.error) setError(res.error);
    else if (res.pending) setPendingApproval(true);
    else navigate(returnTo);
  };

  if (pendingApproval) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-bg via-surface to-bg">
        <div className="bg-card rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center">
          <div className="text-5xl mb-4" aria-hidden>⏳</div>
          <h2 className="text-xl font-bold text-text mb-2">You're in the queue!</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-6">
            {signupAvatar} <strong className="text-text">{signupName.trim()}</strong> is signed up — the site
            owner just needs to tap <em>approve</em> first. Check back soon!
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-accent text-bg font-bold py-3 rounded-xl hover:opacity-90 active:scale-95 transition"
          >
            Back home
          </button>
        </div>
      </div>
    );
  }

  if (showSignup) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-bg via-surface to-bg">
        <div className="bg-card rounded-3xl shadow-2xl p-8 w-full max-w-sm">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => { setShowSignup(false); setError(''); }} className="text-text-muted hover:text-text p-2 -ml-2">
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-xl font-bold text-text">Create Account</h2>
            <div className="w-8" />
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-[280px] mx-auto">
            {AVATARS.map(a => {
              const taken = takenAvatars.has(a);
              return (
                <button
                  key={a}
                  onClick={() => setSignupAvatar(a)}
                  title={taken ? 'Already in use by another player' : undefined}
                  aria-label={taken ? `${a} (already in use)` : a}
                  className={`relative text-2xl p-1.5 rounded-lg transition-all ${
                    signupAvatar === a ? 'bg-accent-soft ring-2 ring-accent scale-110' : 'opacity-50 hover:opacity-80'
                  }`}
                >
                  {a}
                  {taken && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-warning ring-2 ring-bg" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
          {takenAvatars.size > 0 && (
            <p className="text-[10px] text-text-muted text-center -mt-4 mb-4">
              <span className="inline-block w-2 h-2 rounded-full bg-warning align-middle mr-1" aria-hidden />
              = already someone's avatar — picking a fresh one keeps profiles easy to tell apart
            </p>
          )}

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Your name"
              value={signupName}
              onChange={e => { setSignupName(e.target.value); setError(''); }}
              className="w-full bg-surface rounded-xl px-4 py-3 text-text placeholder-text-muted border border-transparent focus:border-accent outline-none"
              maxLength={20}
              autoFocus
            />
            <input
              type="password"
              placeholder="6-digit passcode"
              value={signupPin}
              onChange={e => { setSignupPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)); setError(''); }}
              className="w-full bg-surface rounded-xl px-4 py-3 text-text placeholder-text-muted border border-transparent focus:border-accent outline-none"
              maxLength={PIN_LENGTH}
              inputMode="numeric"
            />
            <input
              type="password"
              placeholder="Confirm passcode"
              value={signupPinConfirm}
              onChange={e => { setSignupPinConfirm(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)); setError(''); }}
              className="w-full bg-surface rounded-xl px-4 py-3 text-text placeholder-text-muted border border-transparent focus:border-accent outline-none"
              maxLength={PIN_LENGTH}
              inputMode="numeric"
            />

            {error && <p className="text-danger text-sm text-center">{error}</p>}

            <button
              onClick={handleSignup}
              disabled={loading}
              className="w-full bg-accent text-bg font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 active:scale-95"
            >
              {loading ? '...' : 'Sign Up'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (selectedProfile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-bg via-surface to-bg">
        <div className="bg-card rounded-3xl shadow-2xl p-8 w-full max-w-sm">
          <div className="flex items-center justify-between mb-8">
            <button onClick={handleBack} className="text-text-muted hover:text-text">
              <ArrowLeft size={24} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-3xl">{selectedProfile.avatar}</span>
              <span className="font-bold text-text text-lg">{selectedProfile.name}</span>
            </div>
            <div className="w-6" />
          </div>

          <div className="text-center mb-8">
            <Lock className="w-8 h-8 text-text-muted mx-auto mb-4" />
            <h2 className="text-xl font-bold text-text">Enter your passcode</h2>
            <div className="flex justify-center gap-3 mt-6" aria-live="polite" aria-atomic="true">
              {[...Array(PIN_LENGTH)].map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all duration-300 ${
                    i < pin.length ? 'bg-accent scale-110' : 'bg-surface'
                  }`}
                />
              ))}
              <span className="sr-only">{pin.length} of {PIN_LENGTH} digits entered</span>
            </div>
            {error && <p className="text-danger text-sm mt-4 font-medium">{error}</p>}
            {loading && <p className="text-text-muted text-sm mt-4">Signing in...</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handlePinPress(num.toString())}
                className="bg-surface hover:bg-card-hover text-text text-2xl font-bold py-4 rounded-2xl transition-colors active:scale-95"
              >
                {num}
              </button>
            ))}
            <div />
            <button
              onClick={() => handlePinPress('0')}
              className="bg-surface hover:bg-card-hover text-text text-2xl font-bold py-4 rounded-2xl transition-colors active:scale-95"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              className="text-text-muted hover:text-text flex items-center justify-center"
            >
              <ArrowLeft size={24} />
            </button>
          </div>

          <p className="text-center text-text-muted text-xs mt-4">
            Forgot your passcode? Ask whoever set it up for help.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-bg via-surface to-bg overflow-y-auto">
      <div className="text-center w-full max-w-2xl py-4">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-text">Who's playing? 🎮</h1>
        <p className="text-text-muted text-sm mb-8">Pick your profile to continue</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 mb-8">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => setSelectedProfile(profile)}
              className={`bg-gradient-to-br ${profile.color} p-5 sm:p-6 rounded-3xl shadow-xl text-white flex flex-col items-center justify-center gap-4 hover:scale-105 transition-transform active:scale-95 min-h-[160px] sm:min-h-[180px]`}
            >
              <span className="text-6xl drop-shadow-md">{profile.avatar}</span>
              <span className="text-sm sm:text-base font-bold capitalize text-center leading-tight">{profile.name}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowSignup(true)}
          className="inline-flex items-center justify-center gap-2 bg-card hover:bg-card-hover text-text font-bold py-3 px-8 rounded-xl transition-colors border border-white/5"
        >
          <Plus size={18} /> New Player
        </button>
      </div>
    </div>
  );
}
