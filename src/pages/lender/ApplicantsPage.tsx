import { api } from '../../api/client';
import type { Applicant, OrgId, Purpose, Tone } from '../../api/types';
import { fmtDate, inr, short, weeklyInstalment } from '../../lib/format';
import * as A from '../../state/actions';
import { useApp } from '../../state/store';
import { Org, PageHead, Pill, Stamp } from '../../components/ui';

function consentStatus(a: Applicant | undefined, clockDays: number): [string, Tone] {
  const c = a?.consent;
  if (!c) return ['No consent', 'neutral'];
  if (c.status === 'REVOKED') return ['Revoked', 'bad'];
  if (Date.now() + clockDays * 864e5 > new Date(c.expiresAt).getTime()) return ['Expired', 'warn'];
  return ['Consented', 'ok'];
}

export function ApplicantsPage() {
  const s = useApp();
  const { selected, caller, purpose, results, form } = s.lender;
  const app = s.applicants.find((a) => a.userId === selected);
  const c = app?.consent ?? null;
  const res = results[selected];
  const offer = s.users[selected].offer;
  const [statusLabel, statusTone] = consentStatus(app, s.clockDays);
  const canOffer = res?.status === 'ALLOWED' && c?.status === 'ACTIVE' && !offer;

  return (
    <>
      <PageHead eyebrow="Kosh Capital · LenderOrg" title="Applicants" lead="This portal reads only the ledger and the data reference it is given. It never touches the platform database." />
      <div className="cols" style={{ gridTemplateColumns: 'minmax(0,300px) minmax(0,1fr)' }}>
        <div className="card">
          <h2>Consented merchants</h2>
          <div className="inbox">
            {s.applicants.map((a) => {
              const [l, t] = consentStatus(a, s.clockDays);
              return (
                <button key={a.userId} onClick={() => A.pickApplicant(a.userId)} aria-pressed={selected === a.userId}>
                  <span className="avatar">{a.initials}</span>
                  <span><b>{a.biz}</b><small><Pill tone={t}>{l}</Pill>{a.snapshot && 'snapshot anchored'}</small></span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-[18px]">
          <div className="card">
            <div className="row between" style={{ flexWrap: 'wrap' }}><h2>{app?.biz}</h2><Pill tone={statusTone}>{statusLabel}</Pill></div>
            <dl className="kv">
              <dt>Consent</dt><dd className="mono">{c?.id ?? '—'}</dd>
              <dt>Scope</dt><dd>{c ? c.scope.join(', ') : '—'}</dd>
              <dt>Expires</dt><dd>{c ? fmtDate(c.expiresAt) : '—'}</dd>
              <dt>Snapshot hash</dt><dd className="mono">{app?.snapshot ? short(app.snapshot.hash, 18) : 'not anchored'}</dd>
              <dt>Co-signed by</dt><dd>{app?.snapshot ? <Org id="VerifierOrg" /> : '—'}</dd>
            </dl>
          </div>

          <div className="card">
            <h2>Request data</h2>
            <p className="hint">Calls RequestData on the chaincode.</p>
            <div className="req-grid">
              <label className="field" htmlFor="caller">Call as
                <select id="caller" value={caller} onChange={(e) => A.setCaller(e.target.value as OrgId)}>
                  <option value="LenderOrg">LenderOrg (granted)</option>
                  <option value="VerifierOrg">VerifierOrg (not granted)</option>
                </select>
              </label>
              <label className="field" htmlFor="purpose">Purpose
                <select id="purpose" value={purpose} onChange={(e) => A.setPurpose(e.target.value as Purpose)}>
                  <option value="credit-assessment">credit-assessment</option>
                  <option value="marketing">marketing (out of scope)</option>
                </select>
              </label>
              <button className="btn btn-primary btn-lg" onClick={A.requestData}>Request data</button>
            </div>

            {!res && <div className="result idle">No request yet. The chaincode checks consent status, expiry, scope and your org before anything is returned.</div>}
            {res?.status === 'ALLOWED' && (
              <div className={`result allowed${s.resultFresh ? ' fresh' : ''}`}>
                <span className="big">ALLOWED</span>
                <span className="why">Consent is active and in scope for {res.purpose}.</span>
                <span className="ref mono">{res.dataRef} · tx {res.txId}</span>
              </div>
            )}
            {res?.status === 'REFUSED' && (
              <div className={`result refused${s.resultFresh ? ' fresh' : ''}`}>
                <span className="big">REFUSED</span>
                <span className="why">{res.reason}</span>
                <span className="ref mono">logged on ledger · tx {res.txId}</span>
                <Stamp />
              </div>
            )}

            {api.demo && (
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button className="btn" onClick={A.toggleClock}>{s.clockDays ? 'Reset ledger clock' : 'Advance ledger clock +91 days'}</button>
                <span className="muted" style={{ fontSize: '.88rem' }}>Demo tool: test expired consent.</span>
              </div>
            )}
          </div>

          <div className="card">
            <h2>Post offer</h2>
            <p className="hint">
              {offer ? `Offer ${offer.id} already posted (${offer.status.toLowerCase()}).`
                : canOffer ? 'Terms go to the private collection. Only their hash is public.'
                : 'Available after an ALLOWED data request on an active consent.'}
            </p>
            <div className="offer-form">
              <label className="field" htmlFor="f-amount">Amount (₹)<input id="f-amount" type="number" min={5000} step={1000} value={form.amount} onChange={(e) => A.setOfferField('amount', Number(e.target.value))} /></label>
              <label className="field" htmlFor="f-apr">Rate (% p.a.)<input id="f-apr" type="number" min={0} step={0.5} value={form.apr} onChange={(e) => A.setOfferField('apr', Number(e.target.value))} /></label>
              <label className="field" htmlFor="f-weeks">Tenure (weeks)<input id="f-weeks" type="number" min={4} step={1} value={form.weeks} onChange={(e) => A.setOfferField('weeks', Number(e.target.value))} /></label>
            </div>
            <div className="calc"><span>Weekly instalment via AutoPay</span><b className="num">{inr(weeklyInstalment(form.amount, form.apr, form.weeks))}</b></div>
            <div><button className="btn btn-primary" onClick={A.postOffer} disabled={!canOffer}>Post offer to {app?.first}</button></div>
          </div>

          {s.agreements.length > 0 && (
            <div className="card">
              <h2>Agreements</h2>
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Merchant</th><th>Agreement</th><th>Status</th><th>Mandate</th><th>Last repayment</th></tr></thead>
                  <tbody>
                    {s.agreements.map((a) => {
                      const last = a.repayments[a.repayments.length - 1];
                      return (
                        <tr key={a.id}>
                          <td>{s.applicants.find((x) => x.userId === a.userId)?.biz}</td>
                          <td className="mono">{a.id}</td>
                          <td><Pill tone="ok">Active</Pill></td>
                          <td className="mono">{a.mandate?.ref ?? '—'}</td>
                          <td>{last ? <Pill tone={last.status === 'SUCCESS' ? 'ok' : 'bad'}>Cycle {last.cycle} {last.status}</Pill> : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
