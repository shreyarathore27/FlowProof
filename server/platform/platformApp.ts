/**
 * Platform service — Express app on port 4000.
 * Only PlatformOrg calls are made to the ledger from this app.
 *
 * Routes:
 *   GET  /auth/profiles
 *   POST /auth/login
 *   POST /consents
 *   GET  /consents/:id
 *   POST /consents/:id/revoke
 *   POST /consents/:id/fetch
 *   GET  /consents/:id/offer
 *   POST /snapshots
 *   GET  /snapshots/:id/matches
 *   POST /offers/:id/accept
 *   POST /agreements/:id/mandate
 *   POST /agreements/:id/repayments[?forceFail=true]
 *   GET  /ledger/timeline/:consentId
 *   POST /dev/clock   (dev-only)
 *   POST /dev/reset   (dev-only)
 */

import express from 'express';
import cors from 'cors';
import { randomBytes } from 'node:crypto';
import { signToken } from '../lib/jwt.js';
import { clockNow, setClockOffset, resetClock } from '../lib/clock.js';
import { canon, sha256 } from '../lib/hash.js';
import { computeSignals, computeVisuals, computeSnapshotHash, evaluate, ruleSetVersion, LENDER_NAME, RULES } from '../lib/signals.js';
import { _offerRegistry } from '../lender/lenderApp.js';
import type { SyntheticDataSource } from '../data/DataSource.js';
import type { SimulatedLedger } from '../ledger/Ledger.js';

const CALLER_ORG = 'PlatformOrg' as const;

function hex(n: number) { return randomBytes(n).toString('hex').toUpperCase(); }

