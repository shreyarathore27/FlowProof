import { useEffect } from 'react';
import { inr, short } from '../../lib/format';
import * as A from '../../state/actions';
import { Empty, PageHead, Pill } from '../../components/ui';
import { useMerchant } from './useMerchant';

export function OfferPage() {
  const { s, u } = useMerchant();
  useEffect(() => { A.loadOffer(); }, [u.consent?.id]);

  const o = u.offer;
  if (!o) {
    const active = u.consent?.status === 'ACTIVE';
    return (
      <>
        <PageHead eyebrow="Step 4 · Offer" title="Offers" />
        <Empty title="No offer yet" action={active && <button className="btn btn-primary" onClick={() => A.setView('lender')}>Open Lender portal</button>}>
          {active ? 'Kosh Capital can request your data and send an offer. Switch to the Lender portal to act as the lender.' : 'Grant consent so a lender can review your profile.'}
        </Empty>
      </>
    );
  }

  const t = o.terms, a = u.agreement;
  const accepted = !!a, mandated = !!a?.mandate, repaid = (a?.repayments.length ?? 0) > 0;
  const last = a?.repayments[a.repayments.length - 1];
  return (
    <>
      <PageHead eyebrow="Step 4 · Offer" title={`Your offer from ${o.lenderName}`} lead="Review the terms, accept, and repay weekly by AutoPay." />
      <div className="cols">
        <div className="ticket">
          <div className="row between"><span className="eyebrow">{o.lenderName} · Working-capital line</span><Pill tone={accepted ? 'ok' : 'neutral'}>{accepted ? 'Accepted' : 'Open'}</Pill></div>
          <div className="amt num">{inr(t.principal)}</div>
          <div className="sub">Offer <span className="mono">{o.id}</span></div>
          <div className="perf" />
          <div className="terms num">
            <div>Weekly<b>{inr(t.weeklyInstalment)}</b></div>
            <div>Tenure<b>{t.weeks} weeks</b></div>
            <div>Rate<b>{t.aprPct}% p.a.</b></div>
          </div>
          <div className="foot">Total repayable {inr(t.weeklyInstalment * t.weeks)} · only the terms hash <span className="mono">{short(o.termsHash, 8)}</span> is public</div>
        </div>

        <div className="card">
          <h2>Next steps</h2>
          <div className="steps">
            <div className={`step ${accepted ? 'done' : 'now'}`}>
              <span className="d">{accepted ? '✓' : '1'}</span>
              <div>
                <b>Accept offer</b>
                <span>{accepted ? `Agreement ${a!.id}` : 'Records AcceptOffer on the ledger'}</span>
                {!accepted && <div className="act"><button className="btn btn-primary" onClick={A.acceptOffer}>Accept offer</button></div>}
              </div>
            </div>
            <div className={`step ${mandated ? 'done' : accepted ? 'now' : ''}`}>
              <span className="d">{mandated ? '✓' : '2'}</span>
              <div>
                <b>Set up AutoPay</b>
                <span>{mandated ? `${a!.mandate!.ref} · ${inr(a!.mandate!.amount)} weekly from ${a!.mandate!.upi}` : 'Mock UPI AutoPay mandate'}</span>
                {accepted && !mandated && <div className="act"><button className="btn btn-primary" onClick={A.setupMandate}>Set up AutoPay</button></div>}
              </div>
            </div>
            <div className={`step ${repaid ? (last!.status === 'SUCCESS' ? 'done' : 'fail') : mandated ? 'now' : ''}`}>
              <span className="d">{repaid ? (last!.status === 'SUCCESS' ? '✓' : '!') : '3'}</span>
              <div>
                <b>Weekly repayment</b>
                <span>
                  {repaid
                    ? a!.repayments.map((r) => <span key={r.cycle} style={{ display: 'block' }}>Cycle {r.cycle}: {r.status === 'SUCCESS' ? `${inr(r.amount)} debited` : r.reason}</span>)
                    : 'One debit cycle'}
                </span>
                {mandated && (
                  <div className="act">
                    <button className={`btn${repaid ? '' : ' btn-primary'}`} onClick={A.runRepayment}>Run {repaid ? 'next' : 'first'} repayment</button>
                    <label className="check" style={{ fontSize: '.9rem' }}>
                      <input type="checkbox" id="failToggle" checked={s.forceFail} onChange={(e) => A.setForceFail(e.target.checked)} />Force a failure
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
