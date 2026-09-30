// Shared UI-side contract. Mirror of CONTRACTS.md (sections 9.4, 10.3, 11, 14 of the solution doc).
// If a backend module changes a shape, update it here and in CONTRACTS.md together.

export type UserId = 'ravi' | 'meena';
export type OrgId = 'PlatformOrg' | 'VerifierOrg' | 'LenderOrg';
export type Purpose = 'credit-assessment' | 'marketing';

export interface MerchantProfile {
  id: UserId;
  name: string;
  first: string;
  biz: string;
  kind: string;
  upi: string;
  initials: string;
  txCount: number;
  tag: { label: string; tone: Tone };
}

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral';

export interface Consent {
  id: string;
  userId: UserId;
  status: 'ACTIVE' | 'REVOKED';
  grantedTo: OrgId[];
  scope: Purpose[];
  dataTypes: string[];
  grantedAt: string; // ISO
  expiresAt: string; // ISO
  revokedAt?: string;
}

export type SignalKey = 'incomeRegularity' | 'activityTrend' | 'repaymentBehaviour' | 'savingsBuffer';

/** Module C output: each signal has a value, a label and a one-sentence plain reason. */
export interface SignalResult {
  key: SignalKey;
  name: string;
  value: number;
  display: string; // e.g. "97", "+12", "6/6"
  unitLabel: string; // e.g. "% of days"
  label: string; // e.g. "Very regular"
  tone: Tone;
  reason: string;
}

/** Aggregates for the charts only. Never raw transactions. */
export interface SignalVisuals {
  activeCalendar: boolean[]; // one entry per day in the window
  weeklySales: number[]; // ₹ thousands per week
  festivalWeek?: number;
  emiMonths: string[]; // months with an on-time EMI
  bufferDays: number;
  bufferThreshold: number;
}

export interface FetchSummary {
  consentId: string;
  transactionCount: number;
  windowDays: number;
  ruleSetVersion: string;
  signals: SignalResult[];
  visuals: SignalVisuals;
}

export interface Snapshot {
  id: string;
  consentId: string;
  hash: string;
  ruleSetVersion: string;
  cosignedBy: OrgId[];
  anchoredAt: string;
}

export interface Gap {
  criterion: string;
  current: string;
  needed: string;
  howToFix: string;
}

export interface MatchResult {
  productId: string;
  name: string;
  blurb: string;
  matched: boolean;
  reasons: string[];
  gaps: Gap[];
}

export interface MatchesResponse {
  snapshotId: string;
  rulesVersion: string;
  matches: MatchResult[];
  explanation: { en: string; hi: string; source: 'llm' | 'template' };
}

export interface OfferTerms {
  product: string;
  principal: number;
  aprPct: number;
  weeks: number;
  weeklyInstalment: number;
}

export interface Offer {
  id: string;
  consentId: string;
  userId: UserId;
  lenderName: string;
  terms: OfferTerms; // visible only to PlatformOrg + LenderOrg (private data collection)
  termsHash: string; // public on the ledger
  status: 'OPEN' | 'ACCEPTED';
}

export interface Mandate {
  ref: string;
  amount: number;
  frequency: 'WEEKLY';
  upi: string;
  start: string;
}

export interface Repayment {
  cycle: number;
  status: 'SUCCESS' | 'FAILED';
  reason?: string;
  at: string;
  amount: number;
}

export interface Agreement {
  id: string;
  offerId: string;
  userId: UserId;
  mandate: Mandate | null;
  repayments: Repayment[];
}

export type LedgerStatus = 'VALID' | 'ALLOWED' | 'REFUSED' | 'FAILED';

export interface LedgerEvent {
  n: number;
  fn: string;
  status: LedgerStatus;
  orgs: OrgId[];
  time: string;
  fields: Record<string, string>;
  reason?: string;
  userId?: UserId;
  txId: string;
  hash: string;
  prev: string;
}

export interface DataRequestInput {
  userId: UserId;
  consentId?: string;
  callerOrg: OrgId;
  purpose: Purpose;
}

export interface DataRequestResult {
  status: 'ALLOWED' | 'REFUSED';
  reason?: string;
  dataRef?: string;
  txId: string;
}

/** What the lender can see: chain-visible fields only. */
export interface Applicant {
  userId: UserId;
  biz: string;
  initials: string;
  first: string;
  consent: Pick<Consent, 'id' | 'status' | 'scope' | 'expiresAt' | 'grantedTo'> | null;
  snapshot: Pick<Snapshot, 'id' | 'hash'> | null;
}
