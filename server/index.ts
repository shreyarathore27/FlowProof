/**
 * FlowProof Server Bootstrap
 *
 * Runs Platform, Lender, and Verifier services
 * through one Express server for deployment.
 */

import express from 'express';

import { SyntheticDataSource } from './data/DataSource.js';
import { SimulatedLedger } from './ledger/Ledger.js';
import { initVerifierInternal } from './verifier/verifierInternal.js';
import { createPlatformApp } from './platform/platformApp.js';
import { createLenderApp } from './lender/lenderApp.js';
import { createVerifierApp } from './verifier/verifierApp.js';

const PORT = Number(process.env.PORT ?? 4000);

async function main() {
  console.log('--- Initializing FlowProof Backend ---');

  const ds = new SyntheticDataSource();
  const ledger = new SimulatedLedger();

  await ledger.init();

  initVerifierInternal(ds, ledger);

  const { app: platformApp } = createPlatformApp(ds, ledger);
  const { app: lenderApp } = createLenderApp(ds, ledger);
  const verifierApp = createVerifierApp();

  const app = express();

  app.get('/', (_req, res) => {
    res.json({
      message: 'FlowProof backend is running',
    });
  });

  app.use('/platform', platformApp);
  app.use('/lender', lenderApp);
  app.use('/verifier', verifierApp);

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`FlowProof backend listening on port ${PORT}`);
    console.log(`Platform: /platform`);
    console.log(`Lender: /lender`);
    console.log(`Verifier: /verifier`);
  });

  const shutdown = () => {
    console.log('\nShutting down FlowProof server...');
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start FlowProof backend:', err);
  process.exit(1);
});
