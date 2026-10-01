import type { ReactNode } from 'react';
import { count, short } from '../../lib/format';
import * as A from '../../state/actions';
import { Empty, HashText, PageHead, Pill } from '../../components/ui';
import { SignalCard } from '../../components/SignalCard';
import { useMerchant } from './useMerchant';

export function SignalsPage() {
  const { s, u, profile } = useMerchant();
  const head = (action?: ReactNode) => (
    <PageHead eyebrow="Step 2 · Signals" title="Your signals" lead={u.summary ? `Computed by fixed rules from ${u.summary.windowDays} days of UPI activity.` : undefined} action={action} />
  );

  if (u.dataDeleted)
    return <>{head()}<Empty title="Your data was deleted">You revoked consent, so FlowProof removed your {count(profile.txCount)} transactions. The anchored hash stays on the ledger as proof of what was shared.</Empty></>;
  if (!u.summary)
    return <>{head()}<Empty title="No signals yet" action={<button className="btn btn-primary" onClick={() => A.goto('consent')}>Go to consent</button>}>Grant consent first. Signals are computed from your shared transactions.</Empty></>;

  const st = u.anchorStage, snap = u.snapshot;
  const platformDone = st === 'verifier' || st === 'done';

  return (
    <>
      {head(snap && <button className="btn btn-primary btn-lg" onClick={() => A.goto('options')}>See my options →</button>)}
      <div className="grid2">
        {u.summary.signals.map((sig) => <SignalCard key={sig.key} signal={sig} visuals={u.summary!.visuals} />)}
      </div>
      <section className="snap">
        <div>
          <div className="row"><span className="eyebrow">Snapshot</span>{snap ? <Pill tone="ok">Anchored on Drunix</Pill> : <Pill>Not anchored</Pill>}</div>
          {snap
            ? <HashText value={snap.hash} animate={s.scrambleHash === snap.hash} />
            : <div className="hash">The SHA-256 of these signals plus the rule-set version appears here once anchored.</div>}
          <div className="meta">
            <div><span>Rule-set version</span><b>{short(u.summary.ruleSetVersion, 10)}</b></div>
            {snap && <div><span>Snapshot ID</span><b>{snap.id}</b></div>}
          </div>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="cosign">
            <div><span className={`tick ${st === 'platform' ? 'spin' : platformDone ? 'ok' : ''}`}>{platformDone ? '✓' : ''}</span>PlatformOrg endorses</div>
            <div><span className={`tick ${st === 'verifier' ? 'spin' : st === 'done' ? 'ok' : ''}`}>{st === 'done' ? '✓' : ''}</span>
              {st === 'done' ? 'VerifierOrg co-signed · recomputed hash matches' : st === 'verifier' ? 'VerifierOrg recomputing hash…' : 'VerifierOrg co-signature'}</div>
          </div>
          {!snap && <button className="btn btn-primary btn-lg" onClick={A.anchorSnapshot} disabled={!!st}>{st ? 'Anchoring…' : 'Anchor snapshot on Drunix'}</button>}
        </div>
      </section>
    </>
  );
}