export function createPlatformApp(ds: SyntheticDataSource, ledger: SimulatedLedger) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // ---------- in-memory stores ----------
  /** snapshotId → { consentId, hash, salt, ruleSetVersion, cosignedBy, anchoredAt } */
  const snapshots = new Map<string, {
    id: string; consentId: string; hash: string; salt: string;
    ruleSetVersion: string; cosignedBy: string[]; anchoredAt: string;
  }>();
  /** offerId → offer record */
  const offers = new Map<string, {
    id: string; consentId: string; userId: string; lenderName: string;
    terms: object; termsHash: string; termsSalt: string; status: 'OPEN' | 'ACCEPTED';
  }>();
  /** agreementId → agreement record */
  const agreements = new Map<string, {
    id: string; offerId: string; userId: string;
    mandate: object | null; repayments: object[];
  }>();

  // ---------- auth ----------
  app.get('/auth/profiles', (_req, res) => {
    const profiles = ds.listAllProfiles().map(p => ({
      id: p.id, name: p.name, first: p.first, biz: p.biz,
      kind: p.kind, upi: p.upi, initials: p.initials,
      txCount: p.txCount, tag: p.tag,
    }));
    res.json(profiles);
  });

  app.post('/auth/login', (req, res) => {
    const { userId } = req.body as { userId: string };
    if (userId !== 'ravi' && userId !== 'meena') { res.status(400).json({ error: 'Unknown userId' }); return; }
    const p = ds.getPersonProfile(userId);
    const token = signToken({ role: 'merchant', userId });
    const profile = {
      id: p.id, name: p.name, first: p.first, biz: p.biz,
      kind: p.kind, upi: p.upi, initials: p.initials,
      txCount: p.txCount, tag: p.tag,
    };
    res.json({ token, profile });
  });

  // ---------- consents ----------
  app.post('/consents', async (req, res) => {
    try {
      const { userId, grantedTo, scope, expiryDays } = req.body as {
        userId?: string; grantedTo: string[]; scope: string[]; expiryDays: number;
      };
      // userId can come from body (demo simplification) or from auth token
      const authHeader = req.headers.authorization;
      let resolvedUserId: 'ravi' | 'meena';
      if (userId === 'ravi' || userId === 'meena') {
        resolvedUserId = userId;
      } else if (authHeader?.startsWith('Bearer ')) {
        try {
          const { verifyToken } = await import('../lib/jwt.js');
          const payload = verifyToken(authHeader.slice(7));
          if (payload.role !== 'merchant') throw new Error();
          resolvedUserId = payload.userId as 'ravi' | 'meena';
        } catch { res.status(401).json({ error: 'Invalid token' }); return; }
      } else { res.status(400).json({ error: 'userId required' }); return; }

      const now = clockNow();
      const consent = await ds.createConsent({
        userId: resolvedUserId,
        expiryDays: expiryDays ?? 90,
        grantedTo: (grantedTo ?? ['LenderOrg']) as ('PlatformOrg' | 'VerifierOrg' | 'LenderOrg')[],
        scope: (scope ?? ['credit-assessment']) as ('credit-assessment' | 'marketing')[],
      });

      await ledger.grantConsent(CALLER_ORG, {
        consentId: consent.id,
        merchantId: consent.merchantId,
        grantedTo: consent.grantedTo,
        scope: consent.scope,
        dataTypes: consent.dataTypes,
        expiresAt: consent.expiresAt,
      }, resolvedUserId, now);

      // Return public consent shape (no merchantId)
      res.json({
        id: consent.id, userId: consent.userId, status: consent.status,
        grantedTo: consent.grantedTo, scope: consent.scope, dataTypes: consent.dataTypes,
        grantedAt: consent.grantedAt, expiresAt: consent.expiresAt,
      });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.get('/consents/:id', async (req, res) => {
    const c = await ds.getConsentStatus(req.params.id);
    if (!c) { res.status(404).json({ error: 'Not found' }); return; }
    const { merchantId: _m, ...pub } = c;
    res.json(pub);
  });

  app.post('/consents/:id/revoke', async (req, res) => {
    try {
      const now = clockNow();
      const c = await ds.revokeConsent(req.params.id);
      const p = ds.getPersonProfile(c.userId);
      await ledger.revokeConsent(CALLER_ORG, {
        consentId: c.id, txCountDeleted: p.txCount,
      }, c.userId, now);
      const { merchantId: _m, ...pub } = c;
      res.json(pub);
    } catch (e) { res.status(404).json({ error: String(e) }); }
  });

  app.post('/consents/:id/fetch', async (req, res) => {
    try {
      const { signals, txCount } = await ds.fetchTransactions(req.params.id);
      res.json({
        consentId: req.params.id,
        transactionCount: txCount,
        windowDays: signals.windowDays,
        ruleSetVersion,
        signals: computeSignals(signals),
        visuals: computeVisuals(
          (await ds.getConsentStatus(req.params.id))?.userId ?? 'ravi',
          signals
        ),
      });
    } catch (e) { res.status(400).json({ error: String(e) }); }
  });

  // DEVIATION: merchant reads the offer posted against their consent
  app.get('/consents/:id/offer', async (_req, res) => {
    const offer = [...offers.values(), ..._offerRegistry.values()].find(o => o.consentId === _req.params.id) ?? null;
    if (!offer) { res.json({ offer: null }); return; }
    // Never expose termsHash salt or raw terms — return only public offer shape
    res.json({
      offer: {
        id: offer.id, consentId: offer.consentId, userId: offer.userId,
        lenderName: offer.lenderName, terms: offer.terms,
        termsHash: offer.termsHash, status: offer.status,
      },
    });
  });

  // ---------- snapshots ----------
  app.post('/snapshots', async (req, res) => {
    try {
      const { consentId } = req.body as { consentId: string };
      const c = await ds.getConsentStatus(consentId);
      if (!c || c.status !== 'ACTIVE') { res.status(400).json({ error: 'Consent must be active' }); return; }

      const { signals } = await ds.fetchTransactions(consentId);
      const now = clockNow();
      const salt = randomBytes(16).toString('hex');
      const hash = computeSnapshotHash(consentId, signals, salt);
      const snapshotId = `SNP-${hex(3)}`;

      // Anchor on-chain (without verifier co-sign yet)
      await ledger.anchorSnapshot(CALLER_ORG, {
        snapshotId, consentId, snapshotHash: hash, ruleSetVersion,
      }, c.userId, now);

      // Call verifier internally (in-process)
      const { verifierApp } = await import('../verifier/verifierInternal.js');
      await verifierApp.cosign({ snapshotId, consentId, hash, salt });

      const snap = {
        id: snapshotId, consentId, hash, ruleSetVersion,
        cosignedBy: ['PlatformOrg', 'VerifierOrg'] as string[],
        anchoredAt: now.toISOString(),
      };
      snapshots.set(snapshotId, { ...snap, salt });
      res.json({ id: snap.id, consentId: snap.consentId, hash: snap.hash, ruleSetVersion: snap.ruleSetVersion, cosignedBy: snap.cosignedBy, anchoredAt: snap.anchoredAt });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.get('/snapshots/:id/matches', async (req, res) => {
    const s = snapshots.get(req.params.id);
    if (!s) { res.status(404).json({ error: 'Snapshot not found' }); return; }
    const c = await ds.getConsentStatus(s.consentId);
    if (!c) { res.status(404).json({ error: 'Consent not found' }); return; }
    const { signals } = await ds.fetchTransactions(s.consentId);
    const p = ds.getPersonProfile(c.userId);
    res.json({
      snapshotId: req.params.id,
      rulesVersion: RULES.version,
      matches: evaluate(signals),
      explanation: { en: p.en, hi: p.hi, source: 'template' },
    });
  });

  // ---------- offers (platform side: accept) ----------
  app.post('/offers/:id/accept', async (req, res) => {
    try {
      const o = offers.get(req.params.id) ?? _offerRegistry.get(req.params.id);
      if (!o) { res.status(404).json({ error: 'Offer not found' }); return; }
      if (o.status !== 'OPEN') { res.status(409).json({ error: 'Offer already accepted' }); return; }
      o.status = 'ACCEPTED';
      const now = clockNow();
      const agreementId = `AGR-${hex(3)}`;
      const agr = { id: agreementId, offerId: req.params.id, userId: o.userId, mandate: null, repayments: [] as object[] };
      agreements.set(agreementId, agr);
      await ledger.acceptOffer(CALLER_ORG, {
        offerId: req.params.id, agreementId, termsHash: o.termsHash,
      }, o.userId as 'ravi' | 'meena', now);
      res.json(agr);
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // ---------- agreements / mandate / repayments ----------
  app.post('/agreements/:id/mandate', async (req, res) => {
    try {
      const a = agreements.get(req.params.id);
      if (!a) { res.status(404).json({ error: 'Agreement not found' }); return; }
      const o = offers.get(a.offerId) ?? _offerRegistry.get(a.offerId);
      if (!o) { res.status(404).json({ error: 'Offer not found' }); return; }
      const p = ds.getPersonProfile(a.userId as 'ravi' | 'meena');
      const terms = o.terms as { weeklyInstalment: number };
      const now = clockNow();
      const mandateRef = `MND-${hex(3)}`;
      const mandate = { ref: mandateRef, amount: terms.weeklyInstalment, frequency: 'WEEKLY', upi: p.upi, start: now.toISOString() };
      a.mandate = mandate;
      await ledger.recordMandate(CALLER_ORG, { agreementId: req.params.id, mandateRef }, a.userId as 'ravi' | 'meena', now);
      res.json(mandate);
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.post('/agreements/:id/repayments', async (req, res) => {
    try {
      const forceFail = req.query.forceFail === 'true';
      const a = agreements.get(req.params.id);
      if (!a || !a.mandate) { res.status(400).json({ error: 'No mandate for agreement' }); return; }
      const mnd = a.mandate as { ref: string; amount: number };
      const now = clockNow();
      const cycle = (a.repayments.length) + 1;
      const repayment = {
        cycle, status: forceFail ? 'FAILED' : 'SUCCESS',
        reason: forceFail ? 'Insufficient balance (simulated)' : undefined,
        at: now.toISOString(), amount: mnd.amount,
      };
      a.repayments.push(repayment);
      await ledger.recordRepayment(CALLER_ORG, {
        agreementId: req.params.id,
        mandateRef: mnd.ref,
        cycle,
        result: forceFail ? 'FAILED' : 'SUCCESS',
        reason: repayment.reason,
      }, a.userId as 'ravi' | 'meena', now);
      res.json(repayment);
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // ---------- ledger timeline ----------
  app.get('/ledger/timeline/:consentId', async (req, res) => {
    const events = await ledger.getHistory(req.params.consentId);
    res.json(events);
  });

  // ---------- dev helpers ----------
  app.post('/dev/clock', (req, res) => {
    const { offsetDays } = req.body as { offsetDays: number };
    setClockOffset(offsetDays ?? 0);
    res.json({ offsetDays: offsetDays ?? 0 });
  });

  app.post('/dev/reset', async (_req, res) => {
    try {
      resetClock();
      ds.reset();
      ledger.clear();
      snapshots.clear();
      offers.clear();
      _offerRegistry.clear();
      agreements.clear();
      await ledger.init();
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // Expose internal stores for the verifier internal call
  return { app, snapshots, offers };
}
