/**
 * DataSource interface and SyntheticDataSource implementation.
 *
 * The interface has five operations:
 *   createConsent  — registers a consent and associates a pseudonymous merchantId
 *   getConsentStatus — returns the live consent record (status, expiry, scope, etc.)
 *   fetchTransactions — returns the raw signal inputs for a consented merchant
 *   revokeConsent  — marks consent REVOKED and deletes its off-chain transaction records
 *   getPersonProfile — public-ish fields for the lender applicant list
 *
 * The verifier calls fetchTransactions and recomputes signals independently.
 * No raw transactions ever leave this module; only the RawSignals aggregate does.
 */

import { randomBytes } from 'node:crypto';
import { clockNow } from '../lib/clock.js';

// ---------- shared types (mirroring src/api/types.ts) ----------
export type UserId = 'ravi' | 'meena';
export type OrgId = 'PlatformOrg' | 'VerifierOrg' | 'LenderOrg';
export type Purpose = 'credit-assessment' | 'marketing';

export interface ConsentRecord {
  id: string;
  userId: UserId;
  /** Pseudonymous ID stored on-chain — never the real userId. */
  merchantId: string;
  status: 'ACTIVE' | 'REVOKED';
  grantedTo: OrgId[];
  /** Stored on-chain as a list of field names, e.g. ['upi.credit','upi.debit'] */
  scope: Purpose[];
  dataTypes: string[];
  grantedAt: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface RawSignals {
  regularity: number;
  activeDays: number;
  windowDays: number;
  trendPct: number;
  onTimeRepayments: number;
  repaymentTotal: number;
  bufferDays: number;
}

export interface PersonProfile {
  id: UserId;
  name: string;
  first: string;
  biz: string;
  kind: string;
  upi: string;
  initials: string;
  txCount: number;
  tag: { label: string; tone: string };
  en: string;
  hi: string;
  seed: number;
  signals: RawSignals;
}

export interface DataSource {
  createConsent(input: {
    userId: UserId;
    expiryDays: number;
    grantedTo: OrgId[];
    scope: Purpose[];
  }): Promise<ConsentRecord>;

  getConsentStatus(id: string): Promise<ConsentRecord | null>;

  /** Returns raw signal inputs for a consented merchant.
   *  Verifier calls this independently to recompute without trusting the platform. */
  fetchTransactions(consentId: string): Promise<{ signals: RawSignals; txCount: number }>;

  revokeConsent(id: string): Promise<ConsentRecord>;

  getPersonProfile(userId: UserId): PersonProfile;

  listAllProfiles(): PersonProfile[];

  /** Returns the most recent ACTIVE consent for a userId (for lender applicant list). */
  latestActiveConsent(userId: UserId): ConsentRecord | null;

  /** Returns the pseudonymous merchantId mapped from a real userId for a given consent. */
  merchantIdForConsent(consentId: string): string | null;
}

// ---------- seeded RNG (matches front-end mockClient.ts) ----------
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- people config (matches src/mock/config.ts) ----------
const PEOPLE: Record<UserId, PersonProfile> = {
  ravi: {
    id: 'ravi',
    name: 'Ravi Kumar', first: 'Ravi', biz: 'Ravi General Store',
    kind: 'Kirana shop · Jaipur', upi: 'ravi.store@okmock', initials: 'RK',
    txCount: 9214, tag: { label: 'Strong profile', tone: 'ok' },
    seed: 7,
    signals: { regularity: 0.967, activeDays: 176, windowDays: 182, trendPct: 12, onTimeRepayments: 6, repaymentTotal: 6, bufferDays: 18 },
    en: 'Over the last six months money came in on almost every day, sales are growing, and all six EMIs were paid on time.',
    hi: 'पिछले छह महीनों में लगभग हर दिन आपको भुगतान मिला, बिक्री बढ़ रही है, और सभी छह किस्तें समय पर चुकाई गईं।',
  },
  meena: {
    id: 'meena',
    name: 'Meena Devi', first: 'Meena', biz: 'Meena Tailors',
    kind: 'Tailoring · Lucknow', upi: 'meena.tailors@okmock', initials: 'MD',
    txCount: 312, tag: { label: 'Thin file', tone: 'warn' },
    seed: 19,
    signals: { regularity: 0.533, activeDays: 97, windowDays: 182, trendPct: -4, onTimeRepayments: 0, repaymentTotal: 0, bufferDays: 4 },
    en: 'Payments come in on about half of all days, and there is no repayment record in the shared data yet.',
    hi: 'लगभग आधे दिनों में आपको भुगतान मिलता है, और साझा डेटा में अभी चुकौती का कोई रिकॉर्ड नहीं है।',
  },
};

function hex8() { return randomBytes(4).toString('hex').toUpperCase(); }

// ---------- SyntheticDataSource ----------
export class SyntheticDataSource implements DataSource {
  /** All consents, keyed by consentId */
  private consents = new Map<string, ConsentRecord>();
  /** Fetched consents — set populated after fetchTransactions is called */
  private fetched = new Set<string>();
  /** pseudonymous merchantId per consentId */
  private merchantIds = new Map<string, string>();

