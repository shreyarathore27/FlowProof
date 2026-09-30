/**
 * In-browser stand-in for the platform service, lender service, verifier, mock AutoPay and
 * the Drunix chaincode. It follows the same rules the real modules must enforce, so the UI
 * can be built and demoed before the backend is ready. Not for production use.
 */
import type { ApiClient } from '../api/client';
import type {
  Agreement, Applicant, Consent, DataRequestInput, DataRequestResult, FetchSummary, Gap, LedgerEvent,
  LedgerStatus, Mandate, MatchesResponse, MatchResult, Offer, OfferTerms, OrgId, Repayment, SignalResult,
  SignalVisuals, Snapshot, Tone, UserId,
} from '../api/types';
import { canon, sha256 } from '../lib/hash';
import { fmtDate, fmtTime } from '../lib/format';
import { LENDER_NAME, PEOPLE, RULES, SIGNAL_CFG, type Criterion, type RawSignals } from './config';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hex = (n: number) => Math.random().toString(16).slice(2, 2 + n).toUpperCase().padEnd(n, '0');

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fmtUnit = (v: number, u: Criterion['unit']) => (u === 'pct' ? `${Math.round(v * 100)}%` : u === 'days' ? `${v} days` : String(v));

function computeSignals(s: RawSignals): SignalResult[] {
  const c = SIGNAL_CFG;
  const reg: [string, Tone] = s.regularity >= c.regularity.strong ? ['Very regular', 'ok'] : s.regularity >= c.regularity.ok ? ['Regular', 'ok'] : ['Irregular', 'warn'];
  const tr: [string, Tone] = s.trendPct >= c.trend.growing ? ['Growing', 'ok'] : s.trendPct <= c.trend.shrinking ? ['Shrinking', 'bad'] : ['Steady', 'neutral'];
  const rp: [string, Tone] = s.repaymentTotal === 0 ? ['No history', 'neutral'] : s.onTimeRepayments === s.repaymentTotal ? ['On time', 'ok'] : ['Some late', 'warn'];
  const bf: [string, Tone] = s.bufferDays >= c.buffer.healthy ? ['Healthy', 'ok'] : s.bufferDays >= c.buffer.ok ? ['Adequate', 'neutral'] : ['Thin', 'warn'];
  const abs = Math.abs(s.trendPct);
  return [
    { key: 'incomeRegularity', name: 'Income regularity', value: s.regularity, display: String(Math.round(s.regularity * 100)), unitLabel: '% of days', label: reg[0], tone: reg[1],
      reason: `Money came in on ${s.activeDays} of the last ${s.windowDays} days.` },
    { key: 'activityTrend', name: 'Activity trend', value: s.trendPct, display: `${s.trendPct > 0 ? '+' : '−'}${abs}`, unitLabel: '% vs previous 8 weeks', label: tr[0], tone: tr[1],
      reason: `Sales in the last 8 weeks were ${abs}% ${s.trendPct > 0 ? 'higher' : 'lower'} than in the 8 weeks before.` },
    { key: 'repaymentBehaviour', name: 'Repayment behaviour', value: s.onTimeRepayments, display: s.repaymentTotal ? `${s.onTimeRepayments}/${s.repaymentTotal}` : '0', unitLabel: s.repaymentTotal ? 'EMIs on time' : 'repayments found', label: rp[0], tone: rp[1],
      reason: s.repaymentTotal ? `${s.onTimeRepayments} of ${s.repaymentTotal} monthly EMIs were paid on or before the due date.` : 'No loan or EMI repayments appear in the shared data.' },
    { key: 'savingsBuffer', name: 'Savings buffer', value: s.bufferDays, display: String(s.bufferDays), unitLabel: 'days of spending', label: bf[0], tone: bf[1],
      reason: `Your usual balance would cover about ${s.bufferDays} days of normal spending.` },
  ];
}

function visuals(userId: UserId): SignalVisuals {
  const p = PEOPLE[userId], s = p.signals;
  const r = rng(p.seed), weekly: number[] = [];
  for (let i = 0; i < 26; i++) {
    if (userId === 'ravi') { let v = 36 + i * 0.36 + (r() - 0.5) * 4; if (i === 21) v += 15; if (i === 22) v += 5; weekly.push(v); }
    else weekly.push(Math.max(0.6, 2 + r() * 6 + (i % 5 === 0 ? -1.5 : 0)));
  }
  const r2 = rng(p.seed + 3), idx = [...Array(s.windowDays).keys()];
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r2() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const off = new Set(idx.slice(0, s.windowDays - s.activeDays));
  return {
    activeCalendar: [...Array(s.windowDays).keys()].map((i) => !off.has(i)),
    weeklySales: weekly,
    festivalWeek: userId === 'ravi' ? 21 : undefined,
    emiMonths: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'].slice(0, s.onTimeRepayments),
    bufferDays: s.bufferDays,
    bufferThreshold: 10,
  };
}

