/**
 * FlowProof Server Bootstrap
 *
 * Runs three distinct services in one Node process with separate listeners:
 *   - Platform Service on port 4000 (calls ledger as PlatformOrg)
 *   - Lender Service on port 4100 (calls ledger as LenderOrg)
 *   - Verifier Service on port 4200 (calls ledger as VerifierOrg)
 *
 * All three interact through the shared SimulatedLedger and DataSource abstractions.
 */

import { SyntheticDataSource } from './data/DataSource.js';
import { SimulatedLedger } from './ledger/Ledger.js';
import { initVerifierInternal } from './verifier/verifierInternal.js';
import { createPlatformApp } from './platform/platformApp.js';
import { createLenderApp } from './lender/lenderApp.js';
import { createVerifierApp } from './verifier/verifierApp.js';

const PLATFORM_PORT = Number(process.env.PORT_PLATFORM ?? 4000);
const LENDER_PORT = Number(process.env.PORT_LENDER ?? 4100);
const VERIFIER_PORT = Number(process.env.PORT_VERIFIER ?? 4200);

async function main() {
  console.log('--- Initializing FlowProof Backend ---');

  // Shared DataSource & Ledger
  const ds = new SyntheticDataSource();
  const ledger = new SimulatedLedger();
  await ledger.init();

  // Initialize Verifier internal engine
  initVerifierInternal(ds, ledger);

  // Initialize services
  const { app: platformApp } = createPlatformApp(ds, ledger);
  const { app: lenderApp } = createLenderApp(ds, ledger);
  const verifierApp = createVerifierApp();

  const pServer = platformApp.listen(PLATFORM_PORT, () => {
    console.log(`[PlatformOrg] Service listening on http://localhost:${PLATFORM_PORT}`);
  });

  const lServer = lenderApp.listen(LENDER_PORT, () => {
    console.log(`[LenderOrg]   Service listening on http://localhost:${LENDER_PORT}`);
  });

  const vServer = verifierApp.listen(VERIFIER_PORT, () => {
    console.log(`[VerifierOrg] Service listening on http://localhost:${VERIFIER_PORT}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down FlowProof servers...');
    pServer.close();
    lServer.close();
    vServer.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start FlowProof backend:', err);
  process.exit(1);
});
