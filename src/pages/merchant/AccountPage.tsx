import { count, fmtDate, fmtTime } from '../../lib/format';
import * as A from '../../state/actions';
import { Aside, Empty, PageHead, Pill } from '../../components/ui';
import { useMerchant } from './useMerchant';

const LENDER = 'Kosh Capital';

export function AccountPage() {
  const { s, uid, u, profile } = useMerchant();
  const c = u.consent;
  const mine = s.ledger.filter((e) => e.userId === uid);
  const tone = (st: string) => (st === 'REFUSED' || st === 'FAILED' ? 'bad' : st === 'ALLOWED' ? 'ok' : 'neutral');

  return (
    <>
      <PageHead eyebrow="Step 5 · Account" title="Account and consent" lead="See what you have shared and take it back." />
      <div className="cols">
        <div className="flex flex-col gap-[18px]">
          {c ? (
            <div className="card">
              <div className="row between"><h2>Consent {c.id}</h2><Pill tone={c.status === 'ACTIVE' ? 'ok' : 'bad'}>{c.status === 'ACTIVE' ? 'Active' : 'Revoked'}</Pill></div>
              <dl className="kv">
                <dt>Shared with</dt><dd>{LENDER}</dd>
                <dt>Purpose</dt><dd>Credit assessment</dd>
                <dt>Granted</dt><dd>{fmtDate(c.grantedAt)}</dd>
                <dt>{c.status === 'ACTIVE' ? 'Expires' : 'Revoked'}</dt>
                <dd>{c.status === 'ACTIVE' ? fmtDate(c.expiresAt) : `${fmtTime(c.revokedAt!)} IST`}</dd>
              </dl>
              {c.status === 'ACTIVE' && !u.revokeConfirm && (
                <div><button className="btn btn-outline-bad" onClick={() => A.askRevoke(true)}>Revoke consent</button></div>
              )}
              {u.revokeConfirm && (
                <div className="confirm" role="alertdialog" aria-label="Confirm revocation">
                  <p><b>Revoke consent for {LENDER}?</b></p>
                  <ul>
                    <li>Any new data request from {LENDER} will be refused on the ledger.</li>
                    <li>Your {count(profile.txCount)} fetched transactions are deleted from FlowProof.</li>
                    <li>Existing agreements and AutoPay stay in place.</li>
                  </ul>
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    <button className="btn btn-danger" onClick={A.revokeConsent}>Yes, revoke and delete my data</button>
                    <button className="btn" onClick={() => A.askRevoke(false)}>Keep sharing</button>
                  </div>
                </div>
              )}
              {u.dataDeleted && (
                <p className="muted" style={{ margin: 0 }}><b style={{ color: 'var(--ink)' }}>Data deleted.</b> {count(profile.txCount)} transactions removed. The ledger keeps only hashes and events.</p>
              )}
            </div>
          ) : (
            <Empty title="No consent given">Nothing about you is shared.</Empty>
          )}

          <div className="card">
            <div className="row between"><h2>On the ledger about you</h2><button className="btn btn-ghost" onClick={() => A.goto('ledger')}>Full ledger →</button></div>
            {mine.length ? (
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Block</th><th>Event</th><th>Status</th><th>Time (IST)</th></tr></thead>
                  <tbody>
                    {mine.map((e) => (
                      <tr key={e.n}><td className="mono">#{e.n}</td><td className="mono">{e.fn}</td><td><Pill tone={tone(e.status)}>{e.status}</Pill></td><td className="num">{fmtTime(e.time)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="muted" style={{ margin: 0 }}>Nothing yet.</p>}
          </div>
        </div>
        <Aside title="Revocation is enforced" txCount={profile.txCount}>
          After RevokeConsent, the lender's next RequestData is refused and logged as REFUSED with a reason. No names, amounts or transactions are stored on the ledger.
        </Aside>
      </div>
    </>
  );
}
