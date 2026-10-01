/**
 * Ledger interface and SimulatedLedger implementation.
 *
 * The interface defines one method per chaincode function, each taking callerOrg
 * as an explicit parameter so business logic can enforce org-level access control
 * without trusting any request field.  This is the seam: replace SimulatedLedger
 * with a FabricGatewayLedger and nothing else changes.
 *
 * SimulatedLedger persists events to server/storage/ledger.json as a SHA-256
 * hash chain identical in structure to the mock client's in-memory ledger.
 *
 * ALL business rules live here, not in routes.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { canon, sha256 } from '../lib/hash.js';
import { clockNow } from '../lib/clock.js';

// ---------- shared types ----------
export type OrgId = 'PlatformOrg' | 'VerifierOrg' | 'LenderOrg';
export type LedgerStatus = 'VALID' | 'ALLOWED' | 'REFUSED' | 'FAILED';
export type Purpose = 'credit-assessment' | 'marketing';
export type UserId = 'ravi' | 'meena';
export type FinancialWorkflowEvent =
  | 'FinancialCredentialCreated'
  | 'FinancialConsentRecorded'
  | 'FinancialShareRequestCreated'
  | 'FinancialCredentialVerified'
  | 'OrganizationAssessmentStarted'
  | 'FinancialConsentRevoked';

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

// Return types for each ledger method
export interface GrantConsentResult {
  consentId: string;
  merchantId: string;
  event: LedgerEvent;
}

export interface DataRequestResult {
  status: 'ALLOWED' | 'REFUSED';
  reason?: string;
  dataRef?: string;
  txId: string;
}

export interface SnapshotResult {
  snapshotId: string;
  hash: string;
  pendingCosign: boolean;
  event: LedgerEvent;
}

export interface CosignResult {
  snapshotId: string;
  cosignedBy: OrgId[];
  event: LedgerEvent;
}

export interface OfferResult {
  offerId: string;
  termsHash: string;
  event: LedgerEvent;
}

// ---------- Ledger interface ----------
export interface Ledger {
  /**
   * Write the genesis ChannelConfig block. Called once on startup / reset.
   */
  init(): Promise<void>;

  /** PlatformOrg: record a new consent grant. */
  grantConsent(
    callerOrg: OrgId,
    params: {
      consentId: string;
      merchantId: string;
      grantedTo: OrgId[];
      scope: string[];
      dataTypes: string[];
      expiresAt: string;
    },
    userId: UserId,
    now: Date
  ): Promise<GrantConsentResult>;

  /** PlatformOrg: mark a consent as revoked. */
  revokeConsent(
    callerOrg: OrgId,
    params: { consentId: string; txCountDeleted: number },
    userId: UserId,
    now: Date
  ): Promise<LedgerEvent>;

  /**
   * PlatformOrg: anchor the snapshot hash. Returns pendingCosign=true until
   * cosignSnapshot is called by VerifierOrg.
   */
  anchorSnapshot(
    callerOrg: OrgId,
    params: {
      snapshotId: string;
      consentId: string;
      snapshotHash: string;
      ruleSetVersion: string;
    },
    userId: UserId,
    now: Date
  ): Promise<SnapshotResult>;

  /** VerifierOrg: co-sign a previously anchored snapshot. */
  cosignSnapshot(
    callerOrg: OrgId,
    params: { snapshotId: string; snapshotHash: string },
    now: Date
  ): Promise<CosignResult>;

  /**
   * LenderOrg: request data for a consented merchant.
   * NEVER throws. Returns { status: 'REFUSED', reason } on any policy failure
   * AND writes a REFUSED event to the ledger.
   */
  requestData(
    callerOrg: OrgId,
    params: {
      userId: UserId;
      consentId?: string;
      purpose: Purpose;
    },
    now: Date,
    resolveConsent: (consentId?: string, userId?: UserId) => Promise<{
      id: string; status: string; grantedTo: OrgId[]; scope: Purpose[]; expiresAt: string;
    } | null>,
    latestSnapshotId: (consentId: string) => string | undefined
  ): Promise<DataRequestResult>;

  /** LenderOrg: post an offer against a consented merchant. */
  postOffer(
    callerOrg: OrgId,
    params: {
      offerId: string;
      consentId: string;
      termsHash: string;
    },
    userId: UserId,
    now: Date
  ): Promise<OfferResult>;

  /** PlatformOrg: accept an open offer, creating an agreement. */
  acceptOffer(
    callerOrg: OrgId,
    params: { offerId: string; agreementId: string; termsHash: string },
    userId: UserId,
    now: Date
  ): Promise<LedgerEvent>;

  /** PlatformOrg: record an AutoPay mandate. */
  recordMandate(
    callerOrg: OrgId,
    params: { agreementId: string; mandateRef: string },
    userId: UserId,
    now: Date
  ): Promise<LedgerEvent>;

  /** PlatformOrg: record a repayment debit result. */
  recordRepayment(
    callerOrg: OrgId,
    params: { agreementId: string; mandateRef: string; cycle: number; result: 'SUCCESS' | 'FAILED'; reason?: string },
    userId: UserId,
    now: Date
  ): Promise<LedgerEvent>;

  /** Record credential workflow metadata only; metric values stay off-chain. */
  recordFinancialWorkflowEvent(
    callerOrg: OrgId,
    event: FinancialWorkflowEvent,
    params: { credentialId: string; organization: string; purpose: string; scope: string[]; credentialHash: string },
    userId: UserId,
    now: Date
  ): Promise<LedgerEvent>;

  /** Get all ledger events, or filter by a consentId field. */
  getHistory(consentId: 'all' | string): Promise<LedgerEvent[]>;
}

