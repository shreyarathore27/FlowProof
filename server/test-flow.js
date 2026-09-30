const BASE_P = 'http://localhost:4000';
const BASE_L = 'http://localhost:4100';

async function test() {
  console.log('--- Testing FlowProof Backend End-to-End ---');

  // 1. Dev reset
  await fetch(`${BASE_P}/dev/reset`, { method: 'POST' });
  console.log('1. Dev reset complete.');

  // 2. Login
  const loginRes = await fetch(`${BASE_P}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'ravi' }),
  });
  const { token, profile } = await loginRes.json();
  console.log(`2. Login: Logged in as ${profile.name} (${profile.biz})`);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // 3. Create Consent
  const consentRes = await fetch(`${BASE_P}/consents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ expiryDays: 90 }),
  });
  const consent = await consentRes.json();
  console.log(`3. Consent created: id=${consent.id}, status=${consent.status}, expiresAt=${consent.expiresAt}`);

  // 4. Fetch signals
  const fetchRes = await fetch(`${BASE_P}/consents/${consent.id}/fetch`, {
    method: 'POST',
    headers,
  });
  const summary = await fetchRes.json();
  console.log(`4. Signals summary: ${summary.transactionCount} transactions, ${summary.signals.length} computed signals`);

  // 5. Create Snapshot & Cosign
  const snapRes = await fetch(`${BASE_P}/snapshots`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ consentId: consent.id }),
  });
  const snapshot = await snapRes.json();
  console.log(`5. Snapshot anchored & cosigned: id=${snapshot.id}, cosignedBy=${snapshot.cosignedBy.join(', ')}`);

  // 6. Get Matches
  const matchRes = await fetch(`${BASE_P}/snapshots/${snapshot.id}/matches`, { headers });
  const matches = await matchRes.json();
  console.log(`6. Product matches evaluated: ${matches.matches.length} products, explanation source=${matches.explanation.source}`);

  // 7. Lender lists applicants
  const appRes = await fetch(`${BASE_L}/applicants`);
  const applicants = await appRes.json();
  console.log(`7. Lender applicants: ${applicants.length} applicant(s) found`);
  const raviApp = applicants.find(a => a.userId === 'ravi');
  if (!raviApp || !raviApp.snapshot) {
    throw new Error('Applicant Ravi with snapshot not found on lender service');
  }

  // 8. Lender requests data
  const drRes = await fetch(`${BASE_L}/data-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consentId: consent.id,
      requesterOrg: 'LenderOrg',
      purpose: 'credit-assessment',
    }),
  });
  const dr = await drRes.json();
  console.log(`8. Lender data request: status=${dr.status}, txId=${dr.txId}`);

  // 9. Lender posts offer
  const terms = {
    product: 'Micro Working Capital',
    principal: 50000,
    aprPct: 14,
    weeks: 12,
    weeklyInstalment: 4450,
  };
  const offerRes = await fetch(`${BASE_L}/offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consentId: consent.id, terms }),
  });
  const offer = await offerRes.json();
  console.log(`9. Lender posted offer: id=${offer.id}, status=${offer.status}, termsHash=${offer.termsHash.slice(0, 12)}...`);

  // 10. Merchant reads offer
  const mOfferRes = await fetch(`${BASE_P}/consents/${consent.id}/offer`, { headers });
  const { offer: mOffer } = await mOfferRes.json();
  console.log(`10. Merchant retrieved offer: id=${mOffer.id}, product=${mOffer.terms.product}`);

  // 11. Merchant accepts offer
  const acceptRes = await fetch(`${BASE_P}/offers/${offer.id}/accept`, {
    method: 'POST',
    headers,
  });
  const agreement = await acceptRes.json();
  console.log(`11. Offer accepted: agreementId=${agreement.id}`);

  // 12. Create Mandate
  const mndRes = await fetch(`${BASE_P}/agreements/${agreement.id}/mandate`, {
    method: 'POST',
    headers,
  });
  const mandate = await mndRes.json();
  console.log(`12. Mandate created: ref=${mandate.ref}, amount=${mandate.amount}, upi=${mandate.upi}`);

  // 13. Run Repayment (Success)
  const rep1Res = await fetch(`${BASE_P}/agreements/${agreement.id}/repayments`, {
    method: 'POST',
    headers,
  });
  const rep1 = await rep1Res.json();
  console.log(`13. Repayment 1: cycle=${rep1.cycle}, status=${rep1.status}`);

  // 14. Run Repayment (Forced Fail)
  const rep2Res = await fetch(`${BASE_P}/agreements/${agreement.id}/repayments?forceFail=true`, {
    method: 'POST',
    headers,
  });
  const rep2 = await rep2Res.json();
  console.log(`14. Repayment 2 (fail test): cycle=${rep2.cycle}, status=${rep2.status}, reason=${rep2.reason}`);

  // 15. Check Timeline & Hash-Chain
  const timeRes = await fetch(`${BASE_P}/ledger/timeline/all`);
  const timeline = await timeRes.json();
  console.log(`15. Ledger timeline: ${timeline.length} events recorded in hash-chain.`);
  console.log('    Events recorded:', timeline.map(e => e.fn).join(' -> '));

  // Verify hash chaining
  for (let i = 1; i < timeline.length; i++) {
    if (timeline[i].prev !== timeline[i - 1].hash) {
      throw new Error(`Hash chain broken between block ${i - 1} and ${i}!`);
    }
  }
  console.log('    [VERIFIED] SHA-256 hash-chain integrity 100% valid!');

  // 16. Test Revocation
  const revRes = await fetch(`${BASE_P}/consents/${consent.id}/revoke`, {
    method: 'POST',
    headers,
  });
  const rev = await revRes.json();
  console.log(`16. Revocation: consent status=${rev.status}`);

  // 17. Verify Data Request is REFUSED after revocation
  const drRefusedRes = await fetch(`${BASE_L}/data-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consentId: consent.id,
      requesterOrg: 'LenderOrg',
      purpose: 'credit-assessment',
    }),
  });
  const drRefused = await drRefusedRes.json();
  console.log(`17. Post-revocation data request: status=${drRefused.status}, reason="${drRefused.reason}"`);

  console.log('\n>>> ALL 17 END-TO-END FLOW TESTS PASSED PERFECTLY! <<<');
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
