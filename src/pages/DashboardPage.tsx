import { useState } from 'react';
import type { AuthSession } from './AuthPage';
import { Icon, PageHead, Pill } from '../components/ui';
import { FinancialAssistant } from '../components/FinancialAssistant';
import * as A from '../state/actions';
import { PEOPLE } from '../mock/config';
import { inr } from '../lib/format';

type Range = 'This Month' | 'Last 3 Months' | '6 Months' | 'This Year';

export function DashboardPage({
  session,
  onAddAccount,
  onSignOut,
}: {
  session: AuthSession;
  onAddAccount: () => void;
  onSignOut: () => void;
}) {
  const [range, setRange] = useState<Range>('This Month');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const profile = PEOPLE[session.demoProfile];
  const finance = profile.finance;
  const bankPreview = session.demoBankPreview ?? { institution: 'SBI', accountType: 'Savings', maskedNumber: 'XXXX XXXX 1234' };
  const firstName = session.fullName.trim().split(/\s+/)[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const rangeMonths = range === 'Last 3 Months' ? finance.trend.months.slice(-3) : finance.trend.months;
  const periodTotals = range === 'This Month'
    ? finance.overview
    : range === 'This Year'
      ? finance.trend.yearly
      : rangeMonths.reduce((totals, month) => ({
        income: totals.income + month.income,
        expenses: totals.expenses + month.expenses,
        savings: totals.savings + month.savings,
      }), { income: 0, expenses: 0, savings: 0 });
  const assistantContext = {
    business: profile.profile.biz,
    selectedPeriod: range,
    overview: {
      income: periodTotals.income,
      expenses: periodTotals.expenses,
      savings: periodTotals.savings,
      cashFlow: range === 'This Month' ? finance.overview.cashFlow : periodTotals.income - periodTotals.expenses,
      accountActivity: finance.overview.accountActivity,
    },
    months: rangeMonths,
    categories: finance.categories,
  };
  const healthScore = Math.round(finance.health.metrics.reduce((sum, metric) => sum + metric.score, 0) / finance.health.metrics.length);
  const savingsRate = periodTotals.income ? Math.round((periodTotals.savings / periodTotals.income) * 1000) / 10 : 0;
  const maxBar = Math.max(...finance.trend.months.flatMap((month) => [month.income, month.expenses]));
  const categoryStops = finance.categories.reduce<{ value: number; stops: string[] }>((state, category) => {
    const next = state.value + category.value;
    state.stops.push(`var(--${category.tone === 'warn' ? 'warn' : category.tone === 'ok' ? 'primary' : 'org-p'}) ${state.value}% ${next}%`);
    state.value = next;
    return state;
  }, { value: 0, stops: [] }).stops.join(', ');
  const currentMonth = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date());

  return (
    <>
      <PageHead
        eyebrow="FinBridge · Financial overview"
        title={`${greeting}, ${firstName}`}
        lead={`Here's your financial overview for ${currentMonth}. Demo figures use synthetic sample activity.`}
        action={<div className="row" style={{ flexWrap: 'wrap' }}><button className="btn" type="button" onClick={onAddAccount}>＋ Connect account</button><button className="btn" type="button" onClick={onSignOut}>Sign out</button></div>}
      />
      <div className="dashboard-toolbar"><span className="eyebrow">FINANCIAL PERIOD</span><div className="seg" role="group" aria-label="Date range">{(['This Month', 'Last 3 Months', '6 Months', 'This Year'] as Range[]).map((option) => <button key={option} type="button" aria-pressed={range === option} onClick={() => setRange(option)}>{option}</button>)}</div></div>
      <div className="metrics-grid dashboard-kpis">
        <div className="metric-card"><span>Total inflow</span><strong>{inr(periodTotals.income)}</strong><small>All incoming funds · demo</small></div>
        <div className="metric-card"><span>Total expenses</span><strong>{inr(periodTotals.expenses)}</strong><small>Recorded outflows · demo</small></div>
        <div className="metric-card"><span>Savings</span><strong>{inr(periodTotals.savings)}</strong><small>{savingsRate}% of inflow</small></div>
        <div className="metric-card"><span>Net cash flow</span><strong>{inr(range === 'This Month' ? finance.overview.cashFlow : periodTotals.income - periodTotals.expenses)}</strong><small>{periodTotals.income >= periodTotals.expenses ? 'Positive cash flow' : 'Negative cash flow'}</small></div>
        <button className="metric-card metric-action" type="button" onClick={onAddAccount}><span>Connected accounts</span><strong>{session.connectedAccounts.length}</strong><small>{session.connectedAccounts.length ? session.connectedAccounts.map((account) => account.institution).join(' · ') : 'Connect a demo account →'}</small></button>
        <button className="metric-card metric-action" type="button" onClick={() => A.goto('verification')}><span>Financial health</span><strong>{healthScore}/100</strong><small>FinBridge profile · not a credit score →</small></button>
      </div>
      <section className="dashboard-welcome">
        <div><span className="eyebrow">YOUR FINBRIDGE ID</span><h2>{session.email}</h2><p>One identity for the financial accounts you choose to connect.</p></div>
        <span className="dashboard-id">{session.finBridgeId ?? `FB-USER-${session.demoProfile === 'ravi' ? '8A72K91' : '4C19M26'}`}</span>
      </section>
      <section className="dashboard-finance">
        <div className="row between dashboard-section-title"><div><span className="eyebrow">UNIFIED FINANCIAL DASHBOARD</span><h2>{profile.profile.biz} · cash overview</h2></div><div className="row" style={{ flexWrap: 'wrap' }}><Pill tone={finance.overview.cashFlow > 0 ? 'ok' : 'warn'}>{finance.overview.cashFlow > 0 ? 'Positive cash flow' : 'Watch cash flow'}</Pill><Pill tone="neutral">{finance.overview.accountActivity} tx · last 30 days</Pill></div></div>
        <div className="analytics-grid">
          <div className="sub-card"><div className="section-label">Income vs expenses · last 6 months</div><div className="chart-legend"><span><i className="income-dot" />Income</span><span><i className="expense-dot" />Expenses</span></div><div className="bar-chart">
            {finance.trend.months.map((month) => <div key={month.label} className="bar-cluster"><div className="bar-stack" aria-label={`${month.label}: income ${inr(month.income)}, expenses ${inr(month.expenses)}`}><span className="bar income" style={{ height: `${(month.income / maxBar) * 100}%` }} /><span className="bar expense" style={{ height: `${(month.expenses / maxBar) * 100}%` }} /></div><small>{month.label}</small></div>)}
          </div><div className="section-label savings-heading">Savings trend</div><div className="savings-trend">{finance.trend.months.map((month) => <div className="savings-month" key={month.label}><span>{month.label}</span><b>{inr(month.savings)}</b><i style={{ height: `${Math.max(12, (month.savings / maxBar) * 100)}%` }} /></div>)}</div><div className="year-summary"><div><span>Income · year</span><b>{inr(finance.trend.yearly.income)}</b></div><div><span>Expenses · year</span><b>{inr(finance.trend.yearly.expenses)}</b></div><div><span>Savings · year</span><b>{inr(finance.trend.yearly.savings)}</b></div></div></div>
          <div className="sub-card"><div className="section-label">Where your money goes</div><div className="spending-layout"><div className="spending-donut" style={{ background: `conic-gradient(${categoryStops})` }} role="img" aria-label="Spending by category"><span>Spending<br />mix</span></div><div className="category-list">{finance.categories.map((category) => <div key={category.label} className="category-row"><div className="line-head"><span>{category.label}</span><b>{category.value}%</b></div><div className="mini-track"><i style={{ width: `${category.value}%` }} className={category.tone === 'warn' ? 'warn' : category.tone === 'ok' ? 'ok' : ''} /></div></div>)}</div></div></div>
        </div>
        <div className="dashboard-columns">
          <section className="dashboard-section"><div className="section-heading"><div><span className="eyebrow">CONNECTED ACCOUNTS</span><h2>Accounts you authorized</h2></div><button className="btn" type="button" onClick={onAddAccount}>＋ Add account</button></div>
            {session.connectedAccounts.length ? <div className="connected-account-list">{session.connectedAccounts.map((account) => <div className="connected-account" key={`${account.institution}-${account.accountType}`}><span className="connected-bank-mark">{account.institution.slice(0, 1)}</span><div><b>{account.institution}</b><span>{account.accountType} · {account.maskedNumber}</span></div><Pill tone="ok">Demo connected</Pill></div>)}</div> : <div className="connected-account-list"><div className="connected-account"><span className="connected-bank-mark">{bankPreview.institution.slice(0, 1)}</span><div><b>{bankPreview.institution}</b><span>{bankPreview.accountType} · {bankPreview.maskedNumber}</span></div><Pill tone="neutral">Sample only</Pill></div><div className="dashboard-empty"><div><b>Not connected</b><p>This random masked account is only a visual demo preview. Authorize separately to connect it.</p></div><button className="btn btn-primary" type="button" onClick={onAddAccount}>Connect demo account</button></div></div>}
            <p className="auth-note">Demo account details and financial activity are synthetic; no live bank is contacted.</p>
          </section>
          <aside className="dashboard-consent"><span className="eyebrow">YOUR DATA, YOUR DECISION</span><h2>Share only with separate consent</h2><p>Registration and account linking do not share transaction history. Review purpose, recipient and expiry before authorizing financial analysis.</p><div className="consent-status"><span className="status-dot" />Transaction data not shared</div><button className="btn btn-primary btn-lg" type="button" onClick={() => A.goto('recommendations')}>Find financial services</button></aside>
        </div>
        <section className="sub-card dashboard-insights"><div className="section-label">Personalized insights</div><ul className="insight-list">{finance.insights.map((insight) => <li key={insight}>{insight}</li>)}</ul></section>
        <div className="analytics-grid">
          <div className="sub-card"><div className="section-label">FinBridge financial health profile</div><p className="health-summary">{finance.health.summary}</p><div className="health-grid">{finance.health.metrics.map((metric) => <div className="health-card" key={metric.label}><div className="row between"><span>{metric.label}</span><Pill tone={metric.tone === 'warn' ? 'warn' : metric.tone === 'ok' ? 'ok' : 'neutral'}>{metric.score}/100</Pill></div><p>{metric.description}</p></div>)}</div><small className="muted">{finance.health.narrative} This is not an official credit score.</small></div>
          <div className="sub-card"><div className="section-label">Recommendation engine</div><div className="recommendation-list">{finance.recommendations.map((item) => <div className="recommendation-item" key={item.title}><div className="row between"><strong>{item.title}</strong><Pill tone="neutral">{item.category}</Pill></div><p>{item.reason}</p><small>{item.organization} · {item.fit}</small><div className="recommendation-note">{item.notApproval}</div></div>)}</div></div>
        </div>
        <p className="dashboard-sample-note"><b>Demo profile</b><span>Financial figures are synthetic examples from {profile.profile.name} · {profile.profile.biz}. Authorize financial-data access separately before using real account information.</span></p>
      </section>
      <div className="assistant-launcher">
        <button className="assistant-fab" type="button" title="Ask FinBridge" aria-label="Ask FinBridge" aria-expanded={assistantOpen} aria-controls="financial-assistant-dialog" onClick={() => setAssistantOpen((open) => !open)}><Icon name="chat" /></button>
        <div className={`assistant-overlay${assistantOpen ? ' open' : ''}`} aria-hidden={!assistantOpen} onClick={(event) => { if (event.target === event.currentTarget) setAssistantOpen(false); }}>
          <section className="assistant-dialog" id="financial-assistant-dialog" role="dialog" aria-modal="true" aria-labelledby="assistant-title">
            <button className="assistant-close" type="button" aria-label="Close FinBridge assistant" onClick={() => setAssistantOpen(false)}><Icon name="close" /></button>
            <FinancialAssistant context={assistantContext} />
          </section>
        </div>
      </div>
    </>
  );
}