  async createConsent({ userId, expiryDays, grantedTo, scope }: {
    userId: UserId; expiryDays: number; grantedTo: OrgId[]; scope: Purpose[];
  }): Promise<ConsentRecord> {
    const now = clockNow();
    const exp = new Date(now.getTime() + expiryDays * 864e5);
    const id = `CNS-${userId.slice(0, 3).toUpperCase()}-${hex8()}`;
    // pseudonymous merchantId: never exposes real userId on-chain
    const merchantId = `MID-${hex8()}`;
    const rec: ConsentRecord = {
      id, userId, merchantId, status: 'ACTIVE',
      grantedTo, scope,
      dataTypes: ['upi.credit', 'upi.debit'],
      grantedAt: now.toISOString(),
      expiresAt: exp.toISOString(),
    };
    this.consents.set(id, rec);
    this.merchantIds.set(id, merchantId);
    return { ...rec };
  }

  async getConsentStatus(id: string): Promise<ConsentRecord | null> {
    const c = this.consents.get(id);
    return c ? { ...c } : null;
  }

  /** The verifier calls this directly — it does not trust signals from the platform. */
  async fetchTransactions(consentId: string): Promise<{ signals: RawSignals; txCount: number }> {
    const c = this.consents.get(consentId);
    if (!c) throw new Error(`fetchTransactions: consent ${consentId} not found`);
    if (c.status !== 'ACTIVE') throw new Error(`fetchTransactions: consent ${consentId} is ${c.status}`);
    this.fetched.add(consentId);
    const p = PEOPLE[c.userId];
    // Seeded deterministic signals — same result every call for the same persona
    return { signals: { ...p.signals }, txCount: p.txCount };
  }

  async revokeConsent(id: string): Promise<ConsentRecord> {
    const c = this.consents.get(id);
    if (!c) throw new Error(`Consent ${id} not found`);
    c.status = 'REVOKED';
    c.revokedAt = clockNow().toISOString();
    this.fetched.delete(id); // off-chain data deleted on revocation
    return { ...c };
  }

  getPersonProfile(userId: UserId): PersonProfile {
    return PEOPLE[userId];
  }

  listAllProfiles(): PersonProfile[] {
    return Object.values(PEOPLE);
  }

  latestActiveConsent(userId: UserId): ConsentRecord | null {
    const all = [...this.consents.values()]
      .filter(c => c.userId === userId && c.status === 'ACTIVE')
      .sort((a, b) => a.grantedAt.localeCompare(b.grantedAt));
    return all.at(-1) ?? null;
  }

  merchantIdForConsent(consentId: string): string | null {
    return this.merchantIds.get(consentId) ?? null;
  }

  isFetched(consentId: string): boolean {
    return this.fetched.has(consentId);
  }

  /** Called by the reset script — clears all in-memory state. */
  reset(): void {
    this.consents.clear();
    this.fetched.clear();
    this.merchantIds.clear();
  }
}
