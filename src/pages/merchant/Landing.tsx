import { count } from '../../lib/format';
import * as A from '../../state/actions';
import { useApp } from '../../state/store';
import { Pill } from '../../components/ui';

export function Landing() {
  const { profiles } = useApp();
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">For payment-active, credit-invisible merchants</span>
          <h1 style={{ marginTop: 10 }}>Your UPI sales are <em>already</em> a credit history.</h1>
          <p>Share your payment data with consent, see exactly why you qualify, and take it back whenever you want. Every decision is recorded on a shared ledger.</p>
        </div>
        <div className="personas">
          <span className="eyebrow">Demo sign-in · pick a merchant</span>
          {profiles.map((p) => (
            <button key={p.id} className="persona" onClick={() => A.login(p.id)}>
              <span className="avatar">{p.initials}</span>
              <span>
                <b>{p.name}</b>
                <span>{p.biz} · {p.kind.split(' · ')[1]}</span>
                <span className="num">{count(p.txCount)} UPI transactions in 6 months</span>
              </span>
              <Pill tone={p.tag.tone}>{p.tag.label}</Pill>
            </button>
          ))}
        </div>
      </section>
      <div className="grid3 how">
        <div className="card"><span className="n">1</span><h3>Consent</h3><p>You choose the lender, the purpose and the expiry. The consent is written to Drunix.</p></div>
        <div className="card"><span className="n">2</span><h3>Signals and matches</h3><p>Fixed rules turn six months of UPI activity into four signals and product matches, with reasons.</p></div>
        <div className="card"><span className="n">3</span><h3>Offer and control</h3><p>Accept an offer, repay by AutoPay, and revoke access. The ledger then refuses the lender.</p></div>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: '.88rem' }}>Both profiles use synthetic data from a seeded generator. No real accounts are touched.</p>
    </>
  );
}