function evaluate(s: RawSignals): MatchResult[] {
  return RULES.products.map((p) => {
    const reasons: string[] = [], gaps: Gap[] = [];
    for (const c of p.criteria) {
      const cur = s[c.signal];
      if (cur >= c.min) reasons.push(`${c.label}: ${fmtUnit(cur, c.unit)} (needs ${fmtUnit(c.min, c.unit)})`);
      else gaps.push({ criterion: c.label, current: fmtUnit(cur, c.unit), needed: fmtUnit(c.min, c.unit), howToFix: c.fix });
    }
    return { productId: p.id, name: p.name, blurb: p.blurb, matched: gaps.length === 0, reasons, gaps };
  });
}

export class MockClient implements ApiClient {
  readonly mode = 'mock' as const;
  private clockDays = 0;
  private ruleSetVersion = '';
  private ledger: LedgerEvent[] = [];
  private consents = new Map<string, Consent>();
  private fetched = new Set<string>(); // consentIds with transactions held off-chain
  private snapshots = new Map<string, Snapshot>();
  private offers = new Map<string, Offer>();
  private agreements = new Map<string, Agreement>();
  private ready: Promise<void>;

  demo = {
    reset: async () => { await this.init(); },
    setClockOffsetDays: (d: number) => { this.clockDays = d; },
  };

  constructor() { this.ready = this.init(); }

  private async init() {
    this.clockDays = 0;
    this.ledger = []; this.consents.clear(); this.fetched.clear(); this.snapshots.clear(); this.offers.clear(); this.agreements.clear();
    this.ruleSetVersion = await sha256(canon({ SIGNAL_CFG, RULES }));
    const t = new Date(Date.now() - 2 * 3600e3).toISOString();
    const g = { n: 0, fn: 'ChannelConfig', status: 'VALID' as LedgerStatus, orgs: ['PlatformOrg', 'VerifierOrg', 'LenderOrg'] as OrgId[], time: t,
      fields: { channel: 'flowproof-channel', chaincode: 'flowproof v0.3 (Go)', endorsement: 'AnchorSnapshot: Platform AND Verifier' }, prev: '0'.repeat(64) };
    const hash = await sha256(canon(g));
    this.ledger.push({ ...g, hash, txId: hash.slice(0, 10) });
  }

  private now() { return new Date(Date.now() + this.clockDays * 864e5); }

  private async tx(fn: string, orgs: OrgId[], fields: Record<string, string>, status: LedgerStatus = 'VALID', reason?: string, userId?: UserId) {
    const prev = this.ledger[this.ledger.length - 1];
    const time = this.now().toISOString();
    const hash = await sha256(canon({ fn, status, orgs, fields, reason: reason ?? null, prev: prev.hash, time }));
    const ev: LedgerEvent = { n: prev.n + 1, fn, status, orgs, time, fields, reason, userId, prev: prev.hash, hash, txId: hash.slice(0, 10) };
    this.ledger.push(ev);
    return ev;
  }

  private consentOrThrow(id: string) {
    const c = this.consents.get(id);
    if (!c) throw new Error(`Consent ${id} not found`);
    return c;
  }
  private latestConsent(userId: UserId) {
    return [...this.consents.values()].filter((c) => c.userId === userId).pop() ?? null;
  }

  // ---------- platform ----------
  async listProfiles() { await this.ready; return Object.values(PEOPLE).map((p) => p.profile); }
  async login(userId: UserId) { await this.ready; return { token: `demo.${userId}`, profile: PEOPLE[userId].profile }; }

  async createConsent({ userId, expiryDays }: { userId: UserId; expiryDays: number }) {
    await this.ready; await sleep(200);
    const at = this.now(), exp = new Date(at.getTime() + expiryDays * 864e5);
    const c: Consent = { id: `CNS-${userId.slice(0, 3).toUpperCase()}-${hex(4)}`, userId, status: 'ACTIVE', grantedTo: ['LenderOrg'], scope: ['credit-assessment'],
      dataTypes: ['upi.credit', 'upi.debit'], grantedAt: at.toISOString(), expiresAt: exp.toISOString() };
    this.consents.set(c.id, c);
    await this.tx('GrantConsent', ['PlatformOrg'], { consentId: c.id, grantedTo: '[LenderOrg]', scope: '[credit-assessment]', expiresAt: c.expiresAt.slice(0, 10), dataTypes: 'upi.credit,upi.debit (182d)' }, 'VALID', undefined, userId);
    return { ...c };
  }
  async getConsent(id: string) { return { ...this.consentOrThrow(id) }; }

