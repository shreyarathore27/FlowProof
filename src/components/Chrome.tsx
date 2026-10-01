import { api } from '../api/client';
import * as A from '../state/actions';
import { stopDemo } from '../state/demo';
import { currentPage, setDemoSpeed, togglePauseDemo, toggleTheme, useApp, type MerchantPage } from '../state/store';
import { Icon, Logo } from './ui';

export function TopBar() {
  const s = useApp();
  return (
    <header className="top">
      <div className="brand"><Logo /><span className="t">FinBridge</span></div>
      <span className="net"><i className="pulse" />Drunix · 3 orgs</span>
      <span className="chip" title="Set VITE_USE_MOCK=false to call the real services">API: {api.mode}</span>
      <span className="spacer" />
      <button
        data-always
        className="theme-toggle"
        onClick={toggleTheme}
        title={`Switch to ${s.theme === 'dark' ? 'light' : 'dark'} mode`}
        aria-label="Toggle light or dark theme"
      >
        <Icon name={s.theme === 'dark' ? 'sun' : 'moon'} />
        <span className="theme-toggle-label">{s.theme === 'dark' ? 'Light' : 'Dark'}</span>
      </button>
    </header>
  );
}

export function Sidebar({ onSignOut, accountName }: { onSignOut: () => void; accountName: string }) {
  const s = useApp();
  const page = currentPage(s);
  const refused = s.ledger.filter((e) => e.status === 'REFUSED').length;
  const profile = s.profiles.find((p) => p.id === s.merchant);

  const item = (k: MerchantPage, label: string, icon: string = k) => (
    <button key={k} onClick={() => A.goto(k)} aria-current={page === k ? 'page' : undefined}>
      <Icon name={icon} />{label}
      {k === 'ledger' && <span className={`count${refused ? ' bad' : ''}`}>{s.ledger.length}</span>}
    </button>
  );

  const nav = [
    item('dashboard', 'Overview', 'desk'),
    item('recommendations', 'Find services', 'options'),
    item('history', 'Sharing history', 'account'),
    item('verification', 'DRUNIX verification', 'ledger'),
    item('consents', 'Consent center', 'consent'),
  ];

  return (
    <aside className="side" aria-label="Navigation">
      {profile && (
        <div className="me">
          <span className="avatar">{profile.initials}</span>
          <div><b>{accountName}</b><span>{profile.biz} · demo data</span></div>
          <button onClick={onSignOut}>Sign out</button>
        </div>
      )}
      <nav className="nav">
        <span className="eyebrow">Your FinBridge</span>
        {nav}
      </nav>
    </aside>
  );
}

export function Narrator() {
  const { narr, playing, demoPaused, demoSpeed } = useApp();
  if (!narr) return null;
  return (
    <div className="narr" role="status">
      <div className="t">
        <small>{narr.done ? 'Demo complete' : `Step ${narr.i + 1} of ${narr.n} · Paced Demo`}</small>
        {narr.text}
      </div>
      <div className="prog" title={`Step ${narr.i + 1} of ${narr.n}`}>
        {[...Array(narr.n)].map((_, i) => <i key={i} className={i <= narr.i ? 'on' : ''} />)}
      </div>

      {!narr.done && playing && (
        <div className="narr-ctrls">
          <button
            data-always
            className={`narr-btn${demoPaused ? ' paused' : ''}`}
            onClick={togglePauseDemo}
            title={demoPaused ? 'Resume demo playback' : 'Pause demo step to explain or inspect'}
          >
            <Icon name={demoPaused ? 'play' : 'pause'} />
            <span>{demoPaused ? 'Resume' : 'Pause'}</span>
          </button>

          <div className="speed-pills" role="group" aria-label="Demo Speed">
            <button
              data-always
              className={`narr-speed-btn${demoSpeed === 0.75 ? ' active' : ''}`}
              onClick={() => setDemoSpeed(0.75)}
              title="Relaxed / Presentation pace (slower)"
            >
              0.75x
            </button>
            <button
              data-always
              className={`narr-speed-btn${demoSpeed === 1 ? ' active' : ''}`}
              onClick={() => setDemoSpeed(1)}
              title="Comfortable pace (recommended)"
            >
              1x
            </button>
            <button
              data-always
              className={`narr-speed-btn${demoSpeed === 1.5 ? ' active' : ''}`}
              onClick={() => setDemoSpeed(1.5)}
              title="Brisk pace"
            >
              1.5x
            </button>
          </div>
        </div>
      )}

      <button data-always className="narr-close-btn" onClick={stopDemo}>
        {narr.done ? 'Close' : 'Stop'}
      </button>
    </div>
  );
}

export function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map(({ id, ev }) => (
        <button key={id} className={`toast${ev.status === 'REFUSED' || ev.status === 'FAILED' ? ' bad' : ''}`} onClick={() => A.goto('ledger')}>
          <span className="n">#{ev.n}</span>
          <span><b>{ev.fn}{ev.status !== 'VALID' ? ` · ${ev.status}` : ''}</b><span>{ev.orgs.join(' + ')} · added to ledger</span></span>
        </button>
      ))}
    </div>
  );
}

export function ErrorBar() {
  const { error } = useApp();
  if (!error) return null;
  return (
    <div className="narr" role="alert" style={{ background: 'var(--bad)' }}>
      <div className="t"><small style={{ color: '#fff' }}>Request failed</small>{error}</div>
      <button data-always onClick={A.dismissError}>Dismiss</button>
    </div>
  );
}
