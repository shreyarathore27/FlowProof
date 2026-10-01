import { useEffect, useState } from 'react';
import { Sidebar, TopBar } from './components/Chrome';
import * as A from './state/actions';
import { currentPage, setState, useApp } from './state/store';
import { AuthPage, type AuthSession } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { UserSharingPage } from './pages/UserSharingPage';
import type { MerchantPage } from './state/store';

export default function App() {
  const s = useApp();
  const [session, setSession] = useState<AuthSession | null>(() => {
    try { return JSON.parse(localStorage.getItem('finbridge_session_v1') ?? 'null') as AuthSession | null; }
    catch { return null; }
  });
  const [ready, setReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let active = true;
    A.boot().then(async () => {
      if (!active) return;
      if (session) {
        await A.login(session.demoProfile);
        setState((s) => ({ pages: { ...s.pages, merchant: 'dashboard' } }));
      }
      if (active) setReady(true);
    }).catch((error: unknown) => {
      if (!active) return;
      setAuthError(error instanceof Error ? error.message : 'Unable to connect to the demo services.');
      setReady(true);
    });
    return () => { active = false; };
  }, []);

  const authenticate = async (next: AuthSession) => {
    setAuthError('');
    try {
      await A.login(next.demoProfile);
      localStorage.setItem('finbridge_session_v1', JSON.stringify(next));
      setSession(next);
      setConnecting(false);
      setState((s) => ({ view: 'merchant', pages: { ...s.pages, merchant: 'dashboard' } }));
    } catch {
      setAuthError('Sign-in failed. Check your ID and password, then try again.');
    }
  };

  const signOut = () => {
    localStorage.removeItem('finbridge_session_v1');
    setSession(null);
    setConnecting(false);
    A.logout();
  };

  if (!ready) return <div className="auth-loading"><span className="brand">FinBridge</span></div>;
  if (!session) return <AuthPage onAuthenticated={authenticate} initialError={authError} />;
  if (connecting) return <AuthPage mode="connect" existingSession={session} onAuthenticated={authenticate} onBack={() => setConnecting(false)} />;

  return (
    <div>
      <TopBar />
      <div className="shell">
        <Sidebar onSignOut={signOut} accountName={session.fullName} />
        <main className="main">
          <div className="page" aria-live="polite">
            {currentPage(s) === 'dashboard'
              ? <DashboardPage session={session} onAddAccount={() => setConnecting(true)} onSignOut={signOut} />
              : <UserSharingPage route={currentPage(s) as MerchantPage} session={session} />}
          </div>
        </main>
      </div>
    </div>
  );
}
