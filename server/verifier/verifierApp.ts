/**
 * Verifier Express app on port 4200.
 * Only VerifierOrg calls are made to the ledger from this app.
 *
 * Route:
 *   POST /cosign  { snapshotId, consentId, hash, salt }
 *     → 200 { valid: true, snapshotId, verifierHash }
 *     → 422 { error: '...' }  on hash mismatch
 */

import express from 'express';
import cors from 'cors';
import { verifierApp } from './verifierInternal.js';

export function createVerifierApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post('/cosign', async (req, res) => {
    const { snapshotId, consentId, hash, salt } = req.body as {
      snapshotId: string; consentId: string; hash: string; salt: string;
    };
    if (!snapshotId || !consentId || !hash || !salt) {
      res.status(400).json({ error: 'snapshotId, consentId, hash, and salt are required' });
      return;
    }
    try {
      const result = await verifierApp.cosign({ snapshotId, consentId, hash, salt });
      res.json(result);
    } catch (e: unknown) {
      const code = (e as { statusCode?: number }).statusCode === 422 ? 422 : 500;
      res.status(code).json({ error: String(e) });
    }
  });

  return app;
}
