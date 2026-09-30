import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { fmtTime } from '../lib/format';
import * as A from '../state/actions';
import { SCRIPT, jump, playDemo, stopDemo } from '../state/demo';
import { currentPage, useApp, type LenderPage, type MerchantPage } from '../state/store';
import { Icon, Logo } from './ui';

function Clock({ offsetDays }: { offsetDays: number }) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setT(Date.now()), 1000); return () => clearInterval(id); }, []);
  return (
    <span className={`clock num${offsetDays ? ' warp' : ''}`}>
      Ledger clock <b>{fmtTime(new Date(t + offsetDays * 864e5))}</b>{offsetDays ? ' (+91d)' : ''}
    </span>
  );
}

export function TopBar() {
  const s = useApp();
  return (
    <header className="top">
      <div className="brand"><Logo /><span className="t">FlowProof</span></div>
      <div className="seg" role="group" aria-label="Portal">
        <button onClick={() => A.setView('merchant')} aria-pressed={s.view === 'merchant'}>Merchant</button>
        <button onClick={() => A.setView('lender')} aria-pressed={s.view === 'lender'}>Lender</button>
      </div>
      <span className="net"><i className="pulse" />Drunix · 3 orgs</span>
      <span className="chip" title="Set VITE_USE_MOCK=false to call the real services">API: {api.mode}</span>
      <span className="spacer" />
      <Clock offsetDays={s.clockDays} />
      <button className="btn btn-ghost" onClick={() => A.reset()}>Reset</button>
      <button className="btn btn-primary" onClick={() => playDemo()} disabled={s.playing}>▶ Play demo</button>
    </header>
  );
}

export function Sidebar() {
  const s = useApp();
  const page = currentPage(s);
  const refused = s.ledger.filter((e) => e.status === 'REFUSED').length;
  const profile = s.profiles.find((p) => p.id === s.merchant);

  const item = (k: MerchantPage | LenderPage, label: string, icon: string = k) => (
    <button key={k} onClick={() => A.goto(k)} aria-current={page === k ? 'page' : undefined}>
      <Icon name={icon} />{label}
      {k === 'ledger' && <span className={`count${refused ? ' bad' : ''}`}>{s.ledger.length}</span>}
    </button>
  );

  let nav;
  if (s.view === 'lender') nav = [item('desk', 'Applicants'), item('ledger', 'Ledger')];
  else if (s.merchant) nav = [item('consent', 'Consent'), item('signals', 'Signals'), item('options', 'Options'), item('offer', 'Offer'), item('account', 'Account'), item('ledger', 'Ledger')];
  else nav = [item('consent', 'Sign in', 'signin'), item('ledger', 'Ledger')];

  let nowSet = false;
  const doneCount = SCRIPT.filter((m) => m.done(s)).length;

  return (
    <aside className="side" aria-label="Navigation">
      {s.view === 'merchant' && profile && (
        <div className="me">
          <span className="avatar">{profile.initials}</span>
          <div><b>{profile.biz}</b><span>{profile.kind}</span></div>
          <button onClick={A.logout}>Switch</button>
        </div>
      )}
      {s.view === 'lender' && (
        <div className="me">
          <span className="avatar" style={{ background: 'var(--org-l)', color: '#fff' }}>KC</span>
          <div><b>Kosh Capital</b><span>LenderOrg identity</span></div>
        </div>
      )}
      <nav className="nav">
        <span className="eyebrow">{s.view === 'merchant' ? 'Merchant portal' : 'Lender portal'}</span>
        {nav}
      </nav>
      <div className="progress">
        <div className="ph"><span className="eyebrow" style={{ padding: 0 }}>Demo script</span><b className="num">{doneCount}/{SCRIPT.length}</b></div>
        <ol>
          {SCRIPT.map((m, i) => {
            const d = m.done(s);
            let cls = d ? 'done' : '';
            if (d && m.refused) cls += ' refused';
            if (!d && !nowSet) { cls = 'now'; nowSet = true; }
            return (
              <li key={m.k} className={cls}>
                <button onClick={() => jump(m.k)}><span className="d">{d ? (m.refused ? '✕' : '✓') : i + 1}</span>{m.lbl}</button>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}

export function Narrator() {
  const { narr } = useApp();
  if (!narr) return null;
  return (
    <div className="narr" role="status">
      <div className="t"><small>{narr.done ? 'Done' : `Step ${narr.i + 1} of ${narr.n}`}</small>{narr.text}</div>
      <div className="prog">{[...Array(narr.n)].map((_, i) => <i key={i} className={i <= narr.i ? 'on' : ''} />)}</div>
      <button data-always onClick={stopDemo}>{narr.done ? 'Close' : 'Stop'}</button>
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
