import { useEffect, useRef, type ReactNode } from 'react';
import type { OrgId, Tone } from '../api/types';
import { count } from '../lib/format';

export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

const orgClass: Record<OrgId, string> = { PlatformOrg: 'p', VerifierOrg: 'v', LenderOrg: 'l' };
export function Org({ id }: { id: OrgId }) {
  return <span className={`org ${orgClass[id]}`}><i />{id}</span>;
}

export function PageHead({ eyebrow, title, lead, action }: { eyebrow: string; title: string; lead?: string; action?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {lead && <p>{lead}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function OnOffChain({ txCount }: { txCount: number }) {
  return (
    <div className="split">
      <div><b>Off-chain</b>{count(txCount)} transactions in MongoDB</div>
      <div><b>On Drunix</b>Hashes, consent, status, events</div>
    </div>
  );
}

export function Aside({ title, children, txCount }: { title: string; children: ReactNode; txCount: number }) {
  return (
    <div className="aside">
      <h3>{title}</h3>
      <p>{children}</p>
      <OnOffChain txCount={txCount} />
    </div>
  );
}

export function Stamp({ small }: { small?: boolean }) {
  return <span className={`stamp${small ? ' sm' : ''}`}>REFUSED</span>;
}

/** Hash that "settles" from random hex into its real value once, when animate is set. */
export function HashText({ value, animate }: { value: string; animate: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const hx = '0123456789abcdef';
    let f = 0, raf = 0;
    const total = 22;
    const tick = () => {
      f++;
      const done = Math.floor((value.length * f) / total);
      el.textContent = value.slice(0, done) + [...value.slice(done)].map(() => hx[(Math.random() * 16) | 0]).join('');
      if (f < total) raf = requestAnimationFrame(tick);
      else el.textContent = value;
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [value, animate]);
  return <div className="hash" ref={ref}>{value}</div>;
}

const paths: Record<string, ReactNode> = {
  signin: <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />,
  consent: <><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></>,
  signals: <path d="M4 19V11M10 19V5M16 19v-7M22 19H2" />,
  options: <><rect x="3" y="4" width="18" height="6" rx="2" /><rect x="3" y="14" width="18" height="6" rx="2" /></>,
  offer: <><path d="M3 8a2 2 0 002-2h14a2 2 0 002 2v2a2 2 0 000 4v2a2 2 0 00-2 2H5a2 2 0 00-2-2v-2a2 2 0 000-4z" /><path d="M10 9h4M10 15h4" /></>,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  desk: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 10v10" /></>,
  ledger: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><path d="M10 6.5h4a2 2 0 012 2V14" /></>,
  sun: (
    <>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  play: <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />,
  pause: <><rect x="6" y="4" width="4" height="16" fill="currentColor" rx="1" /><rect x="14" y="4" width="4" height="16" fill="currentColor" rx="1" /></>,
};
export function Icon({ name }: { name: keyof typeof paths | string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function Logo() {
  return (
    <span className="mark">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
        <path d="M3 16c3 0 3-8 6-8s3 8 6 8 3-5 4-5" />
        <circle cx="20.5" cy="11" r="1.6" fill="#fff" />
      </svg>
    </span>
  );
}
