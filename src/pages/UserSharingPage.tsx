import { useEffect, useMemo, useState } from 'react';
import type { AuthSession } from './AuthPage';
import type { LedgerEvent } from '../api/types';
import { PageHead, Pill } from '../components/ui';
import { PEOPLE } from '../mock/config';
import { inr } from '../lib/format';
import * as A from '../state/actions';
import type { MerchantPage } from '../state/store';

interface Organization {
  id: string;
  name: string;
  service: string;
  description: string;
  target: string;
  location: string;
  needs: string[];
  why: string;
}

interface ShareCredential {
  credentialId: string;
  consentId: string;
  userId: 'ravi' | 'meena';
  userRef: string;
  organizationId: string;
  organization: string;
  purpose: string;
  scope: string[];
  metrics: Record<string, number | string>;
  analysisPeriod: string;
  createdAt: string;
  expiresAt: string;
  credentialHash: string;
  status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REVOKED';
  verificationId?: string;
  verifiedAt?: string;
  events: LedgerEvent[];
  revealCount: number;
}

type NeedId = 'working-capital' | 'business-banking' | 'insurance' | 'savings' | 'emergency-fund' | 'education' | 'other';
type Stage = 'need' | 'organizations' | 'organization' | 'data' | 'review' | 'reauth';
type DataKey = 'monthlyInflow' | 'monthlyOutflow' | 'monthlySavings' | 'savingsRate' | 'cashFlowStability' | 'financialHealth';

const organizations: Organization[] = [
  { id: 'kosh-capital', name: 'Kosh Capital', service: 'Business financing', description: 'Working-capital support for payment-active small businesses.', target: 'Micro and small merchants', location: 'Available across India', needs: ['working-capital', 'business-banking', 'other'], why: 'Offers working-capital products relevant to your selected business need.' },
  { id: 'astra-savings', name: 'Astra Savings', service: 'Savings and emergency funds', description: 'Recurring savings plans and protected business reserves.', target: 'Individuals and small businesses', location: 'Available across India', needs: ['savings', 'emergency-fund', 'education', 'other'], why: 'Provides savings options that match your selected financial goal.' },
  { id: 'securecover', name: 'SecureCover', service: 'Business insurance', description: 'Simple protection options for shops, stock and self-employed workers.', target: 'Small businesses and merchants', location: 'Selected regions in India', needs: ['insurance', 'other'], why: 'Offers protection services relevant to the need you selected.' },
  { id: 'sampada-bank', name: 'Sampada Bank', service: 'Business banking', description: 'Business accounts and cash-management services for growing merchants.', target: 'Small businesses and sole proprietors', location: 'Available across India', needs: ['business-banking', 'working-capital', 'other'], why: 'Offers business banking services relevant to your selection.' },
];

const needs: { id: NeedId; label: string; detail: string; mark: string }[] = [
  { id: 'working-capital', label: 'Business Working Capital', detail: 'Stock, seasonal expenses and day-to-day cash flow', mark: 'WC' },
  { id: 'business-banking', label: 'Business Banking', detail: 'Accounts and tools for business finances', mark: 'BK' },
  { id: 'insurance', label: 'Insurance', detail: 'Protection for your business and its assets', mark: 'IN' },
  { id: 'savings', label: 'Savings', detail: 'Build a regular savings habit', mark: 'SV' },
  { id: 'emergency-fund', label: 'Emergency Fund', detail: 'Prepare a reserve for unexpected costs', mark: 'EF' },
  { id: 'education', label: 'Financial Education', detail: 'Learn about managing business finances', mark: 'ED' },
  { id: 'other', label: 'Other', detail: 'Explore other relevant services', mark: 'OT' },
];