  async revokeConsent(id: string) {
    await sleep(200);
    const c = this.consentOrThrow(id);
    c.status = 'REVOKED'; c.revokedAt = this.now().toISOString();
    this.fetched.delete(id); // Module B rule: stop serving and delete that consent's transactions
    await this.tx('RevokeConsent', ['PlatformOrg'], { consentId: id, offChain: `${PEOPLE[c.userId].profile.txCount.toLocaleString('en-IN')} transactions deleted` }, 'VALID', undefined, c.userId);
    return { ...c };
  }

  async fetchConsentData(id: string): Promise<FetchSummary> {
    const c = this.consentOrThrow(id);
    if (c.status !== 'ACTIVE') throw new Error('Consent is not active');
    await sleep(1300); // SyntheticDataSource.fetchTransactions
    this.fetched.add(id);
    const p = PEOPLE[c.userId];
    return { consentId: id, transactionCount: p.profile.txCount, windowDays: p.signals.windowDays, ruleSetVersion: this.ruleSetVersion,
      signals: computeSignals(p.signals), visuals: visuals(c.userId) };
  }

  async createSnapshot(consentId: string): Promise<Snapshot> {
    const c = this.consentOrThrow(consentId);
    if (c.status !== 'ACTIVE' || !this.fetched.has(consentId)) throw new Error('Consent must be active and fetched');
    const p = PEOPLE[c.userId];
    const hash = await sha256(canon({ consentId, ruleSetVersion: this.ruleSetVersion, signals: p.signals, window: '182d' }));
    // Verifier service independently recomputes the hash before endorsing (Module D).
    const verifierHash = await sha256(canon({ consentId, ruleSetVersion: this.ruleSetVersion, signals: p.signals, window: '182d' }));
    if (verifierHash !== hash) throw new Error('Verifier rejected snapshot: hash mismatch');
    const s: Snapshot = { id: `SNP-${hex(6)}`, consentId, hash, ruleSetVersion: this.ruleSetVersion, cosignedBy: ['PlatformOrg', 'VerifierOrg'], anchoredAt: this.now().toISOString() };
    this.snapshots.set(s.id, s);
    await this.tx('AnchorSnapshot', ['PlatformOrg', 'VerifierOrg'], { snapshotId: s.id, snapshotHash: hash, ruleSetVersion: this.ruleSetVersion.slice(0, 16), consentId }, 'VALID', undefined, c.userId);
    return { ...s };
  }

  async getMatches(snapshotId: string): Promise<MatchesResponse> {
    const s = this.snapshots.get(snapshotId);
    if (!s) throw new Error('Snapshot not found');
    const c = this.consentOrThrow(s.consentId), p = PEOPLE[c.userId];
    return { snapshotId, rulesVersion: RULES.version, matches: evaluate(p.signals), explanation: { en: p.en, hi: p.hi, source: 'template' } };
  }

  async getOfferForConsent(consentId: string) {
    return [...this.offers.values()].find((o) => o.consentId === consentId) ?? null;
  }

  async acceptOffer(offerId: string): Promise<Agreement> {
    await sleep(200);
    const o = this.offers.get(offerId);
    if (!o) throw new Error('Offer not found');
    o.status = 'ACCEPTED';
    const a: Agreement = { id: `AGR-${hex(5)}`, offerId, userId: o.userId, mandate: null, repayments: [] };
    this.agreements.set(a.id, a);
    await this.tx('AcceptOffer', ['PlatformOrg'], { offerId, agreementId: a.id, termsHash: o.termsHash }, 'VALID', undefined, o.userId);
    return structuredClone(a);
  }

  async createMandate(agreementId: string): Promise<Mandate> {
    await sleep(200);
    const a = this.agreements.get(agreementId);
    if (!a) throw new Error('Agreement not found');
    const o = this.offers.get(a.offerId)!;
    a.mandate = { ref: `MND-${hex(6)}`, amount: o.terms.weeklyInstalment, frequency: 'WEEKLY', upi: PEOPLE[a.userId].profile.upi, start: this.now().toISOString() };
    await this.tx('RecordMandate', ['PlatformOrg'], { agreementId, mandateRef: a.mandate.ref, frequency: 'WEEKLY', provider: 'mock-upi-autopay' }, 'VALID', undefined, a.userId);
    return { ...a.mandate };
  }

