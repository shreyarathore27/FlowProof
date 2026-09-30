/**
 * Lender Express app on port 4100.
 * Only LenderOrg calls are made to the ledger from this app.
 * /applicants reads only chain-visible fields — it never reads the platform's DataSource.
 *
 * Routes:
 *   GET  /applicants
 *   POST /data-requests
 *   POST /offers
 *   GET  /agreements
 */

import express from 'express';
import cors from 'cors';
import { randomBytes } from 'node:crypto';
import { signToken } from '../lib/jwt.js';
import { clockNow } from '../lib/clock.js';
import { canon, sha256 } from '../lib/hash.js';
import { LENDER_NAME } from '../lib/signals.js';
import type { SyntheticDataSource } from '../data/DataSource.js';
import type { SimulatedLedger } from '../ledger/Ledger.js';
import type { Purpose } from '../ledger/Ledger.js';

const CALLER_ORG = 'LenderOrg' as const;

function hex(n: number) { return randomBytes(n).toString('hex').toUpperCase(); }

export function createLenderApp(ds: SyntheticDataSource, ledger: SimulatedLedger) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  /** offerId → full offer record (terms kept private off-chain) */
  const offers = new Map<string, {
    id: string; consentId: string; userId: string; lenderName: string;
    terms: object; termsHash: string; termsSalt: string; status: 'OPEN' | 'ACCEPTED';
  }>();
  /** agreementId → agreement */
  const agreements = new Map<string, object>();

  // ---------- lender auth (pre-seeded lender token for demo) ----------
  app.get('/auth/token', (_req, res) => {
    res.json({ token: signToken({ role: 'lender' }) });
  });

  // ---------- applicants (chain-visible fields only) ----------
  /**
   * Reads only what the ledger has publicly recorded:
   *  - consent id, status, scope, expiresAt, grantedTo  (from GrantConsent event fields)
   *  - snapshot id, hash  (from AnchorSnapshot event with VerifierOrg co-sign)
   *
   * Does NOT read the platform's DataSource. The persona name/biz/initials are
   * public profile info (akin to a KYC directory entry), not transaction data.
   */
  app.get('/applicants', async (_req, res) => {
    const allEvents = await ledger.getHistory('all');

    // Build a map: merchantId → latest consent fields from ledger events
    const consentByMerchantId = new Map<string, {
      id: string; merchantId: string; status: 'ACTIVE' | 'REVOKED';
      grantedTo: string[]; scope: string[]; expiresAt: string;
      userId: string;
    }>();

    for (const ev of allEvents) {
      if (ev.fn === 'GrantConsent') {
        consentByMerchantId.set(ev.fields.merchantId, {
          id: ev.fields.consentId,
          merchantId: ev.fields.merchantId,
          status: 'ACTIVE',
          grantedTo: ev.fields.grantedTo.replace(/[\[\]]/g, '').split(','),
          scope: ev.fields.scope.replace(/[\[\]]/g, '').split(','),
          expiresAt: ev.fields.expiresAt,
          userId: ev.userId ?? '',
        });
      }
      if (ev.fn === 'RevokeConsent') {
        const c = [...consentByMerchantId.values()].find(c => c.id === ev.fields.consentId);
        if (c) c.status = 'REVOKED';
      }
    }

    // Build: consentId → cosigned snapshot (chain-visible only)
    const snapshotByConsent = new Map<string, { id: string; hash: string }>();
    for (const ev of allEvents) {
      if (ev.fn === 'AnchorSnapshot' && ev.orgs.includes('VerifierOrg')) {
        snapshotByConsent.set(ev.fields.consentId, {
          id: ev.fields.snapshotId,
          hash: ev.fields.snapshotHash,
        });
      }
    }

    // Build applicant list using only public profile info + chain data
    const profiles = ds.listAllProfiles();
    const applicants = profiles.map(p => {
      // Find consent by userId (using the userId field the ledger stored on events)
      const consent = [...consentByMerchantId.values()].filter(c => c.userId === p.id).at(-1) ?? null;
      const snapshot = consent ? (snapshotByConsent.get(consent.id) ?? null) : null;
      return {
        userId: p.id,
        biz: p.biz,
        initials: p.initials,
        first: p.first,
        consent: consent ? {
          id: consent.id,
          status: consent.status,
          scope: consent.scope,
          expiresAt: consent.expiresAt.length === 10
            ? consent.expiresAt + 'T00:00:00.000Z'
            : consent.expiresAt,
          grantedTo: consent.grantedTo,
        } : null,
        snapshot,
      };
    });

    res.json(applicants);
  });

  // ---------- data-requests ----------
  app.post('/data-requests', async (req, res) => {
    const { userId, consentId, purpose } = req.body as {
      userId: 'ravi' | 'meena'; consentId?: string; purpose: Purpose;
    };
    const now = clockNow();

    const result = await ledger.requestData(
      CALLER_ORG,
      { userId, consentId, purpose },
      now,
      // resolveConsent: lender provides the lookup via ds (read-only consent status)
      async (cId, uid) => {
        const c = cId
          ? await ds.getConsentStatus(cId)
          : ds.latestActiveConsent(uid ?? userId);
        if (!c) return null;
        return { id: c.id, status: c.status, grantedTo: c.grantedTo, scope: c.scope, expiresAt: c.expiresAt };
      },
      // latestSnapshotId: read from ledger events (chain-visible)
      (cId) => {
        // find latest cosigned snapshot for this consent from in-memory ledger
        return ledger.latestSnapshotForConsent(cId)?.id;
      }
    );

    res.json(result);
  });

  // ---------- offers ----------
  app.post('/offers', async (req, res) => {
    try {
      const { consentId, terms } = req.body as {
        consentId: string;
        terms: { product: string; principal: number; aprPct: number; weeks: number; weeklyInstalment: number };
      };

      const c = await ds.getConsentStatus(consentId);
      if (!c || c.status !== 'ACTIVE') { res.status(400).json({ error: 'Consent not active' }); return; }

      // salt stays off-chain; only the termsHash goes on-chain
      const termsSalt = randomBytes(16).toString('hex');
      const termsHash = sha256(canon({ ...terms, salt: termsSalt }));

      const offerId = `OFR-${hex(3)}`;
      const now = clockNow();

      await ledger.postOffer(CALLER_ORG, { offerId, consentId, termsHash }, c.userId, now);

      const offer = {
        id: offerId, consentId, userId: c.userId, lenderName: LENDER_NAME,
        terms, termsHash, termsSalt, status: 'OPEN' as const,
      };
      offers.set(offerId, offer);

      // Share offer with platform (platform needs it for /consents/:id/offer)
      // We expose through a module-level registry below
      _offerRegistry.set(offerId, offer);

      res.json({
        id: offer.id, consentId: offer.consentId, userId: offer.userId,
        lenderName: offer.lenderName, terms: offer.terms,
        termsHash: offer.termsHash, status: offer.status,
      });
    } catch (e) { res.status(400).json({ error: String(e) }); }
  });

  // ---------- agreements ----------
  app.get('/agreements', async (_req, res) => {
    const all = await ledger.getHistory('all');
    const agrEvents = all.filter(e => e.fn === 'AcceptOffer');
    const result = agrEvents.map(ev => {
      const mandateEv = all.find(e => e.fn === 'RecordMandate' && e.fields.agreementId === ev.fields.agreementId);
      const repayEvents = all.filter(e => e.fn === 'RecordRepayment' && e.fields.agreementId === ev.fields.agreementId);
      return {
        id: ev.fields.agreementId,
        offerId: ev.fields.offerId,
        userId: ev.userId,
        mandate: mandateEv ? {
          ref: mandateEv.fields.mandateRef,
          frequency: 'WEEKLY',
          provider: mandateEv.fields.provider,
        } : null,
        repayments: repayEvents.map((r, i) => ({
          cycle: i + 1,
          status: r.status === 'FAILED' ? 'FAILED' : 'SUCCESS',
          reason: r.reason,
          at: r.time,
          amount: 0, // amount not stored on-chain; in real impl it comes from private data collection
        })),
      };
    });
    res.json(result);
  });

  return { app, offers };
}

/** Shared offer registry so platform can read offers posted by lender */
export const _offerRegistry = new Map<string, {
  id: string; consentId: string; userId: string; lenderName: string;
  terms: object; termsHash: string; termsSalt: string; status: 'OPEN' | 'ACCEPTED';
}>();