const fieldDefinitions: { key: DataKey; label: string; description: string }[] = [
  { key: 'monthlyInflow', label: 'Average monthly inflow', description: 'Total money received in a typical month' },
  { key: 'monthlyOutflow', label: 'Average monthly outflow', description: 'Total money spent in a typical month' },
  { key: 'monthlySavings', label: 'Average monthly savings', description: 'Inflow remaining after expenses' },
  { key: 'savingsRate', label: 'Savings rate', description: 'Savings as a percentage of inflow' },
  { key: 'cashFlowStability', label: 'Cash flow stability', description: 'A summary of recent cash-flow consistency' },
  { key: 'financialHealth', label: 'Financial health profile', description: 'FinBridge profile, not a credit score' },
];

const API_BASE = import.meta.env.VITE_ASSISTANT_API_BASE ?? 'http://localhost:4000';
const DEMO_OTP = '135790';
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function readActiveId(userRef: string) {
  return localStorage.getItem(`finbridge_active_credential:${userRef}`);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'The request could not be completed.');
  return result;
}

export function UserSharingPage({ route, session }: { route: MerchantPage; session: AuthSession }) {
  const profile = PEOPLE[session.demoProfile];
  const finance = profile.finance;
  const userRef = session.finBridgeId ?? `FB-USER-${session.demoProfile === 'ravi' ? '8A72K91' : '4C19M26'}`;
  const [credentials, setCredentials] = useState<ShareCredential[]>([]);
  const [activeId, setActiveId] = useState<string | null>(() => readActiveId(userRef));
  const [stage, setStage] = useState<Stage>('need');
  const [selectedNeed, setSelectedNeed] = useState<NeedId | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [selectedData, setSelectedData] = useState<DataKey[]>(['monthlyInflow', 'monthlyOutflow', 'savingsRate']);
  const [consented, setConsented] = useState(false);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    request<{ credentials: Omit<ShareCredential, 'events' | 'revealCount'>[] }>(`/credentials?userRef=${encodeURIComponent(userRef)}`)
      .then(({ credentials: items }) => {
        if (active) {
          const loadedCredentials = items.map((item) => ({ ...item, events: [], revealCount: item.status === 'VERIFIED' ? 6 : 4 }));
          setCredentials(loadedCredentials);
          setActiveId((current) => current && loadedCredentials.some((item) => item.credentialId === current) ? current : loadedCredentials[0]?.credentialId ?? null);
        }
      })
      .catch(() => { if (active) setLoaded(true); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [userRef]);

  const activeCredential = credentials.find((item) => item.credentialId === activeId) ?? null;
  const selectedOrganization = organizations.find((item) => item.id === selectedOrganizationId) ?? null;
  const recommendedOrganizations = organizations.filter((organization) => selectedNeed && organization.needs.includes(selectedNeed));
  const allMetrics: Record<DataKey, number | string> = useMemo(() => {
    const health = Math.round(finance.health.metrics.reduce((sum, metric) => sum + metric.score, 0) / finance.health.metrics.length);
    return {
      monthlyInflow: finance.overview.income,
      monthlyOutflow: finance.overview.expenses,
      monthlySavings: finance.overview.savings,
      savingsRate: Math.round(finance.overview.savings / finance.overview.income * 1000) / 10,
      cashFlowStability: finance.health.metrics.find((metric) => metric.label === 'Cash flow')?.score && finance.health.metrics.find((metric) => metric.label === 'Cash flow')!.score >= 65 ? 'Stable' : 'Variable',
      financialHealth: `${health}/100 · ${health >= 75 ? 'Good' : 'Building'}`,
    };
  }, [finance]);
  const visibleFields = fieldDefinitions.filter((field) => selectedData.includes(field.key));
  const timeline = [
    { title: 'Financial credential created', actor: 'FinBridge', detail: 'Only the fields you selected were added to the credential.' },
    { title: 'Consent recorded', actor: 'Your authorization', detail: `Purpose: ${activeCredential?.purpose ?? 'selected service'}. Consent is separate from account registration.` },
    { title: 'Share request created', actor: activeCredential?.organization ?? 'Selected organization', detail: 'The organization can request verification for this credential.' },
    { title: 'DRUNIX event recorded', actor: 'DRUNIX trust layer', detail: 'Credential hash and scope recorded; metric values remain off-chain.' },
    { title: 'Organization verified credential', actor: activeCredential?.organization ?? 'Organization', detail: 'Integrity, organization, purpose and consent status checked.' },
    { title: 'Organization assessment started', actor: activeCredential?.organization ?? 'Organization', detail: 'The organization handles its own KYC, underwriting and final decision.' },
  ];

  function resetFlow() {
    setSelectedNeed(null);
    setSelectedOrganizationId(null);
    setSelectedData(['monthlyInflow', 'monthlyOutflow', 'savingsRate']);
    setConsented(false);
    setOtp('');
    setError('');
    setStage('need');
    A.goto('recommendations');
  }

  async function createCredential() {
    if (!selectedOrganization || !selectedNeed || !consented || otp !== DEMO_OTP) {
      setError(otp !== DEMO_OTP ? 'The demo verification code is not correct.' : 'Review the selected fields and give explicit consent before continuing.');
      return;
    }
    if (selectedData.length === 0) {
      setError('Choose at least one financial summary field to share.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const purpose = `${needs.find((item) => item.id === selectedNeed)?.label ?? 'Financial services'} assessment`;
      const result = await request<{ credential: Omit<ShareCredential, 'events' | 'revealCount'>; events: LedgerEvent[] }>('/credentials', {
        method: 'POST',
        body: JSON.stringify({
          userId: session.demoProfile,
          userRef,
          organizationId: selectedOrganization.id,
          purpose,
          analysisPeriod: 'Oct 2025 – Sep 2026',
          metrics: Object.fromEntries(selectedData.map((key) => [key, allMetrics[key]])),
          consent: true,
        }),
      });
      const created: ShareCredential = { ...result.credential, events: result.events, revealCount: 4 };
      setCredentials((current) => [created, ...current.filter((item) => item.credentialId !== created.credentialId)]);
      setActiveId(created.credentialId);
      localStorage.setItem(`finbridge_active_credential:${userRef}`, created.credentialId);
      setStage('need');
      A.goto('verification');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Credential creation failed. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCredential() {
    if (!activeCredential) return;
    setError('');
    setBusy(true);
    try {
      const result = await request<{ credential: Omit<ShareCredential, 'events' | 'revealCount'>; events: LedgerEvent[] }>(`/credentials/${encodeURIComponent(activeCredential.credentialId)}/verify`, {
        method: 'POST',
        body: JSON.stringify({ organizationId: activeCredential.organizationId }),
      });
      setCredentials((current) => current.map((item) => item.credentialId === result.credential.credentialId
        ? { ...result.credential, events: result.events, revealCount: 4 }
        : item));
      setBusy(false);
      for (let count = 5; count <= 6; count++) {
        await wait(850);
        setCredentials((current) => current.map((item) => item.credentialId === result.credential.credentialId ? { ...item, revealCount: count } : item));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Verification failed. Please retry.');
      setBusy(false);
    }
  }

  async function revokeConsent(credential: ShareCredential) {
    setError('');
    setBusy(true);
    try {
      const result = await request<{ credential: Omit<ShareCredential, 'events' | 'revealCount'> }>(`/credentials/${encodeURIComponent(credential.credentialId)}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ userRef }),
      });
      setCredentials((current) => current.map((item) => item.credentialId === credential.credentialId ? { ...result.credential, events: item.events, revealCount: item.revealCount } : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Consent could not be revoked.');
    } finally {
      setBusy(false);
    }
  }

  function toggleField(key: DataKey) {
    setSelectedData((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  if (route === 'history') {
    return <>
      <PageHead eyebrow="Your data · History" title="Sharing history" lead="See which organization received a credential, what you authorized and its current status." />
      {error && <p className="flow-error" role="alert">{error}</p>}
      {!credentials.length && loaded ? <div className="flow-empty"><b>No sharing activity yet</b><p>Choose a financial need and create your first selective-sharing credential.</p><button className="btn btn-primary" onClick={resetFlow}>Find financial services</button></div> : <div className="flow-history">{credentials.map((credential) => <button className="flow-history-item" key={credential.credentialId} onClick={() => { setActiveId(credential.credentialId); localStorage.setItem(`finbridge_active_credential:${userRef}`, credential.credentialId); A.goto('verification'); }}><span className="flow-history-mark">{credential.organization.slice(0, 1)}</span><span className="flow-history-main"><b>{credential.organization}</b><small>{credential.purpose} · {credential.scope.length} selected fields</small><small>{credential.credentialId} · {new Date(credential.createdAt).toLocaleDateString('en-IN')}</small></span><Pill tone={credential.status === 'VERIFIED' ? 'ok' : credential.status === 'REVOKED' ? 'bad' : 'warn'}>{credential.status.replace(/_/g, ' ')}</Pill><span className="flow-arrow">›</span></button>)}</div>}
    </>;
  }

  if (route === 'verification') {
    return <>
      <PageHead eyebrow="DRUNIX · Verification" title="Sharing and verification status" lead="Follow your credential from consent through organization verification. This view shows your journey only." />
      {!activeCredential ? <div className="flow-empty"><b>No credential to verify yet</b><p>Start by finding a relevant service and authorizing the exact information you want to share.</p><button className="btn btn-primary" onClick={resetFlow}>Find financial services</button></div> : <>
        <div className="credential-summary"><div><span className="eyebrow">FINANCIAL CREDENTIAL</span><strong>{activeCredential.credentialId}</strong><span>Sharing with {activeCredential.organization} · {activeCredential.purpose}</span></div><Pill tone={activeCredential.status === 'VERIFIED' ? 'ok' : activeCredential.status === 'REVOKED' ? 'bad' : 'warn'}>{activeCredential.status.replace(/_/g, ' ')}</Pill></div>
        <section className="flow-timeline"><div className="flow-timeline-head"><div><span className="eyebrow">USER VIEW · ORGANIZATION STEPS SHOWN HERE</span><h2>Credential journey</h2></div><span className="flow-count">{activeCredential.revealCount} / {timeline.length} complete</span></div>
          <ol>{timeline.map((item, index) => { const done = index < activeCredential.revealCount; const isNext = !done && index === activeCredential.revealCount; return <li key={item.title} className={`${done ? 'completed' : ''}${isNext ? ' current' : ''}`}><span className="flow-tick">{done ? '✓' : index + 1}</span><div className="flow-timeline-copy"><div className="flow-timeline-title"><b>{item.title}</b>{done && <Pill tone="ok">Complete</Pill>}</div><span>{item.actor}</span><p>{item.detail}</p>{index === 0 && <small>{activeCredential.createdAt ? new Date(activeCredential.createdAt).toLocaleString('en-IN') : ''}</small>}{index === 4 && activeCredential.verifiedAt && done && <small>{new Date(activeCredential.verifiedAt).toLocaleString('en-IN')} · {activeCredential.verificationId}</small>}</div></li>; })}</ol>
          {error && <p className="flow-error" role="alert">{error}</p>}
          {activeCredential.status === 'PENDING_VERIFICATION' && <div className="flow-review-action"><p>Organization-side credential verification is simulated for this demo. No organization dashboard is opened.</p><button className="btn btn-primary btn-lg" disabled={busy} onClick={verifyCredential}>{busy ? 'Verifying credential…' : 'Run organization verification'}</button></div>}
          {activeCredential.status === 'VERIFIED' && <div className="flow-assessment-note"><b>Credential verified · assessment started</b><span>The organization now performs its own KYC, underwriting and final decision. FinBridge does not approve or reject the request.</span></div>}
          {activeCredential.status === 'REVOKED' && <div className="flow-assessment-note revoked"><b>Consent revoked</b><span>The organization must not use this credential for new requests.</span></div>}
        </section>
        <section className="card flow-credential-card"><div className="row between"><h2>What this credential contains</h2><Pill tone="neutral">Values kept off-chain</Pill></div><dl className="kv"><dt>Credential</dt><dd>{activeCredential.credentialId}</dd><dt>FinBridge user</dt><dd>{activeCredential.userRef}</dd><dt>Organization</dt><dd>{activeCredential.organization}</dd><dt>Purpose</dt><dd>{activeCredential.purpose}</dd><dt>Data scope</dt><dd>{activeCredential.scope.map((key) => fieldDefinitions.find((field) => field.key === key)?.label ?? key).join(', ')}</dd><dt>Consent</dt><dd>{activeCredential.consentId}</dd><dt>Analysis period</dt><dd>{activeCredential.analysisPeriod}</dd><dt>DRUNIX hash</dt><dd className="mono">{activeCredential.credentialHash.slice(0, 18)}…</dd><dt>Raw transactions</dt><dd>Not included</dd><dt>Full account details</dt><dd>Not included</dd></dl>{activeCredential.status !== 'REVOKED' && <div><button className="btn btn-outline-bad" disabled={busy} onClick={() => revokeConsent(activeCredential)}>Revoke consent</button></div>}</section>
      </>}
    </>;
  }

  if (route === 'consents') {
    const activeCredentials = credentials.filter((credential) => credential.status !== 'REVOKED');
    return <>
      <PageHead eyebrow="Your data · Consent center" title="Consent center" lead="Review or revoke each financial-sharing authorization independently." />
      {error && <p className="flow-error" role="alert">{error}</p>}
      {!activeCredentials.length && loaded ? <div className="flow-empty"><b>No active sharing consent</b><p>Your account registration is separate from authorization to share financial information.</p><button className="btn btn-primary" onClick={resetFlow}>Find financial services</button></div> : <div className="flow-history">{activeCredentials.map((credential) => <article className="consent-record" key={credential.credentialId}><div className="row between"><div><span className="eyebrow">{credential.credentialId}</span><h2>{credential.organization}</h2></div><Pill tone={credential.status === 'VERIFIED' ? 'ok' : 'warn'}>{credential.status.replace(/_/g, ' ')}</Pill></div><p><b>Purpose:</b> {credential.purpose}</p><p><b>Data shared:</b> {credential.scope.map((key) => fieldDefinitions.find((field) => field.key === key)?.label ?? key).join(', ')}</p><p><b>Raw transactions:</b> Not included</p><div className="row" style={{ flexWrap: 'wrap' }}><button className="btn" onClick={() => { setActiveId(credential.credentialId); localStorage.setItem(`finbridge_active_credential:${userRef}`, credential.credentialId); A.goto('verification'); }}>View details</button><button className="btn btn-outline-bad" disabled={busy} onClick={() => revokeConsent(credential)}>Revoke consent</button></div></article>)}</div>}
    </>;
  }

  return <>
    <PageHead eyebrow="Recommendations · Financial services" title="Find financial services" lead="Choose a need to see organizations with relevant services. Recommendations are not approval or eligibility decisions." />
    <div className="flow-stepper" aria-label="Financial sharing steps"><span className={stage === 'need' ? 'active' : 'done'}>01 <b>Your need</b></span><i /><span className={['organizations', 'organization', 'data', 'review', 'reauth'].includes(stage) ? 'active' : ''}>02 <b>Organization</b></span><i /><span className={['data', 'review', 'reauth'].includes(stage) ? 'active' : ''}>03 <b>Data & consent</b></span><i /><span className={stage === 'reauth' ? 'active' : ''}>04 <b>Verify</b></span></div>
    {stage === 'need' && <section className="flow-stage"><div className="flow-stage-heading"><span className="eyebrow">STEP 1 · YOUR NEED</span><h2>What are you looking for?</h2><p>Select one service need to see relevant organizations.</p></div><div className="need-grid">{needs.map((need) => <button className={`need-card${selectedNeed === need.id ? ' selected' : ''}`} key={need.id} onClick={() => { setSelectedNeed(need.id); setSelectedOrganizationId(null); setError(''); }} aria-pressed={selectedNeed === need.id}><span className="need-mark">{need.mark}</span><span><b>{need.label}</b><small>{need.detail}</small></span><i>{selectedNeed === need.id ? '✓' : '›'}</i></button>)}</div><div className="flow-actions"><button className="btn btn-primary btn-lg" disabled={!selectedNeed} onClick={() => { setError(''); setStage('organizations'); }}>Continue to organizations</button></div></section>}
    {stage === 'organizations' && <section className="flow-stage"><div className="flow-stage-heading"><button className="flow-back" onClick={() => { setSelectedOrganizationId(null); setError(''); setStage('need'); }}>← Change need</button><span className="eyebrow">STEP 2 · RELEVANT ORGANIZATIONS</span><h2>Organizations for {needs.find((need) => need.id === selectedNeed)?.label}</h2><p>Each organization makes its own assessment and final decision.</p></div><div className="organization-grid">{recommendedOrganizations.map((organization) => <button className={`organization-card${selectedOrganizationId === organization.id ? ' selected' : ''}`} key={organization.id} onClick={() => setSelectedOrganizationId(organization.id)} aria-pressed={selectedOrganizationId === organization.id}><div className="row between"><span className="organization-mark">{organization.name.slice(0, 1)}</span>{selectedOrganizationId === organization.id && <Pill tone="ok">Selected</Pill>}</div><h3>{organization.name}</h3><b>{organization.service}</b><p>{organization.description}</p><small>{organization.target} · {organization.location}</small><span className="recommendation-note">{organization.why}</span><span className="organization-disclaimer">Final eligibility and approval are decided by the organization.</span></button>)}</div><div className="flow-actions"><button className="btn btn-primary btn-lg" disabled={!selectedOrganizationId || !recommendedOrganizations.some((organization) => organization.id === selectedOrganizationId)} onClick={() => setStage('organization')}>Continue</button></div></section>}
    {stage === 'organization' && selectedOrganization && <section className="flow-stage"><div className="flow-stage-heading"><button className="flow-back" onClick={() => setStage('organizations')}>← All organizations</button><span className="eyebrow">STEP 3 · ORGANIZATION</span><h2>{selectedOrganization.name}</h2><p>{selectedOrganization.description}</p></div><div className="organization-detail"><div><span className="eyebrow">SERVICE</span><b>{selectedOrganization.service}</b></div><div><span className="eyebrow">PURPOSE</span><b>{needs.find((need) => need.id === selectedNeed)?.label} assessment</b></div><div><span className="eyebrow">AVAILABILITY</span><b>{selectedOrganization.location}</b></div><p>This organization offers a service related to your selected need. Approval is not guaranteed; the organization is responsible for its KYC, underwriting and final decision.</p></div><div className="flow-actions"><button className="btn btn-primary btn-lg" onClick={() => { setError(''); setStage('data'); }}>Share financial profile</button></div></section>}
    {stage === 'data' && selectedOrganization && <section className="flow-stage"><div className="flow-stage-heading"><button className="flow-back" onClick={() => setStage('organization')}>← Organization details</button><span className="eyebrow">STEP 4 · SELECTIVE SHARING</span><h2>What would you like to share?</h2><p>Sharing with <b>{selectedOrganization.name}</b> · {needs.find((need) => need.id === selectedNeed)?.label} assessment</p></div><div className="share-data-grid"><div className="share-options"><span className="eyebrow">CHOOSE THE MINIMUM YOU NEED</span>{fieldDefinitions.map((field) => <label className="share-option" key={field.key}><input type="checkbox" checked={selectedData.includes(field.key)} onChange={() => toggleField(field.key)} /><span><b>{field.label}</b><small>{field.description}</small></span><strong>{formatMetric(field.key, allMetrics[field.key])}</strong></label>)}<label className="share-option unavailable"><input type="checkbox" disabled /><span><b>Complete raw transactions</b><small>Not available in the demo; no transaction connector is attached.</small></span><Pill>Unavailable</Pill></label><label className="share-option unavailable"><input type="checkbox" disabled /><span><b>Full account details</b><small>Never share account numbers or bank credentials through this demo.</small></span><Pill>Unavailable</Pill></label></div><aside className="share-preview"><span className="eyebrow">LIVE PREVIEW · SELECTED ONLY</span><h3>What {selectedOrganization.name} will receive</h3>{visibleFields.length ? <dl>{visibleFields.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{formatMetric(field.key, allMetrics[field.key])}</dd></div>)}</dl> : <p>Select at least one summary field to preview it.</p>}<div className="preview-period"><span>Analysis period</span><b>Oct 2025 – Sep 2026</b></div><p className="privacy-note"><b>Raw transactions will not be shared.</b> Only the fields you authorize are included in the credential.</p></aside></div><div className="flow-actions"><button className="btn btn-primary btn-lg" disabled={!selectedData.length} onClick={() => { setConsented(false); setStage('review'); }}>Review sharing consent</button></div></section>}
    {stage === 'review' && selectedOrganization && <section className="flow-stage"><div className="flow-stage-heading"><button className="flow-back" onClick={() => setStage('data')}>← Edit data selection</button><span className="eyebrow">STEP 5 · REVIEW & CONSENT</span><h2>Review your sharing consent</h2><p>Check the recipient, purpose and exact financial summary before authorizing.</p></div><div className="review-consent"><div className="review-consent-head"><span className="organization-mark">{selectedOrganization.name.slice(0, 1)}</span><div><span className="eyebrow">SHARING WITH</span><h3>{selectedOrganization.name}</h3></div></div><dl className="kv"><dt>Purpose</dt><dd>{needs.find((need) => need.id === selectedNeed)?.label} assessment</dd><dt>Data being shared</dt><dd>{visibleFields.map((field) => field.label).join(', ')}</dd><dt>Raw transactions</dt><dd>Not included</dd><dt>Full account details</dt><dd>Not included</dd><dt>Analysis period</dt><dd>Oct 2025 – Sep 2026</dd><dt>Consent expiry</dt><dd>30 days</dd></dl><div className="review-values">{visibleFields.map((field) => <div key={field.key}><span>{field.label}</span><b>{formatMetric(field.key, allMetrics[field.key])}</b></div>)}</div></div><label className="flow-explicit-consent"><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} /><span>I understand and authorize FinBridge to share <b>only these selected financial fields</b> with {selectedOrganization.name} for the stated purpose. This does not share raw transactions or bank credentials.</span></label><div className="flow-actions"><button className="btn" onClick={() => setStage('data')}>Back</button><button className="btn btn-primary btn-lg" disabled={!consented} onClick={() => { setError(''); setStage('reauth'); }}>Continue to verification</button></div></section>}
    {stage === 'reauth' && selectedOrganization && <section className="flow-stage"><div className="flow-stage-heading"><button className="flow-back" onClick={() => setStage('review')}>← Back to consent</button><span className="eyebrow">STEP 6 · RE-AUTHENTICATION</span><h2>Verify your identity</h2><p>Confirm it’s you before creating a financial credential for {selectedOrganization.name}.</p></div><div className="reauth-panel"><span className="reauth-lock">✓</span><b>OTP to your verified mobile ending {session.mobile.slice(-4)}</b><p>Demo OTP <strong>{DEMO_OTP}</strong> · no SMS is sent in this prototype.</p><label className="auth-field" htmlFor="share-otp">6-digit verification code<input id="share-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} placeholder="000000" /></label>{error && <p className="flow-error" role="alert">{error}</p>}<div className="flow-actions"><button className="btn" onClick={() => setStage('review')}>Back</button><button className="btn btn-primary btn-lg" disabled={busy || otp.length !== 6} onClick={createCredential}>{busy ? 'Creating credential…' : 'Verify & create credential'}</button></div></div></section>}
  </>;
}

function formatMetric(key: DataKey, value: number | string) {
  if (key === 'monthlyInflow' || key === 'monthlyOutflow' || key === 'monthlySavings') return inr(Number(value));
  if (key === 'savingsRate') return `${Number(value).toFixed(1)}%`;
  return String(value);
}
