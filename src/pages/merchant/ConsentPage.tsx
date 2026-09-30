import { count, fmtDate, fmtTime } from '../../lib/format';
import * as A from '../../state/actions';
import { Aside, PageHead, Pill } from '../../components/ui';
import { useMerchant } from './useMerchant';

const LENDER = 'Kosh Capital';

export function ConsentPage() {
  const { u, profile } = useMerchant();
  const aside = (
    <Aside title="Consent is a ledger record" txCount={profile.txCount}>
      GrantConsent stores the consent ID, who it is granted to, the purpose and the expiry. The chaincode checks all four on every data request.
    </Aside>
  );

  if (u.consent?.status === 'ACTIVE') {
    const c = u.consent;
    return (
      <>
        <PageHead eyebrow="Step 1 · Consent" title="Consent granted" lead={`Your data is shared with ${LENDER} for credit assessment only.`} />
        <div className="cols">
          <div className="flex flex-col gap-[18px]">
            <div className="card">
              <div className="row between"><h2>Consent {c.id}</h2><Pill tone="ok">Active</Pill></div>
              <dl className="kv">
                <dt>Shared with</dt><dd>{LENDER} (LenderOrg)</dd>
                <dt>Purpose</dt><dd>Credit assessment</dd>
                <dt>Granted</dt><dd>{fmtTime(c.grantedAt)} IST</dd>
                <dt>Expires</dt><dd>{fmtDate(c.expiresAt)}</dd>
              </dl>
            </div>
            {u.fetching ? (
              <div className="card">
                <div className="row between"><b>Fetching transactions</b><span className="mono muted">SyntheticDataSource</span></div>
                <div className="bar"><i /></div>
                <p className="muted" style={{ margin: 0 }}>Reading {count(profile.txCount)} UPI credits and debits through the data-source adapter.</p>
              </div>
            ) : (
              <div className="card">
                <p style={{ margin: 0 }}><b>{count(u.summary?.transactionCount ?? profile.txCount)} transactions fetched.</b> They stay in FlowProof's database and never go on the ledger.</p>
                <div><button className="btn btn-primary btn-lg" onClick={() => A.goto('signals')}>See my signals →</button></div>
              </div>
            )}
          </div>
          {aside}
        </div>
      </>
    );
  }

  const revoked = u.consent?.status === 'REVOKED';
  return (
    <>
      <PageHead eyebrow="Step 1 · Consent" title="Share your payment history" lead="You decide who sees it, why, and for how long." />
      <div className="cols">
        <div className="card" style={{ gap: 22 }}>
          {revoked && (
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <Pill tone="bad">Revoked</Pill>
              <span className="muted">Your previous consent <span className="mono">{u.consent!.id}</span> was revoked. You can grant a new one.</span>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <span className="eyebrow">Data</span>
            <label className="check"><input type="checkbox" checked disabled readOnly id="c-credit" /><span><b>UPI money received</b><br /><span className="muted text-[.9rem]">Last 6 months · amounts and dates</span></span></label>
            <label className="check"><input type="checkbox" checked disabled readOnly id="c-debit" /><span><b>UPI money paid out</b><br /><span className="muted text-[.9rem]">Suppliers, rent, EMIs</span></span></label>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="eyebrow">Shared with</span>
            <div className="grid2" style={{ gap: 10 }}>
              <div className="me"><span className="avatar" style={{ background: 'var(--org-l)', color: '#fff' }}>KC</span><div><b>{LENDER}</b><span className="org l"><i />LenderOrg</span></div></div>
              <div className="me"><span className="avatar" style={{ background: 'var(--org-v)', color: '#fff' }}>VR</span><div><b>Independent verifier</b><span>Checks the hash only</span></div></div>
            </div>
          </div>
          <div className="grid2">
            <label className="field" htmlFor="purpose-m">Purpose<select id="purpose-m" disabled><option>Credit assessment</option></select></label>
            <label className="field" htmlFor="expiry">Expires after
              <select id="expiry" value={u.expiryDays} onChange={(e) => A.setExpiry(Number(e.target.value))}>
                {[30, 90, 180].map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
            </label>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 14 }}>
            <button className="btn btn-primary btn-lg" onClick={A.grantConsent}>Grant consent</button>
            <span className="muted text-[.9rem]">You can revoke this at any time from Account.</span>
          </div>
        </div>
        {aside}
      </div>
    </>
  );
}