  async runRepayment(agreementId: string, { forceFail }: { forceFail: boolean }): Promise<Repayment> {
    await sleep(250);
    const a = this.agreements.get(agreementId);
    if (!a?.mandate) throw new Error('No mandate for agreement');
    const r: Repayment = { cycle: a.repayments.length + 1, status: forceFail ? 'FAILED' : 'SUCCESS', reason: forceFail ? 'Insufficient balance (simulated)' : undefined, at: this.now().toISOString(), amount: a.mandate.amount };
    a.repayments.push(r);
    await this.tx('RecordRepayment', ['PlatformOrg'], { agreementId, mandateRef: a.mandate.ref, cycle: String(r.cycle), result: r.status }, forceFail ? 'FAILED' : 'VALID', r.reason, a.userId);
    return { ...r };
  }

  async getTimeline(consentId: string | 'all') {
    await this.ready;
    const list = consentId === 'all' ? this.ledger : this.ledger.filter((e) => e.fields.consentId === consentId);
    return list.map((e) => ({ ...e, fields: { ...e.fields } }));
  }

  // ---------- lender ----------
  async listApplicants(): Promise<Applicant[]> {
    return (Object.keys(PEOPLE) as UserId[]).map((uid) => {
      const c = this.latestConsent(uid);
      const s = c ? [...this.snapshots.values()].filter((x) => x.consentId === c.id).pop() : undefined;
      const p = PEOPLE[uid].profile;
      return { userId: uid, biz: p.biz, initials: p.initials, first: p.first,
        consent: c ? { id: c.id, status: c.status, scope: c.scope, expiresAt: c.expiresAt, grantedTo: c.grantedTo } : null,
        snapshot: s ? { id: s.id, hash: s.hash } : null };
    });
  }

  /** Chaincode RequestData: refuses on missing, wrong org, revoked, expired or out-of-scope consent. */
  async requestData({ userId, consentId, callerOrg, purpose }: DataRequestInput): Promise<DataRequestResult> {
    await sleep(300);
    const c = consentId ? this.consents.get(consentId) ?? null : this.latestConsent(userId);
    let reason: string | undefined;
    if (!c) reason = 'NO_CONSENT: no consent record exists for this merchant';
    else if (!c.grantedTo.includes(callerOrg)) reason = `CALLER_NOT_GRANTED: ${callerOrg} is not in grantedTo [${c.grantedTo.join(', ')}]`;
    else if (c.status === 'REVOKED') reason = `CONSENT_REVOKED: revoked by the merchant at ${fmtTime(c.revokedAt!)} IST`;
    else if (this.now() > new Date(c.expiresAt)) reason = `CONSENT_EXPIRED: consent expired on ${fmtDate(c.expiresAt)}`;
    else if (!c.scope.includes(purpose)) reason = `OUT_OF_SCOPE: purpose "${purpose}" is not in scope [${c.scope.join(', ')}]`;
    const snap = c ? [...this.snapshots.values()].filter((s) => s.consentId === c.id).pop() : undefined;
    const dataRef = reason || !c ? undefined : snap ? `ref://platform/snapshots/${snap.id}` : `ref://platform/consents/${c.id}/summary`;
    const ev = await this.tx('RequestData', [callerOrg], { consentId: c?.id ?? '—', purpose, ...(dataRef ? { dataRef } : {}) }, reason ? 'REFUSED' : 'ALLOWED', reason, userId);
    return { status: reason ? 'REFUSED' : 'ALLOWED', reason, dataRef, txId: ev.txId };
  }

  async postOffer({ consentId, terms }: { consentId: string; terms: OfferTerms }): Promise<Offer> {
    await sleep(250);
    const c = this.consentOrThrow(consentId);
    if (c.status !== 'ACTIVE') throw new Error('Consent is not active');
    const termsHash = await sha256(canon(terms));
    const o: Offer = { id: `OFR-${hex(5)}`, consentId, userId: c.userId, lenderName: LENDER_NAME, terms: { ...terms }, termsHash, status: 'OPEN' };
    this.offers.set(o.id, o);
    await this.tx('PostOffer', ['LenderOrg'], { offerId: o.id, consentId, termsHash, terms: 'private collection PlatformLenderPDC' }, 'VALID', undefined, c.userId);
    return structuredClone(o);
  }

  async listAgreements() { return [...this.agreements.values()].map((a) => structuredClone(a)); }
}