// ---------- SimulatedLedger ----------
const __dir = dirname(fileURLToPath(import.meta.url));
const STORAGE_PATH = `${__dir}/../storage/ledger.json`;

function ensureStorageDir() {
  const dir = dirname(STORAGE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadLedger(): LedgerEvent[] {
  ensureStorageDir();
  if (!existsSync(STORAGE_PATH)) return [];
  try { return JSON.parse(readFileSync(STORAGE_PATH, 'utf-8')); }
  catch { return []; }
}

function saveLedger(events: LedgerEvent[]): void {
  ensureStorageDir();
  writeFileSync(STORAGE_PATH, JSON.stringify(events, null, 2), 'utf-8');
}

export class SimulatedLedger implements Ledger {
  private events: LedgerEvent[] = [];
  /** snapshotId → { hash, cosigned: boolean, cosignedBy: OrgId[], consentId: string } */
  private snapshots = new Map<string, { hash: string; cosigned: boolean; cosignedBy: OrgId[]; consentId: string }>();
  /** consentId → last ALLOWED requestData txId (needed to gate postOffer) */
  private allowedRequests = new Map<string, string>();
  /** offerId → { open: boolean } */
  private offers = new Map<string, { open: boolean }>();

  constructor() {
    this.events = loadLedger();
    // Rebuild in-memory indexes from persisted events
    for (const ev of this.events) {
      if (ev.fn === 'AnchorSnapshot') {
        const id = ev.fields.snapshotId;
        const existing = this.snapshots.get(id);
        if (!existing) {
          this.snapshots.set(id, { hash: ev.fields.snapshotHash, cosigned: false, cosignedBy: ['PlatformOrg'], consentId: ev.fields.consentId ?? '' });
        }
      }
      if (ev.fn === 'AnchorSnapshot' && ev.orgs.includes('VerifierOrg')) {
        const id = ev.fields.snapshotId;
        const s = this.snapshots.get(id);
        if (s) { s.cosigned = true; s.cosignedBy = ['PlatformOrg', 'VerifierOrg']; }
      }
      if (ev.fn === 'RequestData' && ev.status === 'ALLOWED') {
        this.allowedRequests.set(ev.fields.consentId, ev.txId);
      }
      if (ev.fn === 'PostOffer') {
        this.offers.set(ev.fields.offerId, { open: true });
      }
      if (ev.fn === 'AcceptOffer') {
        const id = ev.fields.offerId;
        const o = this.offers.get(id);
        if (o) o.open = false;
      }
    }
  }

  private prev(): LedgerEvent { return this.events[this.events.length - 1]; }

  private append(
    fn: string, orgs: OrgId[], fields: Record<string, string>,
    status: LedgerStatus = 'VALID', reason?: string, userId?: UserId, now?: Date
  ): LedgerEvent {
    const p = this.prev();
    const time = (now ?? clockNow()).toISOString();
    const hashInput = canon({ fn, status, orgs, fields, reason: reason ?? null, prev: p.hash, time });
    const hash = sha256(hashInput);
    const txId = hash.slice(0, 10);
    const ev: LedgerEvent = { n: p.n + 1, fn, status, orgs, time, fields, reason, userId, prev: p.hash, hash, txId };
    this.events.push(ev);
    saveLedger(this.events);
    return ev;
  }

  async init(): Promise<void> {
    if (this.events.length > 0) return; // already initialized
    const time = new Date(Date.now() - 2 * 3600e3).toISOString();
    const g = {
      n: 0, fn: 'ChannelConfig', status: 'VALID' as LedgerStatus,
      orgs: ['PlatformOrg', 'VerifierOrg', 'LenderOrg'] as OrgId[],
      time,
      fields: { channel: 'flowproof-channel', chaincode: 'flowproof v0.3 (Go)', endorsement: 'AnchorSnapshot: Platform AND Verifier' },
      prev: '0'.repeat(64),
    };
    const hash = sha256(canon(g));
    const genesis: LedgerEvent = { ...g, hash, txId: hash.slice(0, 10) };
    this.events.push(genesis);
    saveLedger(this.events);
  }

  async grantConsent(callerOrg: OrgId, params: {
    consentId: string; merchantId: string; grantedTo: OrgId[];
    scope: string[]; dataTypes: string[]; expiresAt: string;
  }, userId: UserId, now: Date): Promise<GrantConsentResult> {
    if (callerOrg !== 'PlatformOrg') throw new Error('grantConsent requires PlatformOrg');
    const fields: Record<string, string> = {
      consentId: params.consentId,
      merchantId: params.merchantId,           // pseudonymous, never the real userId
      grantedTo: `[${params.grantedTo.join(',')}]`,
      scope: `[${params.scope.join(',')}]`,    // field names on-chain
      dataTypes: params.dataTypes.join(',') + ' (182d)',
      expiresAt: params.expiresAt.slice(0, 10),
    };
    const ev = this.append('GrantConsent', ['PlatformOrg'], fields, 'VALID', undefined, userId, now);
    return { consentId: params.consentId, merchantId: params.merchantId, event: ev };
  }

  async revokeConsent(callerOrg: OrgId, params: {
    consentId: string; txCountDeleted: number;
  }, userId: UserId, now: Date): Promise<LedgerEvent> {
    if (callerOrg !== 'PlatformOrg') throw new Error('revokeConsent requires PlatformOrg');
    const fields: Record<string, string> = {
      consentId: params.consentId,
      offChain: `${params.txCountDeleted.toLocaleString('en-IN')} transactions deleted`,
    };
    return this.append('RevokeConsent', ['PlatformOrg'], fields, 'VALID', undefined, userId, now);
  }

  async anchorSnapshot(callerOrg: OrgId, params: {
    snapshotId: string; consentId: string; snapshotHash: string; ruleSetVersion: string;
  }, userId: UserId, now: Date): Promise<SnapshotResult> {
    if (callerOrg !== 'PlatformOrg') throw new Error('anchorSnapshot requires PlatformOrg');
    this.snapshots.set(params.snapshotId, {
      hash: params.snapshotHash, cosigned: false, cosignedBy: ['PlatformOrg'], consentId: params.consentId,
    });
    const fields: Record<string, string> = {
      snapshotId: params.snapshotId,
      snapshotHash: params.snapshotHash,
      ruleSetVersion: params.ruleSetVersion.slice(0, 16),
      consentId: params.consentId,
    };
    const ev = this.append('AnchorSnapshot', ['PlatformOrg'], fields, 'VALID', undefined, userId, now);
    return { snapshotId: params.snapshotId, hash: params.snapshotHash, pendingCosign: true, event: ev };
  }

  async cosignSnapshot(callerOrg: OrgId, params: {
    snapshotId: string; snapshotHash: string;
  }, now: Date): Promise<CosignResult> {
    if (callerOrg !== 'VerifierOrg') throw new Error('cosignSnapshot requires VerifierOrg');
    const s = this.snapshots.get(params.snapshotId);
    if (!s) throw new Error(`Snapshot ${params.snapshotId} not anchored yet`);
    if (s.cosigned) throw new Error(`Snapshot ${params.snapshotId} already cosigned`);
    if (s.hash !== params.snapshotHash) throw new Error('Hash mismatch: verifier computed a different hash');
    s.cosigned = true;
    s.cosignedBy = ['PlatformOrg', 'VerifierOrg'];
    const fields: Record<string, string> = {
      snapshotId: params.snapshotId,
      snapshotHash: params.snapshotHash,
      consentId: s.consentId,
    };
    const ev = this.append('AnchorSnapshot', ['PlatformOrg', 'VerifierOrg'], fields, 'VALID', undefined, undefined, now);
    return { snapshotId: params.snapshotId, cosignedBy: s.cosignedBy, event: ev };
  }

  async requestData(
    callerOrg: OrgId,
    params: { userId: UserId; consentId?: string; purpose: Purpose },
    now: Date,
    resolveConsent: (consentId?: string, userId?: UserId) => Promise<{
      id: string; status: string; grantedTo: OrgId[]; scope: Purpose[]; expiresAt: string;
    } | null>,
    latestSnapshotId: (consentId: string) => string | undefined
  ): Promise<DataRequestResult> {
    // All failures write a REFUSED event and return {status:'REFUSED'} — never throw
    const refuse = (consentId: string | undefined, reason: string): DataRequestResult => {
      const fields: Record<string, string> = { consentId: consentId ?? '—', purpose: params.purpose };
      this.append('RequestData', [callerOrg], fields, 'REFUSED', reason, params.userId, now);
      return { status: 'REFUSED', reason, txId: this.prev().txId };
    };

    const c = await resolveConsent(params.consentId, params.userId);
    if (!c) return refuse(params.consentId, 'NO_CONSENT: no consent record exists for this merchant');

    if (!c.grantedTo.includes(callerOrg))
      return refuse(c.id, `CALLER_NOT_GRANTED: ${callerOrg} is not in grantedTo [${c.grantedTo.join(', ')}]`);

    if (c.status === 'REVOKED')
      return refuse(c.id, 'CONSENT_REVOKED: revoked by the merchant');

    if (now > new Date(c.expiresAt))
      return refuse(c.id, `CONSENT_EXPIRED: consent expired on ${c.expiresAt.slice(0, 10)}`);

    if (!c.scope.includes(params.purpose))
      return refuse(c.id, `OUT_OF_SCOPE: purpose "${params.purpose}" is not in scope [${c.scope.join(', ')}]`);

    const snapshotId = latestSnapshotId(c.id);
    const dataRef = snapshotId
      ? `ref://platform/snapshots/${snapshotId}`
      : `ref://platform/consents/${c.id}/summary`;

    const fields: Record<string, string> = { consentId: c.id, purpose: params.purpose, dataRef };
    const ev = this.append('RequestData', [callerOrg], fields, 'ALLOWED', undefined, params.userId, now);
    this.allowedRequests.set(c.id, ev.txId);
    return { status: 'ALLOWED', dataRef, txId: ev.txId };
  }

  async postOffer(callerOrg: OrgId, params: {
    offerId: string; consentId: string; termsHash: string;
  }, userId: UserId, now: Date): Promise<OfferResult> {
    if (callerOrg !== 'LenderOrg') throw new Error('postOffer requires LenderOrg');
    if (!this.allowedRequests.has(params.consentId))
      throw new Error('OFFER_REJECTED: no prior ALLOWED data request for this consent');
    this.offers.set(params.offerId, { open: true });
    const fields: Record<string, string> = {
      offerId: params.offerId,
      consentId: params.consentId,
      termsHash: params.termsHash,
      terms: 'private collection PlatformLenderPDC',
    };
    const ev = this.append('PostOffer', ['LenderOrg'], fields, 'VALID', undefined, userId, now);
    return { offerId: params.offerId, termsHash: params.termsHash, event: ev };
  }

  async acceptOffer(callerOrg: OrgId, params: {
    offerId: string; agreementId: string; termsHash: string;
  }, userId: UserId, now: Date): Promise<LedgerEvent> {
    if (callerOrg !== 'PlatformOrg') throw new Error('acceptOffer requires PlatformOrg');
    const o = this.offers.get(params.offerId);
    if (!o) throw new Error(`Offer ${params.offerId} not found on ledger`);
    if (!o.open) throw new Error(`Offer ${params.offerId} is not OPEN`);
    o.open = false;
    const fields: Record<string, string> = {
      offerId: params.offerId,
      agreementId: params.agreementId,
      termsHash: params.termsHash,
    };
    return this.append('AcceptOffer', ['PlatformOrg'], fields, 'VALID', undefined, userId, now);
  }

  async recordMandate(callerOrg: OrgId, params: {
    agreementId: string; mandateRef: string;
  }, userId: UserId, now: Date): Promise<LedgerEvent> {
    if (callerOrg !== 'PlatformOrg') throw new Error('recordMandate requires PlatformOrg');
    const fields: Record<string, string> = {
      agreementId: params.agreementId,
      mandateRef: params.mandateRef,
      frequency: 'WEEKLY',
      provider: 'mock-upi-autopay',
    };
    return this.append('RecordMandate', ['PlatformOrg'], fields, 'VALID', undefined, userId, now);
  }

  async recordRepayment(callerOrg: OrgId, params: {
    agreementId: string; mandateRef: string; cycle: number; result: 'SUCCESS' | 'FAILED'; reason?: string;
  }, userId: UserId, now: Date): Promise<LedgerEvent> {
    if (callerOrg !== 'PlatformOrg') throw new Error('recordRepayment requires PlatformOrg');
    const fields: Record<string, string> = {
      agreementId: params.agreementId,
      mandateRef: params.mandateRef,
      cycle: String(params.cycle),
      result: params.result,
    };
    const status: LedgerStatus = params.result === 'FAILED' ? 'FAILED' : 'VALID';
    return this.append('RecordRepayment', ['PlatformOrg'], fields, status, params.reason, userId, now);
  }

  async recordFinancialWorkflowEvent(
    callerOrg: OrgId,
    event: FinancialWorkflowEvent,
    params: { credentialId: string; organization: string; purpose: string; scope: string[]; credentialHash: string },
    userId: UserId,
    now: Date
  ): Promise<LedgerEvent> {
    const platformEvents: FinancialWorkflowEvent[] = [
      'FinancialCredentialCreated', 'FinancialConsentRecorded', 'FinancialShareRequestCreated', 'FinancialConsentRevoked',
    ];
    const organizationEvents: FinancialWorkflowEvent[] = ['FinancialCredentialVerified', 'OrganizationAssessmentStarted'];
    if (platformEvents.includes(event) && callerOrg !== 'PlatformOrg') throw new Error(`${event} requires PlatformOrg`);
    if (organizationEvents.includes(event) && callerOrg !== 'LenderOrg') throw new Error(`${event} requires LenderOrg`);

    const orgs: OrgId[] = callerOrg === 'PlatformOrg' && event === 'FinancialShareRequestCreated'
      ? ['PlatformOrg', 'LenderOrg']
      : [callerOrg];
    const fields = {
      credentialId: params.credentialId,
      organization: params.organization,
      purpose: params.purpose,
      scope: params.scope.join(','),
      credentialHash: params.credentialHash,
      valuesStored: 'off-chain',
    };
    return this.append(event, orgs, fields, 'VALID', undefined, userId, now);
  }

  async getHistory(consentId: 'all' | string): Promise<LedgerEvent[]> {
    const list = consentId === 'all'
      ? this.events
      : this.events.filter(e => e.fields.consentId === consentId);
    return list.map(e => ({ ...e, fields: { ...e.fields } }));
  }

  /** Verify the snapshot was cosigned by VerifierOrg. */
  isSnapshotCosigned(snapshotId: string): boolean {
    return this.snapshots.get(snapshotId)?.cosigned ?? false;
  }

  /** For the lender /applicants route — reads only chain-visible snapshot fields. */
  latestSnapshotForConsent(consentId: string): { id: string; hash: string } | null {
    // Walk events in reverse to find the latest cosigned snapshot for this consentId
    for (let i = this.events.length - 1; i >= 0; i--) {
      const ev = this.events[i];
      if (ev.fn === 'AnchorSnapshot' && ev.fields.consentId === consentId && ev.orgs.includes('VerifierOrg')) {
        return { id: ev.fields.snapshotId, hash: ev.fields.snapshotHash };
      }
    }
    return null;
  }

  /** Reset — called by reset script. */
  clear(): void {
    this.events = [];
    this.snapshots.clear();
    this.allowedRequests.clear();
    this.offers.clear();
    saveLedger(this.events);
  }
}
