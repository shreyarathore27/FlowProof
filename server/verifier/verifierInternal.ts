/**
 * Verifier internal module.
 * Provides cosign() called in-process by the platform snapshot route.
 * The verifier fetches transactions ITSELF through the DataSource, recomputes
 * signals and hash, and only cosigns if they match. It does not trust
 * any signals sent by the platform.
 *
 * When the backend is split into separate processes, this becomes an HTTP
 * call from the platform to http://localhost:4200/cosign.
 */

import { clockNow } from '../lib/clock.js';
import { computeSnapshotHash } from '../lib/signals.js';
import type { SyntheticDataSource } from '../data/DataSource.js';
import type { SimulatedLedger } from '../ledger/Ledger.js';

const CALLER_ORG = 'VerifierOrg' as const;

let _ds: SyntheticDataSource;
let _ledger: SimulatedLedger;

export function initVerifierInternal(ds: SyntheticDataSource, ledger: SimulatedLedger) {
  _ds = ds;
  _ledger = ledger;
}

export const verifierApp = {
  /**
   * Platform calls this after anchoring. Verifier fetches transactions itself,
   * recomputes the hash using the salt the platform provides, and cosigns on match.
   * Throws with a 422-style message on any mismatch.
   */
  async cosign({
    snapshotId, consentId, hash: platformHash, salt,
  }: { snapshotId: string; consentId: string; hash: string; salt: string }) {
    // Verifier independently fetches raw signals — does NOT use signals from the platform
    const { signals } = await _ds.fetchTransactions(consentId);
    const verifierHash = computeSnapshotHash(consentId, signals, salt);

    if (verifierHash !== platformHash) {
      throw Object.assign(
        new Error(`VerifierOrg: hash mismatch — platform sent ${platformHash.slice(0, 8)}… verifier computed ${verifierHash.slice(0, 8)}…`),
        { statusCode: 422 }
      );
    }

    const now = clockNow();
    await _ledger.cosignSnapshot(CALLER_ORG, { snapshotId, snapshotHash: verifierHash }, now);
    return { valid: true, snapshotId, verifierHash };
  },
};
