import type { ReactNode } from 'react';
import { count, inr, short } from '../../lib/format';
import * as A from '../../state/actions';
import { Empty, HashText, PageHead, Pill } from '../../components/ui';
import { PEOPLE } from '../../mock/config';
import { SignalCard } from '../../components/SignalCard';
import { useMerchant } from './useMerchant';

function money(n: number) { return inr(n); }

export function SignalsPage() {
  const { s, u, profile, uid } = useMerchant();
  const head = (action?: ReactNode) => (
    <PageHead eyebrow="Step 2 · Signals" title="Your signals" lead={u.summary ? `Computed by fixed rules from ${u.summary.windowDays} days of UPI activity.` : undefined} action={action} />
  );

  if (u.dataDeleted)
    return <>{head()}<Empty title="Your data was deleted">You revoked consent, so FlowProof removed your {count(profile.txCount)} transactions. The anchored hash stays on the ledger as proof of what was shared.</Empty></>;
  if (!u.summary)
    return <>{head()}<Empty title="No signals yet" action={<button className="btn btn-primary" onClick={() => A.goto('consent')}>Go to consent</button>}>Grant consent first. Signals are computed from your shared transactions.</Empty></>;

  const st = u.anchorStage, snap = u.snapshot;
  const platformDone = st === 'verifier' || st === 'done';
  const finance = PEOPLE[uid].finance;
  const maxBar = Math.max(...finance.trend.months.flatMap((m) => [m.income, m.expenses, m.savings]));
  const health = finance.health;
  const scoreCards = [
    { label: 'Monthly income', value: money(finance.overview.income), subtext: 'all inflows', tone: 'ok' },
    { label: 'Monthly expenses', value: money(finance.overview.expenses), subtext: 'core spend', tone: 'neutral' },
    { label: 'Savings', value: money(finance.overview.savings), subtext: 'this month', tone: 'ok' },
    { label: 'Cash flow', value: money(finance.overview.cashFlow), subtext: 'after expenses', tone: finance.overview.cashFlow > 0 ? 'ok' : 'warn' },
    { label: 'Account activity', value: `${finance.overview.accountActivity} tx`, subtext: 'last 30 days', tone: 'neutral' },
  ];

  return (
    <>
      {head(snap && <button className="btn btn-primary btn-lg" onClick={() => A.goto('options')}>See my options →</button>)}
      <div className="grid2">
        {u.summary.signals.map((sig) => <SignalCard key={sig.key} signal={sig} visuals={u.summary!.visuals} />)}
      </div>

      <section className="card finance-panel">
        <div className="row between">
          <div>
            <span className="eyebrow">Unified financial dashboard</span>
            <h2>{profile.biz} · cash overview</h2>
          </div>
          <Pill tone="ok">{finance.overview.cashFlow > 0 ? 'Positive cash flow' : 'Watch cash flow'}</Pill>
        </div>

        <div className="metrics-grid">
          {scoreCards.map((card) => (
            <div key={card.label} className="metric-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.subtext}</small>
            </div>
          ))}
        </div>

        <div className="analytics-grid">
          <div className="sub-card">
            <div className="section-label">Monthly & yearly analytics</div>
            <div className="bar-chart">
              {finance.trend.months.map((month) => (
                <div key={month.label} className="bar-cluster">
                  <div className="bar-stack" aria-label={`${month.label} monthly activity`}>
                    <span className="bar income" style={{ height: `${(month.income / maxBar) * 100}%` }} />
                    <span className="bar expense" style={{ height: `${(month.expenses / maxBar) * 100}%` }} />
                    <span className="bar savings" style={{ height: `${(month.savings / maxBar) * 100}%` }} />
                  </div>
                  <small>{month.label}</small>
                </div>
              ))}
            </div>
            <div className="year-summary">
              <div><span>Income</span><b>{money(finance.trend.yearly.income)}</b></div>
              <div><span>Expenses</span><b>{money(finance.trend.yearly.expenses)}</b></div>
              <div><span>Savings</span><b>{money(finance.trend.yearly.savings)}</b></div>
            </div>
          </div>

          <div className="sub-card">
            <div className="section-label">Spending mix</div>
            <div className="category-list">
              {finance.categories.map((cat) => (
                <div key={cat.label} className="category-row">
                  <div className="line-head">
                    <span>{cat.label}</span>
                    <b>{cat.value}%</b>
                  </div>
                  <div className="mini-track"><i style={{ width: `${cat.value}%` }} className={cat.tone === 'warn' ? 'warn' : cat.tone === 'ok' ? 'ok' : ''} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="analytics-grid">
          <div className="sub-card assistant-card">
            <div className="section-label">AI financial assistant</div>
            <div className="prompt-box">
              <span>Ask:</span>
              <strong>{finance.assistant.prompt}</strong>
            </div>
            <p>{finance.assistant.answer}</p>
          </div>

          <div className="sub-card">
            <div className="section-label">Personalized insights</div>
            <ul className="insight-list">
              {finance.insights.map((tip) => <li key={tip}>{tip}</li>)}
            </ul>
          </div>
        </div>

        <div className="analytics-grid">
          <div className="sub-card">
            <div className="section-label">Financial health profile</div>
            <p className="health-summary">{health.summary}</p>
            <div className="health-grid">
              {health.metrics.map((metric) => (
                <div key={metric.label} className="health-card">
                  <div className="row between">
                    <span>{metric.label}</span>
                    <Pill tone={metric.tone === 'warn' ? 'warn' : metric.tone === 'ok' ? 'ok' : 'neutral'}>{metric.score}/100</Pill>
                  </div>
                  <p>{metric.description}</p>
                </div>
              ))}
            </div>
            <small className="muted">{health.narrative}</small>
          </div>

          <div className="sub-card">
            <div className="section-label">Recommendation engine</div>
            <div className="recommendation-list">
              {finance.recommendations.map((item) => (
                <div key={item.title} className="recommendation-item">
                  <div className="row between">
                    <strong>{item.title}</strong>
                    <Pill tone="neutral">{item.category}</Pill>
                  </div>
                  <p>{item.reason}</p>
                  <small>{item.organization} · {item.fit}</small>
                  <div className="recommendation-note">{item.notApproval}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </section>

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
