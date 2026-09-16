import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Home } from '@/screens/home';
import { Landing } from '@/screens/landing';
import { Auth } from '@/screens/auth';
import { useAuth } from '@/contexts/AuthContext';
import { NavBar } from '@/components/NavBar';

// Lazy-loaded route screens
const GameHub = lazy(() => import('@/screens/game-hub').then(m => ({ default: m.GameHub })));
const PlayGame = lazy(() => import('@/screens/play').then(m => ({ default: m.PlayGame })));
const Feed = lazy(() => import('@/screens/feed').then(m => ({ default: m.Feed })));
const Profile = lazy(() => import('@/screens/profile').then(m => ({ default: m.Profile })));
const Leaderboard = lazy(() => import('@/screens/leaderboard').then(m => ({ default: m.Leaderboard })));
const InvitePage = lazy(() => import('@/screens/invite').then(m => ({ default: m.InvitePage })));
const Admin = lazy(() => import('@/screens/admin').then(m => ({ default: m.Admin })));
const AdminReports = lazy(() => import('@/screens/admin-reports').then(m => ({ default: m.AdminReports })));
const WhyPlay = lazy(() => import('@/screens/why-play').then(m => ({ default: m.WhyPlay })));

function ScreenFallback() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-2xl animate-pulse">🎮</div>
    </div>
  );
}

// Persistent strip showing which account is active on every screen.
// Shared computers (e.g. kids forgetting to log out) need this to be
// unavoidable — placing it at the top of the viewport above all screens.
function ActiveAccountBar() {
  const { player, logout } = useAuth();
  const navigate = useNavigate();
  if (!player) return null;
  const handleSwitch = () => { logout(); navigate('/auth'); };
  return (
    <div className="nq-account-bar flex-shrink-0 bg-accent/12 border-b border-accent/20 px-3 py-1.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="nq-account-avatar text-lg leading-none flex-shrink-0" aria-hidden>{player.avatar || '🍜'}</span>
        <span className="nq-account-label text-[10px] uppercase tracking-wide text-text-muted font-semibold flex-shrink-0">Playing as</span>
        <span className="text-xs font-bold text-text truncate">{player.name}</span>
      </div>
      <button
        onClick={handleSwitch}
        aria-label="Sign out and switch player"
        className="nq-account-switch flex items-center gap-1 text-[11px] font-semibold text-primary hover:bg-primary/15 active:scale-95 px-2 py-1 rounded-lg transition-all flex-shrink-0"
        title="Sign out and switch player"
      >
        <LogOut size={12} />
        <span className="nq-account-switch-label">Switch</span>
      </button>
    </div>
  );
}

function AppLayout() {
  return (
    <div className="h-full flex flex-col">
      <ActiveAccountBar />
      <main className="flex-1 overflow-hidden">
        <Suspense fallback={<ScreenFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <NavBar />
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { player } = useAuth();
  if (!player) return <Landing />;
  return <>{children}</>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/welcome" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/why-play" element={
          <Suspense fallback={<ScreenFallback />}>
            <WhyPlay />
          </Suspense>
        } />
        <Route path="/admin" element={
          <Suspense fallback={<ScreenFallback />}>
            <Admin />
          </Suspense>
        } />

        {/* QA playground: play any game without an account. Deliberate —
            scores can't save without a session, so nothing is writable;
            used by E2E smoke tests and manual QA of game builds. */}
        <Route path="/qa/play/:gameId" element={
          <Suspense fallback={<ScreenFallback />}>
            <PlayGame />
          </Suspense>
        } />

        {/* Invite links (public — redirects to auth if needed) */}
        <Route path="/invite/:gameSlug/:code" element={
          <Suspense fallback={<ScreenFallback />}>
            <InvitePage />
          </Suspense>
        } />

        {/* App routes with navbar */}
        <Route element={<AuthGate><AppLayout /></AuthGate>}>
          <Route index element={<Home />} />
          <Route path="games" element={<GameHub />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="chat" element={<Feed />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* Full-screen game (no navbar) */}
        <Route path="play/:gameId" element={
          <AuthGate>
            <Suspense fallback={<ScreenFallback />}>
              <PlayGame />
            </Suspense>
          </AuthGate>
        } />

        {/* Admin pages */}
        <Route path="admin/reports" element={
          <AuthGate>
            <Suspense fallback={<ScreenFallback />}>
              <AdminReports />
            </Suspense>
          </AuthGate>
        } />

        {/* Fallback */}
        <Route path="*" element={<AuthGate><Home /></AuthGate>} />
      </Routes>
    </BrowserRouter>
  );
}
